// 如期而至 - 前端逻辑（纯静态，通过 window.__TAURI__.core.invoke 调用后端）
(function () {
  "use strict";

  const { invoke } = window.__TAURI__.core;

  // ---------- 国际化 + 全局偏好 ----------
  // 语言/时区是全局设置（存后端 settings.json），boot 时读回；
  // 切换语言即时 applyLang() 重刷全部界面文字；时区影响 daysLeft / 日历「今天」
  const I18N = {
    zh: {
      app_title: '如期而至',
      brand_name: '如期而至',   // 顶栏品牌名：中文版用中文名，英文版用 Duely
      brand_sub: '会员 · 保险 · 合同 · 订阅，到期前提醒不漏接',
      nav_events: '首页', nav_cat: '分类', nav_settings: '设置',
      stat_total: '总事件', stat_soon: '即将到期', stat_over: '已过期',
      search_ph: '搜索标题 / 备注…',
      btn_import: '导入', btn_export: '导出', btn_add: '+ 新增提醒',
      btn_add_first: '添加第一个提醒',
      empty_none: '还没有任何事件', empty_filter: '没有符合条件的事件',
      btn_clear_filter: '清除筛选条件',
      all_categories: '全部分类', st_all: '全部状态',
      // ---- 废纸篓 ----
      nav_trash: '废纸篓',
      trash_title: '废纸篓',
      trash_tip: '从列表里删除的事件会先放到这里，不会真的丢掉。可以随时恢复到列表；彻底删除后无法找回。',
      trash_empty: '废纸篓是空的',
      trash_count: '共 {0} 项',
      trash_meta: '到期 {0} · 删除于 {1}',
      btn_restore: '恢复', btn_purge: '彻底删除', btn_purge_all: '清空废纸篓',
      confirm_purge: '彻底删除「{0}」？\n\n此操作无法撤销，删除后找不回。',
      confirm_purge_all: '清空废纸篓？共 {0} 项。\n\n此操作无法撤销，删除后找不回。',
      deleted_to_trash: '已移入废纸篓', restored: '已恢复到列表',
      purged: '已彻底删除', purge_all_done: '已清空废纸篓（{0} 项）',
      st_normal: '正常', st_soon: '即将到期', st_over: '已过期', st_off: '已停用',
      modal_add: '新增提醒', modal_edit: '编辑提醒',
      f_title: '标题', f_title_ph: '例如：视频网站会员续费',
      f_cat: '分类', f_cat_ph: '选择或输入自定义分类',
      f_due: '到期日', f_due_ph: '选择日期',
      f_rules: '提醒规则', rule_ph: '提前 N 天，0 = 当天',
      btn_rule_add: '添加', btn_rule_preset: '预设 7/3/1/当天',
      rule_day: '当天', rule_before: '提前 {0} 天', rule_empty: '尚未添加提醒规则', rule_remove: '移除',
      f_cycle: '续订周期',
      cycle_0: '不自动续订', cycle_1: '每月', cycle_3: '每季度', cycle_6: '每半年', cycle_12: '每年',
      cycle_n: '每 {0} 月',
      f_note: '备注', f_note_ph: '可选，例如：自动续费，记得取消',
      btn_cancel: '取消', btn_save: '保存',
      dp_today: '今天', dp_month: '{0}年{1}月', dp_year: '{0}年',
      dp_m1: '1月', dp_m2: '2月', dp_m3: '3月', dp_m4: '4月', dp_m5: '5月', dp_m6: '6月',
      dp_m7: '7月', dp_m8: '8月', dp_m9: '9月', dp_m10: '10月', dp_m11: '11月', dp_m12: '12月',
      w0: '日', w1: '一', w2: '二', w3: '三', w4: '四', w5: '五', w6: '六',
      cat_mgmt: '分类',
      cat_tip: '改色立即生效；改名会同步更新使用该分类的事件；删除在用分类时，相关事件会归为「其他」。',
      cat_add_ph: '输入新分类名称', btn_cat_add: '＋ 添加',
      cat_used: '{0} 个事件', cat_unused: '未使用',
      cat_other_locked: '「其他」是删除级联的归集目标，不能删除',
      days_left: '剩 {0} 天', days_today: '今天到期', days_over: '已过期 {0} 天',
      meta_remind: '提醒：', meta_renew: '{0}续订',
      progress_title: '本期已过 {0}%',
      tag_off: '已停用',
      btn_edit: '编辑', btn_clone: '克隆', btn_disable: '停用', btn_enable: '启用',
      btn_del: '删除', btn_renew: '续订', btn_refresh: '刷新',
      clone_suffix: ' 副本',
      confirm_del_event: '确定删除「{0}」？\n\n会先移入废纸篓，之后可以恢复。',
      confirm_import: '导入会用备份文件覆盖当前全部事件，确定继续？',
      confirm_del_cat_used: '分类「{0}」下有 {1} 个事件，删除后这些事件会归为「其他」。确定删除？',
      confirm_del_cat: '确定删除分类「{0}」？',
      err_op: '操作失败：{0}', err_days: '请输入 0~365 之间的天数',
      err_rules: '至少保留一条提醒规则', err_title_due: '请填写标题与到期日',
      saved: '已保存', refreshed: '已刷新', deleted: '已删除', cloned: '已克隆',
      msg_disabled: '已停用，不再提醒', msg_enabled: '已启用', renewed: '已续订至 {0}',
      color_updated: '颜色已更新', cat_name_empty: '分类名称不能为空',
      cat_exists: '已存在同名分类「{0}」', renamed: '已重命名为「{0}」，已同步 {1} 个事件',
      cat_added: '已添加分类「{0}」',
      notify_saved: '通知设置已保存', test_sent: '测试消息已发送，请到群里确认',
      webhook_empty: '请先填写至少一个 Webhook 地址',
      imported: '导入完成，共 {0} 条', exported: '已导出：{0}',
      theme_dark_on: '已切换到深色主题', theme_light_on: '已切换到浅色主题',
      theme_system_on: '已跟随系统主题',
      set_title: '设置', set_appearance: '外观', theme_label: '主题', theme_desc: '选择界面配色；跟随系统会随系统深浅色自动切换。', theme_dark: '深色', theme_light: '浅色', theme_system: '跟随系统',
      set_language: '语言', lang_label: '界面语言', lang_desc: '切换后界面文字立即生效。', lang_zh: '简体中文', lang_en: 'English',
      set_region: '时区', set_timezone: '时区', tz_current: '当前时区',
      tz_desc: '影响界面上的日期与剩余天数；提醒推送仍按系统时间。',
      set_data: '数据', set_data_io: '导入与导出',
      grp_general: '通用', grp_alert: '提醒', grp_data: '数据',
      data_import_label: '从备份文件导入', data_export_label: '导出为备份文件',
      data_import_desc: '会覆盖当前全部事件；备份文件里不含分类。',
      data_export_desc: '把全部事件存成一个 JSON 文件（不含分类）。',
      set_notify: '通知配置',
      notify_tip: '到期提醒时，除了本地系统通知，还会向已配置的群各推一条消息。Webhook 地址只保存在本机。',
      wecom_label: '企业微信机器人 Webhook', ding_label: '钉钉机器人 Webhook',
      btn_test: '发送测试',
      tz_system: '跟随系统', tz_utc: 'UTC',
      tz_asia_shanghai: '北京（UTC+8）', tz_asia_tokyo: '东京（UTC+9）',
      tz_asia_singapore: '新加坡（UTC+8）', tz_europe_london: '伦敦（UTC+0/+1）',
      tz_europe_berlin: '柏林（UTC+1/+2）', tz_america_new_york: '纽约（UTC-5/-4）',
      tz_america_los_angeles: '洛杉矶（UTC-8/-7）', tz_australia_sydney: '悉尼（UTC+10/+11）',
    },
    en: {
      app_title: 'Duely — Never Miss a Due Date',
      brand_name: 'Duely',
      brand_sub: 'Memberships · Insurance · Contracts · Subscriptions — reminded before they expire',
      nav_events: 'Home', nav_cat: 'Categories', nav_settings: 'Settings',
      stat_total: 'Total', stat_soon: 'Due soon', stat_over: 'Overdue',
      search_ph: 'Search title / note…',
      btn_import: 'Import', btn_export: 'Export', btn_add: '+ Add Reminder',
      btn_add_first: 'Add your first reminder',
      empty_none: 'No events yet', empty_filter: 'No matching events',
      btn_clear_filter: 'Clear filters',
      all_categories: 'All categories', st_all: 'All status',
      // ---- Trash ----
      nav_trash: 'Trash',
      trash_title: 'Trash',
      trash_tip: 'Events you delete from the list land here first, so nothing is lost by accident. Restore them any time; once permanently deleted they cannot be recovered.',
      trash_empty: 'Trash is empty',
      trash_count: '{0} item(s)',
      trash_meta: 'Due {0} · deleted {1}',
      btn_restore: 'Restore', btn_purge: 'Delete forever', btn_purge_all: 'Empty trash',
      confirm_purge: 'Permanently delete "{0}"?\n\nThis cannot be undone.',
      confirm_purge_all: 'Empty the trash? {0} item(s).\n\nThis cannot be undone.',
      deleted_to_trash: 'Moved to trash', restored: 'Restored to list',
      purged: 'Permanently deleted', purge_all_done: 'Trash emptied ({0} items)',
      st_normal: 'OK', st_soon: 'Due soon', st_over: 'Overdue', st_off: 'Disabled',
      modal_add: 'New Reminder', modal_edit: 'Edit Reminder',
      f_title: 'Title', f_title_ph: 'e.g. Streaming membership renewal',
      f_cat: 'Category', f_cat_ph: 'Choose or type a custom category',
      f_due: 'Due date', f_due_ph: 'Pick a date',
      f_rules: 'Reminder rules', rule_ph: 'Days before, 0 = due day',
      btn_rule_add: 'Add', btn_rule_preset: 'Preset 7/3/1/0',
      rule_day: 'Due day', rule_before: '{0}d before', rule_empty: 'No reminder rules yet', rule_remove: 'Remove',
      f_cycle: 'Renewal cycle',
      cycle_0: 'No auto-renewal', cycle_1: 'Monthly', cycle_3: 'Quarterly', cycle_6: 'Semi-annually', cycle_12: 'Yearly',
      cycle_n: 'Every {0} months',
      f_note: 'Note', f_note_ph: 'Optional, e.g. auto-renews, remember to cancel',
      btn_cancel: 'Cancel', btn_save: 'Save',
      dp_today: 'Today', dp_month: '{1} / {0}', dp_year: '{0}',
      dp_m1: 'Jan', dp_m2: 'Feb', dp_m3: 'Mar', dp_m4: 'Apr', dp_m5: 'May', dp_m6: 'Jun',
      dp_m7: 'Jul', dp_m8: 'Aug', dp_m9: 'Sep', dp_m10: 'Oct', dp_m11: 'Nov', dp_m12: 'Dec',
      w0: 'S', w1: 'M', w2: 'T', w3: 'W', w4: 'T', w5: 'F', w6: 'S',
      cat_mgmt: 'Categories',
      cat_tip: 'Color changes apply instantly; renaming updates all events using it; deleting a category in use moves its events to Other.',
      cat_add_ph: 'New category name', btn_cat_add: '＋ Add',
      cat_used: '{0} events', cat_unused: 'Unused',
      cat_other_locked: 'Other is the fallback for deleted categories and cannot be removed',
      days_left: '{0}d left', days_today: 'Due today', days_over: '{0}d overdue',
      meta_remind: 'Reminders: ', meta_renew: 'renews {0}',
      progress_title: '{0}% of this cycle',
      tag_off: 'Disabled',
      btn_edit: 'Edit', btn_clone: 'Clone', btn_disable: 'Disable', btn_enable: 'Enable',
      btn_del: 'Delete', btn_renew: 'Renew', btn_refresh: 'Refresh',
      clone_suffix: ' (copy)',
      confirm_del_event: 'Delete "{0}"?\n\nIt moves to Trash first and can be restored.',
      confirm_import: 'Import will overwrite all current events. Continue?',
      confirm_del_cat_used: 'Category "{0}" has {1} events; they will be moved to Other. Delete?',
      confirm_del_cat: 'Delete category "{0}"?',
      err_op: 'Failed: {0}', err_days: 'Enter a number between 0 and 365',
      err_rules: 'Keep at least one reminder rule', err_title_due: 'Title and due date are required',
      saved: 'Saved', refreshed: 'Refreshed', deleted: 'Deleted', cloned: 'Cloned',
      msg_disabled: 'Disabled, no more reminders', msg_enabled: 'Enabled', renewed: 'Renewed until {0}',
      color_updated: 'Color updated', cat_name_empty: 'Category name cannot be empty',
      cat_exists: 'Category "{0}" already exists', renamed: 'Renamed to "{0}", synced {1} events',
      cat_added: 'Added category "{0}"',
      notify_saved: 'Notification settings saved', test_sent: 'Test message sent, please check the group',
      webhook_empty: 'Enter at least one webhook URL',
      imported: 'Imported {0} items', exported: 'Exported: {0}',
      theme_dark_on: 'Switched to dark theme', theme_light_on: 'Switched to light theme',
      theme_system_on: 'Now following the system theme',
      set_title: 'Settings', set_appearance: 'Appearance', theme_label: 'Theme', theme_desc: 'Pick a color scheme. Follow system tracks the OS appearance.', theme_dark: 'Dark', theme_light: 'Light', theme_system: 'Follow system',
      set_language: 'Language', lang_label: 'Interface language', lang_desc: 'Applies to the interface right away.', lang_zh: '简体中文', lang_en: 'English',
      set_region: 'Time zone', set_timezone: 'Time zone', tz_current: 'Current time zone',
      tz_desc: 'Affects dates and days-left in the UI; reminders still follow system time.',
      set_data: 'Data', set_data_io: 'Import & export',
      grp_general: 'General', grp_alert: 'Alerts', grp_data: 'Data',
      data_import_label: 'Import from backup file', data_export_label: 'Export to backup file',
      data_import_desc: 'Replaces all current events; the backup holds no categories.',
      data_export_desc: 'Saves all events as one JSON file (categories excluded).',
      set_notify: 'Notifications',
      notify_tip: 'On due reminders, a message is pushed to each configured group in addition to the local system notification. Webhook URLs stay on this machine.',
      wecom_label: 'WeCom bot webhook', ding_label: 'DingTalk bot webhook',
      btn_test: 'Send test',
      tz_system: 'Follow system', tz_utc: 'UTC',
      tz_asia_shanghai: 'Beijing (UTC+8)', tz_asia_tokyo: 'Tokyo (UTC+9)',
      tz_asia_singapore: 'Singapore (UTC+8)', tz_europe_london: 'London (UTC+0/+1)',
      tz_europe_berlin: 'Berlin (UTC+1/+2)', tz_america_new_york: 'New York (UTC-5/-4)',
      tz_america_los_angeles: 'Los Angeles (UTC-8/-7)', tz_australia_sydney: 'Sydney (UTC+10/+11)',
    },
  };
  let lang = 'zh';
  let timezone = ''; // IANA 时区名；空 = 跟随系统
  function t(key, ...args) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.zh[key] || key;
    args.forEach((a, i) => { s = s.split('{' + i + '}').join(String(a)); });
    return s;
  }
  // 指定时区下的「今天」；空时区回退系统本地。统一用 UTC 零点相减算天数，避免时区偏移误差
  function tzToday() {
    const n = new Date();
    if (!timezone) return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
    try {
      const s = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(n);
      const p = s.split('-').map(Number);
      return { y: p[0], m: p[1], d: p[2] };
    } catch {
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
    }
  }

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

  // 有效事件 = 不在废纸篓里的（deleted_at 为空）。列表、统计、筛选计数、分类用量
  // 一律只认这批；废纸篓里的条目仍完整留在 events 里（软删除），只是不参与这些计算。
  const liveEvents = () => events.filter((e) => !e.deleted_at);
  const trashEvents = () => events.filter((e) => e.deleted_at);

  // 分类用量：只数列表里（未删除）的事件 —— 分类页上那个「N 个事件」显示的就是它
  const usageOf = (cat) => liveEvents().filter((e) => e.category === cat).length;
  // 分类改名 / 删除的级联要覆盖**包括废纸篓在内**的全部事件，
  // 否则恢复回来的条目会指向一个已不存在的分类名（颜色退化成灰、筛选里多出一个空分类）
  const usageTotalOf = (cat) => events.filter((e) => e.category === cat).length;

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
  const filterCategoryBtn = $("filterCategoryBtn");
  const filterCategoryPanel = $("filterCategoryPanel");
  const filterStatusBtn = $("filterStatusBtn");
  const filterStatusPanel = $("filterStatusPanel");
  // 筛选选中值不再存在 DOM（原生 select 已移除），用变量持有；默认全部
  let filterCatValue = "__all__";
  let filterStatusValue = "__all__";
  const modal = $("modal");
  const form = $("eventForm");

  // ---------- 工具 ----------
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // 计算剩余天数：「今天」按设置的时区取（timezone 为空则系统本地）
  function daysLeft(dueStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueStr || "");
    if (!m) return null;
    const dueUtc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const td = tzToday();
    const todayUtc = Date.UTC(td.y, td.m - 1, td.d);
    return Math.round((dueUtc - todayUtc) / 86400000);
  }

  function fmtDue(dueStr) {
    // 只显示日期本身；剩余天数由下方的 .days 徽标展示，避免同屏重复
    return dueStr;
  }

  // 本期进度：从「本期开始」到今天，占「本期开始 → 到期日」的比例。
  // 本期开始 = 有续订周期就取「到期日 − 周期」（续订后自动落回本期起点），
  // 否则从事件的录入时间算起。供列表中间的进度条使用：一眼看出这个周期已经走了多少。
  // 算不出起止点（无到期日 / 起点晚于到期日）时返回 null，此时不画条
  function cycleProgress(e) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.due_date || "");
    if (!m) return null;
    const dueUtc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    let startUtc = null;
    if (e.cycle_months > 0) {
      const s = new Date(dueUtc);
      s.setUTCMonth(s.getUTCMonth() - e.cycle_months);
      startUtc = s.getTime();
    } else if (e.created_at) {
      const c = new Date(e.created_at);
      // created_at 存的是 UTC，取 UTC 年月日再拼零点，避免本地时区把日期挪一天
      if (!isNaN(c.getTime())) startUtc = Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate());
    }
    if (startUtc === null) return null;
    const td = tzToday();
    const todayUtc = Date.UTC(td.y, td.m - 1, td.d);
    // 起点已落在到期日之后（例如补录一条早就过期的会员）：本期视为走完，
    // 返回 1 而不是 null —— 网格里少一个子元素会让后面的列整体前移一格
    if (dueUtc <= startUtc) return 1;
    return Math.max(0, Math.min(1, (todayUtc - startUtc) / (dueUtc - startUtc)));
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
      toast(t("err_op", e), "err");
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

  // ---------- 筛选项计数 ----------
  // 数字口径 = 「点这一项之后列表会显示多少条」：搜索关键词 + 另一个维度生效，
  // 而本维度不设条件（点选后本维度只剩选中那一项，其他项自然被排除）。
  // 这样数字与点击结果永远一致，不会出现「标着 3 条、点开只剩 1 条」的困惑。
  function baseFiltered(skip) {
    const kw = searchInput.value.trim().toLowerCase();
    return liveEvents().filter((e) => {
      const okKw =
        !kw ||
        (e.title && e.title.toLowerCase().includes(kw)) ||
        (e.note && e.note.toLowerCase().includes(kw));
      const okCat = skip === "cat" || filterCatValue === "__all__" || e.category === filterCatValue;
      const okStatus =
        skip === "status" || filterStatusValue === "__all__" || statusOf(e) === filterStatusValue;
      return okKw && okCat && okStatus;
    });
  }

  // 分类名 → 条数
  function catCounts() {
    const m = new Map();
    baseFiltered("cat").forEach((e) => m.set(e.category, (m.get(e.category) || 0) + 1));
    return m;
  }

  // 状态值 → 条数
  function statusCounts() {
    const m = new Map();
    baseFiltered("status").forEach((e) => {
      const s = statusOf(e);
      m.set(s, (m.get(s) || 0) + 1);
    });
    return m;
  }

  // 下拉项右侧的条数角标（由 CSS 用 margin-left:auto 推到最右）
  function countBadge(n) {
    return `<span class="ci-n">${n}</span>`;
  }

  // 到期日的合法格式；放在 render 之前声明（render 可能在顶层初始化完成前被调用，
  // 用模块级 const 必须确保它先于任何调用点完成初始化，否则 TDZ 会抛 ReferenceError）
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function render() {
    const kw = searchInput.value.trim().toLowerCase();
    const cat = filterCatValue;
    const status = filterStatusValue;

    // 列表只渲染未删除的条目；废纸篓里的走废纸篓页，不混进来
    const filtered = liveEvents()
      .filter((e) => {
        const okCat = !cat || cat === "__all__" || e.category === cat;
        const okKw =
          !kw ||
          (e.title && e.title.toLowerCase().includes(kw)) ||
          (e.note && e.note.toLowerCase().includes(kw));
        const okStatus = !status || status === "__all__" || statusOf(e) === status;
        return okCat && okKw && okStatus;
      })
      // 列表按到期日正序（最早到期排最前，也就是最该处理的在最上面）。
      // 日期格式是 YYYY-MM-DD，定长零填充，字符串比较即等价于日期比较。
      // 注意：filter 已经产生新数组，这里原地 sort 不会动到 events 原始顺序
      // （保存时写回的是 events，不能因为展示排序把数据顺序也改了）。
      .sort((a, b) => {
        const da = ISO_DATE.test(a.due_date) ? a.due_date : null;
        const db = ISO_DATE.test(b.due_date) ? b.due_date : null;
        // 日期缺失或格式非法的排到最后：它们无法参与比较，
        // 若当成最小值放前面，会顶掉真正紧急的条目
        if (da === null) return db === null ? 0 : 1;
        if (db === null) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      });

    // 统计（基于未删除的事件，不随筛选变化；停用条目不计入即将到期/已过期，避免干扰）
    let soon = 0,
      over = 0;
    liveEvents().forEach((e) => {
      if (e.disabled) return;
      const d = daysLeft(e.due_date);
      if (d === null) return;
      if (d < 0) over++;
      else {
        const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
        if (d <= Math.max(...rules)) soon++;
      }
    });
    $("statTotal").textContent = liveEvents().length;
    $("statSoon").textContent = soon;
    $("statOver").textContent = over;

    // 统计卡高亮：与状态筛选是同一份状态（卡片和工具栏下拉是两个入口），
    // 在这里统一同步，避免从下拉改筛选后卡片高亮还停在旧位置
    const activeKey = activeStatKey(filterStatusValue);
    document.querySelectorAll(".stat").forEach((el) => {
      const on = el.dataset.stat === activeKey;
      el.classList.toggle("active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // 下拉里的条数随数据 / 搜索词 / 另一维度筛选变化，统一在这里刷新（面板关着也重建，项数很少）
    fillCategoryOptions();
    renderStatusPanel();

    listEl.innerHTML = "";
    if (filtered.length === 0) {
      // 两种空态分开：确实一条数据都没有 vs 被筛选条件过滤光了
      // 空态只看「列表里还有没有条目」：废纸篓里有东西不算有数据，
      // 否则删光之后列表空着却不显示「还没有任何事件」的引导
      const live = liveEvents().length;
      emptyEl.hidden = live !== 0;
      $("emptyFilter").hidden = live === 0;
      return;
    }
    emptyEl.hidden = true;
    $("emptyFilter").hidden = true;

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
      let statusCls = ""; // 与剩余天数徽标同源的状态类，进度条复用同一套配色
      if (d !== null) {
        const rules = e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0];
        statusCls = d < 0 ? "over" : d <= Math.max(...rules) ? "soon" : "normal";
        const txt = d > 0 ? t("days_left", d) : d === 0 ? t("days_today") : t("days_over", -d);
        daysHtml = `<span class="days ${statusCls}">${txt}</span>`;
      }
      // 进度条铺在标题与日期之间，填掉这一段的空白；悬停给出百分比，避免「这条是什么」的困惑。
      // 无论有没有数值都必须渲染这个元素：它缺席会让网格后面的列整体前移一格，行与行就参差了
      const prog = cycleProgress(e);
      const barHtml = `<div class="card-progress ${statusCls}"${
        prog === null ? "" : ` title="${escapeHtml(t("progress_title", Math.round(prog * 100)))}"`
      }><i style="width:${prog === null ? 0 : (prog * 100).toFixed(1)}%"></i></div>`;
      // 提醒规则摘要，如「提前 7/3/1 天 · 当天」，便于不打开编辑也能看清提醒节奏
      const rules = (e.remind_days && e.remind_days.length ? e.remind_days : [e.remind_days_before || 0])
        .map((r) => (r === 0 ? t("rule_day") : r))
        .sort((a, b) => (a === "当天" ? -1 : b === "当天" ? 1 : a - b))
        .join("/");
      // 周期文案走 i18n 键（cycle_1/3/6/12），无预设键时按「每 N 月」模板
      const cycleTxt = e.cycle_months
        ? (I18N.zh["cycle_" + e.cycle_months] ? t("cycle_" + e.cycle_months) : t("cycle_n", e.cycle_months))
        : "";

      card.innerHTML = `
        <span class="badge" style="background:${colorOf(e.category)}" title="${escapeHtml(e.category || "其他")}">${escapeHtml(
        e.category || "其他"
      )}</span>
        <div class="card-main">
          <div class="card-title"><span class="ttl">${escapeHtml(e.title)}</span>${e.disabled ? '<span class="off-tag">' + t("tag_off") + "</span>" : ""}</div>
          <div class="card-sub">${
            e.note ? `<span class="card-note">${escapeHtml(e.note)}</span>` : ""
          }<span class="card-meta">${escapeHtml(
            t("meta_remind") + String(rules) + (cycleTxt ? " · " + t("meta_renew", cycleTxt) : "")
          )}</span></div>
        </div>
        ${barHtml}
        <div class="card-side">
          <div class="due-date">${fmtDue(e.due_date)}</div>
          ${daysHtml}
        </div>
        <div class="row-actions">
          ${
            // 「续订」只有配了周期的事件才有；没有周期的也留一个同宽占位（visibility:hidden）——
            // 行内按钮数一致，操作列宽度才固定，进度条左边缘和日期列才能跨行对齐
            e.cycle_months
              ? `<button class="mini renew" data-act="renew" data-id="${e.id}">${t("btn_renew")}</button>`
              : `<button class="mini renew" tabindex="-1" aria-hidden="true" style="visibility:hidden">${t("btn_renew")}</button>`
          }
          <button class="mini edit" data-act="edit" data-id="${e.id}">${t("btn_edit")}</button>
          <button class="mini clone" data-act="clone" data-id="${e.id}">${t("btn_clone")}</button>
          <button class="mini toggle" data-act="toggle" data-id="${e.id}">${e.disabled ? t("btn_enable") : t("btn_disable")}</button>
          <button class="mini del" data-act="del" data-id="${e.id}">${t("btn_del")}</button>
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
    const cats = Array.from(new Set([...categories.map((c) => c.name), ...liveEvents().map((e) => e.category)]))
      .filter(Boolean)
      .sort();
    // 重建面板项；保留当前选中（分类被删等导致选中项消失时回退「全部分类」）
    const prev = filterCatValue;
    const counts = catCounts();
    // 按条数从多到少：用户最关心「哪个分类还有事要处理」，所以多的排前面。
    // 条数相同则保持上面的字典序（Array#sort 自 ES2019 起是稳定排序）
    const ordered = cats
      .map((c) => ({ name: c, n: counts.get(c) || 0 }))
      .sort((a, b) => b.n - a.n);
    filterCategoryPanel.innerHTML =
      // 「全部分类」没有分类色，补一个不可见的圆点占位，名称才能与下面各条左对齐
      `<button type="button" class="combo-item${prev === "__all__" ? " active" : ""}" data-val="__all__"><i class="dot is-blank"></i>${t("all_categories")}${countBadge(baseFiltered("cat").length)}</button>` +
      ordered
        .map(
          // 注意：cats 是分类名字符串数组（上面已 .map(c => c.name)），不是对象，直接取 c
          ({ name: c, n }) =>
            `<button type="button" class="combo-item${prev === c ? " active" : ""}" data-val="${escapeHtml(c)}"><i class="dot" style="background:${escapeHtml(colorOf(c))}"></i>${escapeHtml(c)}${countBadge(n)}</button>`
        )
        .join("");
    if (prev !== "__all__" && !cats.includes(prev)) filterCatValue = "__all__";
    filterCategoryBtn.textContent = filterCatValue === "__all__" ? t("all_categories") : filterCatValue;
  }

  // ---------- 自绘下拉（分类建议 + 续订周期） ----------
  // 替代原生 datalist / select 弹层：webview 里原生弹层是系统样式，与暗色主题完全脱节。
  // 分类面板支持输入过滤，点选填入；仍保留自由输入（不强制选已有分类）。
  const CYCLE_OPTIONS = [[0, "cycle_0"], [1, "cycle_1"], [3, "cycle_3"], [6, "cycle_6"], [12, "cycle_12"]];

  function buildCyclePanel() {
    $("cyclePanel").innerHTML = CYCLE_OPTIONS.map(
      ([v, k]) => `<button type="button" class="combo-item" data-val="${v}">${t(k)}</button>`
    ).join("");
  }
  buildCyclePanel();

  function syncCycleLabel() {
    const v = parseInt($("fCycle").value, 10) || 0;
    const hit = CYCLE_OPTIONS.find(([x]) => x === v);
    $("cycleBtn").textContent = hit ? t(hit[1]) : t("cycle_0");
  }

  function hideCombos() {
    $("catPanel").hidden = true;
    $("cyclePanel").hidden = true;
    filterCategoryPanel.hidden = true;
    filterStatusPanel.hidden = true;
    $("tzPanel").hidden = true;
  }

  // all=true（聚焦时）：忽略输入框已有内容展示全部分类——否则预填值（如默认「会员」）
  // 会把列表过滤成一项，用户看不到其他分类；输入时才按关键字过滤
  function renderCatPanel(all = false) {
    const q = all ? "" : $("fCategory").value.trim().toLowerCase();
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

  $("fCategory").addEventListener("focus", () => renderCatPanel(true));
  $("fCategory").addEventListener("input", () => renderCatPanel(false));
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
    if (
      !e.target.closest("#catCombo") &&
      !e.target.closest("#cycleCombo") &&
      !e.target.closest("#filterCatCombo") &&
      !e.target.closest("#filterStatusCombo") &&
      !e.target.closest("#tzCombo")
    )
      hideCombos();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideCombos();
  });

  // ---------- 工具栏筛选下拉（自绘，替代原生 select） ----------
  const STATUS_OPTIONS = [
    ["__all__", "st_all"],
    ["normal", "st_normal"],
    ["soon", "st_soon"],
    ["over", "st_over"],
    ["off", "st_off"],
  ];

  // 状态面板同样带条数、按条数降序；「全部状态」固定置顶不参与排序（它是清零入口）。
  // 条数随筛选与日期变化，所以每次都用最新计数重建（只有 5 项，开销可忽略）
  function buildStatusPanel() {
    const counts = statusCounts();
    const all = STATUS_OPTIONS[0];
    const ordered = STATUS_OPTIONS.filter(([v]) => v !== all[0])
      .map(([v, k]) => ({ v, k, n: counts.get(v) || 0 }))
      .sort((a, b) => b.n - a.n);
    filterStatusPanel.innerHTML =
      `<button type="button" class="combo-item${filterStatusValue === all[0] ? " active" : ""}" data-val="${all[0]}">${t(all[1])}${countBadge(baseFiltered("status").length)}</button>` +
      ordered
        .map(
          ({ v, k, n }) =>
            `<button type="button" class="combo-item${filterStatusValue === v ? " active" : ""}" data-val="${v}">${t(k)}${countBadge(n)}</button>`
        )
        .join("");
  }
  buildStatusPanel();

  function statusLabel(v) {
    const hit = STATUS_OPTIONS.find(([x]) => x === v);
    return hit ? t(hit[1]) : v;
  }

  // 语义保持「让面板与当前选中同步」，实现改为整块重建 —— 因为条数也要跟着刷新
  function renderStatusPanel() {
    buildStatusPanel();
  }

  filterStatusBtn.addEventListener("click", () => {
    renderStatusPanel();
    const p = filterStatusPanel;
    const willOpen = p.hidden;
    hideCombos();
    p.hidden = !willOpen;
  });
  filterStatusPanel.addEventListener("click", (e) => {
    const item = e.target.closest("[data-val]");
    if (!item) return;
    filterStatusValue = item.getAttribute("data-val");
    filterStatusBtn.textContent = statusLabel(filterStatusValue);
    filterStatusPanel.hidden = true;
    render();
  });

  // 统计卡与状态筛选的映射：卡片就是「改状态筛选」的另一个入口，
  // 与工具栏下拉共用 filterStatusValue，所以两处天然同步。
  // 注意：不要写成外层 const 映射表 —— render() 可能在顶层初始化完成前被执行，
  // const 有 TDZ 会直接抛 ReferenceError；纯函数无外部依赖，最稳。
  function statToStatus(key) {
    return key === "all" ? "__all__" : key; // soon / over 与状态值同名，只有「总事件」要映射成全部
  }
  /// 反查：当前状态筛选命中哪张卡（normal / off 没有对应卡片，返回空串表示都不高亮）
  function activeStatKey(status) {
    return ["all", "soon", "over"].find((k) => statToStatus(k) === status) || "";
  }

  document.querySelectorAll(".stat").forEach((el) =>
    el.addEventListener("click", () => {
      const target = statToStatus(el.dataset.stat);
      // 再点一次已激活的卡片 = 取消筛选（回到全部状态）
      filterStatusValue = filterStatusValue === target ? "__all__" : target;
      filterStatusBtn.textContent = statusLabel(filterStatusValue);
      filterStatusPanel.hidden = true; // 卡片和下拉不会同时开着
      renderStatusPanel();             // 让下拉面板的选中态跟上
      render();
    })
  );

  filterCategoryBtn.addEventListener("click", () => {
    fillCategoryOptions(); // 打开前重建，保证 active 标记和最新分类一致
    const p = filterCategoryPanel;
    const willOpen = p.hidden;
    hideCombos();
    p.hidden = !willOpen;
  });
  filterCategoryPanel.addEventListener("click", (e) => {
    const item = e.target.closest("[data-val]");
    if (!item) return;
    filterCatValue = item.getAttribute("data-val");
    fillCategoryOptions(); // 同步按钮文字和 active 标记
    filterCategoryPanel.hidden = true;
    render();
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
      chip.innerHTML = `${d === 0 ? t("rule_day") : t("rule_before", d)}<button type="button" class="chip-x" data-day="${d}" title="${t("rule_remove")}">✕</button>`;
      box.appendChild(chip);
    });
    if (editingRules.length === 0) {
      box.innerHTML = `<span class="rule-empty">${t("rule_empty")}</span>`;
    }
  }

  $("btnRuleAdd").addEventListener("click", () => {
    const v = parseInt($("fRuleDay").value, 10);
    if (isNaN(v) || v < 0 || v > 365) {
      toast(t("err_days"), "err");
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
    $("modalTitle").textContent = ev ? t("modal_edit") : t("modal_add");
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
  // 面板有两种视图：day = 日历（42 格）、month = 月份快选（12 格）。
  // 只有月历的时候，跨年要连点十几次「下一月」；加一层月份快选后，
  // 跨年 = 点 1 次年按钮（跳 1 年），选定「年月」= 2-3 次点击
  let dpMode = "day";
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

  // 月份快选视图：这一年 12 个月，点一个即回到日历视图
  function dpRenderMonths() {
    dpTitle.textContent = t("dp_year", dpView.y);
    const sel = dpSelected();
    let html = "";
    for (let m = 1; m <= 12; m++) {
      const isSel = !!sel && sel.y === dpView.y && sel.m === m;
      html += `<button type="button" class="dp-day${isSel ? " sel" : ""}" data-month="${m}">${t(
        "dp_m" + m
      )}</button>`;
    }
    // 月份格子用 3 列（12 个月 = 4 行），比 7 列的日子格宽，读起来更清楚
    dpDays.className = "dp-grid dp-months";
    dpDays.innerHTML = html;
  }

  function dpRender() {
    if (dpMode === "month") {
      dpRenderMonths();
      return;
    }
    dpDays.className = "dp-grid";
    dpTitle.textContent = t("dp_month", dpView.y, dpView.m);
    const first = new Date(dpView.y, dpView.m - 1, 1);
    const startWeek = first.getDay(); // 当月 1 号是周几（0=周日），决定首行补几个上月日期
    const daysInMonth = new Date(dpView.y, dpView.m, 0).getDate();
    const prevDays = new Date(dpView.y, dpView.m - 1, 0).getDate();
    const td = tzToday();
    const sel = dpSelected();
    // 固定渲染 42 格（6 行），切换月份时面板高度不跳动；首尾 gray 显示相邻月日期，可直接点选
    const cell = (y, m, d, outside) => {
      const isToday = y === td.y && m === td.m && d === td.d;
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
    dpMode = "day"; // 每次打开都从日历视图开始，不要停在上次的月份快选
    dpSyncHead();
    dpRender();
    duePanel.hidden = false;
    dpOpen = true;
  }

  function dpClosePanel() {
    duePanel.hidden = true;
    dpOpen = false;
  }

  // 月份快选视图下，翻月按钮没有意义，隐藏掉只留 « 2026年 »
  function dpSyncHead() {
    const isMonth = dpMode === "month";
    $("dpPrev").hidden = isMonth;
    $("dpNext").hidden = isMonth;
    $("dpTitle").title = isMonth ? "返回日历" : "选择月份";
  }
  // 切到月份快选：此时 « » 变成翻年
  function dpShowMonths() {
    dpMode = "month";
    dpSyncHead();
    dpRender();
  }
  function dpShowDays() {
    dpMode = "day";
    dpSyncHead();
    dpRender();
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
  // 翻年：日历视图与月份快选视图下都可用（跨年场景一键跳一年）
  $("dpPrevYear").addEventListener("click", () => {
    dpView.y--;
    dpRender();
  });
  $("dpNextYear").addEventListener("click", () => {
    dpView.y++;
    dpRender();
  });
  // 点标题在「日历 ⇄ 月份快选」之间切换
  $("dpTitle").addEventListener("click", () => (dpMode === "month" ? dpShowDays() : dpShowMonths()));
  dpDays.addEventListener("click", (e) => {
    // 月份快选：选完月份回到日历视图，不关闭面板（还要接着选日子）
    const mon = e.target.closest("button[data-month]");
    if (mon) {
      dpView.m = parseInt(mon.dataset.month, 10);
      dpShowDays();
      return;
    }
    const btn = e.target.closest("button[data-date]");
    if (!btn) return;
    dueInput.value = btn.dataset.date;
    dpClosePanel();
  });
  $("dpToday").addEventListener("click", () => {
    const td = tzToday();
    dueInput.value = dpFmt(td.y, td.m, td.d);
    dpClosePanel();
  });
  // 点面板以外区域关闭；Escape 关闭。注意监听挂在 document 上，靠 contains 判断来源
  document.addEventListener("click", (e) => {
    if (dpOpen && !duePicker.contains(e.target)) dpClosePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dpOpen) dpClosePanel();
  });


  // ---------- 废纸篓 ----------
  // 删除语义：列表里的「删除」= 软删除（只写 deleted_at），条目落到这里。
  // 好处是误删可恢复；代价是所有「看数据」的地方都必须排除已删除条目 ——
  // 收口在 liveEvents() / trashEvents() 两个访问器里，别在各处手写 !e.deleted_at。
  const trashRows = $("trashRows");

  function openTrashPage() {
    renderTrash();
    showView("trash");
  }

  // 时间戳渲染：后端存的 deleted_at 是 RFC3339，这里按「所选时区」显示成 YYYY-MM-DD HH:mm。
  // 用 formatToParts 手工拼而不用 Intl 的默认排版 —— 各 locale 的分隔符与顺序都不一样，
  // 会让「删除于 …」忽长忽短，也和旁边的到期日格式不一致。
  function fmtStamp(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
    const opt = {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    };
    if (timezone) opt.timeZone = timezone;
    const p = {};
    new Intl.DateTimeFormat("en-CA", opt).formatToParts(d).forEach((x) => (p[x.type] = x.value));
    // hour12:false 在部分地区实现里会把午夜给成 "24"，折回 "00" 与其余日期一致
    const hh = p.hour === "24" ? "00" : p.hour;
    return `${p.year}-${p.month}-${p.day} ${hh}:${p.minute}`;
  }

  function renderTrash() {
    // 最近删的排最前：刚删错的那条最可能需要恢复
    const rows = trashEvents().sort((a, b) => String(b.deleted_at || "").localeCompare(String(a.deleted_at || "")));
    $("trashCount").textContent = rows.length ? t("trash_count", rows.length) : "";
    // 空的时候没必要给「清空」按钮可点
    $("btnPurgeAll").disabled = rows.length === 0;
    trashRows.innerHTML = "";

    if (rows.length === 0) {
      // 带 data-i18n 以便切换语言时被 applyLang() 一并刷新（纯文本叶子节点，安全）
      const tip = document.createElement("p");
      tip.className = "trash-empty";
      tip.dataset.i18n = "trash_empty";
      tip.textContent = t("trash_empty");
      trashRows.appendChild(tip);
      return;
    }

    rows.forEach((e) => {
      const card = document.createElement("div");
      card.className = "card trash-card";
      card.innerHTML = `
        <span class="badge" style="background:${escapeHtml(colorOf(e.category))}" title="${escapeHtml(e.category || "其他")}">${escapeHtml(e.category || "其他")}</span>
        <div class="card-main">
          <div class="card-title"><span class="ttl">${escapeHtml(e.title)}</span></div>
          <div class="card-sub"><span class="card-meta">${escapeHtml(
            t("trash_meta", e.due_date || "—", fmtStamp(e.deleted_at))
          )}</span></div>
        </div>
        <div class="row-actions">
          <button class="mini restore" data-act="restore" data-id="${e.id}">${t("btn_restore")}</button>
          <button class="mini purge" data-act="purge" data-id="${e.id}">${t("btn_purge")}</button>
        </div>`;
      trashRows.appendChild(card);
    });
  }

  trashRows.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const ev = events.find((x) => x.id === id);
    if (!ev) return;

    if (act === "restore") {
      events = events.map((x) => (x.id === id ? { ...x, deleted_at: null, updated_at: new Date().toISOString() } : x));
      await call("save_events", { events });
      fillCategoryOptions();
      render();
      renderTrash();
      toast(t("restored"), "ok");
    } else if (act === "purge") {
      // 唯一真正销毁数据的入口 —— 确认文案里必须写明不可撤销
      if (!confirm(t("confirm_purge", ev.title))) return;
      events = events.filter((x) => x.id !== id);
      await call("save_events", { events });
      renderTrash();
      toast(t("purged"), "ok");
    }
  });

  $("btnPurgeAll").addEventListener("click", async () => {
    const rows = trashEvents();
    if (rows.length === 0) return;
    if (!confirm(t("confirm_purge_all", rows.length))) return;
    events = events.filter((x) => !x.deleted_at);
    await call("save_events", { events });
    renderTrash();
    toast(t("purge_all_done", rows.length), "ok");
  });

  // ---------- 分类管理（独立页面，原为弹窗） ----------
  const catRows = $("catRows");

  // 每次进入页面都重算：分类用量取决于事件数据，事件可能已被改动
  function openCatPage() {
    renderCatRows();
    showView("categories");
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
        <span class="cat-usage">${used > 0 ? t("cat_used", used) : t("cat_unused")}</span>
        <button type="button" class="mini del cat-del" data-idx="${idx}" ${c.name === "其他" ? `disabled title="${t("cat_other_locked")}"` : ""}>${t("btn_del")}</button>`;
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
    toast(t("color_updated"), "ok");
  });

  // 改名：失焦或回车时校验并级联更新事件
  catRows.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("cat-name")) return;
    const idx = Number(e.target.dataset.idx);
    const oldName = categories[idx].name;
    const newName = e.target.value.trim();
    if (newName === oldName) return;
    if (!newName) {
      toast(t("cat_name_empty"), "err");
      e.target.value = oldName;
      return;
    }
    if (categories.some((c, i) => i !== idx && c.name === newName)) {
      toast(t("cat_exists", newName), "err");
      e.target.value = oldName;
      return;
    }
    // 级联：事件里所有旧名改为新名（先存事件再存分类，失败时两者都会报错提示）。
    // 条数用 usageTotalOf（含废纸篓）—— 级联改的是全部事件，提示数字要和实际改动一致
    const hit = usageTotalOf(oldName);
    if (hit > 0) {
      events = events.map((ev) => (ev.category === oldName ? { ...ev, category: newName } : ev));
      await call("save_events", { events });
    }
    categories[idx].name = newName;
    await persistCategoriesOnly();
    fillCategoryOptions();
    render();
    renderCatRows();
    toast(t("renamed", newName, hit), "ok");
  });

  // 删除：在用分类弹确认并把事件归为「其他」
  catRows.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cat-del");
    if (!btn || btn.disabled) return;
    const idx = Number(btn.dataset.idx);
    const name = categories[idx].name;
    // 同改名：删除级联也要带上废纸篓里的条目，否则它们会留着一个已不存在的分类名
    const used = usageTotalOf(name);
    const msg = used > 0
      ? t("confirm_del_cat_used", name, used)
      : t("confirm_del_cat", name);
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
    toast(t("deleted"), "ok");
  });

  // 新增分类
  $("btnCatAdd").addEventListener("click", async () => {
    const name = $("newCatName").value.trim();
    if (!name) {
      toast("请输入分类名称", "err");
      return;
    }
    if (categories.some((c) => c.name === name)) {
      toast(t("cat_exists", name), "err");
      return;
    }
    categories.push({ name, color: $("newCatColor").value });
    await persistCategoriesOnly();
    $("newCatName").value = "";
    fillCategoryOptions();
    renderCatRows();
    toast(t("cat_added", name), "ok");
  });
  $("newCatName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnCatAdd").click();
  });

  // ---------- 设置页（主题 / 语言 / 时区 / 通知配置） ----------
  // 主题仍走 localStorage（首帧前应用靠 index.html 内联脚本）；语言/时区/Webhook 存后端 settings.json
  let savedSettings = { wecom_webhook: "", dingtalk_webhook: "" };

  // 系统配色偏好；"system" 模式下跟随它的变化
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  /// 把「偏好」解析成「实际主题」：偏好可能是 dark / light / system（跟随系统）
  function resolveTheme(pref) {
    if (pref !== "system") return pref;
    return systemDark.matches ? "dark" : "light";
  }

  /// pref 是用户偏好（原样存 localStorage，含 "system"）；
  /// dataset 只写解析后的 dark/light —— CSS 里没有 [data-theme="system"] 这套变量
  function applyTheme(pref) {
    document.documentElement.dataset.theme = resolveTheme(pref);
    localStorage.setItem("rq-theme", pref);
    document.querySelectorAll('input[name="rq-theme"]').forEach((r) => (r.checked = r.value === pref));
  }
  applyTheme(localStorage.getItem("rq-theme") || "dark");

  // 系统主题变化：仅当偏好是「跟随系统」时才跟着切（用户显式选了深/浅就不该被系统覆盖）
  systemDark.addEventListener("change", () => {
    if ((localStorage.getItem("rq-theme") || "dark") === "system") {
      document.documentElement.dataset.theme = resolveTheme("system");
    }
  });

  // 语言切换入口：静态文字走 [data-i18n]，动态面板/卡片在此重建
  function applyLang() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    // 悬停提示（title）也走 i18n：目前是工具栏的刷新按钮
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll(".nav-item").forEach((it) => { it.dataset.label = t("nav_" + it.dataset.nav); });
    buildCyclePanel();
    buildStatusPanel();
    syncCycleLabel();
    buildTzPanel();
    syncTzLabel();
    fillCategoryOptions();
    renderStatusPanel();
    filterStatusBtn.textContent = statusLabel(filterStatusValue);
    if (dpOpen) dpRender(); // 日历面板没打开时不重绘，避免用占位年月空跑一遍
    render();
  }

  // 时区下拉：值是 IANA 名，空 = 跟随系统
  const TZ_OPTIONS = [
    "", "UTC",
    "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore",
    "Europe/London", "Europe/Berlin",
    "America/New_York", "America/Los_Angeles",
    "Australia/Sydney",
  ];
  const tzKey = (v) => (v === "" ? "tz_system" : "tz_" + v.toLowerCase().replaceAll("/", "_"));

  function buildTzPanel() {
    $("tzPanel").innerHTML = TZ_OPTIONS.map(
      (v) => `<button type="button" class="combo-item${v === timezone ? " active" : ""}" data-val="${v}">${t(tzKey(v))}</button>`
    ).join("");
  }
  function syncTzLabel() {
    $("tzBtn").textContent = t(tzKey(timezone));
  }
  $("tzBtn").addEventListener("click", () => {
    buildTzPanel();
    const p = $("tzPanel");
    const willOpen = p.hidden;
    hideCombos();
    p.hidden = !willOpen;
  });
  $("tzPanel").addEventListener("click", async (e) => {
    const item = e.target.closest("[data-val]");
    if (!item) return;
    timezone = item.getAttribute("data-val");
    syncTzLabel();
    $("tzPanel").hidden = true;
    await persistPrefs();
    render(); // 时区变化影响剩余天数与日历「今天」，立即重算
  });

  // 语言单选：即时全量重刷界面文字并落盘
  document.querySelectorAll('input[name="rq-lang"]').forEach((r) =>
    r.addEventListener("change", async () => {
      lang = r.value;
      document.querySelectorAll('input[name="rq-lang"]').forEach((x) => (x.checked = x.value === lang));
      applyLang();
      await persistPrefs();
    })
  );

  document.querySelectorAll('input[name="rq-theme"]').forEach((r) =>
    r.addEventListener("change", () => {
      applyTheme(r.value);
      const key = r.value === "light" ? "theme_light_on" : r.value === "system" ? "theme_system_on" : "theme_dark_on";
      toast(t(key), "ok");
    })
  );

  // 主视图切换：首页（事件列表）/ 分类 / 废纸篓 / 设置。
  // 顺带给 .app 打标记：后三个页面要「整块内容面」底色，与左侧图标栏区分开
  function showView(name) {
    $("viewEvents").hidden = name !== "events";
    $("viewCategories").hidden = name !== "categories";
    $("viewTrash").hidden = name !== "trash";
    $("viewSettings").hidden = name !== "settings";
    document.querySelector(".app").classList.toggle("is-panel", name !== "events");
    // 切回首页时重读一遍：外部改过数据文件、或从分类/设置页回来都能看到最新数据
    if (name === "events") refreshData();
  }

  // 设置页的左栏：点一项只显示右侧对应分组（分组靠 hidden 显隐）
  function showSettingsSection(key) {
    document.querySelectorAll("#settingsNav .set-nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.set === key);
    });
    document.querySelectorAll("#settingsBody .set-group").forEach((g) => {
      g.hidden = g.dataset.group !== key;
    });
  }
  document.querySelectorAll("#settingsNav .set-nav-item").forEach((b) =>
    b.addEventListener("click", () => showSettingsSection(b.dataset.set))
  );
  // 初始只显示第一个分组：否则四个分组会全部堆在页面上
  showSettingsSection("appearance");

  // 设置页打开时从后端读最新设置填充表单
  async function openSettingsPage() {
    try {
      const s = await call("get_settings");
      savedSettings = s;
      lang = s.language === "en" ? "en" : "zh";
      timezone = s.timezone || "";
      $("fWecom").value = s.wecom_webhook || "";
      $("fDingtalk").value = s.dingtalk_webhook || "";
    } catch {
      // 读取失败时保留当前内存值，允许直接编辑
    }
    document.querySelectorAll('input[name="rq-lang"]').forEach((x) => (x.checked = x.value === lang));
    applyLang();
    // 保留上次选中的分组（左栏高亮与右侧显隐一起同步）
    const cur = document.querySelector("#settingsNav .set-nav-item.active");
    showSettingsSection(cur ? cur.dataset.set : "appearance");
    showView("settings");
  }

  // 界面偏好（语言/时区）变更即落盘。注意后端 save_settings 是整体覆盖，
  // 必须把当前 Webhook 值一起带上，否则会被默认值冲掉
  async function persistPrefs() {
    await call("save_settings", {
      settings: {
        wecom_webhook: savedSettings.wecom_webhook || "",
        dingtalk_webhook: savedSettings.dingtalk_webhook || "",
        language: lang,
        timezone,
      },
    });
  }

  // 导航项：首页 = 主视图；分类 = 独立页面；设置 = 独立设置页
  document.querySelectorAll(".nav-item").forEach((item) =>
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((x) => x.classList.toggle("active", x === item));
      const nav = item.getAttribute("data-nav");
      if (nav === "cat") openCatPage();
      else if (nav === "trash") openTrashPage();
      else if (nav === "settings") openSettingsPage();
      else showView("events");
    })
  );

  $("notifyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    savedSettings = {
      wecom_webhook: $("fWecom").value.trim(),
      dingtalk_webhook: $("fDingtalk").value.trim(),
      language: lang,
      timezone,
    };
    await call("save_settings", { settings: savedSettings });
    toast(t("notify_saved"), "ok");
  });

  // 发送测试：用输入框当前值发一条测试消息，不落盘；方便先验证再保存
  $("btnNotifyTest").addEventListener("click", async () => {
    const wecom = $("fWecom").value.trim();
    const dingtalk = $("fDingtalk").value.trim();
    if (!wecom && !dingtalk) {
      toast(t("webhook_empty"), "err");
      return;
    }
    await call("test_webhooks", { wecomWebhook: wecom, dingtalkWebhook: dingtalk });
    toast(t("test_sent"), "ok");
  });

  // ---------- 事件绑定 ----------
  // 顶栏吸顶后补一条分隔线：有内容从它下面穿过去时才需要，滚回顶部就撤掉
  const stickyHead = document.querySelector(".sticky-head");
  if (stickyHead) {
    const syncStuck = () => stickyHead.classList.toggle("stuck", window.scrollY > 2);
    window.addEventListener("scroll", syncStuck, { passive: true });
    syncStuck();
  }

  // 刷新：重新走一遍 boot()（读 settings/categories/events + 重渲染），
  // 用于外部改了数据文件、或挂着跨天想让剩余天数按新的一天重算
  $("btnRefresh").addEventListener("click", async () => {
    const b = $("btnRefresh");
    b.classList.add("spin");                     // 点一下转一圈，给个即时反馈
    setTimeout(() => b.classList.remove("spin"), 600);
    await boot();
    toast(t("refreshed"));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("fTitle").value.trim();
    const due = $("fDue").value;
    if (!title || !due) {
      toast(t("err_title_due"), "err");
      return;
    }
    // 规则集：去重升序；空规则集不允许提交（否则该事件永远不会提醒）
    const rules = [...new Set(editingRules)].sort((a, b) => a - b);
    if (rules.length === 0) {
      toast(t("err_rules"), "err");
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
    toast(t("saved"), "ok");
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
      // 软删除：写 deleted_at 而不是从数组里摘掉，删错了还能从废纸篓恢复
      if (!confirm(t("confirm_del_event", ev.title))) return;
      const now = new Date().toISOString();
      events = events.map((x) => (x.id === id ? { ...x, deleted_at: now, updated_at: now } : x));
      await call("save_events", { events });
      fillCategoryOptions();
      render();
      toast(t("deleted_to_trash"), "ok");
    } else if (act === "clone") {
      // 克隆：复制一条同构事件（esim 保号等场景），副本去掉提醒去重标记，立即生效
      const now = new Date().toISOString();
      events.push({ ...ev, id: uid(), title: ev.title + t("clone_suffix"), created_at: now, updated_at: now, notified_at: null });
      await call("save_events", { events });
      render();
      toast(t("cloned"), "ok");
    } else if (act === "toggle") {
      ev.disabled = !ev.disabled;
      await call("save_events", { events });
      render();
      toast(ev.disabled ? t("msg_disabled") : t("msg_enabled"), "ok");
    } else if (act === "renew") {
      // 续订交给后端算日期（月底语义 + 过期多期推进），成功后用返回的实体更新本地
      try {
        const updated = await call("renew_event", { id });
        events = events.map((x) => (x.id === id ? updated : x));
        render();
        toast(t("renewed", updated.due_date), "ok");
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
  // 筛选改由自绘下拉面板点击触发（见上方面板 click 监听），不再需要 change 监听

  // 筛选空态的「清除筛选条件」：一键还原搜索词、分类、状态三个条件
  $("btnClearFilter").addEventListener("click", () => {
    searchInput.value = "";
    filterCatValue = "__all__";
    filterStatusValue = "__all__";
    fillCategoryOptions(); // 同步分类按钮文字
    filterStatusBtn.textContent = t("st_all");
    render();
  });

  $("btnExport").addEventListener("click", async () => {
    try {
      const path = await call("export_events");
      toast(t("exported", path), "ok");
    } catch (_) {}
  });
  $("btnImport").addEventListener("click", async () => {
    if (!confirm(t("confirm_import"))) return;
    try {
      const imported = await call("import_events");
      events = imported || [];
      fillCategoryOptions();
      render();
      toast(t("imported", events.length), "ok");
    } catch (_) {}
  });
  // ---------- 启动 ----------
  async function boot() {
    try {
      const s = await call("get_settings");
      lang = s.language === "en" ? "en" : "zh";
      timezone = s.timezone || "";
      savedSettings = s;
    } catch {
      // 旧版本后端无 get_settings 时静默兜底：中文 + 系统时区
    }
    applyLang(); // 语言/时区就位后先刷一遍界面文字，再加载数据
    try {
      const saved = await call("get_categories");
      // 后端有存过的分类才覆盖预设；空列表说明还没初始化过，保留内置预设
      if (Array.isArray(saved) && saved.length > 0) categories = saved;
    } catch (e) {
      // 读取失败（如旧版本后端无此命令）时静默兜底，用预设分类
    }
    await refreshData(true);   // 启动时强制读一次（不受下面的节流影响）
  }

  // ---------- 自动刷新 ----------
  // 数据只在启动时读一次，之前一直挂着的窗口会停在旧数据上（尤其是「剩 N 天」跨天不更新）。
  // 下面三个时机自动重读 + 重渲染：
  //   ① 切回首页；② 窗口重新获得焦点 / 从后台切回（早上打开电脑就是这个场景）；③ 本地日期跨天
  let lastRefreshAt = 0;
  async function refreshData(force) {
    const now = Date.now();
    // focus 与 visibilitychange 常常同时触发，1.5s 内合并成一次；force 供启动时使用
    if (!force && now - lastRefreshAt < 1500) return;
    lastRefreshAt = now;
    try {
      const saved = await call("get_categories");
      if (Array.isArray(saved) && saved.length > 0) categories = saved;
    } catch (e) {
      // 读不到就沿用内存里的分类（旧版本后端无此命令时也一样）
    }
    try {
      events = await call("get_events");
    } catch (e) {
      events = [];
    }
    render();   // 内部会顺带刷新分类下拉与状态面板
  }

  // 本地日期（按设置里的时区）：跨天时「剩 N 天」必须重算
  function dayKey() {
    const d = tzToday();
    return d.y + "-" + d.m + "-" + d.d;
  }
  let lastDay = dayKey();
  setInterval(() => {
    const d = dayKey();
    if (d !== lastDay) {
      lastDay = d;
      refreshData(true);            // 跨天：强制刷一次
    }
  }, 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshData();   // 从后台切回前台
  });
  window.addEventListener("focus", () => refreshData());

  // 开发环境自动刷新由 Vite 提供（改 src/ 文件即整页 reload），无需自绘 livereload。
  // 发布后 webview 走 tauri:// 协议加载打包产物，不存在刷新问题。
  boot();
})();
