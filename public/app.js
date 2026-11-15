const APP_VERSION = "1.3.5";

const state = {
  route: "overview",
  data: null,
  token: "",
  hygieneFilter: "全部",
  hygieneAssignee: "全部",
  preparedRecordPhoto: null,
  preparedRecordPhotos: [],
  photoPageSize: 12,
  photoFilter: "全部",
  toastTimer: null,
  photoUrls: new Map(),
  photoRequests: new Map(),
  collabTab: "literature",
  systemFilter: "all",
  litMethods: [],
  litAuthors: [],
  litAdditives: [],
  litQuery: "",
  forumTab: "ideas",
  litPage: 30,
  etag: "",
  litSearchFocus: false,
  litMatchAll: false,
  litExpandAll: false,
  litStatsOpen: typeof window !== "undefined" && window.innerWidth > 720,
  dictation: null,
  dictatedText: "",
  cancelDictation: false,
};

const page = document.getElementById("page");
const shell = document.getElementById("app-shell");
const connectScreen = document.getElementById("connect-screen");
const modalRoot = document.getElementById("modal-root");

const versionLabel = document.getElementById("app-version");
if (versionLabel) versionLabel.textContent = APP_VERSION;

function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatDate(value, includeTime = false) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无记录";
  const options = includeTime
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "numeric", day: "numeric" };
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

function fmt(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "--";
}

function fileSize(bytes) {
  const size = Number(bytes) || 0;
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function latestFor(records, target) {
  return records.find((record) => record.target === target);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (_) {
    throw new Error("连接不到课题组服务。请检查网络，或确认实验室 Mac Mini 正在运行。");
  }
  if (response.status === 401) {
    disconnect("访问码无效或服务已重启，请重新连接。");
    throw new Error("访问码无效。");
  }
  if (!response.ok) {
    let message = "请求失败，请稍后重试。";
    try { message = (await response.json()).error || message; } catch (_) {}
    throw new Error(message);
  }
  return response;
}

async function checkForUpdate() {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch(`./version.json?check=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const metadata = await response.json();
    if (metadata.version && metadata.version !== APP_VERSION) {
      if (window.__labdeskUpdateScheduled) return;
      window.__labdeskUpdateScheduled = true;
      showToast("发现新版本，正在刷新工作台…");
      window.setTimeout(() => window.location.reload(), 850);
    }
  } catch (_) {
    // An unavailable version file should not interrupt local work.
  }
}

function setConnected(connected) {
  shell.hidden = !connected;
  connectScreen.hidden = connected;
}

function setConnectionMode(isFilePreview) {
  document.getElementById("connect-form").hidden = isFilePreview;
  document.getElementById("file-open-help").hidden = !isFilePreview;
}

function disconnect(message = "") {
  state.token = "";
  state.data = null;
  localStorage.removeItem("labdesk.accessCode");
  modalRoot.innerHTML = "";
  setConnected(false);
  if (message) document.getElementById("connect-error").textContent = message;
}

async function connect(code) {
  const error = document.getElementById("connect-error");
  error.textContent = "";
  if (window.location.protocol === "file:") {
    setConnectionMode(true);
    return;
  }
  const button = document.querySelector("#connect-form button[type=submit]");
  button.disabled = true;
  button.innerHTML = "正在连接…";
  state.token = code.trim();
  try {
    const response = await api("/api/state");
    state.data = await response.json();
    localStorage.setItem("labdesk.accessCode", state.token);
    setConnected(true);
    render();
  } catch (problem) {
    state.token = "";
    if (problem.message !== "访问码无效。") error.textContent = problem.message;
    else error.textContent = "访问码不正确，请向课题组管理员确认后重试。";
  } finally {
    button.disabled = false;
    button.innerHTML = `连接服务 ${icon("arrow")}`;
  }
}

async function resumeSession(code) {
  state.token = code;
  setConnected(true);
  if (page && !page.innerHTML.trim()) {
    page.innerHTML = '<div class="page-loading">正在载入工作台…</div>';
  }
  try {
    const response = await fetch("/api/state", { headers: { Authorization: `Bearer ${code}` } });
    if (response.status === 401) throw new Error("unauthorized");
    if (!response.ok) throw new Error("unavailable");
    state.etag = response.headers.get("ETag") || "";
    state.data = await response.json();
    const hash = (location.hash || "").replace("#", "");
    if (["overview", "collab", "measure", "upkeep", "photos", "forum", "research"].includes(hash)) state.route = hash;
    render();
  } catch (problem) {
    if (problem.message === "unauthorized") {
      disconnect("访问码无效或服务已重启，请重新连接。");
    } else {
      disconnect("连接不到课题组服务，请检查网络或稍后重试。");
    }
  }
}

async function reloadState() {
  const headers = new Headers({ Authorization: `Bearer ${state.token}` });
  if (state.etag) headers.set("If-None-Match", state.etag);
  let response;
  try {
    response = await fetch("/api/state", { headers });
  } catch (error) {
    throw new Error("连接不到课题组服务。请检查网络，或确认实验室 Mac Mini 正在运行。");
  }
  if (response.status === 401) { disconnect("访问码无效或服务已重启，请重新连接。"); throw new Error("访问码无效。"); }
  if (response.status === 304) { render(); return; }
  if (!response.ok) throw new Error("刷新失败，请稍后重试。");
  state.etag = response.headers.get("ETag") || "";
  state.data = await response.json();
  render();
}

function setRoute(route) {
  state.route = route;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNavigation() {
  const names = { overview: "总览", collab: "协作平台", measure: "测量记录", research: "文献协作", upkeep: "卫生与仪器", hygiene: "卫生与仪器", equipment: "卫生与仪器", photos: "照片总览", forum: "Harness 平台" };
  const aliases = { research: "collab" };
  const active = aliases[state.route] || state.route;
  const sectionName = names[state.route] || "总览";
  document.getElementById("topbar-section").textContent = (typeof labdeskTranslate === "function") ? labdeskTranslate(sectionName) : sectionName;
  document.querySelectorAll(".main-nav [data-route], .mobile-nav [data-route]").forEach((button) => button.classList.toggle("is-active", button.dataset.route === active));
  const analysisCount = (state.data?.literature?.length || 0) + (state.data?.labRecords?.length || 0);
  document.querySelectorAll(".nav-count").forEach((badge) => { badge.textContent = analysisCount; });
  const ready = (state.data?.ideas || []).filter((idea) => idea.status === "approved" && !idea.done).length;
  const ideaBadge = document.getElementById("idea-count");
  if (ideaBadge) {
    ideaBadge.textContent = ready;
    ideaBadge.hidden = ready === 0;
  }
}

function render() {
  if (!state.data) return;
  updateNavigation();
  const views = {
    overview: renderOverview,
    collab: renderCollab,
    measure: renderMeasure,
    research: renderResearch,
    upkeep: renderUpkeep,
    hygiene: renderUpkeep,
    equipment: renderUpkeep,
    photos: renderPhotos,
    forum: renderForum,
  };
  photoObserver?.disconnect();
  page.innerHTML = (views[state.route] || renderOverview)();
  if (typeof labdeskLocalize === "function") labdeskLocalize(page);
  if (state.litSearchFocus) {
    const search = document.getElementById("lit-search");
    if (search) {
      search.focus();
      const end = search.value.length;
      try { search.setSelectionRange(end, end); } catch (error) { /* type=search may reject */ }
    }
    state.litSearchFocus = false;
  }
  loadVisiblePhotos();
}

function pageHead(title, subtitle, action = "") {
  const actionClass = action.includes("head-secondary-action") ? " head-actions-secondary" : "";
  return `<div class="page-head"><div class="page-head-copy"><p class="eyebrow">LABDESK · TEAM SPACE</p><h1>${title}</h1><p>${subtitle}</p></div>${action ? `<div class="head-actions${actionClass}">${action}</div>` : ""}</div>`;
}

function statCard(symbol, tint, value, label) {
  return `<div class="stat-card"><span class="stat-symbol ${tint}">${icon(symbol)}</span><div class="stat-copy"><strong class="stat-value">${value}</strong><span class="stat-label">${label}</span></div></div>`;
}

const JV_PARAMS = {
  pce: { label: "PCE", unit: "%", digits: 1 },
  voc: { label: "Voc", unit: "V", digits: 3 },
  jsc: { label: "Jsc", unit: "mA/cm²", digits: 2 },
  ff: { label: "FF", unit: "%", digits: 1 },
};

function jvNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jvTimeMs(value) {
  if (!value) return null;
  const time = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(time) ? time : null;
}

function jvClock(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function jvPoints(research, key) {
  const scans = Array.isArray(research?.scans) ? research.scans : [];
  const points = [];
  scans.forEach((scan) => {
    const y = jvNumber(scan?.[key]);
    const x = jvTimeMs(scan?.t);
    if (x === null || y === null) return;
    points.push({ x, y });
  });
  return points.sort((a, b) => a.x - b.x);
}

function jvDayKey(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function jvScatterSvg(research, key) {
  const cfg = JV_PARAMS[key];
  const points = jvPoints(research, key);
  if (!points.length) return `<div class="jv-empty">没有可绘制的 ${cfg.label} 数据</div>`;
  const W = 320;
  const H = 196;
  const L = 36;
  const R = 10;
  const T = 12;
  const B = 30;
  const byDay = {};
  points.forEach((point) => {
    const day = jvDayKey(point.x);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(point);
  });
  const days = Object.keys(byDay).sort();
  const ys = points.map((point) => point.y);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const padY = (y1 - y0) * 0.12 || 0.5;
  y0 -= padY;
  y1 += padY;
  const py = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const colW = (W - L - R) / Math.max(days.length, 1);
  const jitterMax = Math.min(colW * 0.32, 24);
  const bins = 26;
  const span = y1 - y0 || 1;
  const bucketOf = (day, value) => `${day}|${Math.min(bins - 1, Math.max(0, Math.floor(((value - y0) / span) * bins)))}`;
  const counts = {};
  points.forEach((point) => {
    const bucket = bucketOf(jvDayKey(point.x), point.y);
    counts[bucket] = (counts[bucket] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(counts), 1);
  const noise = (index, dayIndex) => {
    const raw = Math.sin((index + 1) * 12.9898 + (dayIndex + 1) * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  };
  let dots = "";
  days.forEach((day, dayIndex) => {
    const center = L + (dayIndex + 0.5) * colW;
    byDay[day].forEach((point, index) => {
      const jitter = (noise(index, dayIndex) - 0.5) * 2 * jitterMax;
      const count = counts[bucketOf(day, point.y)] || 1;
      const opacity = 0.18 + 0.82 * (count / maxCount);
      dots += `<circle cx="${(center + jitter).toFixed(1)}" cy="${py(point.y).toFixed(1)}" r="2.8" fill="#14624c" fill-opacity="${opacity.toFixed(2)}"/>`;
    });
  });
  const grid = [0, 1, 2, 3].map((index) => {
    const value = y0 + ((y1 - y0) * index) / 3;
    const y = py(value);
    return `<text x="${L - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="jv-tick">${value.toFixed(cfg.digits)}</text><line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" stroke="#e8eee9" stroke-width="1"/>`;
  }).join("");
  const guides = days.map((day, index) => {
    const x = L + (index + 0.5) * colW;
    return `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${H - B}" stroke="#eef2ef" stroke-width="1"/>`;
  }).join("");
  const step = days.length > 8 ? Math.ceil(days.length / 8) : 1;
  const xTicks = days.map((day, index) => {
    if (index % step !== 0 && index !== days.length - 1) return "";
    const x = L + (index + 0.5) * colW;
    return `<text x="${x.toFixed(1)}" y="${H - 9}" text-anchor="middle" class="jv-tick">${day.slice(5)}</text>`;
  }).join("");
  const legend = `<text x="${W - R}" y="${T + 8}" text-anchor="end" class="jv-tick">颜色越深 = 同一取值出现越多</text>`;
  return `<svg class="jv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.label} 按天分列、颜色表示出现频次的散点图">${grid}${guides}<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#c8d4cd"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#c8d4cd"/>${xTicks}${dots}${legend}</svg>`;
}

function jvHistogramSvg(research, key) {
  const cfg = JV_PARAMS[key];
  const values = jvPoints(research, key).map((point) => point.y);
  if (!values.length) return `<div class="jv-empty">没有 ${cfg.label} 数据</div>`;
  const W = 320;
  const H = 172;
  const L = 36;
  const R = 8;
  const T = 12;
  const B = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = 9;
  const span = max - min || 1;
  const counts = new Array(bins).fill(0);
  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor(((value - min) / span) * bins));
    counts[index] += 1;
  });
  const top = Math.max(...counts, 1);
  const bw = (W - L - R) / bins;
  const bars = counts.map((count, index) => {
    const height = (count / top) * (H - T - B);
    return `<rect x="${(L + index * bw + 1).toFixed(1)}" y="${(H - B - height).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${height.toFixed(1)}" rx="2" fill="#14624c" fill-opacity="0.5"><title>${count} 次</title></rect>`;
  }).join("");
  const yTicks = [0, Math.round(top / 2), top].map((value) => {
    const y = H - B - (value / top) * (H - T - B);
    return `<text x="${L - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="jv-tick">${value}</text>`;
  }).join("");
  return `<svg class="jv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.label} 频率分布">${yTicks}<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#c8d4cd"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#c8d4cd"/>${bars}<text x="${L}" y="${H - 8}" class="jv-tick">${min.toFixed(cfg.digits)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" class="jv-tick">${max.toFixed(cfg.digits)} ${cfg.unit}</text></svg>`;
}

function jvPanel(research) {
  const scans = Array.isArray(research?.scans) ? research.scans : [];
  if (!scans.length) return `<div class="empty-inline">${escapeHtml(research?.message || "没有逐条扫描数据")}</div>`;
  const keys = Object.keys(JV_PARAMS);
  const param = JV_PARAMS[state.jvParam] ? state.jvParam : "pce";
  const cfg = JV_PARAMS[param];
  return `<div class="jv-panel">
    <div class="jv-tabs">${keys.map((key) => `<button class="jv-tab ${key === param ? "is-active" : ""}" data-jv-param="${key}">${JV_PARAMS[key].label}</button>`).join("")}</div>
    <div class="jv-chart-grid">
      <figure class="jv-figure"><figcaption>按天分列的 ${cfg.label}（颜色=出现频次）</figcaption>${jvScatterSvg(research, param)}</figure>
      <figure class="jv-figure"><figcaption>${cfg.label} 取值频次（全部天数合计）</figcaption>${jvHistogramSvg(research, param)}</figure>
    </div>
    <p class="jv-caption">每个点是一次 JV 扫描，已合并正/反向数据；横轴按天分列，同一天的数据在同一列，同一取值出现次数越多颜色越深。共 ${scans.length} 次扫描。</p>
  </div>`;
}

function activityRow(record) {
  const isCleaning = record.kind === "hygiene";
  const zone = state.data.zones.find((item) => item.id === record.target);
  const legacyDeviceCleaning = isCleaning && zone?.type === "device";
  const title = `${zone?.name || "实验室项目"} · ${legacyDeviceCleaning ? "历史待归类" : isCleaning ? "卫生" : "维护"}`;
  return `<div class="activity-row"><span class="activity-icon ${isCleaning && !legacyDeviceCleaning ? "green" : ""}">${icon(isCleaning && !legacyDeviceCleaning ? "broom" : "tool")}</span><div class="activity-main"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(record.person)}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</span></div><time class="activity-time">${formatDate(record.createdAt, true)}</time></div>`;
}

function renderOverview() {
  const data = state.data;
  const hygieneCount = data.hygieneRecords.filter((record) => data.zones.some((zone) => zone.id === record.target && zone.type === "area")).length;
  const maintenanceCount = data.maintenanceRecords.length;
  const activity = [...data.hygieneRecords, ...data.maintenanceRecords]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  const llm = data.llm || {};
  return `${pageHead("组内协作总览", "实验问题、本周值日与词条热度，一页开始")}
    ${renderDutyHero()}
    <div class="ov-actions">
      <button class="ov-action" data-action="new-hygiene">${icon("camera")}拍照记录</button>
      <button class="ov-action" data-action="upload-pdf">${icon("file")}上传 PDF</button>
      <button class="ov-action" data-route="forum">${icon("forum")}提个想法</button>
      <button class="ov-action" data-route="upkeep">${icon("tool")}设备目录</button>
    </div>
    <div class="ov-grid">
      <div class="ov-col ov-col-ai">
        <section class="priority-card priority-ai ov-ai">
          <span class="priority-card-top"><span class="priority-icon">${icon("spark")}</span><span class="priority-state">${llm.configured ? `${llm.remote ? "云端" : "本地"} ${escapeHtml(llm.model)}` : "模型未连接"}</span></span>
          <span class="priority-title">实验助手</span>
          <form class="assistant-form priority-assistant-form" id="assistant-form">
            <textarea id="assistant-question" maxlength="4000" placeholder="例如：这周大家测了哪些条件？还有哪些记录没补？" ${llm.configured ? "" : "disabled"}></textarea>
            <div class="assistant-actions"><small>${llm.configured ? (llm.remote ? "经中转调用，只发摘要" : "在 Mac Mini 本地处理") : "模型服务暂不可用"}</small><button class="button button-primary button-compact" type="submit" ${llm.configured ? "" : "disabled"}>分析 ${icon("arrow")}</button></div>
          </form>
          <div id="assistant-response"></div>
        </section>
      </div>
      <div class="ov-col">
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>最近照片</h2><p>${hygieneCount} 条卫生 · ${maintenanceCount} 条维护</p></div><button class="subtle-link" data-route="photos">全部 ${icon("arrow")}</button></div>
          ${activity.length ? `<div class="activity-list">${activity.map(activityRow).join("")}</div>` : `<div class="empty-inline">还没有记录。</div>`}
        </section>
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>区域与设备</h2><p>${data.zones.length} 项</p></div><button class="subtle-link" data-route="upkeep">目录 ${icon("arrow")}</button></div>
          <div class="activity-list">
            ${data.zones.slice(0, 3).map((zone) => `<div class="activity-row"><span class="activity-icon ${zone.type === "area" ? "green" : ""}">${icon(zone.type === "area" ? "broom" : "tool")}</span><div class="activity-main"><strong>${escapeHtml(zone.name)}</strong><span>${escapeHtml(zone.group)}</span></div></div>`).join("")}
          </div>
        </section>
      </div>
      <div class="ov-col">
        ${renderTopicsCard()}
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>文献</h2><p>${data.literature.length} 条分析 · ${data.library.length} 份 PDF</p></div><button class="subtle-link" data-route="collab">打开 ${icon("arrow")}</button></div>
          <div class="supporting-action-list">
            <button class="supporting-action" data-route="collab"><span class="action-icon">${icon("book")}</span><span><strong>文献分析</strong><small>按体系筛选与检索</small></span>${icon("arrow")}</button>
            <button class="supporting-action" data-action="upload-pdf"><span class="action-icon">${icon("file")}</span><span><strong>上传 PDF</strong><small>原件保存在 Mac Mini</small></span>${icon("arrow")}</button>
          </div>
        </section>
      </div>
    </div>`;
}

function documentRow(item) {
  return `<div class="document-row"><span class="document-symbol">${icon("file")}</span><div class="document-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.name)} · ${fileSize(item.bytes)} · ${formatDate(item.createdAt)}</span></div><div class="document-actions"><button class="document-open" data-open-pdf="${escapeHtml(item.id)}">打开</button></div></div>`;
}

function renderResearch() {
  const llm = state.data.llm || {};
  const upload = `<button class="button button-primary" data-action="upload-pdf"><svg class="icon"><use href="#i-plus"></use></svg>添加 PDF</button>`;
  return `${pageHead("文献资料库", "组内共享 PDF 与分析；原件保存在 Mac Mini", `<button class="button button-secondary" data-route="collab">${icon("arrow")}返回协作平台</button>` + upload)}
    <div class="research-grid">
      <div class="research-main">
        <section class="section-card section-card-pad">
          <div class="research-title-line"><span class="file-badge">${icon("file")}</span><div class="report-title-wrap"><h2>课题组数据平台落地方案</h2><p>已有调研 · v0.2 · 2026 年 10 月</p></div><span class="status-tag">调研总结</span></div>
          <p class="report-excerpt">建议以实验批次、条件组、基底/器件、测量和原始文件建立可追溯台账。实验室成员沿用现有仪器和表格，上传后确认样品分组与工艺差异；缺失信息保留为未知，不用模型推测。Mac Mini 可先承担内网文件存储、结构化记录和看板服务。</p>
          <ul class="report-points">
            <li>${icon("check")}原件与解析记录分开保存，后续汇总可追到来源。</li>
            <li>${icon("check")}卫生、仪器维护照片先形成简单闭环，再逐步增加排班和权限。</li>
            <li>${icon("check")}可比性按体系、结构、测量口径和批次分层，不只看冠军效率。</li>
          </ul>
          <div class="report-actions"><small>来源：工作区已有调研文档</small><button class="button button-secondary button-compact" data-action="show-report">查看完整方案 ${icon("external")}</button></div>
        </section>
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>Mac Mini 文献资料库</h2><p>新上传的 PDF 原件只存放在本地服务端</p></div><span class="muted-count">${state.data.library.length} 份 PDF</span></div>
          ${state.data.library.length ? `<div class="document-list">${state.data.library.map(documentRow).join("")}</div>` : `<div class="empty-state"><span class="empty-icon">${icon("file")}</span><strong>还没有协作文献</strong><p>添加 PDF 后，组员可通过同一工作台访问 Mac Mini 上的原件。</p></div>`}
        </section>
      </div>
      <aside class="research-side">
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>解析范围</h2><p>当前已接入内容</p></div></div>
          <div class="activity-list">
            <div class="activity-row"><span class="activity-icon green">${icon("check")}</span><div class="activity-main"><strong>文献分析条目</strong><span>标题、方法、结论与制备流程，可在协作平台筛选</span></div></div>
            <div class="activity-row"><span class="activity-icon">${icon("file")}</span><div class="activity-main"><strong>共享 PDF</strong><span>支持上传、备注与打开；上传分析时原件不落盘</span></div></div>
            <div class="activity-row"><span class="activity-icon">${icon("spark")}</span><div class="activity-main"><strong>实验助手</strong><span>${llm.configured ? `经中转调用 · ${escapeHtml(llm.model)}` : "等待连接模型服务"}</span></div></div>
          </div>
        </section>
        <section class="section-card section-card-pad">
          <div class="card-heading"><div><h2>添加文献分析</h2><p>PDF 不保存，分析后自动整理</p></div></div>
          <p class="report-excerpt">在协作平台点「添加文献分析」，选择一个或多个 PDF，模型会读出标题、方法、结论和制备流程并自动填入；原件在处理完立即删除。</p>
          <button class="button button-secondary button-compact" data-route="collab">去添加分析 ${icon("arrow")}</button>
        </section>
      </aside>
    </div>`;
}

function zoneLatest(zone, kind) {
  const records = kind === "hygiene" ? state.data.hygieneRecords : state.data.maintenanceRecords;
  return latestFor(records, zone.id);
}

function zoneCard(zone, kind) {
  const latest = zoneLatest(zone, kind);
  const count = (kind === "hygiene" ? state.data.hygieneRecords : state.data.maintenanceRecords).filter((record) => record.target === zone.id).length;
  const categoryClass = zone.type === "area" ? "area" : "";
  const actionLabel = kind === "hygiene" ? "记录打扫" : "记录维护";
  const recorded = latest ? `${formatDate(latest.createdAt)} · ${escapeHtml(latest.person)}` : (kind === "hygiene" ? "还没有卫生照片" : "还没有维护照片");
  const chipLabel = kind === "hygiene" ? "轮值未设置" : "周期未设置";
  const assignees = Array.isArray(zone.assignees) ? zone.assignees : [];
  const responsibility = assignees.length ? `负责人：${assignees.map(escapeHtml).join("、")}` : (zone.type === "device" ? "Super User 待登记" : "负责人待登记");
  return `<article class="catalog-item">
    <div class="catalog-item-top"><span class="catalog-icon ${categoryClass}">${icon(zone.type === "area" ? "broom" : "tool")}</span><div><span class="category-label">${escapeHtml(zone.group)} · ${escapeHtml(zone.category)}</span><h3>${escapeHtml(zone.name)}</h3><div class="catalog-item-sub">${responsibility}</div></div><span class="status-chip"><span class="server-dot"></span>${chipLabel}</span></div>
    <div class="catalog-item-bottom"><span class="last-record">${recorded}</span><span class="item-record-count">${count} 条</span></div>
    <div class="item-action"><span class="item-action-label">${latest ? `最近提交 ${formatDate(latest.createdAt, true)}` : ""}</span><button class="button button-secondary button-compact" data-open-record="${kind}" data-target="${escapeHtml(zone.id)}"><svg class="icon"><use href="#i-camera"></use></svg>${actionLabel}</button></div>
  </article>`;
}

function recordPhotos(record) {
  return [...new Set([...(Array.isArray(record.photos) ? record.photos : []), record.photo].filter(Boolean))];
}

function recordRow(record) {
  const zone = state.data.zones.find((item) => item.id === record.target);
  const note = record.note ? escapeHtml(record.note) : "未添加说明";
  const photos = recordPhotos(record);
  const legacyDeviceCleaning = record.kind === "hygiene" && zone?.type === "device";
  const kindLabel = legacyDeviceCleaning ? "历史记录待归类" : record.kind === "hygiene" ? "卫生值日" : "仪器维护";
  return `<article class="record-row">
    <div class="record-photo-strip">${photos.map((photoId, index) => `<button class="record-photo" data-photo-open="${escapeHtml(photoId)}" aria-label="查看第 ${index + 1} 张现场照片"><span class="record-thumb record-thumb-placeholder" data-photo-id="${escapeHtml(photoId)}">${icon("camera")}</span></button>`).join("")}</div>
    <div class="record-copy"><strong>${escapeHtml(zone?.name || record.target)} · ${escapeHtml(record.person)}</strong><p><span class="record-kind-label ${legacyDeviceCleaning ? "is-unclassified" : ""}">${kindLabel}</span>${note}</p><div class="record-meta">${formatDate(record.createdAt, true)} · ${photos.length} 张照片</div></div>
  </article>`;
}

function renderRecordHistory(records, label) {
  if (!records.length) return `<section class="catalog-section"><div class="catalog-section-title"><h2>${label}</h2><span>0 条</span></div><div class="section-card empty-state"><span class="empty-icon">${icon("camera")}</span><strong>还没有提交照片</strong><p>记录保存后会在这里按时间倒序显示。</p></div></section>`;
  return `<section class="catalog-section"><div class="catalog-section-title"><h2>${label}</h2><span>共 ${records.length} 条 · 完整照片见照片总览</span></div><div class="record-list">${records.slice(0, 12).map(recordRow).join("")}</div></section>`;
}

function renderUpkeep() {
  const areas = state.data.zones.filter((zone) => zone.type === "area");
  const devices = state.data.zones.filter((zone) => zone.type === "device");
  const categoryDisplayed = state.hygieneFilter === "全部" ? areas : areas.filter((zone) => zone.group === state.hygieneFilter);
  const displayed = state.hygieneAssignee === "全部"
    ? categoryDisplayed
    : categoryDisplayed.filter((zone) => (zone.assignees || []).includes(state.hygieneAssignee));
  const hygieneRecords = state.data.hygieneRecords.filter((record) => state.data.zones.some((zone) => zone.id === record.target && zone.type === "area"));
  const legacyRecords = state.data.hygieneRecords.filter((record) => !state.data.zones.some((zone) => zone.id === record.target && zone.type === "area"));
  const maintenanceRecords = state.data.maintenanceRecords;
  const merged = [...hygieneRecords, ...maintenanceRecords].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const categories = ["全部", ...new Set(areas.map((zone) => zone.group))];
  const assignees = [...new Set([...areas, ...devices].flatMap((zone) => zone.assignees || []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const visibleDevices = state.hygieneAssignee === "全部"
    ? devices
    : devices.filter((zone) => (zone.assignees || []).includes(state.hygieneAssignee));
  const action = `<button class="button button-primary" data-action="new-upkeep">${icon("camera")}拍照记录</button>`;
  return `${pageHead("卫生与仪器", "公共区域值日与仪器维护在同一页记录，按负责人和 Super User 查看", action)}
    <div class="filter-bar"><div class="filter-options">${categories.map((filter) => `<button class="filter-button ${state.hygieneFilter === filter ? "is-active" : ""}" data-hygiene-filter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`).join("")}</div><label class="assignee-filter"><span>负责人</span><select id="hygiene-assignee-filter"><option value="全部" ${state.hygieneAssignee === "全部" ? "selected" : ""}>全部负责人</option>${assignees.map((name) => `<option value="${escapeHtml(name)}" ${state.hygieneAssignee === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label><span class="filter-spacer"></span><span class="muted-count">${displayed.length} 个区域 · ${visibleDevices.length} 台仪器 · ${merged.length} 条记录</span></div>
    <section class="catalog-section"><div class="catalog-section-title"><h2>公共区域值日</h2><span>${hygieneRecords.length} 条卫生照片</span></div>
      ${displayed.length ? `<div class="item-grid">${displayed.map((zone) => zoneCard(zone, "hygiene")).join("")}</div>` : `<div class="section-card empty-state"><span class="empty-icon">${icon("broom")}</span><strong>没有找到负责区域</strong><p>当前筛选下没有匹配项目。</p></div>`}
    </section>
    <section class="catalog-section"><div class="catalog-section-title"><h2>仪器维护</h2><span>${maintenanceRecords.length} 条维护照片</span></div>
      ${visibleDevices.length ? `<div class="item-grid">${visibleDevices.map((zone) => zoneCard(zone, "maintenance")).join("")}</div>` : `<div class="section-card empty-state"><span class="empty-icon">${icon("tool")}</span><strong>这位负责人名下没有仪器</strong><p>切换到「全部负责人」可查看全部设备。</p></div>`}
    </section>
    ${merged.length ? `<section class="catalog-section"><div class="catalog-section-title"><h2>最近记录</h2><span>卫生与维护合并显示</span></div><div class="record-list">${merged.slice(0, 12).map(recordRow).join("")}</div></section>` : `<section class="catalog-section"><div class="catalog-section-title"><h2>最近记录</h2><span>0 条</span></div><div class="section-card empty-state"><span class="empty-icon">${icon("camera")}</span><strong>还没有提交照片</strong><p>记录保存后会在这里按时间倒序显示。</p></div></section>`}
    ${legacyRecords.length ? `<div class="setup-note">${icon("camera")}<span>有 ${legacyRecords.length} 条旧记录曾选中仪器作为卫生目标，已在照片总览中标注「历史记录待归类」。</span></div>` : ""}`;
}

function renderPhotos() {
  const allRecords = [...state.data.hygieneRecords, ...state.data.maintenanceRecords]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const isLegacy = (record) => record.kind === "hygiene" && state.data.zones.some((zone) => zone.id === record.target && zone.type === "device");
  const filtered = state.photoFilter === "全部"
    ? allRecords
    : state.photoFilter === "待归类"
      ? allRecords.filter(isLegacy)
      : allRecords.filter((record) => !isLegacy(record) && record.kind === (state.photoFilter === "卫生" ? "hygiene" : "maintenance"));
  const shown = filtered.slice(0, state.photoPageSize);
  return `${pageHead("照片总览", "同一服务器上的组员可浏览全部卫生与仪器照片", `""`)}
    <div class="filter-bar"><span class="muted-count">共 ${filtered.length} 条记录 · 按时间从新到旧</span></div>
    ${shown.length ? `<div class="record-list photo-record-list">${shown.map(recordRow).join("")}</div>` : `<div class="section-card empty-state"><span class="empty-icon">${icon("camera")}</span><strong>还没有照片记录</strong><p>提交卫生或仪器维护记录后，组内成员都可以在这里查看。</p></div>`}
    ${shown.length < filtered.length ? `<div class="load-more-wrap"><button class="button button-secondary" data-action="load-more-photos">加载更多 (${shown.length}/${filtered.length})</button></div>` : ""}
`;
}

function systemName(id) {
  return (state.data?.systems || []).find((item) => item.id === id)?.name || "未分类";
}

function systemOptions(selected) {
  return (state.data?.systems || []).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function topicSparkline(weeks) {
  const values = Array.isArray(weeks) && weeks.length ? weeks : [0, 0, 0, 0, 0, 0, 0, 0];
  const maximum = Math.max(1, ...values);
  const step = 100 / Math.max(1, values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(28 - (value / maximum) * 24).toFixed(1)}`).join(" ");
  return `<svg class="topic-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
}

function renderDutyHero() {
  const duty = state.data?.duty || {};
  const entry = duty.entry;
  const names = Array.isArray(entry?.names) ? entry.names : [];
  const weekLabel = duty.weekStart ? `本周排班 · ${formatDate(duty.weekStart)} 起` : "本周排班";
  const body = names.length
    ? `<h2>${names.map(escapeHtml).join(" · ")}</h2><p>${escapeHtml(entry?.areas || "负责本周卫生打扫并上传照片")}</p>`
    : `<h2>本周还没有排班</h2><p>安排值日生后，首页会提醒他们完成打扫并上传卫生照片。</p>`;
  return `<section class="duty-hero ${names.length ? "" : "is-empty"}">
    <span class="duty-mark"><svg class="icon"><use href="#i-broom"></use></svg></span>
    <div class="duty-copy"><p class="eyebrow">本周值日生</p>${body}<small>${weekLabel}</small></div>
    <div class="duty-actions">
      <button class="button button-secondary button-compact" data-action="edit-duty">${icon("calendar")}${names.length ? "调整排班" : "安排值日"}</button>
      <button class="button button-soft button-compact" data-action="new-hygiene">${icon("camera")}上传卫生照片</button>
    </div>
  </section>`;
}

function renderTopicsCard() {
  const topics = state.data?.topics || [];
  const top = topics.slice(0, 8);
  const maximum = Math.max(1, ...top.map((item) => item.count));
  return `<section class="section-card section-card-pad topic-card">
    <div class="card-heading"><div><h2>词条热度</h2><p>近 30 天组内提及频率（来自测量记录与文献分析）</p></div><button class="subtle-link" data-route="collab">查看协作平台 ${icon("arrow")}</button></div>
    ${top.length ? `<div class="topic-list">${top.map((item) => `<div class="topic-row">
      <span class="topic-term">${escapeHtml(item.term)}</span>
      <span class="topic-bar"><i style="width:${Math.max(6, Math.round(item.count / maximum * 100))}%"></i></span>
      ${topicSparkline(item.weeks)}
      <span class="topic-count">${item.count}</span>
    </div>`).join("")}</div>` : `<div class="empty-inline">还没有足够的记录。录入测量记录或文献分析后，这里会显示被提及最多的关键词。</div>`}
  </section>`;
}

function literatureSteps(item) {
  const raw = item.fabrication;
  if (!raw) return [];
  const shape = (name, detail) => {
    const split = splitStepDetail(detail);
    return { name: name || "步骤", detail: split.prose, prose: split.prose, params: split.params };
  };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((step) => step && (step.n || step.d))
        .map((step) => shape(step.n, typeof step.d === "object" && step.d ? JSON.stringify(step.d) : step.d));
    }
  } catch (error) { /* plain-text fallback below */ }
  return [shape("制备流程", String(raw))];
}

function fabricationToText(raw) {
  return literatureSteps({ fabrication: raw })
    .map((step) => (step.detail ? `${step.name}：${step.detail}` : step.name))
    .join("\n");
}

function textToFabrication(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  const steps = lines.map((line) => {
    const match = line.match(/^([^：:]{1,40})[：:]\s*(.*)$/);
    return match ? { n: match[1].trim(), d: match[2].trim() } : { n: "步骤", d: line };
  });
  return JSON.stringify(steps);
}

const METHOD_CANON = [
  ["界面/缺陷钝化", ["钝化", "界面钝化", "表面钝化", "晶界钝化", "分子钝化", "界面工程", "埋底修饰"]],
  ["添加剂/掺杂", ["添加剂", "掺杂"]],
  ["反溶剂", ["反溶剂"]],
  ["真空蒸镀", ["真空蒸镀", "蒸镀", "真空沉积"]],
  ["涂布工艺", ["旋涂", "刮涂", "两步法", "一步法", "溶液加工"]],
  ["结晶/退火调控", ["退火", "结晶调控", "结晶工程"]],
  ["组分/溶剂工程", ["溶剂工程", "组分工程"]],
  ["SAM/自组装", ["自组装单分子层", "自组装单分子", "SAM"]],
  ["叠层", ["叠层", "tandem"]],
  ["p-i-n", ["p-i-n"]],
  ["n-i-p", ["n-i-p"]],
  ["二维/准二维", ["二维/准二维"]],
  ["锡铅", ["Sn-Pb", "锡铅"]],
];
const METHOD_LOOKUP = new Map();
METHOD_CANON.forEach(([canonical, keys]) => keys.forEach((key) => METHOD_LOOKUP.set(key.toLowerCase(), canonical)));

const MATERIAL_BUCKETS = [
  ["理论/仿真", ["密度泛函", "dft", "能带对齐", "scaps", "分子动力学", "第一性原理", "模拟", "计算", "gga"]],
  ["表征分析", ["j-v", "xrd", "xps", "pl", "tem", "sem", "uv-vis", "光谱", "表征", "测试", "eqe", "raman"]],
  ["界面/钝化", ["钝化", "界面", "修饰", "passivat"]],
  ["组分/带隙", ["组分", "带隙", "掺杂", "composition", "bandgap", "doping"]],
  ["成膜工艺", ["旋涂", "刮涂", "涂布", "印刷", "蒸镀", "蒸发", "blade", "spin", "slot", "evaporat"]],
  ["稳定性", ["稳定性", "老化", "isos", "mppt", "湿热", "stability"]],
  ["文献综述", ["综述", "review", "展望", "perspective"]],
];

const SYSTEM_BUCKETS = {
  "sn-pb": MATERIAL_BUCKETS, "pb-gap": MATERIAL_BUCKETS, "wide-gap": MATERIAL_BUCKETS, "sn-only": MATERIAL_BUCKETS,
  "perovskite-module": [
    ["涂布工艺", ["狭缝", "刮刀", "旋涂", "涂布", "印刷", "blade", "slot", "spin"]],
    ["互连/划线", ["互连", "划线", "激光", "p1", "p2", "p3", "interconnect", "scrib"]],
    ["封装", ["封装", "encapsul", "阻水", "阻氧"]],
    ["稳定性", ["稳定性", "湿热", "老化", "户外", "isos", "mppt"]],
    ["成本/规模化", ["成本", "物料衡算", "收率", "规模", "设备", "合成路线", "经济"]],
    ["表征分析", ["表征", "测试", "el", "pl", "xrd", "j-v", "eqe"]],
  ],
  "perovskite-led": [
    ["器件结构", ["器件结构", "p-i-n", "n-i-p", "倒置", "叠层", "结构"]],
    ["发光层", ["发光层", "量子点", "准二维", "钙钛矿层", "emission layer"]],
    ["传输层", ["传输层", "htl", "etl", "空穴", "电子传输"]],
    ["界面/钝化", ["钝化", "界面", "修饰", "配体", "passivat"]],
    ["表征分析", ["pl", "el", "eqe", "xps", "giwaxs", "光谱", "表征", "测试"]],
    ["理论/光学", ["密度泛函", "dft", "光学", "微腔", "光子", "模拟", "计算"]],
    ["稳定性", ["稳定性", "寿命", "t50", "老化", "stability"]],
  ],
  "perovskite-detector": [
    ["成像", ["成像", "mtf", "ct", "imaging"]],
    ["探测类型", ["x射线", "x-ray", "紫外", "uv", "可见", "探测"]],
    ["材料形态", ["单晶", "厚膜", "多晶", "柔性", "晶圆", "薄膜"]],
    ["灵敏度策略", ["离子迁移", "极化", "钝化", "缺陷", "灵敏度", "暗电流"]],
    ["制备工艺", ["旋涂", "溶液", "反溶剂", "逆温", "结晶", "生长", "蒸镀"]],
    ["表征分析", ["表征", "测试", "xrd", "pl", "响应", "迁移率"]],
    ["稳定性", ["稳定性", "老化", "长期", "stability"]],
  ],
  "perovskite-ferroelectric": [
    ["材料/合成", ["固相", "合成", "溶胶", "水热", "陶瓷", "单晶", "薄膜"]],
    ["极化表征", ["p-e", "电滞", "压电", "pfm", "极化", "铁电"]],
    ["结构表征", ["xrd", "raman", "sem", "tem", "rietveld", "afm"]],
    ["理论计算", ["密度泛函", "dft", "第一性原理", "计算", "模拟"]],
    ["器件", ["器件", "fet", "feram", "存储", "晶体管"]],
  ],
  "perovskite-thermoelectric": [
    ["理论计算", ["密度泛函", "dft", "gga", "tb-mbj", "wien2k", "bolztrap", "第一性原理", "计算", "模拟", "势函数"]],
    ["合成", ["固相", "球磨", "熔融", "合成", "烧结", "水热"]],
    ["结构表征", ["xrd", "sem", "tem", "raman", "eds"]],
    ["输运测量", ["seebeck", "电导", "热导", "zt", "hall", "输运"]],
    ["掺杂/缺陷", ["掺杂", "缺陷", "空位", "取代"]],
  ],
  "pbs-qd": [
    ["合成", ["合成", "热注入", "尺寸", "成核", "生长", "溶液"]],
    ["配体交换", ["配体", "edt", "silar", "交换", "钝化"]],
    ["器件", ["j-v", "器件", "光伏", "eqe", "电池"]],
    ["表征分析", ["xrd", "uv-vis", "tem", "光谱", "吸收", "表征"]],
    ["稳定性", ["稳定性", "老化", "存储", "stability"]],
    ["理论建模", ["理论", "建模", "模拟", "计算"]],
  ],
  "solid-state-battery": [
    ["电解质", ["电解质", "聚合物", "氧化物", "硫化物", "固态"]],
    ["电极", ["正极", "负极", "锂金属", "球磨", "复合正极"]],
    ["界面", ["界面", "接触", "阻抗", "sei"]],
    ["电化学测试", ["循环", "eis", "cv", "容量", "倍率", "电化学"]],
    ["合成", ["合成", "球磨", "烧结", "固相"]],
    ["理论计算", ["密度泛函", "dft", "分子动力学", "计算", "模拟"]],
    ["表征分析", ["xrd", "sem", "tem", "afm", "rietveld", "表征"]],
    ["文献综述", ["综述", "review", "比较", "雷达图"]],
  ],
  "llm": [
    ["训练/微调", ["预训练", "微调", "sft", "lora", "rlhf", "dpo", "参数高效", "对齐"]],
    ["提示/推理", ["提示", "prompt", "零样本", "少样本", "cot", "推理", "上下文"]],
    ["评测/可解释", ["评测", "benchmark", "logit", "注意力", "归因", "可解释", "评估"]],
    ["效率", ["剪枝", "量化", "蒸馏", "加速", "压缩", "效率"]],
    ["应用", ["生成", "agent", "检索", "rag", "代码", "对话"]],
  ],
  "semiconductor": [
    ["工艺", ["光刻", "euv", "刻蚀", "沉积", "finfet", "pdk", "工艺", "节点"]],
    ["器件", ["晶体管", "puf", "环振", "触发器", "器件", "振荡器"]],
    ["仿真", ["tcad", "蒙特卡洛", "仿真", "建模", "模型"]],
    ["测试/表征", ["功耗", "时序", "温度", "电压", "hamming", "表征", "测试"]],
    ["可靠性/安全", ["可靠性", "密钥", "安全", "失效", "老化"]],
  ],
};

function canonMethod(name, system) {
  const text = String(name || "").trim();
  if (!text) return "";
  const low = text.toLowerCase();
  const buckets = SYSTEM_BUCKETS[system] || MATERIAL_BUCKETS;
  for (const [bucket, keys] of buckets) {
    if (keys.some((key) => low.includes(key))) return bucket;
  }
  const exact = METHOD_LOOKUP.get(low);
  if (exact) return exact;
  return "其他";
}

function litMethods(item) {
  const raw = item.methods || "";
  return [...new Set(String(raw).split(/[;,；、]/).map((part) => canonMethod(part, item.system)).filter(Boolean))];
}

const ADDITIVE_PATTERNS = [
  ["PEAI", /\bPEAI\b/i], ["PEABr", /\bPEABr\b/i], ["FPEAI", /\b4?-?FPEAI\b/i],
  ["EDAI", /\bEDAI2?\b/i], ["PDAI2", /\bPDAI2?\b/i], ["GAI", /\bGA(I|Br|Cl)\b/i],
  ["2-ThEABr", /2-?ThEA/i], ["OAI", /\bOAI\b/i], ["BAI", /\bBAI\b/i],
  ["MACl", /\bMACl\b/i], ["MABr", /\bMABr\b/i], ["NH4Cl", /\bNH4Cl\b/i],
  ["RbCl", /\bRbCl\b/i], ["CsCl", /\bCsCl\b/i], ["KI", /\bKI\b/i],
  ["RbI", /\bRbI\b/i], ["CsI", /\bCsI\b/i], ["LiF", /\bLiF\b/i],
  ["KHP", /\bKHP\b/i], ["DMPU", /\bDMPU\b/i], ["尿素", /\burea\b|尿素/i],
  ["硫脲", /thiourea|硫脲/i], ["NH4SCN", /\bNH4SCN\b/i], ["Pb(SCN)2", /Pb\(SCN\)2/i],
  ["BMIMBF4", /BMIM-?BF4/i], ["EMIMBF4", /EMIM-?BF4/i],
];

function litAdditives(item) {
  const text = `${item.fabrication || ""} ${item.summary || ""}`;
  return ADDITIVE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function litAuthors(item) {
  return [...new Set(String(item.corresponding || "").split(/[,，、;；]/).map((part) => part.trim()).filter(Boolean))];
}

function litTagButton(name) {
  const active = state.litMethods.includes(name);
  return `<button type="button" class="lit-tag ${active ? "is-active" : ""}" data-lit-method="${escapeHtml(name)}" aria-pressed="${active}" title="加入「${escapeHtml(name)}」筛选">#${escapeHtml(name)}</button>`;
}

function litAuthorLink(name) {
  const active = state.litAuthors.includes(name);
  return `<button type="button" class="lit-author-link ${active ? "is-active" : ""}" data-lit-author="${escapeHtml(name)}" aria-pressed="${active}" title="加入 ${escapeHtml(name)} 的筛选">${escapeHtml(name)}</button>`;
}

const STEP_PARAM_LABELS = {
  concentration_mmol: "浓度 (mmol)",
  solution_volume_ul: "溶液体积 (µL)",
  spin_speed_rpm: "转速 (rpm)",
  acceleration_rpm_s: "加速度 (rpm/s)",
  spin_time_s: "旋涂时间 (s)",
  annealing_temperature_C: "退火温度 (℃)",
  annealing_time_min: "退火时间 (min)",
  annealing_atmosphere: "退火气氛",
  post_anneal_transfer: "退火后转移",
  solvent: "溶剂",
  substrate: "基底",
  temperature_C: "温度 (℃)",
  time_min: "时间 (min)",
  atmosphere: "气氛",
  ratio: "配比",
  molar_ratio: "摩尔比",
  thickness_nm: "厚度 (nm)",
  rpm: "转速 (rpm)",
};

const STEP_PARAM_WORDS = {
  concentration: "浓度", temperature: "温度", time: "时间", speed: "转速", thickness: "厚度",
  ratio: "配比", volume: "体积", pressure: "压力", power: "功率", duration: "时长",
  atmosphere: "气氛", method: "方法", material: "材料", transfer: "转移",
};
const STEP_UNIT_TOKENS = new Set(["mg", "ml", "ul", "mmol", "nm", "min", "s", "c", "rpm", "a", "v", "wt", "deg", "sccm"]);

function stepParamLabel(key) {
  if (STEP_PARAM_LABELS[key]) return STEP_PARAM_LABELS[key];
  const parts = String(key).split("_").filter(Boolean);
  const units = [];
  while (parts.length > 1 && STEP_UNIT_TOKENS.has(parts[parts.length - 1].toLowerCase())) units.unshift(parts.pop());
  const words = parts.map((part) => STEP_PARAM_WORDS[part.toLowerCase()] || part);
  let label = words.join(" ").trim();
  label = label.replace(/\bNiox\b/gi, "NiOx").replace(/\bIto\b/gi, "ITO").replace(/\bSno2\b/gi, "SnO2");
  label = label.replace(/^[a-z]/, (c) => c.toUpperCase());
  if (!units.length) return label;
  const unitText = units.map((unit) => (unit.toLowerCase() === "c" ? "℃" : unit.toLowerCase())).join("/");
  return `${label} (${unitText})`;
}

function flattenParams(value, out) {
  const list = out || [];
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenParams(entry, list));
    return list;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (item && typeof item === "object") flattenParams(item, list);
      else list.push({ key, value: String(item) });
    });
  }
  return list;
}

function extractJsonPairs(raw) {
  const pairs = {};
  const pattern = /"([A-Za-z0-9_%.\- ]+)"\s*:\s*("((?:[^"\\]|\\.)*)"|-?\d+(?:\.\d+)?|true|false|null)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    pairs[match[1]] = match[3] !== undefined ? match[3] : match[2];
  }
  return pairs;
}

function splitStepDetail(detail) {
  const source = String(detail || "");
  let prose = "";
  const blocks = [];
  let index = 0;
  while (index < source.length) {
    const start = source[index];
    if (start === "{" || start === "[") {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let cursor = index;
      for (; cursor < source.length; cursor += 1) {
        const character = source[cursor];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{" || character === "[") depth += 1;
        else if (character === "}" || character === "]") {
          depth -= 1;
          if (depth === 0) { cursor += 1; break; }
        }
      }
      const raw = source.slice(index, cursor);
      let parsedOk = false;
      if (depth === 0) {
        try {
          blocks.push(JSON.parse(raw));
          parsedOk = true;
        } catch (error) { /* truncated or malformed JSON below */ }
      }
      if (!parsedOk && /"[^"]{1,60}"\s*:/.test(raw)) {
        blocks.push(extractJsonPairs(raw));
        parsedOk = true;
      }
      if (parsedOk) {
        prose += " ";
        index = cursor;
        continue;
      }
    }
    prose += start;
    index += 1;
  }
  const params = blocks.flatMap((block) => flattenParams(block, []));
  const cleaned = prose.replace(/\s{2,}/g, " ").replace(/\s+([，,。；;])/g, "$1").trim();
  return { prose: params.length ? cleaned.replace(/[；;，,、:：\s]+$/, "") : cleaned, params };
}

function isNumericStepName(name) {
  return /^\s*\d+\s*[.、)]?\s*$/.test(String(name || ""));
}

function stepMarkup(step) {
  const paramText = (step.params || [])
    .map((param) => `${stepParamLabel(param.key)} ${param.value}`)
    .join("，");
  const body = [step.prose || step.detail || "", paramText ? `（${paramText}）` : ""].filter(Boolean).join("");
  if (isNumericStepName(step.name)) return escapeHtml(body);
  return `<strong>${escapeHtml(step.name)}</strong>${body ? `：${escapeHtml(body)}` : ""}`;
}

function literatureCard(item) {
  const isEnglish = typeof LABDESK_LANG !== "undefined" && LABDESK_LANG === "en";
  const english = (isEnglish && item.en) ? item.en : null;
  const chinese = (!isEnglish && item.zh) ? item.zh : null;
  const steps = english
    ? literatureSteps({ fabrication: JSON.stringify(english.fabrication || []) })
    : chinese
      ? literatureSteps({ fabrication: JSON.stringify(chinese.fabrication || []) })
      : literatureSteps(item);
  const tags = litMethods(item);
  const authors = litAuthors(item);
  const study = english?.study_object || item.study_object;
  const title = english?.title || item.title;
  const summary = english?.summary || item.summary;
  const meta = [item.journal, item.year, study].filter(Boolean).join(" · ");
  const open = state.litExpandAll ? " open" : "";
  return `<article class="section-card lit-card" data-literature-id="${escapeHtml(item.id)}">
    <div class="lit-head"><span class="system-badge">${escapeHtml(systemName(item.system))}</span><span class="lit-date">${formatDate(item.updatedAt || item.createdAt)}</span></div>
    <h3>${escapeHtml(title)}</h3>
    ${meta ? `<p class="lit-meta">${escapeHtml(meta)}</p>` : ""}
    ${item.first_author || authors.length ? `<p class="lit-authors">${item.first_author ? `一作 ${escapeHtml(item.first_author)}` : ""}${item.first_author && authors.length ? " · " : ""}${authors.length ? `通讯 ${authors.map(litAuthorLink).join("、")}` : ""}</p>` : ""}
    ${tags.length ? `<div class="lit-tags">${tags.map(litTagButton).join("")}</div>` : ""}
    <details class="lit-details"${open}><summary>${icon("book")}分析结论</summary>${summary ? `<p class="lit-detail-text">${escapeHtml(summary)}</p>` : `<p class="lit-detail-text is-empty">还没有写分析结论</p>`}</details>
    ${steps.length ? `<details class="lit-details"${open}><summary>${icon("tool")}器件制备流程（${steps.length} 步）</summary><ol class="lit-step-list">${steps.map((step) => `<li>${stepMarkup(step)}</li>`).join("")}</ol></details>` : ""}
    <div class="lit-foot">
      ${item.link ? `<a class="file-chip" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${icon("external")}原文链接</a>` : `<span class="file-chip is-muted">${icon("file")}未附链接</span>`}
      <span class="lit-person">${escapeHtml(item.person || "组内共享")}</span>
      ${(typeof LABDESK_LANG !== "undefined" && LABDESK_LANG === "en" && !item.en) ? `<button class="subtle-link" data-translate-lit="${escapeHtml(item.id)}">翻译为英文</button>` : ""}
      <button class="subtle-link" data-action="edit-literature" data-id="${escapeHtml(item.id)}">${icon("check")}编辑</button>
      <button class="subtle-link danger" data-action="delete-literature" data-id="${escapeHtml(item.id)}">删除</button>
    </div>
  </article>`;
}

function labRecordCard(record) {
  const analysis = record.analysis || {};
  const deltas = Object.entries(analysis.deltas || {});
  const files = record.files || [];
  return `<article class="section-card lab-card" data-record-id="${escapeHtml(record.id)}">
    <div class="lab-head"><span class="system-badge">${escapeHtml(systemName(record.system))}</span><div class="lab-meta"><strong>${escapeHtml(record.person || "未署名")}</strong><span>${formatDate(record.createdAt, true)}</span></div><button class="text-button lab-delete" data-action="delete-measure" data-id="${escapeHtml(record.id)}" title="删除这条记录">${icon("close")}</button></div>
    ${record.conditions ? `<p class="lab-conditions">${escapeHtml(record.conditions)}</p>` : ""}
    ${record.transcript ? `<p class="lab-transcript">${icon("mic")}${escapeHtml(record.transcript)}</p>` : ""}
    <div class="record-analysis-body">
      ${analysis.trend ? `<div class="lab-analysis"><p class="lab-summary">${escapeHtml(analysis.summary || "本次记录已归档。")}</p><p>${escapeHtml(analysis.trend)}</p></div>` : `<p class="analysis-pending">还没有趋势反馈，可以点下面重新分析。</p>`}
      ${deltas.length ? `<div class="delta-row">${deltas.map(([, item]) => `<span class="delta-chip ${item.direction.includes("提升") ? "up" : item.direction.includes("下降") ? "down" : "flat"}">${escapeHtml(item.name)} ${escapeHtml(item.direction)}</span>`).join("")}</div>` : ""}
      ${(analysis.keywords || []).length ? `<div class="keyword-row">${analysis.keywords.map((word) => `<span class="keyword">#${escapeHtml(word)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="lab-foot">
      ${files.map((file, index) => `<button class="file-chip" data-download-measure="${escapeHtml(record.id)}" data-file-index="${index}">${icon("file")}${escapeHtml(file.name)}</button>`).join("")}
      <button class="subtle-link" data-action="reanalyze" data-id="${escapeHtml(record.id)}">${icon("spark")}重新分析</button>
    </div>
  </article>`;
}

function litHit(values, picked, matchAll) {
  if (!picked.length) return true;
  return matchAll ? picked.every((name) => values.includes(name)) : picked.some((name) => values.includes(name));
}

function filterLiterature(items, methods, authors, matchAll, additives = []) {
  return items.filter((item) => litHit(litMethods(item), methods, matchAll) && litHit(litAuthors(item), authors, matchAll) && litHit(litAdditives(item), additives, matchAll));
}

function litFreqRow(entry, kind, active, disabled) {
  const attribute = kind === "method" ? "data-lit-method" : kind === "additive" ? "data-lit-additive" : "data-lit-author";
  const maximum = entry.maximum || entry.count || 1;
  return `<button type="button" class="freq-row ${active ? "is-active" : ""}${disabled ? " is-disabled" : ""}" ${attribute}="${escapeHtml(entry.key)}" aria-pressed="${active}"${disabled ? " disabled" : ""} title="${escapeHtml(`${entry.label}：${entry.count} 篇`)}">
      <span class="freq-check" aria-hidden="true">${active ? "✓" : "+"}</span>
      <span class="freq-name">${escapeHtml(entry.label)}</span>
      <span class="freq-track"><i style="width:${Math.max(6, Math.round((entry.count / maximum) * 100))}%"></i></span>
      <strong>${entry.count}</strong>
    </button>`;
}

function litFreqStatic(entry) {
  const maximum = entry.maximum || entry.count || 1;
  return `<div class="freq-row is-static" title="${escapeHtml(`${entry.label}：${entry.count} 篇`)}">
      <span class="freq-check" aria-hidden="true">·</span>
      <span class="freq-name">${escapeHtml(entry.label)}</span>
      <span class="freq-track"><i style="width:${Math.max(6, Math.round((entry.count / maximum) * 100))}%"></i></span>
      <strong>${entry.count}</strong>
    </div>`;
}

function literatureStats(items, matched) {
  if (!items.length) return "";
  const systems = new Set();
  const methods = new Map();
  const authors = new Map();
  const additives = new Map();
  items.forEach((item) => {
    systems.add(item.system);
    litMethods(item).forEach((name) => methods.set(name, (methods.get(name) || 0) + 1));
    litAuthors(item).forEach((name) => authors.set(name, (authors.get(name) || 0) + 1));
    litAdditives(item).forEach((name) => additives.set(name, (additives.get(name) || 0) + 1));
  });
  const ranked = (map, count) => [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, count)
    .map(([key, total]) => ({ key, label: key, count: total }));
  const methodEntries = ranked(methods, 60).filter((entry) => entry.key !== "其他");
  const authorEntries = ranked(authors, 40);
  const additiveEntries = ranked(additives, 40);
  const methodMax = Math.max(1, ...methodEntries.map((entry) => entry.count));
  const authorMax = Math.max(1, ...authorEntries.map((entry) => entry.count));
  const additiveMax = Math.max(1, ...additiveEntries.map((entry) => entry.count));
  methodEntries.forEach((entry) => { entry.maximum = methodMax; });
  authorEntries.forEach((entry) => { entry.maximum = authorMax; });
  additiveEntries.forEach((entry) => { entry.maximum = additiveMax; });

  const methodDisabled = new Set(methodEntries
    .filter((entry) => !state.litMethods.includes(entry.key)
      && filterLiterature(items, [...state.litMethods, entry.key], state.litAuthors, state.litMatchAll, state.litAdditives).length === 0)
    .map((entry) => entry.key));
  const authorDisabled = new Set(authorEntries
    .filter((entry) => !state.litAuthors.includes(entry.key)
      && filterLiterature(items, state.litMethods, [...state.litAuthors, entry.key], state.litMatchAll, state.litAdditives).length === 0)
    .map((entry) => entry.key));
  const additiveDisabled = new Set(additiveEntries
    .filter((entry) => !state.litAdditives.includes(entry.key)
      && filterLiterature(items, state.litMethods, state.litAuthors, state.litMatchAll, [...state.litAdditives, entry.key]).length === 0)
    .map((entry) => entry.key));

  const chips = [
    ...state.litMethods.map((name) => `<button type="button" class="lit-chip" data-lit-method="${escapeHtml(name)}">${escapeHtml(name)} ${icon("close")}</button>`),
    ...state.litAuthors.map((name) => `<button type="button" class="lit-chip is-author" data-lit-author="${escapeHtml(name)}">${escapeHtml(name)} ${icon("close")}</button>`),
    ...state.litAdditives.map((name) => `<button type="button" class="lit-chip is-additive" data-lit-additive="${escapeHtml(name)}">${escapeHtml(name)} ${icon("close")}</button>`),
  ];
  const selected = chips.length;
  const hitLabel = selected ? `已选 ${selected} · 命中 <strong>${matched.length}</strong> / ${items.length}` : `共 ${items.length} 篇`;
  const open = state.litStatsOpen ? " open" : "";
  return `<details class="lit-summary"${open}>
    <summary>
      <span class="lit-summary-facts"><strong>${items.length}</strong> 篇 · <strong>${systems.size}</strong> 个方向 · <strong>${authors.size}</strong> 位通讯</span>
      <span class="lit-summary-hit">${selected ? `已选 ${selected} · 命中 ${matched.length}` : ""}</span>
      <span class="lit-summary-toggle">筛选</span>
    </summary>
    <div class="lit-controls">
      <div class="lit-controls-row">
        <span class="lit-controls-label">条件</span>
        <div class="lit-chip-row">${chips.length ? chips.join("") : `<span class="lit-chip-empty">还没有条件，点下面任意一条加入（可多选）</span>`}</div>
      </div>
      <div class="lit-controls-row lit-controls-meta">
        <span class="lit-hit">${hitLabel}</span>
        <div class="match-toggle"><button type="button" class="match-button ${state.litMatchAll ? "" : "is-active"}" data-lit-match="any">任一满足</button><button type="button" class="match-button ${state.litMatchAll ? "is-active" : ""}" data-lit-match="all">全部满足</button></div>
        ${selected ? `<button type="button" class="subtle-link" data-clear-lit-filters>清除</button>` : ""}
      </div>
    </div>
    <div class="lit-freq-grid">
      <div class="lit-freq"><h4>方法 / 策略 <span>${methodEntries.length} 类</span></h4><div class="lit-freq-list">${methodEntries.length ? methodEntries.map((entry) => litFreqRow(entry, "method", state.litMethods.includes(entry.key), methodDisabled.has(entry.key))).join("") : `<p class="freq-empty">暂无</p>`}</div></div>
      <div class="lit-freq"><h4>通讯作者 <span>${authors.size} 位</span></h4><div class="lit-freq-list">${authorEntries.length ? authorEntries.map((entry) => litFreqRow(entry, "author", state.litAuthors.includes(entry.key), authorDisabled.has(entry.key))).join("") : `<p class="freq-empty">暂无</p>`}</div></div>
      ${additiveEntries.length ? `<div class="lit-freq"><h4>添加剂 / 钝化分子 <span>${additives.size} 种</span></h4><div class="lit-freq-list">${additiveEntries.map((entry) => litFreqRow(entry, "additive", state.litAdditives.includes(entry.key), additiveDisabled.has(entry.key))).join("")}</div></div>` : ""}
    </div>
    <p class="freq-hint">${icon("check")}点「+」加入条件，再点一次取消；灰掉的条目在当前条件下没有结果。</p>
  </details>`;
}

function renderCollab() {
  const tab = state.collabTab || "literature";
  const filter = state.systemFilter || "all";
  const scoped = (state.data?.literature || [])
    .filter((item) => filter === "all" || item.system === filter)
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  const query = (state.litQuery || "").trim().toLowerCase();
  const searched = query ? scoped.filter((item) => [
    item.title, item.summary, item.journal, item.doi, item.study_object,
    item.methods, item.corresponding, (item.keywords || []).join(" "),
  ].join(" ").toLowerCase().includes(query)) : scoped;
  const literature = filterLiterature(searched, state.litMethods, state.litAuthors, state.litMatchAll, state.litAdditives);
  const labRecords = (state.data?.labRecords || []).filter((item) => filter === "all" || item.system === filter);
  const filters = [{ id: "all", name: "全部方向" }, ...(state.data?.systems || [])];
  const tagFiltered = Boolean(state.litMethods.length || state.litAuthors.length || state.litAdditives.length || query);
  const action = `<button class="button button-secondary" data-route="research">${icon("file")}PDF 资料库</button><button class="button button-primary" data-action="${tab === "literature" ? "add-literature" : "new-measure"}">${icon("plus")}${tab === "literature" ? "添加文献分析" : "记录实验进展"}</button>`;
  return `${pageHead("协作平台", "文献分析与实验室进展分开管理，都按材料方向归档", action)}
    <div class="collab-tabs" role="tablist">
      <button class="collab-tab ${tab === "literature" ? "is-active" : ""}" data-collab-tab="literature" role="tab">${icon("book")}文献协作分析平台<span>${(state.data?.literature || []).length}</span></button>
      <button class="collab-tab ${tab === "lab" ? "is-active" : ""}" data-collab-tab="lab" role="tab">${icon("spark")}实验室进展协作平台<span>${(state.data?.labRecords || []).length}</span></button>
    </div>
    <div class="filter-bar"><div class="filter-options">${filters.map((item) => `<button class="filter-button ${filter === item.id ? "is-active" : ""}" data-system-filter="${item.id}">${escapeHtml(item.name)}</button>`).join("")}</div><span class="filter-spacer"></span><span class="muted-count">${tab === "literature" ? (tagFiltered ? `${literature.length} / ${scoped.length} 条文献分析` : `${literature.length} 条文献分析`) : `${labRecords.length} 条实验进展`}</span></div>
    ${tab === "literature" ? `<div class="lit-search-bar"><input id="lit-search" class="lit-search" type="search" value="${escapeHtml(state.litQuery)}" placeholder="搜索标题、方法、通讯作者、添加剂或关键词" autocomplete="off">${state.litQuery ? `<button type="button" class="subtle-link" data-clear-lit-search>清除</button>` : ""}</div>` : ""}
    ${tab === "literature" ? literatureStats(scoped, literature) : ""}
    ${tab === "literature" && literature.length ? `<div class="lit-toolbar"><span></span><button type="button" class="subtle-link" data-action="toggle-lit-details">${icon("book")}${state.litExpandAll ? "全部收起" : "全部展开"}</button></div>` : ""}
    ${tab === "literature"
      ? (literature.length ? `<div class="lit-grid">${literature.slice(0, state.litPage).map(literatureCard).join("")}</div>${literature.length > state.litPage ? `<div class="load-more-wrap"><button class="button button-secondary" data-action="more-lit">加载更多 (${Math.min(state.litPage, literature.length)}/${literature.length})</button></div>` : ""}` : `<div class="section-card empty-state"><span class="empty-icon">${icon("book")}</span><strong>${tagFiltered ? "当前筛选下没有文献" : "这个方向还没有文献分析"}</strong><p>${tagFiltered ? "换一个方法标签或通讯作者，也可以清除筛选。" : "导入分析结论与链接即可，不需要上传 PDF 原件。"}</p>${tagFiltered ? `<button class="button button-secondary button-compact" data-clear-lit-filters>清除筛选</button>` : `<button class="button button-primary button-compact" data-action="add-literature">${icon("plus")}添加第一条</button>`}</div>`)
      : (labRecords.length ? `<div class="lab-list">${labRecords.map(labRecordCard).join("")}</div>` : `<div class="section-card empty-state"><span class="empty-icon">${icon("spark")}</span><strong>这个方向还没有实验进展</strong><p>在测试电脑上打开「测量记录」，语音说明条件并选择原始数据。</p><button class="button button-primary button-compact" data-action="new-measure">${icon("plus")}记录一条</button></div>`)}`;
}

function currentAuthor() {
  return (localStorage.getItem("labdesk.personName") || "").trim();
}

function voterId() {
  const name = currentAuthor();
  if (name) return name;
  let id = localStorage.getItem("labdesk.voterId");
  if (!id) {
    id = "anon-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("labdesk.voterId", id);
  }
  return id;
}

function ideaAgeText(createdAt) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";
  const hours = (Date.now() - created.getTime()) / 36e5;
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${Math.floor(hours)} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function ideaStatusBadge(idea) {
  if (idea.done) return `<span class="idea-badge is-done">${icon("check")}已上线</span>`;
  if (idea.status === "approved") return `<span class="idea-badge is-approved">${icon("check")}可实施</span>`;
  return `<span class="idea-badge">征集中</span>`;
}

function ideaProgress(idea) {
  if (idea.done) return "已经改进并上线";
  const ups = idea.upvoteCount || 0;
  if (idea.status === "approved") return "已达到实施条件，等待排期";
  const created = new Date(idea.createdAt);
  const hours = Number.isNaN(created.getTime()) ? 0 : (Date.now() - created.getTime()) / 36e5;
  const left = Math.max(0, 48 - hours);
  const down = idea.downvoteCount || 0;
  if (down > 0) return `还有 ${down} 人反对，先讨论清楚再推进（需 ${Math.max(0, 5 - ups)} 个赞）`;
  return `还差 ${Math.max(0, 5 - ups)} 个赞，或 ${Math.ceil(left)} 小时后无人反对自动通过`;
}

function ideaCard(idea) {
  const author = voterId();
  const votedUp = (idea.upvotes || []).includes(author);
  const votedDown = (idea.downvotes || []).includes(author);
  return `<article class="idea-card" data-idea-id="${escapeHtml(idea.id)}">
    <div class="idea-head">${ideaStatusBadge(idea)}<span class="idea-meta">${escapeHtml(idea.author || "匿名")} · ${ideaAgeText(idea.createdAt)}</span></div>
    <h3>${escapeHtml(idea.title)}</h3>
    ${idea.body ? `<p class="idea-body">${escapeHtml(idea.body)}</p>` : ""}
    <div class="idea-foot">
      <button type="button" class="idea-vote ${votedUp ? "is-up" : ""}" data-vote-idea="${escapeHtml(idea.id)}" data-idea-direction="up" aria-pressed="${votedUp}" title="支持这个想法">${icon("check")}<span>支持</span><strong>${idea.upvoteCount || 0}</strong></button>
      <button type="button" class="idea-vote ${votedDown ? "is-down" : ""}" data-vote-idea="${escapeHtml(idea.id)}" data-idea-direction="down" aria-pressed="${votedDown}" title="反对或需要再讨论">${icon("close")}<span>反对</span><strong>${idea.downvoteCount || 0}</strong></button>
      <span class="idea-progress">${ideaProgress(idea)}</span>
      <button type="button" class="subtle-link" data-idea-done="${escapeHtml(idea.id)}">${idea.done ? "取消已上线" : "标记已上线"}</button>
      <button type="button" class="subtle-link danger" data-action="delete-idea" data-id="${escapeHtml(idea.id)}">删除</button>
    </div>
  </article>`;
}

function rantCard(rant) {
  const voted = (rant.upvotes || []).includes(voterId());
  return `<article class="rant-card">
    <p class="rant-body">${escapeHtml(rant.body || rant.title)}</p>
    <div class="rant-foot">
      <span class="rant-time">${ideaAgeText(rant.createdAt)}</span>
      <button type="button" class="idea-vote ${voted ? "is-up" : ""}" data-vote-idea="${escapeHtml(rant.id)}" data-idea-direction="up" aria-pressed="${voted}">${icon("check")}<span>同感</span><strong>${rant.upvoteCount || 0}</strong></button>
      <button type="button" class="subtle-link danger" data-action="delete-idea" data-id="${escapeHtml(rant.id)}">删除</button>
    </div>
  </article>`;
}

function openWorkshop(url, title) {
  const overlay = document.getElementById("workshop-overlay");
  const frame = document.getElementById("workshop-frame");
  const label = document.getElementById("workshop-title");
  if (!overlay || !frame) {
    window.location.href = url;
    return;
  }
  if (label) label.textContent = title || "";
  frame.src = url;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  history.pushState({ workshop: true }, "", url);
}

function closeWorkshop(fromPop) {
  const overlay = document.getElementById("workshop-overlay");
  const frame = document.getElementById("workshop-frame");
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.style.overflow = "";
  if (frame) frame.src = "about:blank";
  if (!fromPop) history.back();
}

function renderForum() {
  const all = [...(state.data?.ideas || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const ideas = all.filter((item) => (item.kind || "idea") === "idea");
  const rants = all.filter((item) => item.kind === "rant");
  const open = ideas.filter((idea) => idea.status === "open" && !idea.done);
  const ready = ideas.filter((idea) => idea.status === "approved" && !idea.done);
  const done = ideas.filter((idea) => idea.done);
  const tab = ["rants", "workshop", "trash"].includes(state.forumTab) ? state.forumTab : "ideas";
  const workshop = state.data?.workshop || [];
  const trash = state.data?.trash || [];
  const action = tab === "rants"
    ? `<button class="button button-primary" data-action="new-rant">${icon("plus")}匿名吐槽</button>`
    : tab === "workshop"
      ? ""
      : `<button class="button button-primary" data-action="new-idea">${icon("plus")}提个想法</button>`;
  const section = (title, hint, items, empty) => `<section class="idea-section">
      <div class="idea-section-head"><h2>${title}</h2><span>${hint}</span></div>
      ${items.length ? `<div class="idea-list">${items.map(ideaCard).join("")}</div>` : `<div class="section-card empty-state compact"><span class="empty-icon">${icon("forum")}</span><strong>${empty}</strong></div>`}
    </section>`;
  const subtitle = tab === "rants" ? "匿名说真话：卫生、仪器、流程，哪里别扭都可以讲"
    : tab === "workshop" ? "组员自己写的小工具，点开即用"
    : tab === "trash" ? "删除的内容先放这里，可以恢复"
    : "提想法、投票，达到条件就排期实现";
  return `${pageHead("Harness 平台", subtitle, action)}
    <div class="collab-tabs" role="tablist">
      <button class="collab-tab ${tab === "ideas" ? "is-active" : ""}" data-forum-tab="ideas" role="tab">${icon("spark")}功能想法<span>${ideas.length}</span></button>
      <button class="collab-tab ${tab === "rants" ? "is-active" : ""}" data-forum-tab="rants" role="tab">${icon("forum")}匿名吐槽<span>${rants.length}</span></button>
      <button class="collab-tab ${tab === "workshop" ? "is-active" : ""}" data-forum-tab="workshop" role="tab">${icon("tool")}创意工坊<span>${workshop.length}</span></button>
      <button class="collab-tab ${tab === "trash" ? "is-active" : ""}" data-forum-tab="trash" role="tab">${icon("close")}回收站<span>${trash.length}</span></button>
    </div>
    ${tab === "trash"
      ? (trash.length ? `<div class="trash-list">${trash.map((entry) => {
          const item = entry.item || {};
          const kind = entry.collection === "literature" ? "文献" : entry.collection === "labRecords" ? "测量" : entry.collection === "ideas" ? "想法" : "其他";
          const title = item.title || item.conditions || item.body || "（无标题）";
          return `<article class="trash-row">
            <span class="trash-kind">${kind}</span>
            <div class="trash-main"><strong>${escapeHtml(String(title).slice(0, 80))}</strong><small>删除于 ${formatDate(entry.deletedAt, true)}</small></div>
            <button class="subtle-link" data-restore-trash="${escapeHtml(entry.trashId)}">恢复</button>
            <button class="subtle-link danger" data-purge-trash="${escapeHtml(entry.trashId)}">彻底删除</button>
          </article>`;
        }).join("")}</div>` : `<div class="section-card empty-state compact"><span class="empty-icon">${icon("close")}</span><strong>回收站是空的</strong></div>`)
      : tab === "workshop"
      ? (workshop.length ? `<div class="workshop-grid">${workshop.map((item) => `<article class="workshop-card">
          <div class="workshop-head"><span class="workshop-icon">${icon("tool")}</span><span class="workshop-author">${escapeHtml(item.author || "组内")}</span></div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.desc || "")}</p>
          <button type="button" class="button button-secondary button-compact" data-open-workshop="${escapeHtml(item.url)}" data-workshop-title="${escapeHtml(item.title)}">打开${icon("arrow")}</button>
        </article>`).join("")}</div>` : `<div class="section-card empty-state compact"><span class="empty-icon">${icon("tool")}</span><strong>还没有工具</strong><p>写好的小工具可以放到创意工坊里。</p></div>`)
      : tab === "rants"
      ? (rants.length ? `<div class="rant-list">${rants.map(rantCard).join("")}</div>` : `<div class="section-card empty-state compact"><span class="empty-icon">${icon("forum")}</span><strong>还没有吐槽</strong><p>点右上角，匿名说两句。</p></div>`)
      : `${section("可以实施", `${ready.length} 条等待排期`, ready, "还没有达到条件的想法")}
    ${section("征集中", `${open.length} 条正在收集意见`, open, "还没有新想法，点右上角提一个")}
    ${done.length ? section("已上线", `${done.length} 条已完成`, done, "") : ""}`}`;
}

function rantDialog() {
  const content = `<form class="form-grid" id="rant-form">
    <div class="field"><label for="rant-body">想吐槽什么</label><textarea id="rant-body" maxlength="800" rows="4" required placeholder="例如：五号楼台面总是堆满样品，没人清理；或者通风橱灯坏了很久"></textarea><span class="field-help">完全匿名，不记录姓名。</span></div>
    <p class="inline-alert" id="rant-error" role="alert"></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-rant" type="button">匿名发布 ${icon("check")}</button>`;
  modal("匿名吐槽", "只记录内容，不记录是谁说的。", content, buttons);
  document.getElementById("save-rant").addEventListener("click", saveRant);
}

async function saveRant(event) {
  const button = event.currentTarget;
  const error = document.getElementById("rant-error");
  const form = document.getElementById("rant-form");
  if (!form.reportValidity()) return;
  button.disabled = true;
  button.textContent = "正在发布…";
  try {
    await api("/api/ideas", { method: "POST", body: JSON.stringify({
      kind: "rant",
      body: document.getElementById("rant-body").value.trim(),
    }) });
    closeModal();
    state.forumTab = "rants";
    await reloadState();
    showToast("已匿名发布");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `匿名发布 ${icon("check")}`;
  }
}

function ideaDialog() {
  const author = currentAuthor();
  const content = `<form class="form-grid" id="idea-form">
    <div class="field"><label for="idea-title">想法标题</label><input id="idea-title" maxlength="120" required placeholder="例如：测量记录支持直接拖拽多个 CSV"></div>
    <div class="field"><label for="idea-body">具体说明（可选）</label><textarea id="idea-body" maxlength="2000" rows="4" placeholder="现在哪里不方便、希望变成什么样、有什么例子"></textarea></div>
    <div class="field"><label for="idea-author">你的名字</label><input id="idea-author" maxlength="60" required value="${escapeHtml(author)}" placeholder="方便大家知道是谁提的"></div>
    <p class="inline-alert" id="idea-error" role="alert"></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-idea" type="button">发布 ${icon("check")}</button>`;
  modal("提个想法", "发布后其他人可以点赞或反对，达到条件就会进入实施清单。", content, buttons);
  document.getElementById("save-idea").addEventListener("click", saveIdea);
}

async function saveIdea(event) {
  const button = event.currentTarget;
  const error = document.getElementById("idea-error");
  const form = document.getElementById("idea-form");
  if (!form.reportValidity()) return;
  const author = document.getElementById("idea-author").value.trim();
  button.disabled = true;
  button.textContent = "正在发布…";
  try {
    await api("/api/ideas", { method: "POST", body: JSON.stringify({
      title: document.getElementById("idea-title").value.trim(),
      body: document.getElementById("idea-body").value.trim(),
      author,
    }) });
    localStorage.setItem("labdesk.personName", author);
    closeModal();
    await reloadState();
    showToast("想法已发布，等大家投票");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `发布 ${icon("check")}`;
  }
}

function patchIdea(idea) {
  if (!idea || !state.data) return;
  const list = state.data.ideas || [];
  const index = list.findIndex((item) => item.id === idea.id);
  if (index >= 0) list[index] = idea;
  else list.unshift(idea);
}

async function voteIdea(id, direction) {
  const author = voterId();
  const card = document.querySelector(`[data-idea-id="${CSS.escape(id)}"]`);
  if (card) card.classList.add("is-pending");
  try {
    const response = await api("/api/ideas/vote", { method: "POST", body: JSON.stringify({ id, direction, author }) });
    const data = await response.json();
    patchIdea(data.idea);
    render();
  } catch (problem) {
    if (card) card.classList.remove("is-pending");
    showToast(problem.message);
  }
}

function renderMeasure() {
  const records = state.data?.labRecords || [];
  const llm = state.data?.llm || {};
  const action = `<button class="button button-primary" data-action="new-measure">${icon("plus")}新建测量记录</button>`;
  return `${pageHead("测量记录", "测完太阳能电池后，用语音说明条件、选择原始数据，模型返回趋势反馈", action)}
    ${records.length ? `<div class="lab-list">${records.map(labRecordCard).join("")}</div>` : `<div class="section-card empty-state"><span class="empty-icon">${icon("mic")}</span><strong>还没有测量记录</strong><p>在测试电脑上打开这一页（建议用 Edge 或 Chrome 安装成桌面应用），测完点「新建测量记录」。</p><button class="button button-primary button-compact" data-action="new-measure">${icon("plus")}新建测量记录</button></div>`}
`;
}

function measureDialog() {
  const person = localStorage.getItem("labdesk.personName") || "";
  const content = `<form class="form-grid" id="measure-form">
    <div class="field"><label for="measure-system">材料方向</label><select id="measure-system" required>${systemOptions("sn-pb")}</select></div>
    <div class="field"><label for="measure-person">记录人</label><input id="measure-person" maxlength="100" value="${escapeHtml(person)}" required placeholder="填写姓名"></div>
    <div class="field"><label for="measure-conditions">本次测试条件 <span aria-hidden="true">*</span></label><textarea id="measure-conditions" maxlength="1200" rows="4" placeholder="例如：锡铅体系，加入分子 B，退火 160 度 15 分钟，测的是第 3 批第 2 片" required></textarea><div class="dictation-row"><button class="button button-secondary button-compact" id="dictate-button" type="button">${icon("mic")}语音输入</button><span class="field-help">点一下开始说话，说完再点一次结束；录音在 Mac Mini 上转成文字填进上面的框，可边说边改。</span></div></div>
    <div class="field"><label for="measure-files">原始数据（可选）</label><input id="measure-files" type="file" accept=".csv,.txt,.tsv,.dat,.json,.xlsx" multiple><span class="field-help" id="measure-file-label">最多 3 个文件，单个不超过 8 MB；原件只保存在 Mac Mini。</span></div>
    <p class="inline-alert" id="measure-error" role="alert"></p>
    <p class="mic-help" id="mic-help" hidden></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-measure" type="button">保存并分析 ${icon("check")}</button>`;
  modal("新建测量记录", "保存后系统会把条件与原始数据对应起来，并生成趋势反馈。", content, buttons);
  state.dictatedText = "";
  document.getElementById("dictate-button").addEventListener("click", (event) => startDictation(event.currentTarget));
  document.getElementById("measure-files").addEventListener("change", (event) => {
    const files = [...(event.currentTarget.files || [])];
    const label = document.getElementById("measure-file-label");
    if (!label) return;
    if (files.length > 3) {
      document.getElementById("measure-error").textContent = "一次最多 3 个原始数据文件。";
      event.currentTarget.value = "";
      label.textContent = "最多 3 个文件，单个不超过 8 MB；原件只保存在 Mac Mini。";
      return;
    }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      document.getElementById("measure-error").textContent = "单个文件不能超过 8 MB。";
      event.currentTarget.value = "";
      return;
    }
    label.textContent = files.length ? `已选择 ${files.map((file) => file.name).join("、")}` : "最多 3 个文件，单个不超过 8 MB；原件只保存在 Mac Mini。";
  });
  document.getElementById("save-measure").addEventListener("click", saveMeasure);
}

async function saveMeasure(event) {
  const button = event.currentTarget;
  const error = document.getElementById("measure-error");
  const form = document.getElementById("measure-form");
  if (!form.reportValidity()) return;
  const person = document.getElementById("measure-person").value.trim();
  const system = document.getElementById("measure-system").value;
  const conditions = document.getElementById("measure-conditions").value.trim();
  const files = [...(document.getElementById("measure-files").files || [])];
  if (!person || !conditions) return;
  button.disabled = true;
  button.textContent = "正在上传…";
  error.textContent = "";
  try {
    const payload = {
      system,
      person,
      conditions,
      transcript: state.dictatedText || "",
      files: await Promise.all(files.map(async (file) => ({ name: file.name, data: await toDataUrl(file) }))),
    };
    const response = await api("/api/lab-records", { method: "POST", body: JSON.stringify(payload) });
    const result = await response.json();
    localStorage.setItem("labdesk.personName", person);
    closeModal();
    state.route = "measure";
    await reloadState();
    showToast("记录已保存，正在生成趋势反馈…");
    analyzeRecord(result.record.id);
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `保存并分析 ${icon("check")}`;
  }
}

async function analyzeRecord(recordId) {
  const card = document.querySelector(`[data-record-id="${CSS.escape(recordId)}"] .record-analysis-body`);
  if (card) card.innerHTML = `<p class="analysis-pending">${icon("clock")}正在生成趋势反馈，请稍候…</p>`;
  try {
    await api("/api/lab-records/analyze", { method: "POST", body: JSON.stringify({ id: recordId }) });
    await reloadState();
  } catch (problem) {
    showToast(problem.message);
    await reloadState().catch(() => {});
  }
}

function setDictateButton(button, mode) {
  if (!button) return;
  button.classList.toggle("is-recording", mode === "recording");
  button.disabled = mode === "busy";
  if (mode === "busy") button.innerHTML = `${icon("clock")}正在识别…`;
  else if (mode === "recording") button.innerHTML = `${icon("mic")}结束录音`;
  else button.innerHTML = `${icon("mic")}语音输入`;
}

function appendSpokenText(field, spoken) {
  if (!field) return;
  const text = String(spoken || "").trim();
  if (!text) return;
  state.dictatedText = [state.dictatedText, text].filter(Boolean).join(" ");
  field.value = [field.value.trim(), text].filter(Boolean).join(" ").trim();
}

function downsampleBuffer(buffer, sourceRate, targetRate) {
  if (targetRate >= sourceRate) return buffer;
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Float32Array(length);
  let offset = 0;
  for (let index = 0; index < length; index += 1) {
    const next = Math.min(buffer.length, Math.round((index + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let source = offset; source < next; source += 1) {
      sum += buffer[source];
      count += 1;
    }
    result[index] = count ? sum / count : 0;
    offset = next;
  }
  return result;
}

function encodeWav(samples, sampleRate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("录音读取失败，请重试。"));
    reader.readAsDataURL(blob);
  });
}

async function recordingToWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error("当前浏览器无法处理录音，请直接输入文字。");
  const context = new AudioCtx();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    return encodeWav(downsampleBuffer(audio.getChannelData(0), audio.sampleRate, 16000), 16000);
  } finally {
    if (context.close) context.close().catch(() => {});
  }
}

async function transcribeAudio(base64Audio) {
  const response = await api("/api/transcribe", { method: "POST", body: JSON.stringify({ audio: base64Audio }) });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return String(result.text || "").trim();
}

function startNativeRecording(button, field) {
  const native = window.LabDeskSpeech;
  if (!native || typeof native.recordStart !== "function") return false;
  state.cancelDictation = false;
  let timer = 0;
  const session = {
    stop: () => {
      clearTimeout(timer);
      try { native.recordStop(); } catch (error) { /* recorder already closed */ }
    },
    cancel: () => {
      clearTimeout(timer);
      state.cancelDictation = true;
      try { native.recordCancel(); } catch (error) { /* recorder already closed */ }
    },
  };
  window.onNativeAudio = async (payload) => {
    clearTimeout(timer);
    state.dictation = null;
    if (state.cancelDictation) {
      state.cancelDictation = false;
      setDictateButton(button, "idle");
      return;
    }
    setDictateButton(button, "busy");
    showToast("正在把录音转成文字…");
    try {
      const text = await transcribeAudio(`data:audio/wav;base64,${payload}`);
      appendSpokenText(field, text);
      showToast(text ? "已转成文字，可直接修改" : "没有识别出内容，请再说一次");
    } catch (problem) {
      showToast(problem.message || "语音识别失败，请直接输入文字。");
    } finally {
      setDictateButton(button, "idle");
    }
  };
  window.onNativeAudioError = (code) => {
    clearTimeout(timer);
    state.dictation = null;
    setDictateButton(button, "idle");
    showToast(`录音失败（${code || "?"}），可直接输入文字`);
  };
  state.dictation = session;
  setDictateButton(button, "recording");
  showToast("正在录音，说完再点一次结束");
  native.recordStart();
  timer = setTimeout(() => { if (state.dictation === session) session.stop(); }, 30000);
  return true;
}

async function startRecordingDictation(button, field) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    showToast("当前环境不能录音，请直接输入文字。");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (problem) {
    if (startNativeRecording(button, field)) return;
    const help = document.getElementById("mic-help");
    const inApp = /LabDeskApp/.test(navigator.userAgent || "");
    if (help) {
      help.hidden = false;
      help.innerHTML = inApp
        ? `录音需要新版工作台 App。<a href="/downloads/ninglab-labdesk-debug.apk">点这里下载新版安装包</a>，覆盖安装后再试。`
        : "浏览器没有拿到麦克风权限，请在地址栏的站点设置里允许麦克风，或直接输入文字。";
    }
    if (window.LabDeskSpeech && typeof window.LabDeskSpeech.startSpeech === "function") {
      startNativeDictation(button, field);
      return;
    }
    showToast("没有拿到麦克风权限，请按提示处理，或直接输入文字。");
    return;
  }
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (problem) {
    stream.getTracks().forEach((track) => track.stop());
    showToast("当前环境不能录音，请直接输入文字。");
    return;
  }
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
  const session = {
    timer: 0,
    stop: () => { try { recorder.stop(); } catch (error) { /* already stopped */ } },
    cancel: () => { state.cancelDictation = true; session.stop(); },
  };
  recorder.onstop = async () => {
    clearTimeout(session.timer);
    stream.getTracks().forEach((track) => track.stop());
    state.dictation = null;
    if (state.cancelDictation) { state.cancelDictation = false; setDictateButton(button, "idle"); return; }
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (!blob.size) { setDictateButton(button, "idle"); showToast("没有录到声音，请再说一次。"); return; }
    setDictateButton(button, "busy");
    showToast("正在把录音转成文字…");
    try {
      const wav = await recordingToWav(blob);
      const text = await transcribeAudio(await blobToBase64(wav));
      appendSpokenText(field, text);
      showToast(text ? "已转成文字，可直接修改" : "没有识别出内容，请再说一次或直接输入文字");
    } catch (problem) {
      showToast(problem.message || "语音识别失败，请直接输入文字。");
    } finally {
      setDictateButton(button, "idle");
    }
  };
  state.dictation = session;
  setDictateButton(button, "recording");
  recorder.start();
  showToast("正在录音，说完再点一次结束");
  session.timer = setTimeout(() => { if (state.dictation === session) session.stop(); }, 60000);
}

function startNativeDictation(button, field) {
  const nativeSpeech = window.LabDeskSpeech;
  if (!nativeSpeech || typeof nativeSpeech.startSpeech !== "function") return;
  const nativeBase = field.value.trim();
  let finished = false;
  window.onNativeSpeechPartial = (text) => {
    const spoken = String(text || "").trim();
    if (spoken && !finished) field.value = [nativeBase, spoken].filter(Boolean).join(" ").trim();
  };
  window.onNativeSpeech = (text) => {
    finished = true;
    const spoken = String(text || "").trim();
    if (spoken) field.value = [nativeBase, spoken].filter(Boolean).join(" ").trim();
    setDictateButton(button, "idle");
    showToast(spoken ? "语音已填入，可直接修改" : "没有识别到内容，可以直接输入文字");
  };
  window.onNativeSpeechError = (code) => {
    finished = true;
    setDictateButton(button, "idle");
    showToast("手机语音识别不可用（" + (code || "?") + "），请更新工作台 App 后重试，或直接输入文字");
  };
  setDictateButton(button, "recording");
  showToast("请说话，识别完成后自动填入");
  try {
    nativeSpeech.startSpeech();
  } catch (error) {
    setDictateButton(button, "idle");
    showToast("无法启动手机语音识别，请直接输入文字。");
  }
}

function startDictation(button) {
  const field = document.getElementById("measure-conditions");
  if (!field) return;
  if (state.dictation) {
    state.dictation.stop();
    state.dictation = null;
    setDictateButton(button, "idle");
    return;
  }
  const asr = state.data?.asr || {};
  if (asr.ready) {
    startRecordingDictation(button, field);
    return;
  }
  if (window.LabDeskSpeech && typeof window.LabDeskSpeech.startSpeech === "function") {
    startNativeDictation(button, field);
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showToast("当前浏览器不支持语音识别，请直接输入文字。");
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  const base = field.value.trim();
  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    state.dictatedText = finalText.trim();
    field.value = [base, finalText + interim].filter(Boolean).join(" ").trim();
  };
  recognition.onerror = (event) => {
    const reason = event?.error || "";
    if (reason === "not-allowed" || reason === "service-not-allowed") showToast("麦克风权限被拒绝，请在浏览器设置中允许后重试。");
    else if (reason === "no-speech") showToast("没有听到声音，请再说一次或直接输入文字。");
    else showToast("语音识别中断，可以直接输入文字。");
  };
  recognition.onend = () => {
    state.dictation = null;
    setDictateButton(button, "idle");
  };
  state.dictation = recognition;
  setDictateButton(button, "recording");
  showToast("开始录音，说完会自动结束。");
  try {
    recognition.start();
  } catch (error) {
    state.dictation = null;
    setDictateButton(button, "idle");
    showToast("无法启动语音识别，可以直接输入文字。");
  }
}

function literatureDialog(item = null) {
  const methods = litMethods(item || {}).join("、");
  const content = `<form class="form-grid" id="literature-form">
    <div class="pdf-import">
      <div class="pdf-import-head">${icon("file")}<strong>上传 PDF 自动整理</strong><span>原件不保存</span></div>
      <div class="pdf-import-row">
        <input id="literature-pdf" type="file" accept="application/pdf,.pdf" multiple>
        <select id="pdf-engine" aria-label="分析速度"><option value="quality">质量优先</option><option value="fast">速度优先</option></select>
        <select id="pdf-language" aria-label="分析输出语言"><option value="zh">中文输出</option><option value="en">English</option><option value="both">中英对照</option></select>
      </div>
      <p class="pdf-import-status" id="pdf-status">可以一次选多个 PDF，模型会逐个读标题、方法、结论和制备流程；文件只在 Mac Mini 临时存在，分析完立即删除。</p>
      <div class="pdf-batch" id="pdf-batch" hidden></div>
      ${item ? "" : `<button type="button" class="subtle-link" id="lit-manual-toggle">没有 PDF？手动填写</button>`}
    </div>
    <div class="lit-preview" id="lit-preview" hidden></div>
    <div class="lit-manual" id="lit-manual" ${item ? "" : "hidden"}>
    <div class="field"><label for="literature-system">材料方向</label><select id="literature-system" required>${systemOptions(item?.system || "sn-pb")}</select></div>
    <div class="field"><label for="literature-title">标题 / 主题</label><input id="literature-title" maxlength="200" value="${escapeHtml(item?.title || "")}" required placeholder="例如：锡铅钙钛矿界面钝化综述"></div>
    <div class="field"><label for="literature-link">原文链接（可选）</label><input id="literature-link" maxlength="500" value="${escapeHtml(item?.link || "")}" placeholder="https://..."></div>
    <div class="field"><label for="literature-methods">方法 / 策略标签</label><input id="literature-methods" maxlength="300" value="${escapeHtml(methods)}" placeholder="反溶剂、界面钝化、添加剂"><span class="field-help">用顿号或逗号分隔。保存后这些标签可点击，用来筛选同类文献，也会显示在方法频次里。</span></div>
    <div class="field"><label for="literature-summary">分析结论</label><textarea id="literature-summary" maxlength="4000" rows="4" placeholder="这个方向的关键结论、可借鉴的条件或分子">${escapeHtml(item?.summary || "")}</textarea><span class="field-help">列表里默认折叠，点开才显示。</span></div>
    <details class="dialog-details" ${item ? "" : ""}><summary>作者、期刊与制备流程（可选）</summary>
      <div class="form-grid dialog-grid">
        <div class="field"><label for="literature-first-author">第一作者</label><input id="literature-first-author" maxlength="100" value="${escapeHtml(item?.first_author || "")}" placeholder="Yang Zhou"></div>
        <div class="field"><label for="literature-corresponding">通讯作者</label><input id="literature-corresponding" maxlength="300" value="${escapeHtml(item?.corresponding || "")}" placeholder="Ni Zhao、Ching-Ping Wong"><span class="field-help">多个用顿号或逗号分隔，同样可以点击筛选。</span></div>
        <div class="field"><label for="literature-doi">DOI</label><input id="literature-doi" maxlength="200" value="${escapeHtml(item?.doi || "")}" placeholder="10.1002/adfm.201803130"></div>
        <div class="field"><label for="literature-journal">期刊</label><input id="literature-journal" maxlength="200" value="${escapeHtml(item?.journal || "")}" placeholder="Advanced Functional Materials"></div>
        <div class="field"><label for="literature-year">年份</label><input id="literature-year" type="number" min="1900" max="2100" value="${escapeHtml(item?.year || "")}" placeholder="2018"></div>
        <div class="field"><label for="literature-bandgap">带隙 (eV)</label><input id="literature-bandgap" type="number" step="0.01" min="0" max="5" value="${escapeHtml(item?.bandgap ?? "")}" placeholder="1.75"></div>
        <div class="field"><label for="literature-fabrication">器件制备流程</label><textarea id="literature-fabrication" rows="6" placeholder="基底清洗：FTO 依次用 Hellmanex、去离子水、乙醇各超声 30 min&#10;SnO2 层：旋涂 SnO2 胶体（稀释 20 倍），150 ℃ 退火 30 min&#10;钙钛矿层：反溶剂法，转速 4000 rpm、时间 30 s，退火 100 ℃ 10 min">${escapeHtml(fabricationToText(item?.fabrication || ""))}</textarea><span class="field-help">一行一步，统一写成「步骤名称：说明」。工艺参数直接写在说明里（如「转速 4000 rpm、时间 30 s、退火 120 ℃ 10 min」），不要贴 JSON；这样每个体系的格式都一致，也便于横向比较。</span></div>
      </div>
    </details>
    <div class="field"><label for="literature-keywords">关键词</label><input id="literature-keywords" maxlength="200" value="${escapeHtml((item?.keywords || []).join("、"))}" placeholder="钝化、开压、锡铅"><span class="field-help">用顿号或逗号分隔；这些词会进入首页词条热度。</span></div>
    <p class="inline-alert" id="literature-error" role="alert"></p>
    </div>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-literature" type="button" ${item ? "" : "disabled"}>保存分析 ${icon("check")}</button>`;
  modal(item ? "编辑文献分析" : "添加文献分析", item ? "修改后保存；PDF 不会保存在服务器上。" : "上传 PDF，模型自动整理成分析条目；PDF 不会保存在服务器上。", content, buttons, true);
  document.getElementById("save-literature").addEventListener("click", (event) => saveLiterature(event, item?.id));
  document.getElementById("literature-pdf").addEventListener("change", (event) => analyzeLiteraturePdf(event));
  const manualToggle = document.getElementById("lit-manual-toggle");
  if (manualToggle) {
    manualToggle.addEventListener("click", () => {
      const manual = document.getElementById("lit-manual");
      manual.hidden = false;
      document.getElementById("save-literature").disabled = false;
      manualToggle.hidden = true;
    });
  }
}

async function importLiteratureBatch(files, input) {
  const status = document.getElementById("pdf-status");
  const batch = document.getElementById("pdf-batch");
  const saveButton = document.getElementById("save-literature");
  const language = document.getElementById("pdf-language")?.value || "zh";
  const engine = document.getElementById("pdf-engine")?.value || "quality";
  const person = currentAuthor();
  const queue = files.slice(0, 10);
  if (files.length > queue.length) showToast("一次最多处理 10 个 PDF，其余的请再上传一次");
  batch.hidden = false;
  batch.innerHTML = queue.map((file, index) => `<div class="pdf-batch-row" data-batch-index="${index}">
      <span class="pdf-batch-name">${escapeHtml(file.name)}</span>
      <span class="pdf-batch-state">排队中</span>
    </div>`).join("");
  if (saveButton) saveButton.disabled = true;
  input.disabled = true;
  let saved = 0;
  let failed = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const file = queue[index];
    const row = batch.querySelector(`[data-batch-index="${index}"]`);
    const state = row?.querySelector(".pdf-batch-state");
    if (file.size > 30 * 1024 * 1024) {
      failed += 1;
      if (state) { state.textContent = "超过 30 MB，已跳过"; state.className = "pdf-batch-state is-error"; }
      continue;
    }
    status.textContent = `正在解析第 ${index + 1} / ${queue.length} 个：${file.name}`;
    if (state) { state.textContent = "解析中…"; state.className = "pdf-batch-state is-busy"; }
    try {
      const dataUrl = await toDataUrl(file);
      const response = await api("/api/literature/extract", { method: "POST", body: JSON.stringify({ file: dataUrl, language, engine }) });
      const result = await response.json();
      const fields = result.fields || {};
      if (!fields.title) throw new Error("没有识别出标题");
      await api("/api/literature", { method: "POST", body: JSON.stringify({
        system: fields.system || "other",
        title: fields.title,
        link: fields.doi ? `https://doi.org/${String(fields.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : "",
        doi: fields.doi || "",
        journal: fields.journal || "",
        year: fields.year || "",
        first_author: fields.first_author || "",
        corresponding: fields.corresponding || "",
        study_object: fields.study_object || "",
        bandgap: fields.bandgap ?? "",
        methods: fields.methods || "",
        keywords: fields.keywords || "",
        summary: fields.summary || "",
        fabrication: fields.fabrication || "",
        person,
      }) });
      saved += 1;
      if (state) { state.textContent = `已保存：${fields.title.slice(0, 28)}`; state.className = "pdf-batch-state is-done"; }
    } catch (problem) {
      failed += 1;
      if (state) { state.textContent = problem.message || "解析失败"; state.className = "pdf-batch-state is-error"; }
    }
  }
  input.disabled = false;
  input.value = "";
  status.textContent = `处理完成：成功 ${saved} 篇，失败 ${failed} 篇。失败的可以单独重试，或手动填写。`;
  if (saveButton) saveButton.disabled = false;
  if (saved) {
    await reloadState();
    showToast(`已导入 ${saved} 篇文献${failed ? `，${failed} 篇失败` : ""}`);
  }
}

async function analyzeLiteraturePdf(event) {
  const input = event.currentTarget;
  const files = [...(input.files || [])];
  if (!files.length) return;
  if (files.length > 1) {
    await importLiteratureBatch(files, input);
    return;
  }
  const file = files[0];
  const status = document.getElementById("pdf-status");
  if (file.size > 30 * 1024 * 1024) {
    status.textContent = "PDF 超过 30 MB，请压缩后再试。";
    input.value = "";
    return;
  }
  status.textContent = `正在读取 ${file.name}（${fileSize(file.size)}），分析大约需要 30–90 秒…`;
  status.classList.add("is-busy");
  try {
    const dataUrl = await toDataUrl(file);
    const language = document.getElementById("pdf-language")?.value || "zh";
    const engine = document.getElementById("pdf-engine")?.value || "quality";
    const response = await api("/api/literature/extract", { method: "POST", body: JSON.stringify({ file: dataUrl, language, engine }) });
    const result = await response.json();
    const fields = result.fields || {};
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element && value !== undefined && value !== null && String(value).trim() !== "") element.value = value;
    };
    if (fields.system) {
      const select = document.getElementById("literature-system");
      if ([...select.options].some((option) => option.value === fields.system)) select.value = fields.system;
    }
    setValue("literature-title", fields.title);
    setValue("literature-journal", fields.journal);
    setValue("literature-doi", fields.doi);
    setValue("literature-first-author", fields.first_author);
    setValue("literature-corresponding", fields.corresponding);
    setValue("literature-year", fields.year);
    setValue("literature-bandgap", fields.bandgap);
    setValue("literature-methods", fields.methods);
    setValue("literature-keywords", fields.keywords);
    setValue("literature-summary", fields.summary);
    setValue("literature-fabrication", fields.fabrication);
    if (fields.doi && !document.getElementById("literature-link").value.trim()) {
      const doi = String(fields.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      document.getElementById("literature-link").value = `https://doi.org/${doi}`;
    }
    status.classList.remove("is-busy");
    status.textContent = `已从 ${result.pages || "?"} 页 PDF 中整理出内容${result.truncated ? "（长文只读取了开头与方法部分）" : ""}，原件已删除。`;
    const preview = document.getElementById("lit-preview");
    if (preview) {
      const steps = literatureSteps({ fabrication: fields.fabrication });
      preview.hidden = false;
      preview.innerHTML = `<div class="lit-preview-head">${escapeHtml(fields.title || "未识别出标题")}</div>
        <p class="lit-preview-meta">${escapeHtml([fields.journal, fields.year, fields.first_author && `一作 ${fields.first_author}`].filter(Boolean).join(" · "))}</p>
        ${fields.summary ? `<p class="lit-preview-summary">${escapeHtml(fields.summary)}</p>` : ""}
        <p class="lit-preview-tags">${fields.methods ? escapeHtml(fields.methods) : "未识别方法标签"}${steps.length ? ` · 制备流程 ${steps.length} 步` : ""}</p>`;
    }
    const saveButton = document.getElementById("save-literature");
    if (saveButton) saveButton.disabled = false;
    showToast("PDF 已分析完成，可保存");
  } catch (problem) {
    status.classList.remove("is-busy");
    status.textContent = problem.message || "PDF 分析失败，请重试。";
    showToast(problem.message || "PDF 分析失败");
  } finally {
    input.value = "";
  }
}

async function saveLiterature(event, itemId) {
  const button = event.currentTarget;
  const error = document.getElementById("literature-error");
  const form = document.getElementById("literature-form");
  if (!form.reportValidity()) return;
  button.disabled = true;
  button.textContent = "正在保存…";
  try {
    await api("/api/literature", { method: "POST", body: JSON.stringify({
      id: itemId || "",
      system: document.getElementById("literature-system").value,
      title: document.getElementById("literature-title").value.trim(),
      link: document.getElementById("literature-link").value.trim(),
      summary: document.getElementById("literature-summary").value.trim(),
      keywords: document.getElementById("literature-keywords").value.trim(),
      doi: document.getElementById("literature-doi").value.trim(),
      methods: document.getElementById("literature-methods").value.trim(),
      first_author: document.getElementById("literature-first-author").value.trim(),
      corresponding: document.getElementById("literature-corresponding").value.trim(),
      journal: document.getElementById("literature-journal").value.trim(),
      year: document.getElementById("literature-year").value.trim(),
      bandgap: document.getElementById("literature-bandgap").value.trim(),
      fabrication: textToFabrication(document.getElementById("literature-fabrication").value),
      person: localStorage.getItem("labdesk.personName") || "",
    }) });
    closeModal();
    await reloadState();
    showToast("文献分析已保存");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `保存分析 ${icon("check")}`;
  }
}

function dutyDialog() {
  const duty = state.data?.duty || {};
  const entry = duty.entry || {};
  const next = (duty.weeks || []).find((item) => item.weekStart > (duty.weekStart || ""));
  const content = `<form class="form-grid" id="duty-form">
    <p class="field-help">本周从 ${formatDate(duty.weekStart)} 开始。填好姓名后，首页会显示本周值日生。</p>
    <div class="field"><label for="duty-names">本周值日生</label><input id="duty-names" maxlength="120" value="${escapeHtml((entry.names || []).join("、"))}" placeholder="例如：刘高奇、郎海涛"><span class="field-help">多个名字用顿号、逗号或空格分隔。</span></div>
    <div class="field"><label for="duty-areas">负责区域（可选）</label><input id="duty-areas" maxlength="200" value="${escapeHtml(entry.areas || "")}" placeholder="例如：五号楼台面、七号楼地面"></div>
    <div class="field"><label for="duty-next-names">下周值日生（可选）</label><input id="duty-next-names" maxlength="120" value="${escapeHtml((next?.names || []).join("、"))}" placeholder="提前安排，下周自动显示"></div>
    <p class="inline-alert" id="duty-error" role="alert"></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-duty" type="button">保存排班 ${icon("check")}</button>`;
  modal("安排本周值日", "排班保存在 Mac Mini，所有组员看到的首页一致。", content, buttons);
  document.getElementById("save-duty").addEventListener("click", saveDuty);
}

async function saveDuty(event) {
  const button = event.currentTarget;
  const error = document.getElementById("duty-error");
  const names = document.getElementById("duty-names").value.trim();
  const areas = document.getElementById("duty-areas").value.trim();
  const nextNames = document.getElementById("duty-next-names").value.trim();
  if (!names && !nextNames) {
    error.textContent = "至少填写本周或下周的值日生。";
    return;
  }
  button.disabled = true;
  button.textContent = "正在保存…";
  try {
    const duty = state.data?.duty || {};
    if (names) {
      await api("/api/duty", { method: "POST", body: JSON.stringify({ weekStart: duty.weekStart, names: names.split(/[、,，\s]+/).filter(Boolean), areas }) });
    }
    if (nextNames) {
      await api("/api/duty", { method: "POST", body: JSON.stringify({ weekStart: nextWeekStart(duty.weekStart), names: nextNames.split(/[、,，\s]+/).filter(Boolean), areas }) });
    }
    closeModal();
    await reloadState();
    showToast("值日排班已更新");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `保存排班 ${icon("check")}`;
  }
}

function nextWeekStart(weekStart) {
  if (!weekStart) return "";
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function downloadLabFile(recordId, index) {
  try {
    const response = await api(`/api/lab-data/${encodeURIComponent(recordId)}/${index}`);
    const blob = await response.blob();
    const record = (state.data?.labRecords || []).find((item) => item.id === recordId);
    const name = record?.files?.[index]?.name || "raw-data";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (problem) {
    showToast(problem.message);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = (typeof labdeskTranslate === "function") ? labdeskTranslate(message) : message;
  toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function modal(title, subtitle, content, buttons = "", wide = false) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div><button class="modal-close" data-close-modal aria-label="关闭">${icon("close")}</button></div><div class="modal-body">${content}</div>${buttons ? `<div class="modal-foot">${buttons}</div>` : ""}</section></div>`;
  if (typeof labdeskLocalize === "function") labdeskLocalize(modalRoot);
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function recordDialog(kind, targetId = "") {
  const targetZone = state.data.zones.find((zone) => zone.id === targetId);
  const targetAssignees = targetZone?.assignees || [];
  const personName = targetAssignees.includes(state.hygieneAssignee)
    ? state.hygieneAssignee
    : (targetAssignees.length === 1 ? targetAssignees[0] : (localStorage.getItem("labdesk.personName") || ""));
  const isCleaning = kind === "hygiene";
  const eligibleZones = state.data.zones.filter((zone) => zone.type === (isCleaning ? "area" : "device"));
  const zoneOptions = eligibleZones.map((zone) => `<option value="${escapeHtml(zone.id)}" ${zone.id === targetId ? "selected" : ""}>${escapeHtml(zone.name)} · ${escapeHtml(zone.group)}</option>`).join("");
  const title = isCleaning ? "提交卫生照片" : "提交仪器维护记录";
  const personLabel = isCleaning ? "记录人" : "维护人 / Super User";
  const content = `<form class="form-grid" id="record-form">
    <div class="field"><label for="record-target">${isCleaning ? "卫生区域" : "维护仪器"}</label><select id="record-target" required>${zoneOptions}</select></div>
    <div class="field"><label for="record-person">${personLabel}</label><input id="record-person" maxlength="100" value="${escapeHtml(personName)}" required placeholder="填写姓名"></div>
    <div class="field"><label for="record-note">简要说明</label><textarea id="record-note" maxlength="800" placeholder="${isCleaning ? "例如：已清洁工作台并恢复物品摆放" : "例如：清洁腔体、检查密封圈"}"></textarea></div>
    <div class="field"><label for="record-photo">现场照片 <span aria-hidden="true">*</span></label><input id="record-photo" type="file" accept="image/*" capture="environment" multiple required><span class="field-help" id="photo-size-label">可选择 1–5 张照片；压缩后上传并保存在 Mac Mini。</span></div>
    <div class="photo-preview-grid" id="photo-preview-grid"></div>
    <p class="inline-alert" id="record-error" role="alert"></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-record" type="button">保存记录 ${icon("check")}</button>`;
  modal(title, "照片和记录会保存到 Mac Mini 本地目录。", content, buttons);
  const fileInput = document.getElementById("record-photo");
  state.preparedRecordPhoto = null;
  state.preparedRecordPhotos = [];
  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files || [])];
    const error = document.getElementById("record-error");
    error.textContent = "";
    state.preparedRecordPhoto = null;
    state.preparedRecordPhotos = [];
    const previewGrid = document.getElementById("photo-preview-grid");
    previewGrid.replaceChildren();
    if (!files.length) return;
    if (files.length > 5) {
      error.textContent = "一次最多上传 5 张照片。";
      fileInput.value = "";
      return;
    }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      error.textContent = "请选用 JPEG、PNG 或 WebP 照片。iPhone 如拍摄 HEIC，请先选择兼容格式。";
      fileInput.value = "";
      return;
    }
    try {
      const prepared = [];
      for (const file of files) prepared.push(await compressPhoto(file));
      if (prepared.some((file) => file.size > 6 * 1024 * 1024) || prepared.reduce((sum, file) => sum + file.size, 0) > 30 * 1024 * 1024) {
        error.textContent = "单张照片需小于 6 MB，所有照片合计需小于 30 MB。";
        fileInput.value = "";
        return;
      }
      state.preparedRecordPhotos = prepared;
      state.preparedRecordPhoto = prepared[0];
      prepared.forEach((file, index) => {
        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = `照片预览 ${index + 1}`;
        previewGrid.append(image);
      });
      const sizeLabel = document.getElementById("photo-size-label");
      if (sizeLabel) sizeLabel.textContent = `已选择 ${prepared.length} 张 · ${fileSize(prepared.reduce((sum, file) => sum + file.size, 0))}，将上传到 Mac Mini`;
    } catch (_) {
      error.textContent = "无法处理这张照片，请换一张 JPEG、PNG 或 WebP 图片。";
    }
  });
  document.getElementById("save-record").addEventListener("click", saveRecord);
}

async function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("无法读取此文件。"));
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file) {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 2 * 1024 * 1024 && file.type === "image/jpeg") {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "lab-photo"}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

async function saveRecord(event) {
  const button = event.currentTarget;
  const form = document.getElementById("record-form");
  const error = document.getElementById("record-error");
  if (!form.reportValidity()) return;
  const files = state.preparedRecordPhotos.length
    ? state.preparedRecordPhotos
    : [...(document.getElementById("record-photo").files || [])];
  if (!files.length) {
    error.textContent = "请添加现场照片。";
    return;
  }
  button.disabled = true;
  button.textContent = "正在保存…";
  error.textContent = "";
  try {
    const routeKind = state.route === "equipment" ? "maintenance" : "";
    const dialogKind = document.getElementById("record-target").dataset.kind || routeKind;
    const kind = dialogKind || (document.querySelector("#record-form") && state._recordKind) || "hygiene";
    const body = {
      kind,
      target: document.getElementById("record-target").value,
      person: document.getElementById("record-person").value.trim(),
      note: document.getElementById("record-note").value.trim(),
      photos: await Promise.all(files.map(toDataUrl)),
    };
    await api("/api/records", { method: "POST", body: JSON.stringify(body) });
    localStorage.setItem("labdesk.personName", body.person);
    state.preparedRecordPhoto = null;
    state.preparedRecordPhotos = [];
    closeModal();
    await reloadState();
    showToast(kind === "hygiene" ? "卫生照片已保存" : "仪器维护记录已保存");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `保存记录 ${icon("check")}`;
  }
}

function upkeepDialog() {
  const content = `<div class="upkeep-choice">
    <button type="button" class="choice-card" data-pick-upkeep="hygiene"><span class="choice-icon">${icon("broom")}</span><strong>公共区域值日</strong><small>打扫完成后拍摄现场照片</small></button>
    <button type="button" class="choice-card" data-pick-upkeep="maintenance"><span class="choice-icon">${icon("tool")}</span><strong>仪器维护</strong><small>由 Super User 记录维护照片</small></button>
  </div>`;
  modal("记录哪一类？", "两类记录都在同一页查看。", content, `<button class="button button-secondary" data-close-modal type="button">取消</button>`);
  document.querySelectorAll("[data-pick-upkeep]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.pickUpkeep;
      closeModal();
      openRecord(kind, state.data.zones.find((zone) => zone.type === (kind === "hygiene" ? "area" : "device"))?.id || "");
    });
  });
}

function openRecord(kind, target) {
  state._recordKind = kind;
  recordDialog(kind, target);
  document.getElementById("record-target").dataset.kind = kind;
}

function pdfDialog() {
  const content = `<form class="form-grid" id="pdf-form">
    <div class="field"><label for="pdf-title">标题</label><input id="pdf-title" maxlength="180" placeholder="例如：界面钝化综述"></div>
    <div class="field"><label for="pdf-file">PDF 原件</label><input id="pdf-file" type="file" accept="application/pdf,.pdf" required><span class="field-help">单个文件不超过 30 MB；原件保存在 Mac Mini，不进入浏览器缓存</span></div>
    <div class="field"><label for="pdf-note">备注</label><textarea id="pdf-note" maxlength="800" placeholder="研究方向、关键词或阅读进度"></textarea></div>
    <p class="inline-alert" id="pdf-error" role="alert"></p>
  </form>`;
  const buttons = `<button class="button button-secondary" data-close-modal type="button">取消</button><button class="button button-primary" id="save-pdf" type="button">保存 PDF ${icon("check")}</button>`;
  modal("添加研究资料", "PDF 文件只写入 Mac Mini 本地资料库。", content, buttons);
  document.getElementById("pdf-file").addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const title = document.getElementById("pdf-title");
    if (!title.value) title.value = file.name.replace(/\.pdf$/i, "");
    if (file.size > 30 * 1024 * 1024) document.getElementById("pdf-error").textContent = "PDF 超过 30 MB。";
  });
  document.getElementById("save-pdf").addEventListener("click", savePdf);
}

async function savePdf(event) {
  const button = event.currentTarget;
  const form = document.getElementById("pdf-form");
  const error = document.getElementById("pdf-error");
  if (!form.reportValidity()) return;
  const file = document.getElementById("pdf-file").files?.[0];
  if (!file || !file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    error.textContent = "请选择 PDF 文件。";
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    error.textContent = "PDF 超过 30 MB。";
    return;
  }
  button.disabled = true;
  button.textContent = "正在上传…";
  try {
    await api("/api/library", {
      method: "POST",
      body: JSON.stringify({
        title: document.getElementById("pdf-title").value.trim(),
        name: file.name,
        note: document.getElementById("pdf-note").value.trim(),
        file: (await toDataUrl(file)).replace(/^data:[^;]+;base64,/, "data:application/pdf;base64,"),
      }),
    });
    closeModal();
    await reloadState();
    showToast("PDF 已存入 Mac Mini 资料库");
  } catch (problem) {
    error.textContent = problem.message;
    button.disabled = false;
    button.innerHTML = `保存 PDF ${icon("check")}`;
  }
}

async function showReport() {
  try {
    const response = await api("/api/research-note");
    const report = await response.text();
    modal("完整调研方案", "工作区已有版本；下方内容按原文呈现。", `<pre class="report-raw">${escapeHtml(report)}</pre>`, `<button class="button button-primary" data-close-modal type="button">关闭</button>`, true);
  } catch (problem) {
    showToast(problem.message);
  }
}

async function openPdf(itemId) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    showToast("浏览器拦截了新窗口，请允许此站点打开 PDF。");
    return;
  }
  try {
    const response = await api(`/api/library/file/${encodeURIComponent(itemId)}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    tab.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (problem) {
    tab.close();
    showToast(problem.message);
  }
}

async function ensurePhoto(id) {
  if (state.photoUrls.has(id)) return state.photoUrls.get(id);
  if (!state.photoRequests.has(id)) {
    const request = api(`/api/media/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const url = URL.createObjectURL(await response.blob());
        state.photoUrls.set(id, url);
        return url;
      })
      .finally(() => state.photoRequests.delete(id));
    state.photoRequests.set(id, request);
  }
  return state.photoRequests.get(id);
}

function displayPhoto(id, url) {
  page.querySelectorAll(`[data-photo-id="${CSS.escape(id)}"]`).forEach((element) => {
    if (element.tagName.toLowerCase() === "img") element.src = url;
    else {
      element.classList.remove("record-thumb-placeholder");
      element.innerHTML = `<img class="record-thumb" src="${url}" alt="现场照片" data-photo-display="${escapeHtml(id)}">`;
    }
  });
}

const photoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const id = entry.target.dataset.photoId;
      ensurePhoto(id).then((url) => displayPhoto(id, url)).catch(() => { entry.target.title = "照片暂时无法加载，请刷新后重试"; });
    });
  }, { rootMargin: "160px" })
  : null;

function loadVisiblePhotos() {
  page.querySelectorAll("[data-photo-id]").forEach((element) => {
    const id = element.dataset.photoId;
    if (!id || element.dataset.photoLoaded === "true") return;
    element.dataset.photoLoaded = "true";
    if (photoObserver) photoObserver.observe(element);
    else ensurePhoto(id).then((url) => displayPhoto(id, url)).catch(() => { element.title = "照片暂时无法加载，请刷新后重试"; });
  });
}

function showPhoto(id) {
  const url = state.photoUrls.get(id);
  if (!url) {
    ensurePhoto(id).then((loadedUrl) => {
      displayPhoto(id, loadedUrl);
      showPhoto(id);
    }).catch(() => showToast("照片暂时无法加载，请检查网络后刷新重试。"));
    return;
  }
  modalRoot.innerHTML = `<div class="lightbox-backdrop" data-close-modal><button class="modal-close lightbox-close" data-close-modal aria-label="关闭">${icon("close")}</button><img class="lightbox-image" src="${url}" alt="现场记录照片"></div>`;
}

async function askAssistant(event) {
  event.preventDefault();
  const input = document.getElementById("assistant-question");
  const button = event.currentTarget.querySelector("button[type=submit]");
  const responseBox = document.getElementById("assistant-response");
  const question = input.value.trim();
  if (!question) return;
  button.disabled = true;
  button.textContent = "处理中…";
  responseBox.innerHTML = "";
  try {
    const response = await api("/api/assistant", { method: "POST", body: JSON.stringify({ question }) });
    const result = await response.json();
    responseBox.innerHTML = `<div class="assistant-response">${escapeHtml(result.answer || "没有返回内容。")}</div>`;
  } catch (problem) {
    responseBox.innerHTML = `<div class="assistant-response">${escapeHtml(problem.message)}</div>`;
  } finally {
    button.disabled = !state.data?.llm?.configured;
    button.innerHTML = `询问 ${icon("arrow")}`;
  }
}

document.getElementById("connect-form").addEventListener("submit", (event) => {
  event.preventDefault();
  connect(document.getElementById("access-code").value);
});

document.getElementById("toggle-code").addEventListener("click", (event) => {
  const input = document.getElementById("access-code");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  const label = show ? "隐藏访问码" : "显示访问码";
  event.currentTarget.setAttribute("aria-label", label);
  event.currentTarget.title = label;
  event.currentTarget.innerHTML = icon(show ? "eye-off" : "eye");
});

document.addEventListener("click", (event) => {
  const route = event.target.closest("[data-route]");
  if (route) { setRoute(route.dataset.route); return; }
  const jvTab = event.target.closest("[data-jv-param]");
  if (jvTab) { state.jvParam = jvTab.dataset.jvParam; render(); return; }
  const disconnectButton = event.target.closest("#disconnect, #mobile-disconnect");
  if (disconnectButton) { disconnect(); return; }
  const close = event.target.closest("[data-close-modal]");
  if (close && (event.target === close || !close.classList.contains("modal-backdrop"))) { closeModal(); return; }
  const openRecordButton = event.target.closest("[data-open-record]");
  if (openRecordButton) { openRecord(openRecordButton.dataset.openRecord, openRecordButton.dataset.target); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "new-upkeep") { upkeepDialog(); return; }
  if (action === "new-idea") { ideaDialog(); return; }
  if (action === "new-rant") { rantDialog(); return; }
  if (action === "delete-idea") {
    const ideaId = event.target.closest("[data-action]").dataset.id;
    if (window.confirm("删除这条想法？") && ideaId) {
      api("/api/ideas/delete", { method: "POST", body: JSON.stringify({ id: ideaId }) })
        .then(() => reloadState()).then(() => showToast("已移入回收站"))
        .catch((problem) => showToast(problem.message));
    }
    return;
  }
  const translateButton = event.target.closest("[data-translate-lit]");
  if (translateButton) {
    const id = translateButton.dataset.translateLit;
    translateButton.textContent = "翻译中…";
    api("/api/literature/translate", { method: "POST", body: JSON.stringify({ id }) })
      .then(() => reloadState())
      .catch((problem) => { showToast(problem.message); translateButton.textContent = "翻译为英文"; });
    return;
  }
  const voteButton = event.target.closest("[data-vote-idea]");
  if (voteButton) { voteIdea(voteButton.dataset.voteIdea, voteButton.dataset.ideaDirection); return; }
  const doneButton = event.target.closest("[data-idea-done]");
  if (doneButton) {
    const idea = (state.data?.ideas || []).find((item) => item.id === doneButton.dataset.ideaDone);
    const target = !(idea && idea.done);
    api("/api/ideas/done", { method: "POST", body: JSON.stringify({ id: doneButton.dataset.ideaDone, done: target }) })
      .then((response) => response.json())
      .then((data) => { patchIdea(data.idea); render(); showToast(target ? "已标记为上线" : "已恢复为待实施"); })
      .catch((problem) => showToast(problem.message));
    return;
  }
  if (action === "new-hygiene") { openRecord("hygiene", state.data.zones.find((zone) => zone.type === "area")?.id || ""); return; }
  if (action === "new-maintenance") { openRecord("maintenance", state.data.zones.find((zone) => zone.type === "device")?.id || ""); return; }
  if (action === "refresh-state") { reloadState().then(() => showToast("照片与记录已更新")).catch((problem) => showToast(problem.message)); return; }
  if (action === "load-more-photos") { state.photoPageSize += 12; render(); return; }
  if (action === "upload-pdf") { pdfDialog(); return; }
  if (action === "new-measure") { measureDialog(); return; }
  if (action === "add-literature") { literatureDialog(); return; }
  if (action === "edit-duty") { dutyDialog(); return; }
  if (action === "edit-literature") {
    const item = (state.data.literature || []).find((entry) => entry.id === event.target.closest("[data-action]").dataset.id);
    if (item) literatureDialog(item);
    return;
  }
  if (action === "delete-literature") {
    const itemId = event.target.closest("[data-action]").dataset.id;
    if (window.confirm("删除这条文献分析？") && itemId) {
      api("/api/literature/delete", { method: "POST", body: JSON.stringify({ id: itemId }) })
        .then(() => reloadState()).then(() => showToast("已删除文献分析"))
        .catch((problem) => showToast(problem.message));
    }
    return;
  }
  if (action === "delete-measure") {
    const itemId = event.target.closest("[data-action]").dataset.id;
    if (window.confirm("删除这条测量记录及其原始数据？") && itemId) {
      api("/api/lab-records/delete", { method: "POST", body: JSON.stringify({ id: itemId }) })
        .then(() => reloadState()).then(() => showToast("已删除测量记录"))
        .catch((problem) => showToast(problem.message));
    }
    return;
  }
  if (action === "reanalyze") { analyzeRecord(event.target.closest("[data-action]").dataset.id); return; }
  if (event.target.closest("[data-action='more-lit']")) { state.litPage += 30; render(); return; }
  const restoreButton = event.target.closest("[data-restore-trash]");
  if (restoreButton) {
    api("/api/trash/restore", { method: "POST", body: JSON.stringify({ id: restoreButton.dataset.restoreTrash }) })
      .then(() => reloadState()).then(() => showToast("已恢复"))
      .catch((problem) => showToast(problem.message));
    return;
  }
  const purgeButton = event.target.closest("[data-purge-trash]");
  if (purgeButton) {
    if (!window.confirm("彻底删除后无法恢复，确定？")) return;
    api("/api/trash/purge", { method: "POST", body: JSON.stringify({ id: purgeButton.dataset.purgeTrash }) })
      .then(() => reloadState()).then(() => showToast("已彻底删除"))
      .catch((problem) => showToast(problem.message));
    return;
  }
  const openWorkshopButton = event.target.closest("[data-open-workshop]");
  if (openWorkshopButton) {
    openWorkshop(openWorkshopButton.dataset.openWorkshop, openWorkshopButton.dataset.workshopTitle);
    return;
  }
  const forumTab = event.target.closest("[data-forum-tab]");
  if (forumTab) { state.forumTab = forumTab.dataset.forumTab; render(); return; }
  const collabTab = event.target.closest("[data-collab-tab]");
  if (collabTab) { state.collabTab = collabTab.dataset.collabTab; state.litPage = 30; render(); return; }
  if (action === "toggle-lit-details") { state.litExpandAll = !state.litExpandAll; render(); return; }
  if (action === "toggle-lit-stats") { state.litStatsOpen = !state.litStatsOpen; render(); return; }
  const systemFilter = event.target.closest("[data-system-filter]");
  if (systemFilter) { state.systemFilter = systemFilter.dataset.systemFilter; state.litPage = 30; render(); return; }
  const matchButton = event.target.closest("[data-lit-match]");
  if (matchButton) { state.litMatchAll = matchButton.dataset.litMatch === "all"; render(); return; }
  const toggleValue = (list, value) => {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
  };
  const methodFilter = event.target.closest("[data-lit-method]");
  if (methodFilter) {
    toggleValue(state.litMethods, methodFilter.dataset.litMethod);
    state.litPage = 30;
    render();
    return;
  }
  const authorFilter = event.target.closest("[data-lit-author]");
  if (authorFilter) {
    toggleValue(state.litAuthors, authorFilter.dataset.litAuthor);
    state.litPage = 30;
    render();
    return;
  }
  const additiveFilter = event.target.closest("[data-lit-additive]");
  if (additiveFilter) {
    toggleValue(state.litAdditives, additiveFilter.dataset.litAdditive);
    render();
    return;
  }
  if (event.target.closest("[data-clear-lit-search]")) { state.litQuery = ""; render(); return; }
  if (event.target.closest("[data-clear-lit-filters]")) { state.litMethods = []; state.litAuthors = []; state.litAdditives = []; render(); return; }
  const downloadLink = event.target.closest("[data-download-measure]");
  if (downloadLink) { downloadLabFile(downloadLink.dataset.downloadMeasure, downloadLink.dataset.fileIndex); return; }
  if (action === "show-report") { showReport(); return; }
  const pdf = event.target.closest("[data-open-pdf]");
  if (pdf) { openPdf(pdf.dataset.openPdf); return; }
  const filter = event.target.closest("[data-hygiene-filter]");
  if (filter) { state.hygieneFilter = filter.dataset.hygieneFilter; render(); return; }
  const photoFilter = event.target.closest("[data-photo-filter]");
  if (photoFilter) { state.photoFilter = photoFilter.dataset.photoFilter; state.photoPageSize = 12; render(); return; }
  const photo = event.target.closest("[data-photo-open]");
  if (photo) { showPhoto(photo.dataset.photoOpen); return; }
  const thumb = event.target.closest("[data-photo-id]");
  if (thumb && thumb.dataset.photoId) { showPhoto(thumb.dataset.photoId); }
});

document.addEventListener("toggle", (event) => {
  const target = event.target;
  if (target && target.classList && target.classList.contains("lit-summary")) {
    state.litStatsOpen = target.open;
  }
}, true);

let litSearchTimer = 0;
document.addEventListener("input", (event) => {
  if (event.target.id !== "lit-search") return;
  state.litQuery = event.target.value;
  state.litPage = 30;
  clearTimeout(litSearchTimer);
  litSearchTimer = setTimeout(() => {
    state.litSearchFocus = true;
    render();
  }, 220);
});

document.addEventListener("change", (event) => {
  if (event.target.id === "hygiene-assignee-filter") {
    state.hygieneAssignee = event.target.value;
    render();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-photo-id]")) {
    event.preventDefault();
    showPhoto(event.target.dataset.photoId);
  }
  if (event.key === "Escape") closeModal();
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "assistant-form") askAssistant(event);
});

let photoScrollPending = false;
window.addEventListener("scroll", () => {
  if (photoScrollPending || state.route !== "photos") return;
  photoScrollPending = true;
  window.requestAnimationFrame(() => {
    photoScrollPending = false;
    loadVisiblePhotos();
  });
}, { passive: true });

window.setInterval(() => {
  if (state.token && state.route === "photos" && !document.hidden && !modalRoot.childElementCount) {
    reloadState().catch(() => {});
  }
}, 30000);

if ("serviceWorker" in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (window.__labdeskReloading) return;
    window.__labdeskReloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`, { updateViaCache: "none" }).catch(() => {});
    }
  });
}

function applyBootLanguage() {
  const label = LABDESK_LANG === "en" ? "中文" : "English";
  ["lang-toggle", "lang-toggle-mobile"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    if (id === "lang-toggle") button.textContent = label;
    button.addEventListener("click", () => {
      labdeskSetLang(LABDESK_LANG === "en" ? "zh" : "en");
      window.location.reload();
    });
  });
  if (typeof labdeskLocalize === "function") {
    labdeskLocalize(document.body);
    document.title = labdeskTranslate(document.title);
  }
}

applyBootLanguage();

const workshopClose = document.getElementById("workshop-close");
if (workshopClose) workshopClose.addEventListener("click", () => closeWorkshop(false));
window.addEventListener("popstate", () => {
  const overlay = document.getElementById("workshop-overlay");
  if (overlay && !overlay.hidden) closeWorkshop(true);
});

const isFilePreview = window.location.protocol === "file:";
if (document.body && /LabDeskApp\//.test(navigator.userAgent)) document.body.classList.add("in-app");
setConnectionMode(isFilePreview);
if (!isFilePreview) {
  const savedCode = localStorage.getItem("labdesk.accessCode");
  if (savedCode) resumeSession(savedCode);
  window.setTimeout(checkForUpdate, 1200);
  window.setInterval(checkForUpdate, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });
}
