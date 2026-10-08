// 如期而至 - 前端逻辑（纯静态，通过 window.__TAURI__.core.invoke 调用后端）
(function () {
  "use strict";

  const { invoke } = window.__TAURI__.core;

  // 预设分类及其颜色（新增时可选择，也支持自定义）
  const CATEGORIES = [
    { name: "会员", color: "#4f8cff" },
    { name: "保险", color: "#f5a623" },
    { name: "合同", color: "#9b6dff" },
    { name: "证件", color: "#2dd4bf" },
    { name: "账单", color: "#ff6b6b" },
    { name: "订阅", color: "#ff9f43" },
    { name: "其他", color: "#8a8f98" },
  ];
  const colorOf = (cat) => {
    const found = CATEGORIES.find((c) => c.name === cat);
    return found ? found.color : "#8a8f98";
  };

  let events = [];
  let editingId = null; // 正在编辑的事件 id，null 表示新增

  // DOM
  const $ = (id) => document.getElementById(id);
  const listEl = $("list");
  const emptyEl = $("empty");
  const searchInput = $("searchInput");
  const filterCategory = $("filterCategory");
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
  function render() {
    const kw = searchInput.value.trim().toLowerCase();
    const cat = filterCategory.value;

    const filtered = events.filter((e) => {
      const okCat = !cat || cat === "__all__" || e.category === cat;
      const okKw =
        !kw ||
        (e.title && e.title.toLowerCase().includes(kw)) ||
        (e.note && e.note.toLowerCase().includes(kw));
      return okCat && okKw;
    });

    // 统计（基于全部事件，不随筛选变化）
    let soon = 0,
      over = 0;
    events.forEach((e) => {
      const d = daysLeft(e.due_date);
      if (d === null) return;
      if (d < 0) over++;
      else if (d <= e.remind_days_before) soon++;
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
      if (d !== null && d < 0) card.classList.add("overdue");
      else if (d !== null && d <= e.remind_days_before) card.classList.add("soon");

      let daysHtml = "";
      if (d !== null) {
        const cls = d < 0 ? "over" : d <= e.remind_days_before ? "soon" : "normal";
        const txt = d > 0 ? `剩 ${d} 天` : d === 0 ? "今天到期" : `已过期 ${-d} 天`;
        daysHtml = `<span class="days ${cls}">${txt}</span>`;
      }

      card.innerHTML = `
        <span class="badge" style="background:${colorOf(e.category)}">${escapeHtml(
        e.category || "其他"
      )}</span>
        <div class="card-main">
          <div class="card-title">${escapeHtml(e.title)}</div>
          ${e.note ? `<div class="card-note">${escapeHtml(e.note)}</div>` : ""}
        </div>
        <div class="card-side">
          <div class="due-date">${fmtDue(e.due_date)}</div>
          ${daysHtml}
        </div>
        <div class="row-actions">
          <button class="mini" data-act="edit" data-id="${e.id}">编辑</button>
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
    const cats = Array.from(new Set([...CATEGORIES.map((c) => c.name), ...events.map((e) => e.category)]))
      .filter(Boolean)
      .sort();
    filterCategory.innerHTML =
      `<option value="__all__">全部分类</option>` +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    $("catList").innerHTML = CATEGORIES.map((c) => `<option value="${escapeHtml(c.name)}">`).join("");
  }

  // ---------- 弹窗 ----------
  function openModal(ev) {
    editingId = ev ? ev.id : null;
    $("modalTitle").textContent = ev ? "编辑事件" : "新增事件";
    $("fTitle").value = ev ? ev.title : "";
    $("fCategory").value = ev ? ev.category : "会员";
    $("fDue").value = ev ? ev.due_date : "";
    $("fRemind").value = ev ? ev.remind_days_before : 7;
    $("fNote").value = ev ? ev.note : "";
    modal.hidden = false;
    setTimeout(() => $("fTitle").focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    editingId = null;
  }

  // ---------- 事件绑定 ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("fTitle").value.trim();
    const due = $("fDue").value;
    if (!title || !due) {
      toast("请填写标题与到期日", "err");
      return;
    }
    const cat = $("fCategory").value.trim() || "其他";
    const remind = Math.max(0, parseInt($("fRemind").value, 10) || 0);
    const note = $("fNote").value.trim();
    const now = new Date().toISOString();

    if (editingId) {
      const idx = events.findIndex((x) => x.id === editingId);
      if (idx >= 0) {
        events[idx] = { ...events[idx], title, category: cat, due_date: due, remind_days_before: remind, note, updated_at: now };
      }
    } else {
      events.push({
        id: uid(),
        title,
        category: cat,
        due_date: due,
        remind_days_before: remind,
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
  $("btnTest").addEventListener("click", async () => {
    try {
      await call("test_notify");
      toast("已发送测试通知，请查看系统通知", "ok");
    } catch (_) {}
  });

  // ---------- 启动 ----------
  async function boot() {
    try {
      events = await call("get_events");
    } catch (e) {
      events = [];
    }
    fillCategoryOptions();
    render();
  }
  boot();
})();
