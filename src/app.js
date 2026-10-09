// 如期而至 - 前端逻辑（纯静态，通过 window.__TAURI__.core.invoke 调用后端）
(function () {
  "use strict";

  const { invoke } = window.__TAURI__.core;

  // 内置预设分类：仅作首次启动的兜底；用户改过的分类存 categories.json，启动时加载覆盖
  const DEFAULT_CATEGORIES = [
    { name: "会员", color: "#4f8cff" },
    { name: "保险", color: "#f5a623" },
    { name: "合同", color: "#9b6dff" },
    { name: "证件", color: "#2dd4bf" },
    { name: "账单", color: "#ff6b6b" },
    { name: "订阅", color: "#ff9f43" },
    { name: "其他", color: "#8a8f98" },
  ];
  // 运行时分类列表（含用户自定义），boot 时从后端加载
  let categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));

  const colorOf = (cat) => {
    const found = categories.find((c) => c.name === cat);
    return found ? found.color : "#8a8f98";
  };

  const usageOf = (cat) => events.filter((e) => e.category === cat).length;

  /// 确保「其他」分类存在（删除在用分类时的级联归集目标），不存在则补一个灰色项
  function ensureFallbackCategory() {
    if (!categories.some((c) => c.name === "其他")) {
      categories.push({ name: "其他", color: "#8a8f98" });
    }
  }

  let events = [];
  let editingId = null; // 正在编辑的事件 id，null 表示新增

  // DOM
  const $ = (id) => document.getElementById(id);
  const listEl = $("list");
  const emptyEl = $("empty");
  const searchInput = $("searchInput");
  const filterCategory = $("filterCategory");
  const filterStatus = $("filterStatus");
  const modal = $("modal");
  const form = $("eventForm");

  // ---------- 工具 ----------
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // 计算剩余天数（本地时区）
  function daysLeft(dueStr) {
    const due = new Date(dueStr + "T00:00:00");
    if (isNaN(due.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  }

  function fmtDue(dueStr) {
    const d = daysLeft(dueStr);
    if (d === null) return dueStr;
    if (d > 0) return `${dueStr}（剩 ${d} 天）`;
    if (d === 0) return `${dueStr}（今天）`;
    return `${dueStr}（已过 ${-d} 天）`;
  }

  let toastTimer = null;
  function toast(msg, kind) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast" + (kind ? " " + kind : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  async function call(cmd, args) {
    try {
      return await invoke(cmd, args || {});
    } catch (e) {
      toast("操作失败：" + e, "err");
      throw e;
    }
  }

  // ---------- 渲染 ----------
  // 事件状态判定（与状态筛选、统计口径保持一致）：
  // 停用 > 已过期 > 即将到期 > 正常；即将到期 = 0 <= 剩余天数 <= 最大提醒提前量
  function statusOf(e) {
    if (e.disabled) return "off";
    const d = daysLeft(e.due_date);
    if (d === null) return "normal";
    if (d < 0) return "over";
    const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
    return d <= Math.max(...rules) ? "soon" : "normal";
  }

  function render() {
    const kw = searchInput.value.trim().toLowerCase();
    const cat = filterCategory.value;
    const status = filterStatus.value;

    const filtered = events.filter((e) => {
      const okCat = !cat || cat === "__all__" || e.category === cat;
      const okKw =
        !kw ||
        (e.title && e.title.toLowerCase().includes(kw)) ||
        (e.note && e.note.toLowerCase().includes(kw));
      const okStatus = !status || status === "__all__" || statusOf(e) === status;
      return okCat && okKw && okStatus;
    });

    // 统计（基于全部事件，不随筛选变化；停用条目不计入即将到期/已过期，避免干扰）
    let soon = 0,
      over = 0;
    events.forEach((e) => {
      if (e.disabled) return;
      const d = daysLeft(e.due_date);
      if (d === null) return;
      if (d < 0) over++;
      else {
        const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
        if (d <= Math.max(...rules)) soon++;
      }
    });
    $("statTotal").textContent = events.length;
    $("statSoon").textContent = soon;
    $("statOver").textContent = over;

    listEl.innerHTML = "";
    if (filtered.length === 0) {
      emptyEl.hidden = events.length !== 0; // 仅当确实无数据才显示空态
      return;
    }
    emptyEl.hidden = true;

    filtered.forEach((e) => {
      const d = daysLeft(e.due_date);
      const card = document.createElement("div");
      card.className = "card";
      if (e.disabled) card.classList.add("off");
      else if (d !== null && d < 0) card.classList.add("overdue");
      else if (d !== null) {
        const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
        if (d <= Math.max(...rules)) card.classList.add("soon");
      }

      let daysHtml = "";
      if (d !== null) {
        const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
        const cls = d < 0 ? "over" : d <= Math.max(...rules) ? "soon" : "normal";
        const txt = d > 0 ? `剩 ${d} 天` : d === 0 ? "今天到期" : `已过期 ${-d} 天`;
        daysHtml = `<span class="days ${cls}">${txt}</span>`;
      }
      // 提醒规则摘要，如「提前 7/3/1 天 · 当天」，便于不打开编辑也能看清提醒节奏
      const rules = (e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0])
        .map((r) => (r === 0 ? "当天" : r))
        .sort((a, b) => (a === "当天" ? -1 : b === "当天" ? 1 : a - b))
        .join("/");
      const cycleTxt = e.cycle_months ? { 1: "每月", 3: "每季度", 6: "每半年", 12: "每年" }[e.cycle_months] || `每 ${e.cycle_months} 月` : "";

      card.innerHTML = `
        <span class="badge" style="background:${colorOf(e.category)}">${escapeHtml(
        e.category || "其他"
      )}</span>
        <div class="card-main">
          <div class="card-title">${escapeHtml(e.title)}${e.disabled ? ' <span class="off-tag">已停用</span>' : ""}</div>
          ${e.note ? `<div class="card-note">${escapeHtml(e.note)}</div>` : ""}
          <div class="card-meta">提醒：${escapeHtml(String(rules))}${cycleTxt ? " · " + cycleTxt + "续订" : ""}</div>
        </div>
        <div class="card-side">
          <div class="due-date">${fmtDue(e.due_date)}</div>
          ${daysHtml}
        </div>
        <div class="row-actions">
          ${e.cycle_months ? `<button class="mini renew" data-act="renew" data-id="${e.id}">续订</button>` : ""}
          <button class="mini edit" data-act="edit" data-id="${e.id}">编辑</button>
          <button class="mini clone" data-act="clone" data-id="${e.id}">克隆</button>
          <button class="mini toggle" data-act="toggle" data-id="${e.id}">${e.disabled ? "启用" : "停用"}</button>
          <button class="mini del" data-act="del" data-id="${e.id}">删除</button>
        </div>`;
      listEl.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillCategoryOptions() {
    // 筛选下拉：已定义分类 + 事件里用到但分类列表没有的名字（如导入的旧数据），保持可选
    const cats = Array.from(new Set([...categories.map((c) => c.name), ...events.map((e) => e.category)]))
      .filter(Boolean)
      .sort();
    const prev = filterCategory.value;
    filterCategory.innerHTML =
      `<option value="__all__">全部分类</option>` +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    filterCategory.value = prev; // 尽量保留当前筛选，避免管理分类后筛选被重置
  }

  // ---------- 自绘下拉（分类建议 + 续订周期） ----------
  // 替代原生 datalist / select 弹层：webview 里原生弹层是系统样式，与暗色主题完全脱节。
  // 分类面板支持输入过滤，点选填入；仍保留自由输入（不强制选已有分类）。
  const CYCLE_OPTIONS = [[0, "不自动续订"], [1, "每月"], [3, "每季度"], [6, "每半年"], [12, "每年"]];

  $("cyclePanel").innerHTML = CYCLE_OPTIONS.map(
    ([v, label]) => `<button type="button" class="combo-item" data-val="${v}">${label}</button>`
  ).join("");

  function syncCycleLabel() {
    const v = parseInt($("fCycle").value, 10) || 0;
    $("cycleBtn").textContent = (CYCLE_OPTIONS.find(([x]) => x === v) || CYCLE_OPTIONS[0])[1];
  }

  function hideCombos() {
    $("catPanel").hidden = true;
    $("cyclePanel").hidden = true;
  }

  function renderCatPanel() {
    const q = $("fCategory").value.trim().toLowerCase();
    const list = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
    if (!list.length) {
      $("catPanel").hidden = true;
      return;
    }
    $("catPanel").innerHTML = list
      .map(
        (c) =>
          `<button type="button" class="combo-item" data-cat="${escapeHtml(c.name)}"><i class="dot" style="background:${escapeHtml(c.color)}"></i>${escapeHtml(c.name)}</button>`
      )
      .join("");
    $("catPanel").hidden = false;
  }

  $("fCategory").addEventListener("focus", renderCatPanel);
  $("fCategory").addEventListener("input", renderCatPanel);
  $("catPanel").addEventListener("click", (e) => {
    const item = e.target.closest("[data-cat]");
    if (!item) return;
    $("fCategory").value = item.getAttribute("data-cat");
    $("catPanel").hidden = true;
  });

  $("cycleBtn").addEventListener("click", () => {
    const p = $("cyclePanel");
    p.hidden = !p.hidden;
    $("catPanel").hidden = true;
  });
  $("cyclePanel").addEventListener("click", (e) => {
    const item = e.target.closest("[data-val]");
    if (!item) return;
    $("fCycle").value = item.getAttribute("data-val");
    syncCycleLabel();
    $("cyclePanel").hidden = true;
  });

  // 点面板外部或按 Escape 收起
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#catCombo") && !e.target.closest("#cycleCombo")) hideCombos();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideCombos();
  });

  // ---------- 弹窗 ----------
  // 当前正在编辑的提醒规则集（剩余天数列表，0 = 当天）；提交时写回事件
  let editingRules = [];

  function renderRuleChips() {
    const box = $("ruleChips");
    box.innerHTML = "";
    // 去重 + 升序展示，避免用户加出重复规则
    [...new Set(editingRules)].sort((a, b) => a - b).forEach((d) => {
      const chip = document.createElement("span");
      chip.className = "rule-chip";
      chip.innerHTML = `${d === 0 ? "当天" : "提前 " + d + " 天"}<button type="button" class="chip-x" data-day="${d}" title="移除">✕</button>`;
      box.appendChild(chip);
    });
    if (editingRules.length === 0) {
      box.innerHTML = `<span class="rule-empty">尚未添加提醒规则</span>`;
    }
  }

  $("btnRuleAdd").addEventListener("click", () => {
    const v = parseInt($("fRuleDay").value, 10);
    if (isNaN(v) || v < 0 || v > 365) {
      toast("请输入 0~365 之间的天数", "err");
      return;
    }
    if (!editingRules.includes(v)) editingRules.push(v);
    $("fRuleDay").value = "";
    renderRuleChips();
  });
  $("fRuleDay").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("btnRuleAdd").click(); }
  });
  $("btnRulePreset").addEventListener("click", () => {
    editingRules = [...new Set([...editingRules, 7, 3, 1, 0])];
    renderRuleChips();
  });
  $("ruleChips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-x");
    if (!btn) return;
    editingRules = editingRules.filter((d) => d !== Number(btn.dataset.day));
    renderRuleChips();
  });

  function openModal(ev) {
    editingId = ev ? ev.id : null;
    $("modalTitle").textContent = ev ? "编辑事件" : "新增事件";
    $("fTitle").value = ev ? ev.title : "";
    $("fCategory").value = ev ? ev.category : "会员";
    $("fDue").value = ev ? ev.due_date : "";
    // 规则：优先多规则字段；旧数据无 remind_days 时回退单字段（与后端 rules() 一致）
    editingRules = ev
      ? (ev.remind_days && ev.remind_days.length ? [...ev.remind_days] : [ev.remind_days_before || 0])
      : [7];
    $("fCycle").value = ev ? (ev.cycle_months || 0) : 0;
    syncCycleLabel(); // 自绘下拉：隐藏 input 赋值后同步按钮上的文字
    hideCombos();
    $("fNote").value = ev ? ev.note : "";
    renderRuleChips();
    modal.hidden = false;
    modal.style.display = ""; // 双保险：内联样式复位，避免 webview 缓存旧 CSS 时 [hidden] 失效
    setTimeout(() => $("fTitle").focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    modal.style.display = "none"; // 双保险：不依赖 CSS 的 [hidden] 规则，缓存旧样式也能关
    editingId = null;
  }

  // ---------- 自定义日期选择器 ----------
  // 替代原生 type="date"：系统日历弹窗样式不可定制且操作割裂，改为自绘面板（暗色主题统一）
  const duePicker = $("duePicker");
  const dueInput = $("fDue"); // 只读输入框，value 始终是 ISO 格式 YYYY-MM-DD，供提交逻辑使用
  const duePanel = $("duePanel");
  const dpDays = $("dpDays");
  const dpTitle = $("dpTitle");
  let dpView = { y: 0, m: 0 }; // 面板当前展示的年/月（m 为 1-12）
  let dpOpen = false;

  function dpParse(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }

  const dpSelected = () => dpParse(dueInput.value);

  function dpFmt(y, m, d) {
    const p = (n) => String(n).padStart(2, "0");
    return y + "-" + p(m) + "-" + p(d);
  }

  function dpRender() {
    dpTitle.textContent = dpView.y + "年" + dpView.m + "月";
    const first = new Date(dpView.y, dpView.m - 1, 1);
    const startWeek = first.getDay(); // 当月 1 号是周几（0=周日），决定首行补几个上月日期
    const daysInMonth = new Date(dpView.y, dpView.m, 0).getDate();
    const prevDays = new Date(dpView.y, dpView.m - 1, 0).getDate();
    const t = new Date();
    const sel = dpSelected();
    // 固定渲染 42 格（6 行），切换月份时面板高度不跳动；首尾 gray 显示相邻月日期，可直接点选
    const cell = (y, m, d, outside) => {
      const isToday = y === t.getFullYear() && m === t.getMonth() + 1 && d === t.getDate();
      const isSel = !!sel && sel.y === y && sel.m === m && sel.d === d;
      const cls = ["dp-day", outside ? "out" : "", isToday ? "today" : "", isSel ? "sel" : ""]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-date="${dpFmt(y, m, d)}">${d}</button>`;
    };
    let html = "";
    for (let i = 0; i < 42; i++) {
      const n = i - startWeek + 1;
      if (n < 1) {
        const pm = dpView.m === 1 ? 12 : dpView.m - 1;
        const py = dpView.m === 1 ? dpView.y - 1 : dpView.y;
        html += cell(py, pm, prevDays + n, true);
      } else if (n > daysInMonth) {
        const nm = dpView.m === 12 ? 1 : dpView.m + 1;
        const ny = dpView.m === 12 ? dpView.y + 1 : dpView.y;
        html += cell(ny, nm, n - daysInMonth, true);
      } else {
        html += cell(dpView.y, dpView.m, n, false);
      }
    }
    dpDays.innerHTML = html;
  }

  function dpOpenPanel() {
    // 已选日期则定位到该月，否则定位到本月
    const sel = dpSelected();
    const base = sel || { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
    dpView = { y: base.y, m: base.m };
    dpRender();
    duePanel.hidden = false;
    dpOpen = true;
  }

  function dpClosePanel() {
    duePanel.hidden = true;
    dpOpen = false;
  }

  dueInput.addEventListener("click", () => (dpOpen ? dpClosePanel() : dpOpenPanel()));
  $("dpPrev").addEventListener("click", () => {
    dpView.m--;
    if (dpView.m < 1) { dpView.m = 12; dpView.y--; }
    dpRender();
  });
  $("dpNext").addEventListener("click", () => {
    dpView.m++;
    if (dpView.m > 12) { dpView.m = 1; dpView.y++; }
    dpRender();
  });
  dpDays.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-date]");
    if (!btn) return;
    dueInput.value = btn.dataset.date;
    dpClosePanel();
  });
  $("dpToday").addEventListener("click", () => {
    const t = new Date();
    dueInput.value = dpFmt(t.getFullYear(), t.getMonth() + 1, t.getDate());
    dpClosePanel();
  });
  // 点面板以外区域关闭；Escape 关闭。注意监听挂在 document 上，靠 contains 判断来源
  document.addEventListener("click", (e) => {
    if (dpOpen && !duePicker.contains(e.target)) dpClosePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dpOpen) dpClosePanel();
  });

  // ---------- 分类管理弹窗 ----------
  const catModal = $("catModal");
  const catRows = $("catRows");

  function openCatModal() {
    renderCatRows();
    catModal.hidden = false;
    catModal.style.display = "";
  }
  function closeCatModal() {
    catModal.hidden = true;
    catModal.style.display = "none";
  }

  function renderCatRows() {
    catRows.innerHTML = "";
    categories.forEach((c, idx) => {
      const used = usageOf(c.name);
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <input type="color" class="cat-color" value="${escapeHtml(c.color)}" title="分类颜色" />
        <input type="text" class="cat-name" value="${escapeHtml(c.name)}" maxlength="12" data-idx="${idx}" />
        <span class="cat-usage">${used > 0 ? used + " 个事件" : "未使用"}</span>
        <button type="button" class="mini del cat-del" data-idx="${idx}" ${c.name === "其他" ? "disabled title=\"「其他」是删除级联的归集目标，不能删除\"" : ""}>删除</button>`;
      catRows.appendChild(row);
    });
  }

  async function persistCategoriesOnly() {
    await call("save_categories", { categories });
  }

  // 改色：立即生效并落盘，同时刷新事件列表徽标颜色
  catRows.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("cat-color")) return;
    const idx = Number(e.target.closest(".cat-row").querySelector(".cat-name").dataset.idx);
    categories[idx].color = e.target.value;
    await persistCategoriesOnly();
    render();
    toast("颜色已更新", "ok");
  });

  // 改名：失焦或回车时校验并级联更新事件
  catRows.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("cat-name")) return;
    const idx = Number(e.target.dataset.idx);
    const oldName = categories[idx].name;
    const newName = e.target.value.trim();
    if (newName === oldName) return;
    if (!newName) {
      toast("分类名称不能为空", "err");
      e.target.value = oldName;
      return;
    }
    if (categories.some((c, i) => i !== idx && c.name === newName)) {
      toast(`已存在同名分类「${newName}」`, "err");
      e.target.value = oldName;
      return;
    }
    // 级联：事件里所有旧名改为新名（先存事件再存分类，失败时两者都会报错提示）
    const hit = usageOf(oldName);
    if (hit > 0) {
      events = events.map((ev) => (ev.category === oldName ? { ...ev, category: newName } : ev));
      await call("save_events", { events });
    }
    categories[idx].name = newName;
    await persistCategoriesOnly();
    fillCategoryOptions();
    render();
    renderCatRows();
    toast(`已重命名为「${newName}」，已同步 ${hit} 个事件`, "ok");
  });

  // 删除：在用分类弹确认并把事件归为「其他」
  catRows.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cat-del");
    if (!btn || btn.disabled) return;
    const idx = Number(btn.dataset.idx);
    const name = categories[idx].name;
    const used = usageOf(name);
    const msg = used > 0
      ? `分类「${name}」下有 ${used} 个事件，删除后这些事件会归为「其他」。确定删除？`
      : `确定删除分类「${name}」？`;
    if (!confirm(msg)) return;
    ensureFallbackCategory();
    categories.splice(idx, 1);
    if (used > 0) {
      events = events.map((ev) => (ev.category === name ? { ...ev, category: "其他" } : ev));
      await call("save_events", { events });
    }
    await persistCategoriesOnly();
    fillCategoryOptions();
    render();
    renderCatRows();
    toast("已删除", "ok");
  });

  // 新增分类
  $("btnCatAdd").addEventListener("click", async () => {
    const name = $("newCatName").value.trim();
    if (!name) {
      toast("请输入分类名称", "err");
      return;
    }
    if (categories.some((c) => c.name === name)) {
      toast(`已存在同名分类「${name}」`, "err");
      return;
    }
    categories.push({ name, color: $("newCatColor").value });
    await persistCategoriesOnly();
    $("newCatName").value = "";
    fillCategoryOptions();
    renderCatRows();
    toast(`已添加分类「${name}」`, "ok");
  });
  $("newCatName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnCatAdd").click();
  });

  $("btnCat").addEventListener("click", openCatModal);
  $("catModalClose").addEventListener("click", closeCatModal);
  catModal.addEventListener("click", (e) => {
    if (e.target === catModal) closeCatModal();
  });

  // ---------- 事件绑定 ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("fTitle").value.trim();
    const due = $("fDue").value;
    if (!title || !due) {
      toast("请填写标题与到期日", "err");
      return;
    }
    // 规则集：去重升序；空规则集不允许提交（否则该事件永远不会提醒）
    const rules = [...new Set(editingRules)].sort((a, b) => a - b);
    if (rules.length === 0) {
      toast("至少保留一条提醒规则", "err");
      return;
    }
    const cat = $("fCategory").value.trim() || "其他";
    const cycle = Math.max(0, parseInt($("fCycle").value, 10) || 0);
    const note = $("fNote").value.trim();
    const now = new Date().toISOString();

    if (editingId) {
      const idx = events.findIndex((x) => x.id === editingId);
      if (idx >= 0) {
        events[idx] = {
          ...events[idx],
          title,
          category: cat,
          due_date: due,
          remind_days: rules,
          // 旧字段保留兼容（后端 rules() 只在 remind_days 为空时用它），取最大提前量无实际影响
          remind_days_before: 0,
          cycle_months: cycle,
          disabled: !!events[idx].disabled, // 编辑不改停用状态
          note,
          updated_at: now,
        };
      }
    } else {
      events.push({
        id: uid(),
        title,
        category: cat,
        due_date: due,
        remind_days: rules,
        remind_days_before: 0,
        cycle_months: cycle,
        disabled: false,
        note,
        created_at: now,
        updated_at: now,
        notified_at: null,
      });
    }
    await call("save_events", { events });
    closeModal();
    fillCategoryOptions();
    render();
    toast("已保存", "ok");
  });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    if (act === "edit") {
      openModal(ev);
    } else if (act === "del") {
      if (!confirm(`确定删除「${ev.title}」？`)) return;
      events = events.filter((x) => x.id !== id);
      await call("save_events", { events });
      fillCategoryOptions();
      render();
      toast("已删除", "ok");
    } else if (act === "clone") {
      // 克隆：复制一条同构事件（esim 保号等场景），副本去掉提醒去重标记，立即生效
      const now = new Date().toISOString();
      events.push({ ...ev, id: uid(), title: ev.title + " 副本", created_at: now, updated_at: now, notified_at: null });
      await call("save_events", { events });
      render();
      toast("已克隆", "ok");
    } else if (act === "toggle") {
      ev.disabled = !ev.disabled;
      await call("save_events", { events });
      render();
      toast(ev.disabled ? "已停用，不再提醒" : "已启用", "ok");
    } else if (act === "renew") {
      // 续订交给后端算日期（月底语义 + 过期多期推进），成功后用返回的实体更新本地
      try {
        const updated = await call("renew_event", { id });
        events = events.map((x) => (x.id === id ? updated : x));
        render();
        toast("已续订至 " + updated.due_date, "ok");
      } catch (_) {}
    }
  });

  $("btnAdd").addEventListener("click", () => openModal(null));
  $("btnAddEmpty").addEventListener("click", () => openModal(null));
  $("modalClose").addEventListener("click", closeModal);
  $("btnCancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  searchInput.addEventListener("input", render);
  filterCategory.addEventListener("change", render);
  filterStatus.addEventListener("change", render);

  $("btnExport").addEventListener("click", async () => {
    try {
      const path = await call("export_events");
      toast("已导出：" + path, "ok");
    } catch (_) {}
  });
  $("btnImport").addEventListener("click", async () => {
    if (!confirm("导入会用备份文件覆盖当前所有数据，确定继续？")) return;
    try {
      const imported = await call("import_events");
      events = imported || [];
      fillCategoryOptions();
      render();
      toast("导入完成，共 " + events.length + " 条", "ok");
    } catch (_) {}
  });
  // ---------- 启动 ----------
  async function boot() {
    try {
      const saved = await call("get_categories");
      // 后端有存过的分类才覆盖预设；空列表说明还没初始化过，保留内置预设
      if (Array.isArray(saved) && saved.length > 0) categories = saved;
    } catch (e) {
      // 读取失败（如旧版本后端无此命令）时静默兜底，用预设分类
    }
    try {
      events = await call("get_events");
    } catch (e) {
      events = [];
    }
    fillCategoryOptions();
    render();
  }

  // ---------- dev 自动刷新（livereload） ----------
  // 仅开发环境生效：发布后 webview 走 tauri:// 协议，hostname 不是 localhost，整段不执行。
  // 注意：若 devUrl 端口或 frontendDist 结构变化，需同步下面的判断条件。
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    let lrVersion = null;
    setInterval(async () => {
      try {
        const v = await fetch("/__livereload", { cache: "no-store" }).then((r) => r.text());
        // 首次只记录基线版本，避免页面一打开就刷新一次
        if (lrVersion === null) lrVersion = v;
        else if (v !== lrVersion) location.reload();
      } catch {
        // dev-server 未就绪时静默，下一轮再试
      }
    }, 2000);
  }
  boot();
})();
