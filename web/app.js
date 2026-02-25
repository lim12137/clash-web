const API = "/api";

let activeTab = "override-script";
let eventSource = null;
let scheduleHistoryRows = [];
let bulkImportTarget = null;

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
    const set1Tbody = document.getElementById("set1-table");
    const set2Tbody = document.getElementById("set2-table");
    set1Tbody.innerHTML = "";
    set2Tbody.innerHTML = "";
    (data.set1 || []).forEach((item) => addSetRow("set1", item));
    (data.set2 || []).forEach((item) => addSetRow("set2", item));
    if (!set1Tbody.querySelector("tr")) addSetRow("set1", {});
    if (!set2Tbody.querySelector("tr")) addSetRow("set2", {});
  } catch (err) {
    showToast(`读取集合失败: ${err.message}`);
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

function groupCard(group) {
  const box = document.createElement("div");
  box.className = "group-card";

  const title = document.createElement("h3");
  title.textContent = `${group.name} (${group.type || "selector"})`;
  box.appendChild(title);

  const now = document.createElement("div");
  now.className = "muted";
  now.textContent = `当前: ${group.now || "-"}`;
  box.appendChild(now);

  const row = document.createElement("div");
  row.className = "row";
  const sel = document.createElement("select");
  (group.all || []).forEach((item) => {
    const op = document.createElement("option");
    op.value = item;
    op.textContent = item;
    if (item === group.now) op.selected = true;
    sel.appendChild(op);
  });
  const btn = document.createElement("button");
  btn.textContent = "应用";
  btn.onclick = async () => {
    try {
      await api(`/clash/groups/${encodeURIComponent(group.name)}/select`, {
        method: "POST",
        body: { name: sel.value },
      });
      showToast(`${group.name} 已切换`);
      await loadGroups();
    } catch (err) {
      showToast(`切换失败: ${err.message}`);
    }
  };
  row.appendChild(sel);
  row.appendChild(btn);
  box.appendChild(row);

  return box;
}

async function loadGroups() {
  const root = document.getElementById("groups-list");
  root.innerHTML = "";
  try {
    const res = await api("/clash/groups");
    const groups = res.data || [];
    if (!groups.length) {
      root.innerHTML = `<div class="muted">当前没有可切换组</div>`;
      return;
    }
    groups.forEach((group) => root.appendChild(groupCard(group)));
  } catch (err) {
    root.innerHTML = `<div class="muted">加载失败: ${err.message}</div>`;
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
    await loadSchedule();
    await loadScheduleHistory();
  };
  document.getElementById("reload-subs").onclick = loadSubscriptions;
  document.getElementById("reload-groups").onclick = loadGroups;
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
    importSetRows("set1", "Paid", "集合1（付费）");
  document.getElementById("import-set2-bulk").onclick = () =>
    importSetRows("set2", "Free", "集合2（免费）");
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
  bindTabs();
  initLogs();
  await refreshStatus();
  await loadSubscriptions();
  await loadGroups();
  await loadSubscriptionSets();
  await loadSchedule();
  await loadScheduleHistory();
  await loadEditor();
  setInterval(refreshStatus, 5000);
  setInterval(loadSchedule, 30000);
  setInterval(loadScheduleHistory, 30000);
}

boot();
