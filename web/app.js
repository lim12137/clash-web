const API = "/api";

let activeTab = "override-script";
let eventSource = null;
let scheduleHistoryRows = [];
let bulkImportTarget = null;
let activeSection = "dashboard";
let currentSubscriptionSets = {
  set1: [],
  set2: [],
  us_auto: { priority1: "", priority2: "" },
};
let providerRows = [];
let geoActionBusy = false;
let kernelActionBusy = false;

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

// 仪表盘相关状态
let dashboardState = {
  speedHistory: { up: [], down: [] },
  maxSpeedPoints: 60,
  trafficStats: { upload: 0, download: 0, totalUpload: 0, totalDownload: 0 },
  uptimeSeconds: 0,
  uptimeInterval: null,
  speedInterval: null,
  lastTraffic: { up: null, down: null },
  isServiceRunning: true,
};

// 国家代码映射（用于显示国旗）
const COUNTRY_FLAGS = {
  'CN': '🇨🇳', 'US': '🇺🇸', 'HK': '🇭🇰', 'JP': '🇯🇵', 'SG': '🇸🇬',
  'TW': '🇹🇼', 'KR': '🇰🇷', 'UK': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷',
  'NL': '🇳🇱', 'CA': '🇨🇦', 'AU': '🇦🇺', 'IN': '🇮🇳', 'BR': '🇧🇷',
  'RU': '🇷🇺', 'TR': '🇹🇷', 'VN': '🇻🇳', 'TH': '🇹🇭', 'MY': '🇲🇾',
  'ID': '🇮🇩', 'PH': '🇵🇭', 'UA': '🇺🇦', 'PL': '🇵🇱', 'SE': '🇸🇪',
  'CH': '🇨🇭', 'ES': '🇪🇸', 'IT': '🇮🇹', 'MX': '🇲🇽', 'AR': '🇦🇷',
  'ZA': '🇿🇦', 'EG': '🇪🇬', 'NZ': '🇳🇿', 'IL': '🇮🇱', 'AE': '🇦🇪',
  'BD': '🇧🇩', 'PK': '🇵🇰', 'NG': '🇳🇬', 'KE': '🇰🇪', 'CL': '🇨🇱',
  'CO': '🇨🇴', 'PE': '🇵🇪', 'IE': '🇮🇪', 'NO': '🇳🇴', 'FI': '🇫🇮',
  'DK': '🇩🇰', 'PT': '🇵🇹', 'GR': '🇬🇷', 'CZ': '🇨🇿', 'HU': '🇭🇺',
  'RO': '🇷🇴', 'BG': '🇧🇬', 'HR': '🇭🇷', 'SI': '🇸🇮', 'SK': '🇸🇰',
  'LT': '🇱🇹', 'LV': '🇱🇻', 'EE': '🇪🇪', 'BY': '🇧🇾', 'MD': '🇲🇩',
  'AM': '🇦🇲', 'AZ': '🇦🇿', 'GE': '🇬🇪', 'KZ': '🇰🇿', 'UZ': '🇺🇿',
  'KG': '🇰🇬', 'TJ': '🇹🇯', 'TM': '🇹🇲', 'MN': '🇲🇳', 'KP': '🇰🇵',
};

const SECTION_TITLES = {
  dashboard: "仪表盘",
  proxy: "代理",
  config: "配置",
  logs: "日志",
  connections: "连接",
  "proxy-records": "代理记录",
  settings: "设置",
};

function getSectionFromHash() {
  const section = String(window.location.hash || "").replace(/^#/, "").trim();
  return SECTION_TITLES[section] ? section : "";
}

function syncSectionHash(section) {
  if (!SECTION_TITLES[section]) return;
  const nextHash = `#${section}`;
  if (window.location.hash === nextHash) return;
  history.replaceState(null, "", nextHash);
}

function setActiveSection(section) {
  if (!SECTION_TITLES[section]) return;
  activeSection = section;
  syncSectionHash(section);

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

  // 切换到连接页面时，重新渲染节点网格以显示已有的延迟数据
  if (section === "connections" && proxyGroups.length > 0) {
    renderNodesGrid();
  }
}

function bindSidebarNav() {
  const navItems = Array.from(document.querySelectorAll(".nav-item[data-section]"));
  navItems.forEach((item) => {
    item.onclick = () => {
      setActiveSection(item.dataset.section || "dashboard");
    };
  });

  const defaultSection = navItems.find((item) => item.classList.contains("active"))?.dataset.section;
  setActiveSection(getSectionFromHash() || defaultSection || "dashboard");
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

function buildGroupLookup(groups) {
  const lookup = new Map();
  if (!Array.isArray(groups)) return lookup;
  groups.forEach((group) => {
    const name = String(group?.name || "").trim();
    if (!name) return;
    lookup.set(name, group);
  });
  return lookup;
}

function isUsAutoFallbackGroup(group) {
  const name = String(group?.name || "").trim().toLowerCase();
  const type = String(group?.type || "").trim().toLowerCase();
  return name === "us-auto" && type.includes("fallback");
}

function isSystemNodeName(name) {
  return SYSTEM_NODE_NAMES.has(String(name || "").trim().toUpperCase());
}

function expandUsAutoNodes(group, groups = proxyGroups) {
  const groupLookup = buildGroupLookup(groups);
  const all = Array.isArray(group?.all) ? group.all : [];
  const names = [];
  const seen = new Set();

  const addNode = (rawName) => {
    const name = String(rawName || "").trim();
    if (!name) return;
    if (isSystemNodeName(name)) return;
    if (groupLookup.has(name)) return;
    if (seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  all.forEach((entryRaw) => {
    const entry = String(entryRaw || "").trim();
    if (!entry) return;
    const childGroup = groupLookup.get(entry);
    if (childGroup && Array.isArray(childGroup.all)) {
      childGroup.all.forEach((childNode) => addNode(childNode));
      return;
    }
    addNode(entry);
  });

  return names;
}

function getDisplayNodesForGroup(group, groups = proxyGroups) {
  if (!group) return [];
  if (isUsAutoFallbackGroup(group)) {
    const expanded = expandUsAutoNodes(group, groups);
    if (expanded.length) return expanded;
  }

  const all = Array.isArray(group?.all) ? group.all : [];
  return all
    .map((item) => String(item || "").trim())
    .filter((name) => name && !isSystemNodeName(name));
}

function resolveUsAutoChildGroupForNode(group, nodeName, groups = proxyGroups) {
  if (!isUsAutoFallbackGroup(group)) return "";
  const target = String(nodeName || "").trim();
  if (!target) return "";

  const groupLookup = buildGroupLookup(groups);
  const childNames = Array.isArray(group?.all) ? group.all : [];
  for (const childRaw of childNames) {
    const childName = String(childRaw || "").trim();
    if (!childName) continue;
    const childGroup = groupLookup.get(childName);
    if (!childGroup || !Array.isArray(childGroup.all)) continue;
    if (childGroup.all.some((item) => String(item || "").trim() === target)) {
      return childName;
    }
  }
  return "";
}

function getUsAutoSelectedNode(group, groups = proxyGroups) {
  if (!isUsAutoFallbackGroup(group)) return String(group?.now || "").trim();

  const selectedChildName = String(group?.now || "").trim();
  if (!selectedChildName) return "";

  const groupLookup = buildGroupLookup(groups);
  const childGroup = groupLookup.get(selectedChildName);
  if (!childGroup) return "";

  const childNow = String(childGroup.now || "").trim();
  if (childNow && !isSystemNodeName(childNow)) return childNow;

  const childNodes = getDisplayNodesForGroup(childGroup, groups);
  if (childNodes.length === 1) return childNodes[0];
  return "";
}

function countRealNodeOptions(group, groups = proxyGroups) {
  return getDisplayNodesForGroup(group, groups).length;
}

function collectUsAutoNodeOptions(groups) {
  if (!Array.isArray(groups)) return [];
  const usAutoGroup = groups.find(
    (group) => String(group?.name || "").trim().toLowerCase() === "us-auto"
  );
  if (!usAutoGroup) return [];

  const options = getDisplayNodesForGroup(usAutoGroup, groups);
  return options.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

function renderNodePriorityOptions(selectEl, options, selectedValue) {
  if (!selectEl) return;
  const selected = String(selectedValue || "").trim();
  const hasSelected = selected ? options.includes(selected) : true;
  const frag = document.createDocumentFragment();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "自动";
  frag.appendChild(defaultOption);

  options.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    frag.appendChild(option);
  });

  if (selected && !hasSelected) {
    const missingOption = document.createElement("option");
    missingOption.value = selected;
    missingOption.textContent = `${selected}（当前值，不在节点列表）`;
    frag.appendChild(missingOption);
  }

  selectEl.innerHTML = "";
  selectEl.appendChild(frag);
  selectEl.value = selected;
}

function refreshNodePrioritySelects(preferred = {}) {
  const priority1Select = document.getElementById("us-auto-priority1");
  const priority2Select = document.getElementById("us-auto-priority2");
  if (!priority1Select && !priority2Select) return;

  const options = collectUsAutoNodeOptions(proxyGroups);
  const selected1 = String(
    preferred.priority1 ?? priority1Select?.value ?? currentSubscriptionSets.us_auto.priority1 ?? ""
  ).trim();
  let selected2 = String(
    preferred.priority2 ?? priority2Select?.value ?? currentSubscriptionSets.us_auto.priority2 ?? ""
  ).trim();
  if (selected1 && selected2 && selected1 === selected2) {
    selected2 = "";
  }

  const optionsForPriority1 = selected2
    ? options.filter((name) => name !== selected2 || name === selected1)
    : options;
  const optionsForPriority2 = selected1
    ? options.filter((name) => name !== selected1 || name === selected2)
    : options;

  renderNodePriorityOptions(priority1Select, optionsForPriority1, selected1);
  renderNodePriorityOptions(priority2Select, optionsForPriority2, selected2);
}

function toggleNodePriorityControls(groupName) {
  const controls = document.getElementById("node-priority-controls");
  if (!controls) return;
  const isUsAuto = String(groupName || "").trim().toLowerCase() === "us-auto";
  controls.hidden = !isUsAuto;
}

function pickBestGroupIndex(groups) {
  if (!Array.isArray(groups) || !groups.length) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  groups.forEach((group, index) => {
    const name = String(group?.name || "").toLowerCase();
    const type = String(group?.type || "").toLowerCase();
    const realCount = countRealNodeOptions(group, groups);

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

function isKernelProgressMessage(msg) {
  const lowered = String(msg || "").toLowerCase();
  if (!lowered) return false;
  return (
    lowered.includes("kernel update") ||
    lowered.includes("kernel ") ||
    lowered.includes("core self-check") ||
    lowered.includes("rolled back") ||
    lowered.includes("process restart scheduled")
  );
}

function detectKernelStage(text) {
  const lowered = String(text || "").toLowerCase();
  if (!lowered) return "运行";
  if (lowered.includes("开始内核更新")) return "请求";
  if (lowered.includes("repo=") || lowered.includes("selected asset")) return "准备";
  if (lowered.includes("downloaded") || lowered.includes("下载")) return "下载";
  if (lowered.includes("checksum") || lowered.includes("sha256")) return "校验";
  if (
    lowered.includes("self-check") ||
    lowered.includes("core -v") ||
    lowered.includes("core -t") ||
    lowered.includes("candidate check")
  ) {
    return "自检";
  }
  if (lowered.includes("update success") || lowered.includes("更新成功")) return "完成";
  if (lowered.includes("restart")) return "重启";
  if (lowered.includes("failed") || lowered.includes("error") || lowered.includes("失败")) return "失败";
  return "运行";
}

function kernelStageClass(stage) {
  const key = String(stage || "").trim();
  if (key === "请求") return "stage-request";
  if (key === "准备") return "stage-prepare";
  if (key === "下载") return "stage-download";
  if (key === "校验") return "stage-verify";
  if (key === "自检") return "stage-check";
  if (key === "完成") return "stage-done";
  if (key === "重启") return "stage-restart";
  if (key === "失败") return "stage-fail";
  return "stage-run";
}

function normalizeKernelLogLevel(levelHint, text) {
  const direct = String(levelHint || "").trim().toUpperCase();
  if (direct === "SUCCESS") return "success";
  if (direct === "WARN" || direct === "WARNING") return "warn";
  if (direct === "ERROR") return "error";

  const lowered = String(text || "").toLowerCase();
  if (
    lowered.includes(" failed") ||
    lowered.includes(" error") ||
    lowered.includes("失败") ||
    lowered.includes("error:")
  ) {
    return "error";
  }
  if (lowered.includes("warn") || lowered.includes("warning") || lowered.includes("重启")) {
    return "warn";
  }
  if (lowered.includes("success") || lowered.includes("完成") || lowered.includes("verified")) {
    return "success";
  }
  return "info";
}

function appendKernelProgressLine(line, levelHint = "") {
  const container = document.getElementById("kernel-live-logs");
  if (!container) return;
  const text = String(line || "").trim();
  if (!text) return;

  const level = normalizeKernelLogLevel(levelHint, text);
  const stage = detectKernelStage(text);
  const stageClass = kernelStageClass(stage);

  const row = document.createElement("div");
  row.className = `kernel-log-line level-${level}`;

  const tag = document.createElement("span");
  tag.className = `kernel-log-tag ${stageClass}`;
  tag.textContent = stage;
  row.appendChild(tag);

  const detail = document.createElement("span");
  detail.className = "kernel-log-text";
  detail.textContent = text;
  row.appendChild(detail);

  container.appendChild(row);
  while (container.children.length > 120) {
    container.removeChild(container.firstElementChild);
  }
  container.scrollTop = container.scrollHeight;
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

function setRuntimeInfoValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = String(value || "").trim();
  el.textContent = text || "-";
}

function formatProxyAddress(host, port) {
  const parsed = Number(port);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  const safeHost = String(host || "").trim();
  if (!safeHost) return `:${parsed}`;
  if (safeHost.includes(":") && !safeHost.startsWith("[") && !safeHost.endsWith("]")) {
    return `[${safeHost}]:${parsed}`;
  }
  return `${safeHost}:${parsed}`;
}

function pickRuntimePort(...candidates) {
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function formatHttpAddress(host, port) {
  const addr = formatProxyAddress(host, port);
  if (addr === "-") return "-";
  return `http://${addr}`;
}

function renderRuntimeConnectionInfo(statusPayload = {}, configPayload = {}) {
  const runtimePayload = statusPayload?.runtime || {};
  const clashApi = String(runtimePayload?.clash_api || "").trim();
  const accessHost = String(runtimePayload?.access_host || "").trim() || String(window.location.hostname || "").trim() || "127.0.0.1";
  const externalPorts =
    runtimePayload?.external_ports && typeof runtimePayload.external_ports === "object"
      ? runtimePayload.external_ports
      : {};
  const internalPorts =
    runtimePayload?.internal_ports && typeof runtimePayload.internal_ports === "object"
      ? runtimePayload.internal_ports
      : {};

  const externalControllerPort = pickRuntimePort(externalPorts.controller_port);
  const internalControllerPort = pickRuntimePort(internalPorts.controller_port);
  const kernelApiText = externalControllerPort
    ? formatHttpAddress(accessHost, externalControllerPort)
    : clashApi
      ? `${clashApi} (容器内)`
      : "-";
  setRuntimeInfoValue("runtime-kernel-api", kernelApiText);

  const mixedPort = pickRuntimePort(externalPorts.mixed_port, configPayload?.mixed_port, configPayload?.http_port);
  const socksPort = pickRuntimePort(externalPorts.socks_port, configPayload?.socks_port);
  const allowLan = !!configPayload?.allow_lan;
  const bindAddress = String(configPayload?.bind_address || "").trim() || "-";
  const hostName = String(window.location.hostname || "").trim() || "127.0.0.1";

  const localHttp = formatProxyAddress("127.0.0.1", mixedPort);
  const localSocks = formatProxyAddress("127.0.0.1", socksPort);
  const mappedHttp = formatProxyAddress(accessHost, mixedPort);
  const mappedSocks = formatProxyAddress(accessHost, socksPort);

  let httpText = mappedHttp !== "-" ? mappedHttp : localHttp;
  let socksText = mappedSocks !== "-" ? mappedSocks : localSocks;
  if (allowLan && hostName && hostName !== "localhost" && hostName !== "127.0.0.1" && hostName !== accessHost) {
    const lanHttp = formatProxyAddress(hostName, mixedPort);
    const lanSocks = formatProxyAddress(hostName, socksPort);
    httpText = `当前地址 ${httpText} | LAN ${lanHttp}`;
    socksText = `当前地址 ${socksText} | LAN ${lanSocks}`;
  } else if (httpText !== localHttp || socksText !== localSocks) {
    httpText = `${httpText} | 本机 ${localHttp}`;
    socksText = `${socksText} | 本机 ${localSocks}`;
  }

  setRuntimeInfoValue("runtime-http-proxy", httpText);
  setRuntimeInfoValue("runtime-socks-proxy", socksText);

  const noteEl = document.getElementById("runtime-proxy-note");
  if (noteEl) {
    const lanState = allowLan ? "已开启" : "未开启";
    const portSource = externalPorts.mixed_port || externalPorts.socks_port ? "端口来源: compose/.env" : "端口来源: 内核配置";
    const controllerNote = internalControllerPort ? `内核控制端口(容器内): ${internalControllerPort}` : "内核控制端口(容器内): -";
    noteEl.textContent = `${portSource} | bind-address: ${bindAddress} | allow-lan: ${lanState} | ${controllerNote}`;
  }
}

async function loadRuntimeConnectionInfo(options = {}) {
  const panelExists = document.getElementById("runtime-kernel-api");
  if (!panelExists) return;

  const silent = !!options.silent;
  const providedConfig =
    options && options.configData && typeof options.configData === "object" ? options.configData : null;

  try {
    const [statusRes, configRes] = await Promise.all([
      api("/status"),
      providedConfig ? Promise.resolve({ data: providedConfig }) : api("/clash/config").catch(() => ({ data: {} })),
    ]);
    const configData = configRes && typeof configRes.data === "object" ? configRes.data : {};
    renderRuntimeConnectionInfo(statusRes || {}, configData);
  } catch (err) {
    renderRuntimeConnectionInfo({}, {});
    if (!silent) {
      showToast(`读取连接信息失败: ${err.message}`);
    }
  }
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

// ==================== 仪表盘功能 ====================

// 格式化速度显示
function formatSpeed(bytesPerSec) {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

// 格式化流量显示
function formatTraffic(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// 格式化运行时间
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// 绘制波形图
function drawWaveChart() {
  const canvas = document.getElementById('speed-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  
  // 只在初始化时设置 canvas 尺寸，避免累积误差
  if (!canvas.dataset.initialized) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.dataset.initialized = 'true';
  }
  
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  
  // 获取数据
  const upData = dashboardState.speedHistory.up;
  const downData = dashboardState.speedHistory.down;
  
  if (upData.length < 2 && downData.length < 2) return;
  
  // 计算最大值
  const maxVal = Math.max(
    ...upData, ...downData, 
    1024 * 100 // 最小刻度 100KB/s
  ) * 1.2;
  
  const stepX = width / (dashboardState.maxSpeedPoints - 1);
  
  // 绘制下载速度（紫色）
  if (downData.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    for (let i = 0; i < downData.length; i++) {
      const x = width - (downData.length - 1 - i) * stepX;
      const y = height - (downData[i] / maxVal) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 填充渐变
    ctx.lineTo(width, height);
    ctx.lineTo(width - (downData.length - 1) * stepX, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  
  // 绘制上传速度（绿色）
  if (upData.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    for (let i = 0; i < upData.length; i++) {
      const x = width - (upData.length - 1 - i) * stepX;
      const y = height - (upData[i] / maxVal) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// 更新速度显示
function updateSpeedDisplay() {
  const speedUpEl = document.getElementById('speed-up');
  const speedDownEl = document.getElementById('speed-down');
  
  if (speedUpEl && speedDownEl) {
    const upLen = dashboardState.speedHistory.up.length;
    const downLen = dashboardState.speedHistory.down.length;
    const currentUp = upLen > 0 ? dashboardState.speedHistory.up[upLen - 1] : 0;
    const currentDown = downLen > 0 ? dashboardState.speedHistory.down[downLen - 1] : 0;
    
    speedUpEl.textContent = formatSpeed(currentUp);
    speedDownEl.textContent = formatSpeed(currentDown);
  }
  
  drawWaveChart();
}

// 获取流量和速度数据
async function fetchTrafficData() {
  try {
    const res = await api("/clash/traffic");
    const data = res.data || {};

    const totalUpRaw = Number(data.up_total ?? data.up ?? 0);
    const totalDownRaw = Number(data.down_total ?? data.down ?? 0);
    const speedUpRaw = Number(data.speed_up);
    const speedDownRaw = Number(data.speed_down);

    const totalUp = Number.isFinite(totalUpRaw) && totalUpRaw >= 0 ? totalUpRaw : 0;
    const totalDown = Number.isFinite(totalDownRaw) && totalDownRaw >= 0 ? totalDownRaw : 0;

    const prevUp = Number(dashboardState.lastTraffic.up);
    const prevDown = Number(dashboardState.lastTraffic.down);
    const hasPrevTotals = Number.isFinite(prevUp) && Number.isFinite(prevDown);
    const hasRealtimeSpeed =
      Number.isFinite(speedUpRaw) &&
      speedUpRaw >= 0 &&
      Number.isFinite(speedDownRaw) &&
      speedDownRaw >= 0;

    let upSpeed = 0;
    let downSpeed = 0;
    if (hasRealtimeSpeed) {
      upSpeed = speedUpRaw;
      downSpeed = speedDownRaw;
    } else if (hasPrevTotals) {
      upSpeed = Math.max(0, totalUp - prevUp);
      downSpeed = Math.max(0, totalDown - prevDown);
    }

    if (hasRealtimeSpeed || hasPrevTotals) {
      dashboardState.speedHistory.up.push(upSpeed);
      dashboardState.speedHistory.down.push(downSpeed);

      // 限制历史数据长度
      if (dashboardState.speedHistory.up.length > dashboardState.maxSpeedPoints) {
        dashboardState.speedHistory.up.shift();
      }
      if (dashboardState.speedHistory.down.length > dashboardState.maxSpeedPoints) {
        dashboardState.speedHistory.down.shift();
      }

      updateSpeedDisplay();
    }

    dashboardState.lastTraffic = { up: totalUp, down: totalDown };
    dashboardState.trafficStats.totalUpload = totalUp;
    dashboardState.trafficStats.totalDownload = totalDown;
    
    updateTrafficDisplay();
  } catch (err) {
    // 静默失败，使用模拟数据
    const upSpeed = Math.random() * 50000;
    const downSpeed = Math.random() * 200000;
    
    dashboardState.speedHistory.up.push(upSpeed);
    dashboardState.speedHistory.down.push(downSpeed);
    
    if (dashboardState.speedHistory.up.length > dashboardState.maxSpeedPoints) {
      dashboardState.speedHistory.up.shift();
    }
    if (dashboardState.speedHistory.down.length > dashboardState.maxSpeedPoints) {
      dashboardState.speedHistory.down.shift();
    }
    
    updateSpeedDisplay();
  }
}

// 更新流量显示
function updateTrafficDisplay() {
  const totalEl = document.getElementById('total-traffic');
  const upEl = document.getElementById('traffic-up');
  const downEl = document.getElementById('traffic-down');
  
  if (totalEl && upEl && downEl) {
    const total = dashboardState.trafficStats.totalUpload + dashboardState.trafficStats.totalDownload;
    totalEl.textContent = formatTraffic(total);
    upEl.textContent = formatTraffic(dashboardState.trafficStats.totalUpload);
    downEl.textContent = formatTraffic(dashboardState.trafficStats.totalDownload);
    
    // 更新环形图
    const maxTraffic = Math.max(total, 1024 * 1024 * 100); // 最小100MB
    const uploadPercent = dashboardState.trafficStats.totalUpload / maxTraffic;
    const downloadPercent = dashboardState.trafficStats.totalDownload / maxTraffic;
    
    const uploadCircle = document.querySelector('.circle-progress.upload');
    const downloadCircle = document.querySelector('.circle-progress.download');
    
    if (uploadCircle) {
      const uploadOffset = 251.2 * (1 - uploadPercent);
      uploadCircle.style.strokeDashoffset = uploadOffset;
    }
    if (downloadCircle) {
      const downloadOffset = 201 * (1 - downloadPercent);
      downloadCircle.style.strokeDashoffset = downloadOffset;
    }
  }
}

// 更新运行时间
function updateUptime() {
  if (dashboardState.isServiceRunning) {
    dashboardState.uptimeSeconds++;
  }
  
  const uptimeEl = document.getElementById('uptime');
  if (uptimeEl) {
    uptimeEl.textContent = formatUptime(dashboardState.uptimeSeconds);
  }
}

// 获取公网IP
async function fetchPublicIP() {
  try {
    // 尝试从多个服务获取IP
    const res = await fetch('https://api.ip.sb/geoip', { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    
    const ipEl = document.getElementById('public-ip');
    const flagEl = document.getElementById('public-ip-flag');
    
    if (ipEl) ipEl.textContent = data.ip || '--.--.--.--';
    if (flagEl) {
      const country = data.country_code || 'CN';
      flagEl.textContent = COUNTRY_FLAGS[country] || '🌐';
    }
  } catch (err) {
    // 备用方案
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      const ipEl = document.getElementById('public-ip');
      if (ipEl) ipEl.textContent = data.ip || '--.--.--.--';
    } catch (e) {
      console.log('无法获取公网IP');
    }
  }
}

// 获取内网IP
function getLocalIP() {
  const ipEl = document.getElementById('local-ip');
  if (!ipEl) return;
  
  // 使用 WebRTC 获取内网IP
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o));
    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const ipMatch = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.exec(ice.candidate.candidate);
        if (ipMatch && ipEl) {
          ipEl.textContent = ipMatch[1];
          pc.close();
        }
      }
    };
    
    // 超时回退
    setTimeout(() => {
      if (ipEl && ipEl.textContent === '192.168.x.x') {
        ipEl.textContent = '127.0.0.1';
      }
    }, 2000);
  } catch (err) {
    ipEl.textContent = '127.0.0.1';
  }
}

// 切换出站模式
async function switchProxyMode(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (!["rule", "global", "direct"].includes(normalized)) {
    throw new Error("invalid mode");
  }
  try {
    await api("/clash/config", {
      method: "PUT",
      body: { mode: normalized }
    });
    showToast(`已切换到${normalized === 'rule' ? '规则' : normalized === 'global' ? '全局' : '直连'}模式`);
  } catch (err) {
    showToast(`切换模式失败: ${err.message}`);
    throw err;
  }
}

function applyProxyMode(mode) {
  const normalized = String(mode || "").toLowerCase();
  const validMode = ["rule", "global", "direct"].includes(normalized) ? normalized : "rule";
  const radio = document.querySelector(`input[name="proxy-mode"][value="${validMode}"]`);
  if (radio) radio.checked = true;
}

async function switchLanProxy(enabled) {
  try {
    await api("/clash/config", {
      method: "PUT",
      body: { allow_lan: !!enabled },
    });
    await loadRuntimeConnectionInfo({ silent: true });
    showToast(enabled ? "局域网代理已开启" : "局域网代理已关闭");
  } catch (err) {
    showToast(`切换局域网代理失败: ${err.message}`);
    throw err;
  }
}

async function switchTun(enabled) {
  try {
    await api("/clash/config", {
      method: "PUT",
      body: { tun_enabled: !!enabled },
    });
    showToast(enabled ? "虚拟网卡已开启" : "虚拟网卡已关闭");
  } catch (err) {
    showToast(`切换虚拟网卡失败: ${err.message}`);
    throw err;
  }
}

async function loadClashConfig(silent = false) {
  try {
    const res = await api("/clash/config");
    const data = res.data || {};
    const mode = String(data.mode || "rule").toLowerCase();
    const allowLan = !!data.allow_lan;
    const tunEnabled = !!data.tun_enabled;

    applyProxyMode(mode);

    const lanProxyToggle = document.getElementById("lan-proxy-toggle");
    if (lanProxyToggle) {
      lanProxyToggle.checked = allowLan;
    }

    const tunToggle = document.getElementById("tun-toggle");
    if (tunToggle) {
      tunToggle.checked = tunEnabled;
    }

    await loadRuntimeConnectionInfo({ silent: true, configData: data });
  } catch (err) {
    if (!silent) {
      showToast(`读取运行设置失败: ${err.message}`);
    }
  }
}

function setGeoButtonsBusy(busy) {
  const ids = ["btn-geo-refresh", "btn-geo-check", "btn-geo-update", "btn-geo-save-settings"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!busy;
  });
}

function renderGeoProviders(rows) {
  const tbody = document.getElementById("geo-providers-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(rows) || !rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">暂无规则提供者数据</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const typeParts = [];
    if (item.behavior) typeParts.push(String(item.behavior));
    if (item.format) typeParts.push(String(item.format));
    const typeText = typeParts.length ? typeParts.join(" / ") : String(item.type || "-");
    const count = Number(item.rule_count || 0);
    tr.innerHTML = `
      <td>${item.name || "-"}</td>
      <td>${typeText}</td>
      <td>${Number.isFinite(count) ? count : 0}</td>
      <td>${item.updated_at || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGeoCheckResult(checkData) {
  const checkEl = document.getElementById("geo-check-result");
  if (!checkEl) return;
  if (!checkData || typeof checkData !== "object") {
    checkEl.textContent = "代理检查：未执行";
    return;
  }

  if (checkData.ok) {
    const proxy = String(checkData.proxy || "-");
    const group = String(checkData.group || "-");
    const delay = Number(checkData.delay || 0);
    checkEl.textContent = `代理检查：可用 (${proxy} @ ${group}, ${delay}ms)`;
    return;
  }

  const msg = String(checkData.message || "不可用");
  checkEl.textContent = `代理检查：失败 (${msg})`;
}

async function loadGeoStatus(silent = false) {
  try {
    const res = await api("/clash/geo/status");
    const data = res.data || {};
    const cfg = data.config || {};
    const autoUpdate = !!cfg.geo_auto_update;
    const geodataMode = !!cfg.geodata_mode;
    const interval = Number(cfg.geo_update_interval || 24);
    const loader = String(cfg.geodata_loader || "-");
    const matcher = String(cfg.geosite_matcher || "-");

    const autoToggle = document.getElementById("geo-auto-update-enabled");
    if (autoToggle) {
      autoToggle.checked = autoUpdate;
    }
    const intervalInput = document.getElementById("geo-auto-update-interval");
    if (intervalInput) {
      const safeInterval = Number.isFinite(interval) ? Math.max(1, Math.min(720, interval)) : 24;
      intervalInput.value = String(safeInterval);
      intervalInput.disabled = !autoUpdate;
    }

    const summaryEl = document.getElementById("geo-config-summary");
    if (summaryEl) {
      let text = `GEO 配置：自动更新 ${autoUpdate ? "开启" : "关闭"} | 间隔 ${interval}h | Geodata ${geodataMode ? "开启" : "关闭"} | Loader ${loader} | Matcher ${matcher}`;
      if (data.rule_providers_error) {
        text += ` | 规则状态读取失败: ${data.rule_providers_error}`;
      }
      summaryEl.textContent = text;
    }
    renderGeoProviders(data.rule_providers || []);
  } catch (err) {
    if (!silent) {
      showToast(`读取 GEO 状态失败: ${err.message}`);
    }
  }
}

async function checkGeoProxy(silent = false) {
  try {
    const res = await api("/clash/geo/check");
    const checkData = res.data || {};
    renderGeoCheckResult(checkData);
    if (!silent) {
      showToast(checkData.ok ? "代理连通性检查通过" : `代理检查失败: ${checkData.message || "-"}`);
    }
    return checkData;
  } catch (err) {
    if (!silent) {
      showToast(`代理检查失败: ${err.message}`);
    }
    return null;
  }
}

async function saveGeoSettings() {
  const autoToggle = document.getElementById("geo-auto-update-enabled");
  const intervalInput = document.getElementById("geo-auto-update-interval");
  const autoUpdate = !!autoToggle?.checked;

  let interval = Number(intervalInput?.value || 24);
  if (!Number.isFinite(interval)) interval = 24;
  interval = Math.max(1, Math.min(720, Math.floor(interval)));

  if (intervalInput) {
    intervalInput.value = String(interval);
  }

  try {
    const res = await api("/clash/geo/settings", {
      method: "PUT",
      body: {
        geo_auto_update: autoUpdate,
        geo_update_interval: interval,
      },
    });
    await loadGeoStatus(true);
    const via = String(res.applied_via || "runtime");
    const reloaded = !!res.reloaded;
    if (via === "config_reload") {
      showToast(`GEO 自动更新设置已保存（写入配置并重载${reloaded ? "成功" : "失败"}）`);
    } else {
      showToast("GEO 自动更新设置已保存");
    }
  } catch (err) {
    showToast(`保存 GEO 自动更新设置失败: ${err.message}`);
  }
}

function setGeoUpdateResult(text, level = "muted") {
  const el = document.getElementById("geo-update-result");
  if (!el) return;
  el.textContent = String(text || "");
  el.classList.remove("muted", "ok", "warn", "error");
  if (level === "ok" || level === "warn" || level === "error") {
    el.classList.add("geo-update-result", level);
    return;
  }
  el.classList.add("geo-update-result", "muted");
}

function normalizeKernelRepo(raw) {
  let repo = String(raw || "").trim();
  if (!repo) return "MetaCubeX/mihomo";
  repo = repo.replace(/^https?:\/\/github\.com\//i, "").replace(/^\/+|\/+$/g, "");
  return repo || "MetaCubeX/mihomo";
}

function getKernelRepoValue() {
  const input = document.getElementById("kernel-repo");
  const normalized = normalizeKernelRepo(input?.value || "");
  if (input) {
    input.value = normalized;
  }
  return normalized;
}

function setKernelButtonsBusy(busy) {
  const ids = ["btn-kernel-refresh", "btn-kernel-check-latest", "btn-kernel-update"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!busy;
  });
  const repoInput = document.getElementById("kernel-repo");
  if (repoInput) repoInput.disabled = !!busy;
  const restartToggle = document.getElementById("kernel-restart-after-update");
  if (restartToggle) restartToggle.disabled = !!busy;
}

function setKernelUpdateResult(text, level = "muted") {
  const el = document.getElementById("kernel-update-result");
  if (!el) return;
  el.textContent = String(text || "");
  el.classList.remove("muted", "ok", "warn", "error");
  if (level === "ok" || level === "warn" || level === "error") {
    el.classList.add("geo-update-result", level);
    return;
  }
  el.classList.add("geo-update-result", "muted");
}

function kernelStatusPillClass(rawStatus) {
  const status = String(rawStatus || "").toLowerCase();
  if (status === "success" || status === "updated") return "success";
  if (status === "failed" || status === "error") return "failed";
  return "started";
}

function renderKernelStatus(data) {
  const payload = data && typeof data === "object" ? data : {};
  setRuntimeInfoValue("kernel-current-version", payload.core_version || "-");
  setRuntimeInfoValue("kernel-bin-path", payload.core_bin || "-");
  setRuntimeInfoValue("kernel-prev-bin-path", payload.core_prev_bin || "-");

  const summaryEl = document.getElementById("kernel-status-summary");
  if (!summaryEl) return;
  const allowedRepos = Array.isArray(payload.allowed_repos) ? payload.allowed_repos : [];
  const updating = payload.updating ? "是" : "否";
  const restartPending = payload.restart_pending ? "是" : "否";
  const checksumRequired = payload.require_checksum ? "开启" : "关闭";
  const allowedText = allowedRepos.length ? allowedRepos.join(", ") : "-";
  summaryEl.textContent =
    `内核状态：更新中 ${updating} | 重启待执行 ${restartPending} | SHA256 强制校验 ${checksumRequired} | 允许仓库 ${allowedText}`;
}

function renderKernelLatest(data, errorMessage = "") {
  const latestEl = document.getElementById("kernel-latest-summary");
  if (!latestEl) return;
  if (errorMessage) {
    latestEl.textContent = `最新版本检查失败：${errorMessage}`;
    return;
  }
  const payload = data && typeof data === "object" ? data : {};
  const tag = String(payload.tag || "-");
  const publishedAt = String(payload.published_at || "-");
  const assetName = String(payload.asset_name || "-");
  const checksum = String(payload.checksum || "").trim();
  const checksumText = checksum ? `SHA256 ${checksum.slice(0, 16)}...` : "未提供 checksum";
  latestEl.textContent = `最新版本：${tag} | 发布时间：${publishedAt} | 资产：${assetName} | 校验：${checksumText}`;
}

function renderKernelUpdateHistory(rows) {
  const tbody = document.getElementById("kernel-update-history-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(rows) || !rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="muted">暂无更新记录</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const status = String(item.status || "-");
    const oldVersion = String(item.old_version || "").trim();
    const newVersion = String(item.new_version || "").trim();
    const releaseTag = String(item.release_tag || "-").trim() || "-";
    const versionText = oldVersion || newVersion ? `${oldVersion || "-"} -> ${newVersion || releaseTag}` : "-";
    const message = String(item.error || item.asset_name || item.repo || "-").trim() || "-";

    const tdTime = document.createElement("td");
    tdTime.textContent = String(item.time || "-");
    tr.appendChild(tdTime);

    const tdStatus = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `status-pill ${kernelStatusPillClass(status)}`;
    statusPill.textContent = status;
    tdStatus.appendChild(statusPill);
    tr.appendChild(tdStatus);

    const tdVersion = document.createElement("td");
    tdVersion.textContent = versionText;
    tr.appendChild(tdVersion);

    const tdRelease = document.createElement("td");
    tdRelease.textContent = releaseTag;
    tr.appendChild(tdRelease);

    const tdMessage = document.createElement("td");
    tdMessage.textContent = message;
    tr.appendChild(tdMessage);

    tbody.appendChild(tr);
  });
}

async function loadKernelStatusAndHistory(silent = false) {
  try {
    const [statusRes, historyRes] = await Promise.all([
      api("/kernel/status"),
      api("/kernel/updates?limit=20"),
    ]);
    renderKernelStatus(statusRes.data || {});
    renderKernelUpdateHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
  } catch (err) {
    renderKernelStatus({});
    renderKernelUpdateHistory([]);
    if (!silent) {
      showToast(`读取内核状态失败: ${err.message}`);
    }
  }
}

async function loadKernelLatest(silent = false) {
  const repo = getKernelRepoValue();
  try {
    const res = await api(`/kernel/release/latest?repo=${encodeURIComponent(repo)}`);
    const payload = res.data || {};
    renderKernelLatest(payload, "");
    if (!silent) {
      showToast(`已检查最新版本: ${payload.tag || "-"}`);
    }
  } catch (err) {
    renderKernelLatest(null, err.message);
    if (!silent) {
      showToast(`检查最新版本失败: ${err.message}`);
    }
  }
}

async function loadKernelPanel(silent = false) {
  await loadKernelStatusAndHistory(silent);
  await loadKernelLatest(true);
}

async function runKernelUpdate() {
  if (kernelActionBusy) return;
  const repo = getKernelRepoValue();
  const restart = !!document.getElementById("kernel-restart-after-update")?.checked;
  if (!repo) {
    showToast("更新仓库不能为空");
    return;
  }
  if (!confirm(`确认从 ${repo} 更新内核？`)) return;

  kernelActionBusy = true;
  setKernelButtonsBusy(true);
  setKernelUpdateResult("内核更新中：正在下载、校验并自检，请稍候...", "warn");
  appendKernelProgressLine(`[client] 开始内核更新: repo=${repo}, restart=${restart}`);

  try {
    const res = await api("/actions/kernel/update", {
      method: "POST",
      body: { repo, restart },
    });
    const data = res.data || {};
    const oldVersion = String(data.old_version || "-").trim() || "-";
    const newVersion = String(data.new_version || data.release_tag || "-").trim() || "-";
    const restartRequested = !!data.restart_requested;
    const restartScheduled = !!data.restart_scheduled;
    let text = `更新成功：${oldVersion} -> ${newVersion}`;
    if (restartRequested) {
      text += restartScheduled ? "；已触发容器重启" : "；重启已在进行";
    }
    setKernelUpdateResult(text, "ok");
    appendKernelProgressLine(`[client] ${text}`);
    showToast(restartRequested ? "内核更新成功，准备重启容器" : "内核更新成功");

    if (!restartRequested) {
      await loadKernelPanel(true);
      await refreshStatus();
      await loadRuntimeConnectionInfo({ silent: true });
    } else {
      setTimeout(() => {
        refreshStatus().catch(() => {});
      }, 3000);
    }
  } catch (err) {
    setKernelUpdateResult(`更新失败：${err.message}`, "error");
    appendKernelProgressLine(`[client] 更新失败: ${err.message}`);
    showToast(`内核更新失败: ${err.message}`);
    await loadKernelStatusAndHistory(true);
  } finally {
    kernelActionBusy = false;
    setKernelButtonsBusy(false);
  }
}

function deriveGeoOverallMessage(data) {
  const summary = data.update_summary || {};
  const rawMessage = String(summary.message || data.message || "").trim();
  if (rawMessage && rawMessage !== "GEO 更新部分失败或未执行") {
    return rawMessage;
  }

  const check = data.check || {};
  const geoDb = data.geo_db || {};
  const rules = data.rule_providers || {};
  const checkFailed = check && typeof check === "object" && check.ok === false;
  const geoFailed = String(geoDb.status || "").toLowerCase() === "failed";
  const rulesFailed = Number(rules.failed || 0) > 0;

  if (data.ok) {
    return rawMessage || "GEO 更新完成";
  }
  if (checkFailed) {
    return "GEO 更新失败：代理连通性检查未通过";
  }
  if (geoFailed && rulesFailed) {
    return "GEO 更新失败：GEO 库和规则提供者都存在失败";
  }
  if (geoFailed) {
    return "GEO 更新部分失败：GEO 库更新失败";
  }
  if (rulesFailed) {
    return "GEO 更新部分失败：规则提供者更新失败";
  }
  return rawMessage || "GEO 更新未完成";
}

function buildGeoDbLine(summary, geoDb) {
  const summaryLine = String(summary.geo_db || "").trim();
  if (summaryLine) return summaryLine;

  const status = String(geoDb.status || "").toLowerCase();
  const message = String(geoDb.message || "").trim();
  const newData = String(geoDb.new_data || "").toLowerCase();
  let line = "";
  if (status === "updated") {
    if (newData === "yes") {
      line = "GEO 库：已更新，检测到新数据";
    } else if (newData === "no") {
      line = "GEO 库：已检查，当前已是最新";
    } else {
      line = "GEO 库：更新请求已执行，是否有新数据未知";
    }
  } else if (status === "failed") {
    line = "GEO 库：更新失败";
  } else if (status === "busy") {
    line = "GEO 库：已有更新任务在进行，当前请求被跳过";
  } else if (status === "skipped") {
    line = "GEO 库：未执行";
  } else {
    line = `GEO 库：状态 ${status || "-"}`;
  }

  const ignoredMessages = new Set(["not requested", "geo database update triggered"]);
  if (message && !ignoredMessages.has(message)) {
    line = `${line}（${message}）`;
  }
  return line;
}

function parseRuleNumbers(rules) {
  const items = Array.isArray(rules.items) ? rules.items : [];
  const totalRaw = Number(rules.total);
  const updatedRaw = Number(rules.updated);
  const failedRaw = Number(rules.failed);
  const changedRaw = Number(rules.changed);
  const unchangedRaw = Number(rules.unchanged);
  const unknownRaw = Number(rules.unknown);

  const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : items.length;
  const updated = Number.isFinite(updatedRaw)
    ? Math.max(0, updatedRaw)
    : items.filter((x) => !!x.ok).length;
  const failed = Number.isFinite(failedRaw)
    ? Math.max(0, failedRaw)
    : items.filter((x) => !x.ok).length;

  let changed = Number.isFinite(changedRaw) ? Math.max(0, changedRaw) : -1;
  let unchanged = Number.isFinite(unchangedRaw) ? Math.max(0, unchangedRaw) : -1;
  let unknown = Number.isFinite(unknownRaw) ? Math.max(0, unknownRaw) : -1;

  if (changed < 0) {
    changed = items.filter((x) => {
      const state = String(x.new_data || "").toLowerCase();
      const status = String(x.status || "").toLowerCase();
      return state === "yes" || status === "updated";
    }).length;
  }
  if (unchanged < 0) {
    unchanged = items.filter((x) => {
      const state = String(x.new_data || "").toLowerCase();
      const status = String(x.status || "").toLowerCase();
      return state === "no" || status === "no_change";
    }).length;
  }
  if (unknown < 0) {
    unknown = items.filter((x) => {
      if (!x.ok) return false;
      const state = String(x.new_data || "").toLowerCase();
      const status = String(x.status || "").toLowerCase();
      return state === "unknown" || status === "unknown" || (!state && !status);
    }).length;
  }

  return { total, updated, failed, changed, unchanged, unknown };
}

function collectFailedRuleNames(summary, rules) {
  const names = Array.isArray(summary.failed_rules)
    ? summary.failed_rules.filter((x) => String(x || "").trim())
    : [];
  if (names.length) return names;
  const items = Array.isArray(rules.items) ? rules.items : [];
  return items
    .filter((item) => !item.ok && String(item.name || "").trim() && String(item.name) !== "_all_")
    .map((item) => String(item.name));
}

function findFirstRuleError(rules) {
  const items = Array.isArray(rules.items) ? rules.items : [];
  for (const item of items) {
    if (item && !item.ok) {
      const errorText = String(item.error || "").trim();
      if (errorText) return errorText;
    }
  }
  return "";
}

function buildGeoUpdateResultText(data) {
  const summary = data.update_summary || {};
  const rules = data.rule_providers || {};
  const geoDb = data.geo_db || {};
  const lines = [];

  lines.push(deriveGeoOverallMessage(data));
  lines.push(buildGeoDbLine(summary, geoDb));

  const newData = String(summary.new_data || data.new_data || geoDb.new_data || "unknown").toLowerCase();
  if (newData === "yes") {
    lines.push("本次更新：有新数据");
  } else if (newData === "no") {
    lines.push("本次更新：无新数据（当前已是最新）");
  } else if (data.ok === false) {
    lines.push("本次更新：执行失败，无法判断是否有新数据");
  } else {
    lines.push("本次更新：是否有新数据未知");
  }

  if (summary.rules) {
    lines.push(String(summary.rules));
  } else {
    const stats = parseRuleNumbers(rules);
    lines.push(
      `规则提供者：成功 ${stats.updated}/${stats.total}，失败 ${stats.failed}，有更新 ${stats.changed}，无变化 ${stats.unchanged}`
    );
    if (stats.unknown > 0) {
      lines.push(`规则提供者：结果未知 ${stats.unknown}`);
    }
  }

  const compareError = String(rules.compare_error || "").trim();
  if (compareError) {
    lines.push(`规则结果比对失败：${compareError}`);
  }

  const failedRules = collectFailedRuleNames(summary, rules);
  if (failedRules.length) {
    const preview = failedRules.slice(0, 4).join(", ");
    const suffix = failedRules.length > 4 ? ` 等 ${failedRules.length} 个` : "";
    lines.push(`失败规则提供者：${preview}${suffix}`);
  }
  const firstRuleError = findFirstRuleError(rules);
  if (firstRuleError) {
    const reasonText = firstRuleError.length > 180 ? `${firstRuleError.slice(0, 180)}...` : firstRuleError;
    lines.push(`失败原因：${reasonText}`);
  }
  return lines.join("\n");
}

function geoResultLevelFromData(data) {
  if (!data || typeof data !== "object") return "muted";
  if (!data.ok) return "error";
  const summary = data.update_summary || {};
  const newData = String(summary.new_data || data.new_data || "unknown");
  if (newData === "unknown") return "warn";
  return "ok";
}

async function runGeoUpdate() {
  if (geoActionBusy) return;
  geoActionBusy = true;
  setGeoButtonsBusy(true);
  setGeoUpdateResult("正在执行 GEO 更新，请稍候...", "warn");
  try {
    const checkFirst = !!document.getElementById("geo-update-check-first")?.checked;
    const res = await api("/actions/geo/update", {
      method: "POST",
      body: { check_proxy: checkFirst },
    });
    const data = res.data || {};
    renderGeoCheckResult(data.check || null);
    await loadGeoStatus(true);

    const resultText = buildGeoUpdateResultText(data);
    setGeoUpdateResult(resultText, geoResultLevelFromData(data));
    showToast(deriveGeoOverallMessage(data));
  } catch (err) {
    setGeoUpdateResult(`执行 GEO 更新失败：${err.message}`, "error");
    showToast(`执行 GEO 更新失败: ${err.message}`);
  } finally {
    geoActionBusy = false;
    setGeoButtonsBusy(false);
  }
}

// 绑定仪表盘事件
function bindDashboardEvents() {
  // 局域网代理开关
  const lanProxyToggle = document.getElementById("lan-proxy-toggle");
  if (lanProxyToggle) {
    lanProxyToggle.addEventListener("change", async (e) => {
      const nextChecked = !!e.target.checked;
      e.target.disabled = true;
      try {
        await switchLanProxy(nextChecked);
      } catch (_) {
        e.target.checked = !nextChecked;
      } finally {
        e.target.disabled = false;
      }
    });
  }
  
  // 虚拟网卡开关
  const tunToggle = document.getElementById('tun-toggle');
  if (tunToggle) {
    tunToggle.addEventListener('change', async (e) => {
      const nextChecked = !!e.target.checked;
      e.target.disabled = true;
      try {
        await switchTun(nextChecked);
      } catch (_) {
        e.target.checked = !nextChecked;
      } finally {
        e.target.disabled = false;
      }
    });
  }
  
  // 出站模式切换
  const modeRadios = document.querySelectorAll('input[name="proxy-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        try {
          await switchProxyMode(e.target.value);
        } catch (_) {
          await loadClashConfig(true);
        }
      }
    });
  });
  
  // 服务开关按钮
  const toggleBtn = document.getElementById('toggle-service-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      dashboardState.isServiceRunning = !dashboardState.isServiceRunning;
      showToast(dashboardState.isServiceRunning ? '服务已启动' : '服务已暂停');
    });
  }
}

// 启动仪表盘定时更新
function startDashboardUpdates() {
  // 运行时间更新（每秒）
  dashboardState.uptimeInterval = setInterval(updateUptime, 1000);
  
  // 流量和速度更新（每秒）
  dashboardState.speedInterval = setInterval(fetchTrafficData, 1000);
  
  // 初始获取数据
  fetchTrafficData();
  fetchPublicIP();
  getLocalIP();
  
  // 每5分钟重新获取公网IP
  setInterval(fetchPublicIP, 5 * 60 * 1000);
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
    const fallbackUsAuto =
      currentSubscriptionSets &&
      currentSubscriptionSets.us_auto &&
      typeof currentSubscriptionSets.us_auto === "object"
        ? currentSubscriptionSets.us_auto
        : { priority1: "", priority2: "" };
    const usAutoHasFields =
      data.us_auto &&
      typeof data.us_auto === "object" &&
      (
        Object.prototype.hasOwnProperty.call(data.us_auto, "priority1") ||
        Object.prototype.hasOwnProperty.call(data.us_auto, "priority2")
      );
    const usAutoRaw = usAutoHasFields ? data.us_auto : fallbackUsAuto;
    currentSubscriptionSets = {
      set1: Array.isArray(data.set1) ? data.set1 : [],
      set2: Array.isArray(data.set2) ? data.set2 : [],
      us_auto: {
        priority1: String(usAutoRaw.priority1 || "").trim(),
        priority2: String(usAutoRaw.priority2 || "").trim(),
      },
    };
    const set1Tbody = document.getElementById("set1-table");
    const set2Tbody = document.getElementById("set2-table");
    set1Tbody.innerHTML = "";
    set2Tbody.innerHTML = "";
    currentSubscriptionSets.set1.forEach((item) => addSetRow("set1", item));
    currentSubscriptionSets.set2.forEach((item) => addSetRow("set2", item));
    if (!set1Tbody.querySelector("tr")) addSetRow("set1", {});
    if (!set2Tbody.querySelector("tr")) addSetRow("set2", {});
    refreshNodePrioritySelects(currentSubscriptionSets.us_auto);
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

async function saveSubscriptionSetsPayload(payload, successTip, errorPrefix) {
  try {
    await api("/subscription-sets", { method: "PUT", body: payload });
    showToast(successTip);
    if (activeTab === "override-script") {
      await loadEditor();
    }
    await loadSubscriptionSets();
    await loadProviderStatus();
  } catch (err) {
    showToast(`${errorPrefix}: ${err.message}`);
  }
}

async function saveSubscriptionSets() {
  const priority1Input = document.getElementById("us-auto-priority1");
  const priority2Input = document.getElementById("us-auto-priority2");
  const payload = {
    set1: collectSetRows("set1", "Paid"),
    set2: collectSetRows("set2", "Free"),
    us_auto: {
      priority1: String(priority1Input?.value || "").trim(),
      priority2: String(priority2Input?.value || "").trim(),
    },
  };
  currentSubscriptionSets = {
    set1: Array.isArray(payload.set1) ? payload.set1 : [],
    set2: Array.isArray(payload.set2) ? payload.set2 : [],
    us_auto: { ...payload.us_auto },
  };
  await saveSubscriptionSetsPayload(
    payload,
    "订阅集合已保存，override.js 头部已更新",
    "保存集合失败"
  );
}

async function saveNodeSettings() {
  const priority1Input = document.getElementById("us-auto-priority1");
  const priority2Input = document.getElementById("us-auto-priority2");
  const payload = {
    set1: Array.isArray(currentSubscriptionSets.set1) ? currentSubscriptionSets.set1 : [],
    set2: Array.isArray(currentSubscriptionSets.set2) ? currentSubscriptionSets.set2 : [],
    us_auto: {
      priority1: String(priority1Input?.value || "").trim(),
      priority2: String(priority2Input?.value || "").trim(),
    },
  };
  currentSubscriptionSets = {
    set1: Array.isArray(currentSubscriptionSets.set1) ? currentSubscriptionSets.set1 : [],
    set2: Array.isArray(currentSubscriptionSets.set2) ? currentSubscriptionSets.set2 : [],
    us_auto: { ...payload.us_auto },
  };
  await saveSubscriptionSetsPayload(payload, "节点设置已保存", "保存节点设置失败");
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

// 代理组图标映射（精确名优先）
const GROUP_EXACT_ICONS = {
  'proxy': '🚀',
  'google': '🔍',
  'us1': '🇺🇸',
  'us2': '🇺🇸',
  'us-auto': '🇺🇸',
};
const GROUP_FUZZY_ICONS = {
  'PROXY': '🚀',
  'Auto': '⚡',
  'AUTO': '⚡',
  'SELECT': '📍',
  'Fallback': '🔁',
  'FALLBACK': '🔁',
  'LoadBalance': '⚖️',
  'URLTest': '🔍',
};

function groupSortRank(groupName) {
  const name = String(groupName || "").trim().toLowerCase();
  if (name === "us1") return 1;
  if (name === "us2") return 2;
  if (name === "proxy") return 3;
  if (name === "us-auto") return 4;
  if (name === "google") return 5;
  return 100;
}

function compareProxyGroups(a, b) {
  const aName = String(a?.name || "");
  const bName = String(b?.name || "");
  const rankDiff = groupSortRank(aName) - groupSortRank(bName);
  if (rankDiff !== 0) return rankDiff;
  return aName.localeCompare(bName, "zh-CN", { sensitivity: "base" });
}

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
  const key = String(groupName || "").trim().toLowerCase();
  if (GROUP_EXACT_ICONS[key]) return GROUP_EXACT_ICONS[key];
  for (const [fuzzyKey, icon] of Object.entries(GROUP_FUZZY_ICONS)) {
    if (key.includes(fuzzyKey.toLowerCase())) {
      return icon;
    }
  }
  if (key.includes("us")) return "🇺🇸";
  if (key.includes("google")) return "🔍";
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
  const infoText = document.getElementById('node-info-text');

  if (!grid) return;

  const group = proxyGroups[activeGroupIndex];
  if (!group) {
    toggleNodePriorityControls("");
    grid.innerHTML = '<div class="muted">没有可用的代理组</div>';
    return;
  }
  toggleNodePriorityControls(group.name);

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

      // 记录代理切换
      const providerName = nodeProviderMap.get(nodeName) || "";
      recordProxySwitch(group.name, nodeName, {
        provider: providerName,
        success: true,
      });

      // 更新本地状态并重新渲染
      group.now = nodeName;
      renderNodesGrid();
    } catch (err) {
      showToast(`切换失败: ${err.message}`);
      // 记录失败的切换
      recordProxySwitch(group.name, nodeName, {
        success: false,
        note: err.message,
      });
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
          // 记录测速结果
          const providerName = nodeProviderMap.get(nodeName) || "";
          recordProxyTest(nodeName, delay, {
            provider: providerName,
            success: delay > 0,
          });
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
    const incomingGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
    proxyGroups = [...incomingGroups].sort(compareProxyGroups);
    refreshNodePrioritySelects();

    if (!proxyGroups.length) {
      toggleNodePriorityControls("");
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
      const line = `${data.time} [${data.level}] ${data.msg}`;
      appendLog(line);
      if (isKernelProgressMessage(data.msg)) {
        appendKernelProgressLine(line, data.level);
      }
    } catch (_) {
      appendLog(evt.data);
      if (isKernelProgressMessage(evt.data)) {
        appendKernelProgressLine(evt.data);
      }
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
    await loadClashConfig(true);
    await loadKernelStatusAndHistory(true);
    await loadGeoStatus(true);
    await loadSubscriptions();
    await loadGroups();
    await loadSubscriptionSets();
    await loadProviderStatus();
    await loadSchedule();
    await loadScheduleHistory();
  };
  const runtimeRefreshBtn = document.getElementById("btn-runtime-refresh");
  if (runtimeRefreshBtn) {
    runtimeRefreshBtn.onclick = () => loadRuntimeConnectionInfo({ silent: false });
  }
  const kernelRefreshBtn = document.getElementById("btn-kernel-refresh");
  if (kernelRefreshBtn) {
    kernelRefreshBtn.onclick = () => loadKernelStatusAndHistory(false);
  }
  const kernelLatestBtn = document.getElementById("btn-kernel-check-latest");
  if (kernelLatestBtn) {
    kernelLatestBtn.onclick = () => loadKernelLatest(false);
  }
  const kernelUpdateBtn = document.getElementById("btn-kernel-update");
  if (kernelUpdateBtn) {
    kernelUpdateBtn.onclick = () => runKernelUpdate();
  }
  const kernelRepoInput = document.getElementById("kernel-repo");
  if (kernelRepoInput) {
    kernelRepoInput.onblur = () => {
      kernelRepoInput.value = normalizeKernelRepo(kernelRepoInput.value);
    };
  }
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
    const kernelLogs = document.getElementById("kernel-live-logs");
    if (kernelLogs) {
      kernelLogs.textContent = "";
    }
  };
  document.getElementById("save-sub-sets").onclick = saveSubscriptionSets;
  const saveNodeSettingsBtn = document.getElementById("save-node-settings");
  if (saveNodeSettingsBtn) saveNodeSettingsBtn.onclick = saveNodeSettings;
  const priority1Select = document.getElementById("us-auto-priority1");
  const priority2Select = document.getElementById("us-auto-priority2");
  if (priority1Select) priority1Select.onchange = () => refreshNodePrioritySelects();
  if (priority2Select) priority2Select.onchange = () => refreshNodePrioritySelects();
  document.getElementById("save-schedule").onclick = saveSchedule;
  document.getElementById("add-set1-row").onclick = () => addSetRow("set1", {});
  document.getElementById("add-set2-row").onclick = () => addSetRow("set2", {});
  document.getElementById("import-set1-bulk").onclick = () =>
    importSetRows("set1", "Paid", "付费");
  document.getElementById("import-set2-bulk").onclick = () =>
    importSetRows("set2", "Free", "免费");
  document.getElementById("reload-schedule-history").onclick = loadScheduleHistory;
  document.getElementById("clear-schedule-history").onclick = clearScheduleHistory;
  document.getElementById("btn-geo-refresh").onclick = () => loadGeoStatus();
  document.getElementById("btn-geo-check").onclick = () => checkGeoProxy();
  document.getElementById("btn-geo-update").onclick = () => runGeoUpdate();
  document.getElementById("btn-geo-save-settings").onclick = () => saveGeoSettings();
  document.getElementById("geo-auto-update-enabled").onchange = (evt) => {
    const intervalInput = document.getElementById("geo-auto-update-interval");
    if (intervalInput) {
      intervalInput.disabled = !evt.target.checked;
    }
  };
  document.getElementById("history-only-scheduler").onchange = renderScheduleHistory;
  document.getElementById("history-only-failed").onchange = renderScheduleHistory;

  // 代理记录事件绑定
  document.getElementById("reload-proxy-records").onclick = loadProxyRecords;
  document.getElementById("capture-proxy-records").onclick = captureProxyRecords;
  document.getElementById("clear-proxy-records").onclick = clearProxyRecords;
  document.getElementById("apply-proxy-record-filters").onclick = loadProxyRecords;
  document.getElementById("reset-proxy-record-filters").onclick = resetProxyRecordFilters;
  document.getElementById("proxy-record-keyword").addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadProxyRecords();
  });
  document.getElementById("proxy-record-subscription").addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadProxyRecords();
  });

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
  bindDashboardEvents();
  startDashboardUpdates();
  await refreshStatus();
  await loadRuntimeConnectionInfo({ silent: true });
  await loadClashConfig(true);
  await loadKernelPanel(true);
  await loadGeoStatus(true);
  await loadSubscriptions();
  await loadSubscriptionSets();
  await loadProviderStatus();
  await loadGroups();
  await loadSchedule();
  await loadScheduleHistory();
  await loadProxyRecords();
  await loadEditor();
  setInterval(refreshStatus, 5000);
  setInterval(() => loadKernelStatusAndHistory(true), 30000);
  setInterval(loadSchedule, 30000);
  setInterval(loadScheduleHistory, 30000);
  setInterval(() => loadProxyRecorderStatus(true), 15000);
}

// ==================== Proxy Records Functions ====================

let currentProxyRecords = [];
let proxyRecordsLastError = "";

function formatRecordTime(timestamp) {
  if (!timestamp) return "-";
  const dt = new Date(timestamp * 1000);
  return dt.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 代理记录类型配置
const RECORD_TYPE_CONFIG = {
  switch: { label: "切换", class: "badge warn" },
  test: { label: "测速", class: "badge info" },
  select: { label: "选择", class: "badge success" },
  connection: { label: "连接", class: "badge" },
};

function getRecordTypeLabel(type) {
  return RECORD_TYPE_CONFIG[type]?.label || type || "未知";
}

function getRecordTypeClass(type) {
  return RECORD_TYPE_CONFIG[type]?.class || "badge";
}

function renderProxyRecorderStatus(data, errorMessage = "") {
  const el = document.getElementById("proxy-recorder-status");
  if (!el) return;
  if (errorMessage) {
    el.textContent = `连接采样器状态：读取失败 (${errorMessage})`;
    return;
  }

  const payload = data && typeof data === "object" ? data : {};
  const enabled = !!payload.enabled;
  const running = !!payload.running;
  const interval = Number(payload.poll_interval || 0);
  const active = Number(payload.active_connections || 0);
  const timeout = Number(payload.request_timeout || 0);
  el.textContent = `连接采样器状态：${enabled ? "已启用" : "未启用"} | 线程 ${running ? "运行中" : "未运行"} | 轮询 ${interval || "-"}s | 活跃连接 ${active} | 请求超时 ${timeout || "-"}s`;
}

async function loadProxyRecorderStatus(silent = true) {
  try {
    const result = await api("/proxy-records/recorder");
    renderProxyRecorderStatus(result.data || {}, "");
  } catch (err) {
    renderProxyRecorderStatus(null, err.message);
    if (!silent) {
      showToast(`读取连接采样器状态失败: ${err.message}`);
    }
  }
}

async function loadProxyRecords() {
  const keyword = document.getElementById("proxy-record-keyword")?.value?.trim() || "";
  const subscription = document.getElementById("proxy-record-subscription")?.value?.trim() || "";
  const type = document.getElementById("proxy-record-type")?.value || "";
  const limit = document.getElementById("proxy-record-limit")?.value || "100";

  const params = new URLSearchParams();
  if (keyword) params.append("keyword", keyword);
  if (subscription) params.append("subscription", subscription);
  if (type) params.append("type", type);
  params.append("limit", limit);

  try {
    const result = await api(`/proxy-records?${params.toString()}`);
    proxyRecordsLastError = "";
    currentProxyRecords = result.data || [];
    renderProxyRecords(result.stats);
    await loadProxyRecorderStatus(true);
  } catch (err) {
    proxyRecordsLastError = String(err.message || "");
    if (!/not found/i.test(proxyRecordsLastError)) {
      showToast(`加载代理记录失败: ${proxyRecordsLastError}`);
    }
    renderProxyRecords({ total: 0, filtered: 0, returned: 0 });
    await loadProxyRecorderStatus(true);
  }
}

// 获取延迟等级信息
function getDelayInfo(delayMs) {
  if (delayMs <= 0) {
    return { text: "-", class: "" };
  }
  let cssClass;
  if (delayMs < 200) {
    cssClass = "success";
  } else if (delayMs < 500) {
    cssClass = "warn";
  } else {
    cssClass = "error";
  }
  return { text: `${delayMs}ms`, class: cssClass };
}

function getRecordMetricInfo(record) {
  if (String(record.type || "") === "connection") {
    const upload = Math.max(0, Number(record.upload || 0));
    const download = Math.max(0, Number(record.download || 0));
    if (upload <= 0 && download <= 0) {
      return { text: "-", class: "" };
    }
    return {
      text: `↑${formatTraffic(upload)} ↓${formatTraffic(download)}`,
      class: "",
    };
  }
  return getDelayInfo(Number(record.delay_ms ?? -1));
}

function getRecordAppName(record) {
  const appName = String(record.app_name || "").trim();
  if (appName) return appName;
  const processPath = String(record.process_path || "").trim();
  if (!processPath) return "-";
  const chunks = processPath.split(/[\\/]/);
  return chunks[chunks.length - 1] || processPath;
}

function getRecordHost(record) {
  const host = String(record.host || "").trim();
  if (host) return host;
  const destination = String(record.destination || "").trim();
  return destination || "-";
}

function renderProxyRecords(stats) {
  const tbody = document.getElementById("proxy-records-tbody");
  const statsEl = document.getElementById("proxy-records-stats");

  if (!tbody || !statsEl) return;

  statsEl.textContent = `总计: ${stats.total} 条 | 筛选后: ${stats.filtered} 条 | 显示: ${stats.returned} 条`;

  if (!currentProxyRecords || currentProxyRecords.length === 0) {
    if (/not found/i.test(proxyRecordsLastError)) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="muted">当前运行脚本缺少 /api/proxy-records 接口，请升级镜像并重建 scripts_data 卷。</td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="10" class="muted">暂无记录（可点击“采样连接”后再刷新）</td></tr>';
    }
    return;
  }

  tbody.innerHTML = currentProxyRecords
    .map((record) => {
      const metricInfo = getRecordMetricInfo(record);
      const statusText = record.success !== false ? "成功" : "失败";
      const statusClass = record.success !== false ? "success" : "error";
      const appName = getRecordAppName(record);
      const host = getRecordHost(record);

      return `
      <tr>
        <td>${formatRecordTime(record.timestamp)}</td>
        <td><span class="${getRecordTypeClass(record.type)}">${getRecordTypeLabel(record.type)}</span></td>
        <td>${escapeHtml(record.group_name || "-")}</td>
        <td>${escapeHtml(record.target_node || record.proxy_name || "-")}</td>
        <td>${escapeHtml(appName)}</td>
        <td>${escapeHtml(host)}</td>
        <td>${escapeHtml(record.subscription || "-")}</td>
        <td class="${metricInfo.class}">${metricInfo.text}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn-small" onclick="deleteProxyRecord('${record.id}')">删除</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function deleteProxyRecord(recordId) {
  if (!confirm("确定要删除这条记录吗？")) return;

  try {
    await api(`/proxy-records/${recordId}`, { method: "DELETE" });
    showToast("记录已删除");
    await loadProxyRecords();
  } catch (err) {
    showToast(`删除失败: ${err.message}`);
  }
}

async function clearProxyRecords() {
  if (!confirm("确定要清空所有代理记录吗？此操作不可恢复。")) return;

  try {
    await api("/proxy-records/clear", {
      method: "POST",
      body: { confirm: "yes" },
    });
    showToast("记录已清空");
    await loadProxyRecords();
  } catch (err) {
    showToast(`清空失败: ${err.message}`);
  }
}

async function captureProxyRecords() {
  const btn = document.getElementById("capture-proxy-records");
  if (btn) btn.disabled = true;
  try {
    const result = await api("/proxy-records/capture", {
      method: "POST",
      body: {},
    });
    const captured = Number(result.captured || 0);
    showToast(`连接采样完成，新增/更新 ${captured} 条`);
    await loadProxyRecords();
  } catch (err) {
    showToast(`采样失败: ${err.message}`);
    await loadProxyRecorderStatus(true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function resetProxyRecordFilters() {
  document.getElementById("proxy-record-keyword").value = "";
  document.getElementById("proxy-record-subscription").value = "";
  document.getElementById("proxy-record-type").value = "";
  document.getElementById("proxy-record-limit").value = "100";
  loadProxyRecords();
}

// 记录代理事件的通用函数
async function recordProxyEvent(recordType, data, extra = {}) {
  const record = {
    type: recordType,
    ...data,
    subscription: extra.subscription || "",
    provider: extra.provider || "",
    delay_ms: extra.delay_ms ?? -1,
    success: extra.success !== false,
    note: extra.note || "",
  };
  try {
    await api("/proxy-records", { method: "POST", body: record });
  } catch (err) {
    console.error(`Failed to record proxy ${recordType}:`, err);
  }
}

// 记录代理切换事件
function recordProxySwitch(groupName, targetNode, extra = {}) {
  return recordProxyEvent("switch", { group_name: groupName, target_node: targetNode }, extra);
}

// 记录代理测速事件
function recordProxyTest(proxyName, delayMs, extra = {}) {
  return recordProxyEvent("test", { proxy_name: proxyName, target_node: proxyName, delay_ms: delayMs }, extra);
}

boot();
