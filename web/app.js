const API = "/api";

let activeTab = "override-script";
let eventSource = null;
let scheduleHistoryRows = [];
let bulkImportTarget = null;
let activeSection = "dashboard";
let currentSubscriptionSets = { set1: [], set2: [] };
let providerRows = [];

// 节点切换相关状态
let proxyGroups = [];
let activeGroupIndex = 0;
let activeGroupName = "";
let autoSelectGroupDone = false;
let nodeLatencies = new Map(); // 节点延迟缓存
let nodeProviderMap = new Map(); // 节点 -> provider 名称
let currentNodes = []; // 当前显示的节点列表
let isLatencyTesting = false; // 防止重复触发批量延迟测试
const LATENCY_TEST_CONCURRENCY = 20; // 节点延迟测试并发数
const SYSTEM_NODE_NAMES = new Set(["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"]);
const BUILTIN_PROVIDER_NAMES = new Set(["free-auto", "us-auto", "proxy", "google", "default"]);

const SECTION_TITLES = {
  dashboard: "仪表盘",
  proxy: "代理",
  config: "配置",
  logs: "日志",
  connections: "连接",
  settings: "设置",
};

function setActiveSection(section) {
  if (!SECTION_TITLES[section]) return;
  activeSection = section;

  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === section);
  });

  const headerTitle = document.querySelector(".header h1");
  if (headerTitle) {
    headerTitle.textContent = SECTION_TITLES[section];
  }

  document.querySelectorAll(".content-grid .card[data-page]").forEach((card) => {
    card.classList.toggle("is-hidden", card.dataset.page !== section);
  });
}

function bindSidebarNav() {
  const navItems = Array.from(document.querySelectorAll(".nav-item[data-section]"));
  navItems.forEach((item) => {
    item.onclick = () => {
      setActiveSection(item.dataset.section || "dashboard");
    };
  });

  const defaultSection = navItems.find((item) => item.classList.contains("active"))?.dataset.section;
  setActiveSection(defaultSection || "dashboard");
}

function normalizeProviderName(raw, fallback) {
  const base = String(raw || fallback || "Sub").trim();
  return base.replace(/[^A-Za-z0-9_-]/g, "_");
}

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let idx = 0;
  let current = n;
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024;
    idx += 1;
  }
  const display = current >= 100 ? current.toFixed(0) : current.toFixed(1);
  return `${display}${units[idx]}`;
}

function formatExpireTime(rawExpire) {
  const expire = Number(rawExpire);
  if (!Number.isFinite(expire) || expire <= 0) return "-";
  const dt = new Date(expire * 1000);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function formatSubscriptionInfo(info) {
  if (!info || typeof info !== "object") return "-";
  const totalRaw = Number(info.Total);
  const uploadRaw = Number(info.Upload);
  const downloadRaw = Number(info.Download);
  const remainingRaw = totalRaw - uploadRaw - downloadRaw;
  const remainText = Number.isFinite(remainingRaw) && remainingRaw > 0 ? formatBytes(remainingRaw) : "-";
  const totalText = formatBytes(totalRaw);
  const expireText = formatExpireTime(info.Expire);
  if (remainText === "-" && totalText === "-" && expireText === "-") return "-";
  return `余量 ${remainText} / 总量 ${totalText} / 到期 ${expireText}`;
}

function extractHost(urlText) {
  const raw = String(urlText || "").trim();
  if (!raw) return "-";
  try {
    const url = new URL(raw);
    return url.host || "-";
  } catch (_) {
    return "-";
  }
}

function buildProviderSourceIndex() {
  const byName = new Map();
  const orderByName = new Map();

  function addSetItems(setKey, setLabel, items, fallbackPrefix) {
    if (!Array.isArray(items)) return;
    items.forEach((item, idx) => {
      const index = idx + 1;
      const name = normalizeProviderName(item?.name, `${fallbackPrefix}_${index}`);
      const displayName = String(item?.name || `${fallbackPrefix}_${index}`);
      const url = String(item?.url || "").trim();
      const host = extractHost(url);
      byName.set(name, {
        setKey,
        setLabel,
        index,
        displayName,
        url,
        host,
      });
      const orderBase = setKey === "set1" ? 0 : 1000;
      orderByName.set(name, orderBase + index);
    });
  }

  addSetItems("set1", "付费", currentSubscriptionSets.set1 || [], "Paid");
  addSetItems("set2", "免费", currentSubscriptionSets.set2 || [], "Free");
  return { byName, orderByName };
}

function resolveProviderSource(providerName, sourceIndex) {
  const name = String(providerName || "");
  const lower = name.toLowerCase();
  const matched = sourceIndex.byName.get(name);

  if (matched) {
    return {
      source: `${matched.setLabel} #${matched.index}`,
      sourceItem: `${matched.displayName} (${matched.host})`,
      sortRank: matched.setKey === "set1" ? 10 : 20,
      sortOrder: sourceIndex.orderByName.get(name) || 9999,
      matchedSet: matched.setKey,
      matched: true,
    };
  }
  if (lower === "free-auto") {
    return {
      source: "免费聚合组",
      sourceItem: "由免费 provider 自动聚合",
      sortRank: 30,
      sortOrder: 1,
      matchedSet: "set2",
      matched: true,
    };
  }
  if (lower === "us-auto") {
    return {
      source: "付费筛选组",
      sourceItem: "由付费按美国过滤生成",
      sortRank: 31,
      sortOrder: 2,
      matchedSet: "set1",
      matched: true,
    };
  }
  if (lower === "proxy" || lower === "google") {
    return {
      source: "策略组",
      sourceItem: "override.js 组装",
      sortRank: 40,
      sortOrder: 10,
      matchedSet: "",
      matched: true,
    };
  }
  if (lower === "default") {
    return {
      source: "内置",
      sourceItem: "mihomo 默认 provider",
      sortRank: 50,
      sortOrder: 20,
      matchedSet: "",
      matched: true,
    };
  }
  return {
    source: "未匹配",
    sourceItem: "-",
    sortRank: 90,
    sortOrder: 99999,
    matchedSet: "",
    matched: false,
  };
}

function renderProviderSummaryHeader(sourceIndex = buildProviderSourceIndex()) {
  const summaryEl = document.getElementById("provider-summary");
  if (!summaryEl) return;

  const set1Count = (currentSubscriptionSets.set1 || []).length;
  const set2Count = (currentSubscriptionSets.set2 || []).length;
  const providerCount = providerRows.length;
  const totalNodes = providerRows.reduce((sum, item) => sum + Number(item.proxy_count || 0), 0);
  const set1Nodes = providerRows
    .filter((item) => sourceIndex.byName.get(String(item.name || ""))?.setKey === "set1")
    .reduce((sum, item) => sum + Number(item.proxy_count || 0), 0);
  const set2Nodes = providerRows
    .filter((item) => sourceIndex.byName.get(String(item.name || ""))?.setKey === "set2")
    .reduce((sum, item) => sum + Number(item.proxy_count || 0), 0);
  const unmatched = providerRows.filter((item) => {
    const name = String(item.name || "");
    const lower = name.toLowerCase();
    return !sourceIndex.byName.has(name) && !BUILTIN_PROVIDER_NAMES.has(lower);
  }).length;

  let text = `付费: ${set1Count} 条(${set1Nodes}节点) | 免费: ${set2Count} 条(${set2Nodes}节点) | Provider: ${providerCount} | 总节点: ${totalNodes}`;
  if (unmatched > 0) {
    text += ` | 未匹配Provider: ${unmatched}`;
  }
  if (set2Count === 0) {
    text += " | 免费为空时 Free-Auto 仅有 DIRECT";
  }
  summaryEl.textContent = text;
}

function renderProviderRows() {
  const tbody = document.getElementById("provider-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!providerRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">暂无 provider 数据</td>`;
    tbody.appendChild(tr);
    return;
  }

  const sourceIndex = buildProviderSourceIndex();
  const sortedRows = [...providerRows]
    .map((item) => ({ item, meta: resolveProviderSource(item.name, sourceIndex) }))
    .sort((a, b) => {
      if (a.meta.sortRank !== b.meta.sortRank) return a.meta.sortRank - b.meta.sortRank;
      if (a.meta.sortOrder !== b.meta.sortOrder) return a.meta.sortOrder - b.meta.sortOrder;
      return String(a.item.name || "").localeCompare(String(b.item.name || ""), "zh-CN");
    });

  sortedRows.forEach(({ item, meta }) => {
    const tr = document.createElement("tr");
    const proxyCount = Number(item.proxy_count || 0);
    const aliveCount = Number(item.alive_count || 0);
    const updateTextRaw = String(item.updated_at || "").trim();
    const updateText = updateTextRaw && !updateTextRaw.startsWith("0001-01-01") ? updateTextRaw : "-";
    const aliveRatio = proxyCount > 0 ? `${aliveCount}/${proxyCount}` : String(aliveCount);
    const subInfo = formatSubscriptionInfo(item.subscription_info);
    tr.innerHTML = `
      <td>${item.name || "-"}</td>
      <td>${meta.source}</td>
      <td>${meta.sourceItem}</td>
      <td>${proxyCount}</td>
      <td>${aliveRatio}</td>
      <td>${updateText}</td>
      <td>${subInfo}</td>
    `;
    if (meta.source === "未匹配") {
      tr.classList.add("provider-row-unmatched");
    }
    tbody.appendChild(tr);
  });

  renderProviderSummaryHeader(sourceIndex);
}

function countRealNodeOptions(group) {
  const all = Array.isArray(group?.all) ? group.all : [];
  return all.filter((name) => !SYSTEM_NODE_NAMES.has(String(name || "").toUpperCase())).length;
}

function pickBestGroupIndex(groups) {
  if (!Array.isArray(groups) || !groups.length) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  groups.forEach((group, index) => {
    const name = String(group?.name || "").toLowerCase();
    const type = String(group?.type || "").toLowerCase();
    const realCount = countRealNodeOptions(group);

    let score = realCount;
    if (name === "proxy") score += 200;
    if (name === "us-auto") score += 180;
    if (name.includes("google")) score += 120;
    if (name === "free-auto") score -= 60;
    if (name === "global" || name === "default") score -= 40;
    if (type.includes("selector")) score += 8;
    if (type.includes("urltest")) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function createSetRowElement(setKey, item = {}) {
  const tr = document.createElement("tr");

  const tdIdx = document.createElement("td");
  tdIdx.className = "idx";

  const tdName = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.dataset.field = "name";
  nameInput.placeholder = "名称";
  nameInput.value = String(item.name || "");
  tdName.appendChild(nameInput);

  const tdUrl = document.createElement("td");
  const urlInput = document.createElement("input");
  urlInput.dataset.field = "url";
  urlInput.placeholder = "https://...";
  urlInput.value = String(item.url || "");
  tdUrl.appendChild(urlInput);

  const tdOp = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.dataset.action = "delete";
  delBtn.textContent = "删除";
  delBtn.onclick = () => {
    tr.remove();
    renumberSetTable(setKey);
  };
  tdOp.appendChild(delBtn);

  tr.appendChild(tdIdx);
  tr.appendChild(tdName);
  tr.appendChild(tdUrl);
  tr.appendChild(tdOp);
  return tr;
}

function renumberSetTable(setKey) {
  const tbody = document.getElementById(`${setKey}-table`);
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.forEach((row, idx) => {
    const idxCell = row.querySelector(".idx");
    if (idxCell) idxCell.textContent = String(idx + 1);
  });
}

function addSetRow(setKey, item = {}) {
  const tbody = document.getElementById(`${setKey}-table`);
  tbody.appendChild(createSetRowElement(setKey, item));
  renumberSetTable(setKey);
}

function collectSetRows(setKey, fallbackPrefix) {
  const tbody = document.getElementById(`${setKey}-table`);
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const result = [];
  let counter = 1;
  rows.forEach((row) => {
    const nameInput = row.querySelector('input[data-field="name"]');
    const urlInput = row.querySelector('input[data-field="url"]');
    const rawUrl = String(urlInput?.value || "").trim();
    if (!rawUrl) return;
    const rawName = String(nameInput?.value || "").trim();
    result.push({
      name: rawName || `${fallbackPrefix}${counter}`,
      url: rawUrl,
    });
    counter += 1;
  });
  return result;
}

function parseBulkSetRows(text, fallbackPrefix) {
  const lines = String(text || "").split(/\r?\n/);
  const items = [];
  let skipped = 0;
  let autoNameIdx = 1;

  lines.forEach((line) => {
    const raw = String(line || "").trim();
    if (!raw) return;

    let name = "";
    let url = "";
    if (/^https?:\/\//i.test(raw)) {
      url = raw;
    } else {
      const separatorMatch = raw.match(/[,\t，]/);
      if (!separatorMatch || separatorMatch.index === undefined) {
        skipped += 1;
        return;
      }
      const pos = separatorMatch.index;
      name = raw.slice(0, pos).trim();
      url = raw.slice(pos + 1).trim();
    }

    name = name.replace(/^['"]+|['"]+$/g, "").trim();
    url = url.replace(/^['"]+|['"]+$/g, "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      skipped += 1;
      return;
    }

    if (!name) {
      name = `${fallbackPrefix}${autoNameIdx}`;
      autoNameIdx += 1;
    }
    items.push({ name, url });
  });

  return { items, skipped };
}

function closeBulkImportModal() {
  const modal = document.getElementById("bulk-import-modal");
  const textEl = document.getElementById("bulk-import-text");
  if (!modal || !textEl) return;
  modal.classList.add("hidden");
  textEl.value = "";
  bulkImportTarget = null;
}

function applyBulkImportRows() {
  if (!bulkImportTarget) return;
  const textEl = document.getElementById("bulk-import-text");
  const parsed = parseBulkSetRows(textEl?.value || "", bulkImportTarget.fallbackPrefix);
  if (!parsed.items.length) {
    showToast("未识别到可导入数据");
    return;
  }

  parsed.items.forEach((item) => addSetRow(bulkImportTarget.setKey, item));
  closeBulkImportModal();
  if (parsed.skipped > 0) {
    showToast(`已导入 ${parsed.items.length} 行，跳过 ${parsed.skipped} 行`);
    return;
  }
  showToast(`已导入 ${parsed.items.length} 行`);
}

function importSetRows(setKey, fallbackPrefix, title) {
  const modal = document.getElementById("bulk-import-modal");
  const titleEl = document.getElementById("bulk-import-title");
  const textEl = document.getElementById("bulk-import-text");
  if (!modal || !titleEl || !textEl) return;

  bulkImportTarget = { setKey, fallbackPrefix };
  titleEl.textContent = `${title} 批量导入`;
  textEl.value = "";
  modal.classList.remove("hidden");
  textEl.focus();
}

function getToken() {
  return localStorage.getItem("admin_token") || "";
}

function setToken(token) {
  if (token) {
    localStorage.setItem("admin_token", token);
  } else {
    localStorage.removeItem("admin_token");
  }
}

function showToast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function appendLog(text) {
  const logs = document.getElementById("logs");
  logs.textContent += `${text}\n`;
  logs.scrollTop = logs.scrollHeight;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const cfg = {
    method: options.method || "GET",
    headers,
  };
  if (options.body !== undefined) {
    cfg.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  const resp = await fetch(`${API}${path}`, cfg);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    const message = data.error || `HTTP ${resp.status}`;
    throw new Error(message);
  }
  return data;
}

async function refreshStatus() {
  try {
    const status = await api("/clash/status");
    const badge = document.getElementById("clash-status");
    const version = document.getElementById("clash-version");
    if (status.running) {
      badge.textContent = "运行中";
      badge.className = "badge ok";
      version.textContent = `v${status.version || "unknown"} / ${status.mode || "unknown"}`;
    } else {
      badge.textContent = "离线";
      badge.className = "badge bad";
      version.textContent = "clash 不可达";
    }
  } catch (err) {
    const badge = document.getElementById("clash-status");
    badge.textContent = "错误";
    badge.className = "badge bad";
  }
}

async function loadSchedule() {
  try {
    const res = await api("/schedule");
    const data = res.data || {};
    document.getElementById("schedule-enabled").checked = !!data.enabled;
    document.getElementById("schedule-interval").value = data.interval_minutes || 60;
    const info = document.getElementById("schedule-info");
    info.textContent = `计划状态: ${data.enabled ? "启用" : "关闭"} | 下次: ${data.next_run || "-"} | 上次: ${data.last_run || "-"} | 状态: ${data.last_status || "-"}`;
  } catch (err) {
    showToast(`读取计划失败: ${err.message}`);
  }
}

function shouldKeepScheduleHistoryRow(item) {
  const onlyScheduler = !!document.getElementById("history-only-scheduler")?.checked;
  const onlyFailed = !!document.getElementById("history-only-failed")?.checked;
  const trigger = String(item.trigger || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();

  if (onlyScheduler && trigger !== "scheduler") return false;
  if (onlyFailed && status !== "failed" && status !== "skipped_busy") return false;
  return true;
}

function updateScheduleHistoryCount(filteredCount, totalCount) {
  const countEl = document.getElementById("schedule-history-count");
  if (!countEl) return;
  countEl.textContent = `显示 ${filteredCount} / ${totalCount}`;
}

function renderScheduleHistory() {
  const tbody = document.getElementById("schedule-history-table");
  const filteredRows = scheduleHistoryRows.filter((item) => shouldKeepScheduleHistoryRow(item));
  updateScheduleHistoryCount(filteredRows.length, scheduleHistoryRows.length);
  tbody.innerHTML = "";
  if (!scheduleHistoryRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="muted">暂无执行历史</td>`;
    tbody.appendChild(tr);
    return;
  }
  if (!filteredRows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="muted">当前筛选条件下暂无记录</td>`;
    tbody.appendChild(tr);
    return;
  }
  filteredRows.forEach((item) => {
    const tr = document.createElement("tr");
    const status = String(item.status || "-");
    tr.innerHTML = `
      <td>${item.started_at || "-"}</td>
      <td>${item.ended_at || "-"}</td>
      <td>${item.trigger || "-"}</td>
      <td>${item.action || "-"}</td>
      <td><span class="status-pill ${status}">${status}</span></td>
      <td>${item.message || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadScheduleHistory() {
  try {
    const res = await api("/schedule/history");
    scheduleHistoryRows = Array.isArray(res.data) ? res.data : [];
    renderScheduleHistory();
  } catch (err) {
    showToast(`读取历史失败: ${err.message}`);
  }
}

async function clearScheduleHistory() {
  if (!confirm("确认清空执行历史?")) return;
  try {
    await api("/schedule/history", { method: "DELETE" });
    scheduleHistoryRows = [];
    renderScheduleHistory();
    showToast("历史已清空");
  } catch (err) {
    showToast(`清空失败: ${err.message}`);
  }
}

async function saveSchedule() {
  const enabled = document.getElementById("schedule-enabled").checked;
  const intervalValue = Number(document.getElementById("schedule-interval").value || 60);
  try {
    await api("/schedule", {
      method: "PUT",
      body: { enabled, interval_minutes: intervalValue },
    });
    showToast("计划已保存");
    await loadSchedule();
  } catch (err) {
    showToast(`保存计划失败: ${err.message}`);
  }
}

async function loadSubscriptionSets() {
  try {
    const res = await api("/subscription-sets");
    const data = res.data || {};
    currentSubscriptionSets = {
      set1: Array.isArray(data.set1) ? data.set1 : [],
      set2: Array.isArray(data.set2) ? data.set2 : [],
    };
    const set1Tbody = document.getElementById("set1-table");
    const set2Tbody = document.getElementById("set2-table");
    set1Tbody.innerHTML = "";
    set2Tbody.innerHTML = "";
    currentSubscriptionSets.set1.forEach((item) => addSetRow("set1", item));
    currentSubscriptionSets.set2.forEach((item) => addSetRow("set2", item));
    if (!set1Tbody.querySelector("tr")) addSetRow("set1", {});
    if (!set2Tbody.querySelector("tr")) addSetRow("set2", {});
    renderProviderSummaryHeader();
    renderProviderRows();
  } catch (err) {
    showToast(`读取集合失败: ${err.message}`);
  }
}

async function loadProviderStatus() {
  try {
    const res = await api("/clash/providers");
    providerRows = Array.isArray(res.data) ? res.data : [];
    renderProviderSummaryHeader();
    renderProviderRows();
  } catch (err) {
    providerRows = [];
    renderProviderSummaryHeader();
    renderProviderRows();
    showToast(`读取 Provider 失败: ${err.message}`);
  }
}

async function saveSubscriptionSets() {
  const payload = {
    set1: collectSetRows("set1", "Paid"),
    set2: collectSetRows("set2", "Free"),
  };
  try {
    await api("/subscription-sets", { method: "PUT", body: payload });
    showToast("订阅集合已保存，override.js 头部已更新");
    if (activeTab === "override-script") {
      await loadEditor();
    }
    await loadSubscriptionSets();
    await loadProviderStatus();
  } catch (err) {
    showToast(`保存集合失败: ${err.message}`);
  }
}

function renderSubRow(item) {
  const tr = document.createElement("tr");
  const status = item.enabled ? "启用" : "禁用";
  tr.innerHTML = `
    <td>${item.name || ""}</td>
    <td>${status}</td>
    <td>${item.node_count || 0}</td>
    <td>${item.cached_time || "-"}</td>
    <td class="row wrap">
      <button data-action="edit">编辑</button>
      <button data-action="toggle">切换</button>
      <button data-action="test">测试</button>
      <button data-action="delete">删除</button>
    </td>
  `;
  tr.querySelector('[data-action="edit"]').onclick = () => fillSubForm(item);
  tr.querySelector('[data-action="toggle"]').onclick = () => toggleSub(item.name);
  tr.querySelector('[data-action="test"]').onclick = () => testSub(item.name);
  tr.querySelector('[data-action="delete"]').onclick = () => deleteSub(item.name);
  return tr;
}

async function loadSubscriptions() {
  const tbody = document.getElementById("sub-table");
  tbody.innerHTML = "";
  try {
    const res = await api("/subscriptions");
    const list = res.data || [];
    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">暂无订阅</td>`;
      tbody.appendChild(tr);
      return;
    }
    list.forEach((item) => tbody.appendChild(renderSubRow(item)));
  } catch (err) {
    showToast(`加载订阅失败: ${err.message}`);
  }
}

function resetSubForm() {
  document.getElementById("sub-original-name").value = "";
  document.getElementById("sub-name").value = "";
  document.getElementById("sub-url").value = "";
  document.getElementById("sub-prefix").value = "";
  document.getElementById("sub-include").value = "";
  document.getElementById("sub-exclude").value = "";
  document.getElementById("sub-enabled").checked = true;
}

function fillSubForm(item) {
  document.getElementById("sub-original-name").value = item.name || "";
  document.getElementById("sub-name").value = item.name || "";
  document.getElementById("sub-url").value = item.url || "";
  document.getElementById("sub-prefix").value = item.prefix || "";
  document.getElementById("sub-include").value = item.include_filter || "";
  document.getElementById("sub-exclude").value = item.exclude_filter || "";
  document.getElementById("sub-enabled").checked = !!item.enabled;
}

async function saveSubscription(evt) {
  evt.preventDefault();
  const originalName = document.getElementById("sub-original-name").value.trim();
  const name = document.getElementById("sub-name").value.trim();
  const url = document.getElementById("sub-url").value.trim();
  const prefix = document.getElementById("sub-prefix").value.trim();
  const includeFilter = document.getElementById("sub-include").value.trim();
  const excludeFilter = document.getElementById("sub-exclude").value.trim();
  const enabled = document.getElementById("sub-enabled").checked;

  if (!name || !url) {
    showToast("名称和订阅地址不能为空");
    return;
  }

  const body = {
    name,
    url,
    prefix,
    include_filter: includeFilter,
    exclude_filter: excludeFilter,
    enabled,
  };

  try {
    if (!originalName) {
      await api("/subscriptions", { method: "POST", body });
      showToast("订阅已添加");
    } else {
      await api(`/subscriptions/${encodeURIComponent(originalName)}`, {
        method: "PUT",
        body: { ...body, new_name: name },
      });
      showToast("订阅已更新");
    }
    resetSubForm();
    await loadSubscriptions();
  } catch (err) {
    showToast(`保存失败: ${err.message}`);
  }
}

async function toggleSub(name) {
  try {
    const res = await api(`/subscriptions/${encodeURIComponent(name)}/toggle`, { method: "POST" });
    showToast(`${name} -> ${res.enabled ? "启用" : "禁用"}`);
    await loadSubscriptions();
  } catch (err) {
    showToast(`切换失败: ${err.message}`);
  }
}

async function testSub(name) {
  try {
    const res = await api(`/subscriptions/${encodeURIComponent(name)}/test`, { method: "POST" });
    showToast(`${name} 可用节点: ${res.node_count || 0}`);
  } catch (err) {
    showToast(`测试失败: ${err.message}`);
  }
}

async function deleteSub(name) {
  if (!confirm(`确认删除订阅 ${name} ?`)) return;
  try {
    await api(`/subscriptions/${encodeURIComponent(name)}`, { method: "DELETE" });
    showToast("已删除");
    await loadSubscriptions();
  } catch (err) {
    showToast(`删除失败: ${err.message}`);
  }
}

async function testProxyDelay(name, options = {}) {
  const body = { name };
  if (options.url) body.url = options.url;
  if (options.timeout !== undefined) body.timeout = options.timeout;
  try {
    return await api("/clash/proxies/delay", { method: "POST", body });
  } catch (err) {
    const message = String(err?.message || err || "");
    // Backward compatibility: old backend may still expose GET-only delay endpoint.
    if (!message.includes("405")) {
      throw err;
    }
    const params = new URLSearchParams({ name });
    if (options.url) params.set("url", options.url);
    if (options.timeout !== undefined) params.set("timeout", String(options.timeout));
    return api(`/clash/proxies/delay?${params.toString()}`);
  }
}

// ==================== 节点切换新功能 ====================

// 国家/地区旗帜映射
const FLAG_MAP = {
  '美国': '🇺🇸', 'US': '🇺🇸', 'United States': '🇺🇸', 'America': '🇺🇸',
  '香港': '🇭🇰', 'HK': '🇭🇰', 'Hong Kong': '🇭🇰',
  '日本': '🇯🇵', 'JP': '🇯🇵', 'Japan': '🇯🇵',
  '新加坡': '🇸🇬', 'SG': '🇸🇬', 'Singapore': '🇸🇬',
  '台湾': '🇹🇼', 'TW': '🇹🇼', 'Taiwan': '🇹🇼',
  '韩国': '🇰🇷', 'KR': '🇰🇷', 'Korea': '🇰🇷', 'South Korea': '🇰🇷',
  '英国': '🇬🇧', 'UK': '🇬🇧', 'Britain': '🇬🇧', 'United Kingdom': '🇬🇧',
  '德国': '🇩🇪', 'DE': '🇩🇪', 'Germany': '🇩🇪',
  '法国': '🇫🇷', 'FR': '🇫🇷', 'France': '🇫🇷',
  '荷兰': '🇳🇱', 'NL': '🇳🇱', 'Netherlands': '🇳🇱',
  '加拿大': '🇨🇦', 'CA': '🇨🇦', 'Canada': '🇨🇦',
  '澳大利亚': '🇦🇺', 'AU': '🇦🇺', 'Australia': '🇦🇺',
  '印度': '🇮🇳', 'IN': '🇮🇳', 'India': '🇮🇳',
  '巴西': '🇧🇷', 'BR': '🇧🇷', 'Brazil': '🇧🇷',
  '俄罗斯': '🇷🇺', 'RU': '🇷🇺', 'Russia': '🇷🇺',
  '土耳其': '🇹🇷', 'TR': '🇹🇷', 'Turkey': '🇹🇷',
  '越南': '🇻🇳', 'VN': '🇻🇳', 'Vietnam': '🇻🇳',
  '泰国': '🇹🇭', 'TH': '🇹🇭', 'Thailand': '🇹🇭',
  '马来西亚': '🇲🇾', 'MY': '🇲🇾', 'Malaysia': '🇲🇾',
  '印度尼西亚': '🇮🇩', 'ID': '🇮🇩', 'Indonesia': '🇮🇩',
  '菲律宾': '🇵🇭', 'PH': '🇵🇭', 'Philippines': '🇵🇭',
  '乌克兰': '🇺🇦', 'UA': '🇺🇦', 'Ukraine': '🇺🇦',
  '波兰': '🇵🇱', 'PL': '🇵🇱', 'Poland': '🇵🇱',
  '瑞典': '🇸🇪', 'SE': '🇸🇪', 'Sweden': '🇸🇪',
  '瑞士': '🇨🇭', 'CH': '🇨🇭', 'Switzerland': '🇨🇭',
  '西班牙': '🇪🇸', 'ES': '🇪🇸', 'Spain': '🇪🇸',
  '意大利': '🇮🇹', 'IT': '🇮🇹', 'Italy': '🇮🇹',
  '墨西哥': '🇲🇽', 'MX': '🇲🇽', 'Mexico': '🇲🇽',
  '阿根廷': '🇦🇷', 'AR': '🇦🇷', 'Argentina': '🇦🇷',
  '南非': '🇿🇦', 'ZA': '🇿🇦', 'South Africa': '🇿🇦',
  '埃及': '🇪🇬', 'EG': '🇪🇬', 'Egypt': '🇪🇬',
  '新西兰': '🇳🇿', 'NZ': '🇳🇿', 'New Zealand': '🇳🇿',
  '以色列': '🇮🇱', 'IL': '🇮🇱', 'Israel': '🇮🇱',
  '阿联酋': '🇦🇪', 'AE': '🇦🇪', 'UAE': '🇦🇪', 'United Arab Emirates': '🇦🇪',
  '孟加拉': '🇧🇩', 'BD': '🇧🇩', 'Bangladesh': '🇧🇩',
  '巴基斯坦': '🇵🇰', 'PK': '🇵🇰', 'Pakistan': '🇵🇰',
  '尼日利亚': '🇳🇬', 'NG': '🇳🇬', 'Nigeria': '🇳🇬',
  '肯尼亚': '🇰🇪', 'KE': '🇰🇪', 'Kenya': '🇰🇪',
  '智利': '🇨🇱', 'CL': '🇨🇱', 'Chile': '🇨🇱',
  '哥伦比亚': '🇨🇴', 'CO': '🇨🇴', 'Colombia': '🇨🇴',
  '秘鲁': '🇵🇪', 'PE': '🇵🇪', 'Peru': '🇵🇪',
  '洛杉矶': '🇺🇸', '硅谷': '🇺🇸', '圣何塞': '🇺🇸', '西雅图': '🇺🇸',
  '达拉斯': '🇺🇸', '芝加哥': '🇺🇸', '纽约': '🇺🇸', '华盛顿': '🇺🇸',
  '美西': '🇺🇸', '美东': '🇺🇸',
};

// 代理组图标映射
const GROUP_ICONS = {
  'PROXY': '🚀',
  'Auto': '⚡',
  'AUTO': '⚡',
  'SELECT': '📍',
  'Fallback': '🔁',
  'FALLBACK': '🔁',
  'LoadBalance': '⚖️',
  'URLTest': '🔍',
};

// 获取节点旗帜
function getNodeFlag(nodeName) {
  for (const [key, flag] of Object.entries(FLAG_MAP)) {
    if (nodeName.toLowerCase().includes(key.toLowerCase())) {
      return flag;
    }
  }
  return '🌐';
}

// 获取代理组图标
function getGroupIcon(groupName) {
  for (const [key, icon] of Object.entries(GROUP_ICONS)) {
    if (groupName.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return '📡';
}

// 从节点名称解析协议类型
function getProtocolType(nodeName) {
  const protocols = ['Hysteria2', 'Vless', 'Vmess', 'Shadowsocks', 'Trojan', 'Tuic', 'Socks5', 'HTTP', 'Snell'];
  for (const protocol of protocols) {
    if (nodeName.toLowerCase().includes(protocol.toLowerCase())) {
      return protocol;
    }
  }
  return 'Proxy';
}

// 获取延迟样式类
function getLatencyClass(delay) {
  if (delay === null) return 'loading';
  if (delay === undefined) return 'unknown';
  if (delay === -1) return 'timeout';
  if (delay < 200) return 'good';
  if (delay < 500) return 'medium';
  return 'bad';
}

// 格式化延迟显示
function formatLatency(delay) {
  if (delay === null) return '测试中...';
  if (delay === undefined) return '--';
  if (delay === -1) return '超时';
  return `${delay} ms`;
}

// 渲染代理组 Tabs
function renderProxyTabs() {
  const tabsContainer = document.getElementById('proxy-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = '';

  proxyGroups.forEach((group, index) => {
    const tab = document.createElement('button');
    tab.className = `proxy-tab ${index === activeGroupIndex ? 'active' : ''}`;
    tab.innerHTML = `
      <span class="proxy-tab-icon">${getGroupIcon(group.name)}</span>
      <span>${group.name}</span>
    `;
    tab.onclick = () => {
      activeGroupIndex = index;
      activeGroupName = String(group.name || "");
      autoSelectGroupDone = true;
      renderProxyTabs();
      renderNodesGrid();
    };
    tabsContainer.appendChild(tab);
  });
}

// 渲染节点网格
function renderNodesGrid() {
  const grid = document.getElementById('nodes-grid');
  const infoBar = document.getElementById('node-info-bar');
  const infoText = document.getElementById('node-info-text');

  if (!grid) return;

  const group = proxyGroups[activeGroupIndex];
  if (!group) {
    grid.innerHTML = '<div class="muted">没有可用的代理组</div>';
    return;
  }

  grid.innerHTML = '';
  currentNodes = group.all || [];

  currentNodes.forEach((nodeName) => {
    const card = createNodeCard(nodeName, group);
    grid.appendChild(card);
  });

  // 更新信息栏
  if (infoText) {
    let text = `${group.name} · ${currentNodes.length} 个节点 · 当前选择: ${group.now || '-'}`;
    if (
      String(group.name || "").toLowerCase() === "free-auto" &&
      currentNodes.length === 1 &&
      String(currentNodes[0] || "").toUpperCase() === "DIRECT"
    ) {
      text += " · 免费为空，当前仅DIRECT";
    }
    infoText.textContent = text;
  }
}

// 创建节点卡片
function createNodeCard(nodeName, group) {
  const card = document.createElement('div');
  const isSelected = nodeName === group.now;

  card.className = `node-card ${isSelected ? 'selected' : ''}`;

  const flag = getNodeFlag(nodeName);
  const protocol = getProtocolType(nodeName);
  const latency = nodeLatencies.get(nodeName);
  const latencyClass = getLatencyClass(latency);
  const providerName = String(nodeProviderMap.get(nodeName) || "").trim() || "-";

  card.innerHTML = `
    <div class="node-header">
      <span class="node-flag">${flag}</span>
      <span class="node-type">${protocol}</span>
    </div>
    <div class="node-name-row">
      <span class="node-name node-name-right" title="${nodeName}">${nodeName}</span>
    </div>
    <div class="node-meta-row">
      <div class="node-latency ${latencyClass}" data-node="${nodeName}">
        ${formatLatency(latency)}
      </div>
      <span class="node-provider" title="Provider: ${providerName}">${providerName}</span>
    </div>
  `;

  card.onclick = async () => {
    if (isSelected) return;

    try {
      await api(`/clash/groups/${encodeURIComponent(group.name)}/select`, {
        method: 'POST',
        body: { name: nodeName },
      });
      showToast(`已切换到: ${nodeName}`);

      // 更新本地状态并重新渲染
      group.now = nodeName;
      renderNodesGrid();
    } catch (err) {
      showToast(`切换失败: ${err.message}`);
    }
  };

  return card;
}

// 测试单个节点延迟
async function testSingleNodeLatency(nodeName) {
  try {
    const res = await testProxyDelay(nodeName, { timeout: 5000 });
    const delay = Number(res.delay);
    return Number.isFinite(delay) && delay >= 0 ? delay : -1;
  } catch (err) {
    return -1;
  }
}

// 批量测试节点延迟
async function testAllNodeLatencies() {
  if (isLatencyTesting) {
    return;
  }
  const group = proxyGroups[activeGroupIndex];
  if (!group) return;

  isLatencyTesting = true;
  const testBtn = document.getElementById("btn-test-latency");
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.textContent = "测试中...";
  }

  const nodes = group.all || [];
  const infoText = document.getElementById('node-info-text');

  try {
    if (infoText) {
      infoText.textContent = `${group.name} · 正在测试延迟...`;
    }

    // 显示加载状态
    nodes.forEach(nodeName => {
      nodeLatencies.set(nodeName, null); // null 表示加载中
    });
    renderNodesGrid();

    // 并行测试所有节点（限制并发数）
    const batchSize = LATENCY_TEST_CONCURRENCY;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (nodeName) => {
          const delay = await testSingleNodeLatency(nodeName);
          nodeLatencies.set(nodeName, delay);
          updateNodeLatencyDisplay(nodeName, delay);
        })
      );
    }

    if (infoText) {
      const validLatencies = nodes
        .map(n => nodeLatencies.get(n))
        .filter(d => d !== null && d !== -1);
      const avgLatency = validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : 0;
      infoText.textContent = `${group.name} · ${nodes.length} 个节点 · 平均延迟: ${avgLatency}ms`;
    }
  } finally {
    isLatencyTesting = false;
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.textContent = "测延时";
    }
  }
}

// 更新单个节点延迟显示
function updateNodeLatencyDisplay(nodeName, delay) {
  const grid = document.getElementById('nodes-grid');
  if (!grid) return;

  const latencyEl = grid.querySelector(`.node-latency[data-node="${CSS.escape(nodeName)}"]`);
  if (latencyEl) {
    latencyEl.className = `node-latency ${getLatencyClass(delay)}`;
    latencyEl.textContent = formatLatency(delay);
  }
}

// 保留旧的 groupCard 函数以兼容其他代码（返回空元素）
function groupCard(group) {
  return document.createElement('div');
}

async function loadGroups() {
  try {
    const [groupsRes, proxyMetaRes] = await Promise.all([
      api('/clash/groups'),
      api('/clash/proxy-meta').catch(() => ({ data: {} })),
    ]);
    const proxyMetaRows =
      proxyMetaRes && proxyMetaRes.data && typeof proxyMetaRes.data === "object"
        ? proxyMetaRes.data
        : {};
    nodeProviderMap = new Map(Object.entries(proxyMetaRows));
    proxyGroups = groupsRes.data || [];

    if (!proxyGroups.length) {
      const grid = document.getElementById('nodes-grid');
      if (grid) grid.innerHTML = '<div class="muted">当前没有可用的代理组</div>';
      return;
    }

    // 优先按名称恢复用户选择；首次加载时选择更有节点价值的分组。
    const nameMatchedIndex = activeGroupName
      ? proxyGroups.findIndex((item) => String(item.name || "") === activeGroupName)
      : -1;
    if (nameMatchedIndex >= 0) {
      activeGroupIndex = nameMatchedIndex;
    } else if (!autoSelectGroupDone || activeGroupIndex >= proxyGroups.length || activeGroupIndex < 0) {
      activeGroupIndex = pickBestGroupIndex(proxyGroups);
      autoSelectGroupDone = true;
    }
    activeGroupName = String(proxyGroups[activeGroupIndex]?.name || "");

    renderProxyTabs();
    renderNodesGrid();

    // 自动测试延迟
    setTimeout(() => testAllNodeLatencies(), 500);
  } catch (err) {
    const grid = document.getElementById('nodes-grid');
    if (grid) grid.innerHTML = `<div class="muted">加载失败: ${err.message}</div>`;
  }
}

function editorPathFromTab(tabName) {
  if (tabName === "override-script") return "/override-script";
  if (tabName === "override") return "/override";
  if (tabName === "site-policy") return "/site-policy";
  return "/merge-script";
}

async function loadEditor() {
  const textarea = document.getElementById("editor");
  try {
    const res = await api(editorPathFromTab(activeTab));
    textarea.value = res.content || "";
  } catch (err) {
    textarea.value = "";
    showToast(`加载编辑器内容失败: ${err.message}`);
  }
}

async function saveEditor() {
  const textarea = document.getElementById("editor");
  const path = editorPathFromTab(activeTab);
  try {
    await api(path, { method: "PUT", body: { content: textarea.value } });
    showToast("保存成功");
  } catch (err) {
    showToast(`保存失败: ${err.message}`);
  }
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.onclick = async () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;
      await loadEditor();
    };
  });
}

async function doAction(path, tip) {
  try {
    await api(path, { method: "POST" });
    showToast(tip);
  } catch (err) {
    showToast(`${tip}失败: ${err.message}`);
  }
}

function initLogs() {
  if (eventSource) {
    eventSource.close();
  }
  eventSource = new EventSource("/api/logs/stream");
  eventSource.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      appendLog(`${data.time} [${data.level}] ${data.msg}`);
    } catch (_) {
      appendLog(evt.data);
    }
  };
  eventSource.onerror = () => {
    setTimeout(() => initLogs(), 2500);
  };
}

function initProxySettingCardToggles() {
  const toggles = Array.from(document.querySelectorAll(".proxy-settings-toggle"));
  toggles.forEach((btn) => {
    const targetId = String(btn.dataset.toggleCard || "").trim();
    const card = targetId ? document.getElementById(targetId) : btn.closest(".proxy-setting-card");
    const content = card?.querySelector(".proxy-setting-content");
    if (!card || !content) return;

    const applyState = () => {
      const collapsed = card.classList.contains("is-collapsed");
      content.hidden = collapsed;
      btn.textContent = collapsed ? "展开设置" : "收起设置";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };

    btn.onclick = () => {
      card.classList.toggle("is-collapsed");
      applyState();
    };

    applyState();
  });
}

function bindEvents() {
  document.getElementById("save-token").onclick = () => {
    const val = document.getElementById("admin-token").value.trim();
    setToken(val);
    showToast("令牌已保存");
  };
  document.getElementById("btn-merge").onclick = () => doAction("/actions/merge", "合并已启动");
  document.getElementById("btn-merge-reload").onclick = () =>
    doAction("/actions/merge-and-reload", "合并与重载已启动");
  document.getElementById("btn-reload").onclick = () => doAction("/actions/reload", "重载已发起");
  document.getElementById("btn-refresh").onclick = async () => {
    await refreshStatus();
    await loadSubscriptions();
    await loadGroups();
    await loadSubscriptionSets();
    await loadProviderStatus();
    await loadSchedule();
    await loadScheduleHistory();
  };
  document.getElementById("reload-subs").onclick = loadSubscriptions;
  document.getElementById("reload-providers").onclick = loadProviderStatus;
  document.getElementById("reload-groups").onclick = loadGroups;
  document.getElementById("btn-test-latency").onclick = () => {
    testAllNodeLatencies();
  };
  document.getElementById("btn-load-editor").onclick = loadEditor;
  document.getElementById("btn-save-editor").onclick = saveEditor;
  document.getElementById("sub-reset").onclick = resetSubForm;
  document.getElementById("sub-form").addEventListener("submit", saveSubscription);
  document.getElementById("clear-logs").onclick = () => {
    document.getElementById("logs").textContent = "";
  };
  document.getElementById("save-sub-sets").onclick = saveSubscriptionSets;
  document.getElementById("save-schedule").onclick = saveSchedule;
  document.getElementById("add-set1-row").onclick = () => addSetRow("set1", {});
  document.getElementById("add-set2-row").onclick = () => addSetRow("set2", {});
  document.getElementById("import-set1-bulk").onclick = () =>
    importSetRows("set1", "Paid", "付费");
  document.getElementById("import-set2-bulk").onclick = () =>
    importSetRows("set2", "Free", "免费");
  document.getElementById("reload-schedule-history").onclick = loadScheduleHistory;
  document.getElementById("clear-schedule-history").onclick = clearScheduleHistory;
  document.getElementById("history-only-scheduler").onchange = renderScheduleHistory;
  document.getElementById("history-only-failed").onchange = renderScheduleHistory;
  document.getElementById("bulk-import-submit").onclick = applyBulkImportRows;
  document.getElementById("bulk-import-cancel").onclick = closeBulkImportModal;
  document.getElementById("bulk-import-modal").onclick = (evt) => {
    if (evt.target === evt.currentTarget) closeBulkImportModal();
  };
  document.getElementById("bulk-import-text").addEventListener("keydown", (evt) => {
    if ((evt.ctrlKey || evt.metaKey) && evt.key === "Enter") {
      evt.preventDefault();
      applyBulkImportRows();
    }
  });
}

async function boot() {
  document.getElementById("admin-token").value = getToken();
  bindEvents();
  initProxySettingCardToggles();
  bindTabs();
  bindSidebarNav();
  initLogs();
  await refreshStatus();
  await loadSubscriptions();
  await loadSubscriptionSets();
  await loadProviderStatus();
  await loadGroups();
  await loadSchedule();
  await loadScheduleHistory();
  await loadEditor();
  setInterval(refreshStatus, 5000);
  setInterval(loadSchedule, 30000);
  setInterval(loadScheduleHistory, 30000);
}

boot();
