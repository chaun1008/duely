#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use chrono::{Local, Months, NaiveDate};
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

/// 一条到期事件
#[derive(Serialize, Deserialize, Clone, Debug)]
struct EventItem {
    id: String,
    title: String,
    category: String,
    /// 到期日，格式 YYYY-MM-DD
    due_date: String,
    /// 旧字段：单规则时代的「提前多少天提醒」。新数据一律用 remind_days，本字段仅作旧数据兜底
    remind_days_before: i64,
    /// 多规则提醒：剩余天数正好等于列表中某个值时提醒一次（0 = 到期当天）。
    /// 参考 SubsTracker 的语义：是「正好 N 天」触发，不是「≤N 每天触发」
    #[serde(default)]
    remind_days: Vec<i64>,
    /// 续订周期（月）：0 = 不自动续订；点「续订」时从当前到期日往后推 N 个月。
    /// 循环模式：会员续费类场景从到期日接续，而不是从续费当天重算
    #[serde(default)]
    cycle_months: u32,
    /// 停用后不再弹提醒，仅保留数据（区别于删除，适合暂停使用的订阅）
    #[serde(default)]
    disabled: bool,
    note: String,
    created_at: String,
    updated_at: String,
    /// 最近一次成功发出系统通知的时间（RFC3339），用于按天去重，避免同一天重复弹窗
    notified_at: Option<String>,
    /// 软删除标记：有值 = 已移入废纸篓（存的是删除时刻的 RFC3339）。
    /// 用软删除而不是直接从数组里删掉，是为了让用户能恢复误删；
    /// 废纸篓里的条目完全不参与提醒、统计与列表。
    /// serde(default) 兼容旧数据（没有这个字段时视为 None = 未删除）
    #[serde(default)]
    deleted_at: Option<String>,
}

impl EventItem {
    /// 实际生效的提醒规则：优先多规则列表；为空则回退旧字段（兼容升级前的旧数据）
    fn rules(&self) -> Vec<i64> {
        if self.remind_days.is_empty() {
            vec![self.remind_days_before]
        } else {
            self.remind_days.clone()
        }
    }
}

/// 一个自定义分类（名称 + 颜色），存 categories.json
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Category {
    name: String,
    /// 十六进制颜色，如 "#4f8cff"
    color: String,
}

/// 通知设置：企业微信 / 钉钉群机器人 Webhook 地址，存 settings.json。
/// 地址本身含密钥（key/access_token），只存在本机应用数据目录，不上传任何第三方。
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
struct NotifySettings {
    wecom_webhook: String,
    dingtalk_webhook: String,
    /// 界面语言（zh/en）；旧版 settings.json 无此字段，serde(default) 兜底为空串，
    /// 前端把空串按中文处理
    #[serde(default)]
    language: String,
    /// 界面显示用 IANA 时区（如 Asia/Shanghai），空 = 跟随系统；
    /// 只影响前端日期/剩余天数显示，提醒调度仍按系统本地时间
    #[serde(default)]
    timezone: String,
}

/// 全局状态：事件列表 + 分类列表 + 各自的数据文件路径
struct AppState {
    events: Mutex<Vec<EventItem>>,
    file_path: PathBuf,
    categories: Mutex<Vec<Category>>,
    cat_file_path: PathBuf,
    settings: Mutex<NotifySettings>,
    settings_path: PathBuf,
}

fn now_iso() -> String {
    Local::now().to_rfc3339()
}

fn today_naive() -> NaiveDate {
    Local::now().date_naive()
}

/// 读取本地 JSON 数据文件；文件不存在或损坏时返回空列表
fn load_events(path: &PathBuf) -> Vec<EventItem> {
    match fs::read_to_string(path) {
        Ok(s) if !s.trim().is_empty() => serde_json::from_str(&s).unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// 把内存中的事件写回本地文件（best-effort，失败仅打印）
fn persist(state: &AppState) {
    let events = state.events.lock().unwrap();
    if let Ok(json) = serde_json::to_string_pretty(&*events) {
        let _ = fs::write(&state.file_path, json);
    }
}

/// 按到期日升序排列，最早的排最前
fn sort_events(events: &mut Vec<EventItem>) {
    events.sort_by(|a, b| a.due_date.cmp(&b.due_date));
}

/// 读取分类文件；文件不存在或损坏时返回空列表（前端会合并内置预设分类兜底）
fn load_categories(path: &PathBuf) -> Vec<Category> {
    match fs::read_to_string(path) {
        Ok(s) if !s.trim().is_empty() => serde_json::from_str(&s).unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// 把内存中的分类写回本地文件（best-effort，失败仅打印）
fn persist_categories(state: &AppState) {
    let cats = state.categories.lock().unwrap();
    if let Ok(json) = serde_json::to_string_pretty(&*cats) {
        let _ = fs::write(&state.cat_file_path, json);
    }
}

/// 读取通知设置；文件不存在或损坏时返回默认（两个 Webhook 均为空 = 不推送）
fn load_settings(path: &PathBuf) -> NotifySettings {
    match fs::read_to_string(path) {
        Ok(s) if !s.trim().is_empty() => serde_json::from_str(&s).unwrap_or_default(),
        _ => NotifySettings::default(),
    }
}

fn persist_settings(state: &AppState) {
    let settings = state.settings.lock().unwrap();
    if let Ok(json) = serde_json::to_string_pretty(&*settings) {
        let _ = fs::write(&state.settings_path, json);
    }
}

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> NotifySettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(state: tauri::State<AppState>, settings: NotifySettings) -> Result<(), String> {
    let mut guard = state.settings.lock().unwrap();
    *guard = settings;
    drop(guard);
    persist_settings(&state);
    Ok(())
}

/// 向群机器人推送文本消息。best-effort：失败只打印日志，绝不影响本地提醒流程；
/// 网络调用带 5 秒超时，防止弱网拖住提醒循环。
fn push_webhooks(settings: &NotifySettings, text: &str) {
    let payload = || serde_json::json!({ "msgtype": "text", "text": { "content": text } });
    if !settings.wecom_webhook.is_empty() {
        if let Err(e) = ureq::post(&settings.wecom_webhook)
            .timeout(Duration::from_secs(5))
            .send_json(payload())
        {
            eprintln!("[webhook] 企业微信推送失败：{e}");
        }
    }
    if !settings.dingtalk_webhook.is_empty() {
        if let Err(e) = ureq::post(&settings.dingtalk_webhook)
            .timeout(Duration::from_secs(5))
            .send_json(payload())
        {
            eprintln!("[webhook] 钉钉推送失败：{e}");
        }
    }
}

/// 用设置弹窗里当前输入的地址各发一条测试消息，不落盘、不改配置
#[tauri::command]
fn test_webhooks(wecom_webhook: String, dingtalk_webhook: String) {
    push_webhooks(
        &NotifySettings {
            wecom_webhook,
            dingtalk_webhook,
            ..Default::default() // language/timezone 与推送无关，取默认值
        },
        "【如期而至】测试消息：如果你在企业微信/钉钉群里看到这条，说明 Webhook 配置正确。",
    );
}

/// 发一条本地系统通知，用于验证系统通知权限与通道是否正常
#[tauri::command]
fn test_notify(app: AppHandle) {
    let _ = app
        .notification()
        .builder()
        .title("如期而至")
        .body("这是一条测试通知，说明系统通知已正常工作。")
        .show();
}

#[tauri::command]
fn get_categories(state: tauri::State<AppState>) -> Vec<Category> {
    state.categories.lock().unwrap().clone()
}

/// 保存分类列表。重命名/删除的级联处理由前端负责（前端会先改事件再调本命令），
/// 后端只信任传入的完整列表并原样落盘，保持单一数据源在前端编排。
#[tauri::command]
fn save_categories(state: tauri::State<AppState>, categories: Vec<Category>) -> Result<(), String> {
    let mut guard = state.categories.lock().unwrap();
    *guard = categories;
    drop(guard);
    persist_categories(&state);
    Ok(())
}

#[tauri::command]
fn get_events(state: tauri::State<AppState>) -> Vec<EventItem> {
    state.events.lock().unwrap().clone()
}

#[tauri::command]
fn save_events(state: tauri::State<AppState>, events: Vec<EventItem>) -> Result<(), String> {
    let mut guard = state.events.lock().unwrap();
    *guard = events;
    sort_events(&mut guard);
    drop(guard);
    persist(&state);
    Ok(())
}

#[tauri::command]
async fn import_events(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<EventItem>, String> {
    // 注意：本插件版本（2.8.1）没有返回 Future 的 pick_file，只有回调式 pick_file
    // 和会阻塞主线程的 blocking_pick_file。这里用 mpsc 把回调桥接成同步等待：
    // 阻塞的只是本命令所在的异步工作线程，主线程事件循环不受影响的。
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("JSON 备份", &["json"])
        .pick_file(move |f| {
            let _ = tx.send(f);
        });
    let file = rx
        .recv()
        .map_err(|_| "对话框异常退出".to_string())?
        .ok_or("未选择文件")?;
    let path = file.to_string();
    let content = fs::read_to_string(&path).map_err(|e| format!("读取失败：{e}"))?;
    let parsed: Vec<EventItem> =
        serde_json::from_str(&content).map_err(|e| format!("解析失败（请确认是导出的 JSON）：{e}"))?;
    let mut guard = state.events.lock().unwrap();
    *guard = parsed;
    sort_events(&mut guard);
    drop(guard);
    persist(&state);
    Ok(state.events.lock().unwrap().clone())
}

#[tauri::command]
async fn export_events(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    // 同 import_events：blocking_save_file 会阻塞主线程冻住 webview，
    // 这里同样用 mpsc 桥接回调式 save_file（阻塞的只是异步工作线程）
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("JSON 备份", &["json"])
        .set_file_name("到期事件备份")
        .save_file(move |f| {
            let _ = tx.send(f);
        });
    let file = rx
        .recv()
        .map_err(|_| "对话框异常退出".to_string())?
        .ok_or("未选择保存位置")?;
    let path = file.to_string();
    let events = state.events.lock().unwrap();
    let json = serde_json::to_string_pretty(&*events).map_err(|e| e.to_string())?;
    drop(events);
    fs::write(&path, json).map_err(|e| format!("写入失败：{e}"))?;
    Ok(path)
}

/// 续订（循环模式）：从当前到期日往后推一个周期。
/// 若已过期多期，逐期推进到未来最近一期，避免连点补登过期期数。
/// 成功后重置 notified_at，让新周期从头开始正常提醒。
#[tauri::command]
fn renew_event(state: tauri::State<AppState>, id: String) -> Result<EventItem, String> {
    let mut guard = state.events.lock().unwrap();
    let ev = guard
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "事件不存在".to_string())?;
    if ev.deleted_at.is_some() {
        // 废纸篓里的条目应先恢复再续订：直接续订会让一个用户以为已经删掉的东西悄悄活过来
        return Err("该事件在废纸篓中，请先恢复".to_string());
    }
    if ev.cycle_months == 0 {
        return Err("该事件未设置续订周期".to_string());
    }
    let cycle = Months::new(ev.cycle_months);
    let due =
        NaiveDate::parse_from_str(&ev.due_date, "%Y-%m-%d").map_err(|_| "到期日格式非法".to_string())?;
    // checked_add_months 处理月底语义（如 1/31 月推到 2/28），溢出时返回 None 按错误处理
    let mut new_due = due
        .checked_add_months(cycle)
        .ok_or_else(|| "日期计算溢出".to_string())?;
    let today = today_naive();
    while new_due < today {
        new_due = new_due
            .checked_add_months(cycle)
            .ok_or_else(|| "日期计算溢出".to_string())?;
    }
    ev.due_date = new_due.format("%Y-%m-%d").to_string();
    ev.notified_at = None; // 重置按天去重标记，新周期恢复提醒
    ev.updated_at = now_iso();
    let cloned = ev.clone();
    drop(guard);
    persist(&state);
    Ok(cloned)
}

/// 启动后台调度线程：每 60 秒检查一次临近/到期事件并弹系统通知
fn run_scheduler(app_handle: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        check_due(&app_handle);
    });
}

/// 过期后持续提醒的天数上限，超过后不再弹窗（避免已弃用条目每天骚扰）
const OVERDUE_NAG_DAYS: i64 = 30;

/// 「今天该不该提醒这条事件」的唯一判据（纯函数，便于测试）。
/// 返回 None = 不提醒；Some(days_left) = 该提醒，并带上剩余天数（负数 = 已过期）。
///
/// 判定顺序：停用 / 废纸篓 → 日期非法 → 命中规则。
/// 为什么抽出来：原来这段内联在 check_due 的扫描循环里，而循环需要 AppHandle 才能跑，
/// 结果「废纸篓里的条目不提醒」这类规则没法写测试，只能靠肉眼读代码。
fn due_hit(ev: &EventItem, today: NaiveDate) -> Option<i64> {
    if ev.disabled {
        return None; // 停用：不提醒
    }
    if ev.deleted_at.is_some() {
        return None; // 在废纸篓里：不提醒（已删除的条目不该再骚扰用户）
    }
    let due = NaiveDate::parse_from_str(&ev.due_date, "%Y-%m-%d").ok()?; // 日期非法则跳过
    let days_left = (due - today).num_days();
    // 命中判断：未到期要求「正好等于」某条规则；过期要求在上限内
    let hit = if days_left >= 0 {
        ev.rules().contains(&days_left)
    } else {
        -days_left <= OVERDUE_NAG_DAYS
    };
    if hit {
        Some(days_left)
    } else {
        None
    }
}

/// 核心提醒逻辑（多规则版）：
/// - 是否提醒单条事件由 due_hit 判定（含停用 / 废纸篓 / 日期非法 / 规则命中）
/// - 未到期：剩余天数正好等于某条规则（0=当天）时提醒一次
/// - 已过期：每天催一次直到处理，最多连催 30 天（防止弃用条目永久弹窗；更久的过期条目列表里仍可见）
/// - 停用（disabled）的条目完全不提醒
/// 同一天不重复弹窗，靠 notified_at 的日期部分去重
fn check_due(app_handle: &AppHandle) {
    let state = app_handle.state::<AppState>();
    let today = today_naive();
    let today_iso = today.format("%Y-%m-%d").to_string();

    let mut guard = state.events.lock().unwrap();
    let mut changed = false;
    // 本次扫描命中待发的群消息，统一在释放锁后发送
    let mut pushes: Vec<String> = Vec::new();

    for ev in guard.iter_mut() {
        let days_left = match due_hit(ev, today) {
            Some(d) => d,
            None => continue,
        };

        // 当天已通知过则跳过，实现“每天最多提醒一次”
        let last = ev
            .notified_at
            .as_ref()
            .map(|n| n.get(..10).unwrap_or("").to_string())
            .unwrap_or_default();
        if last == today_iso {
            continue;
        }

        let body = if days_left > 0 {
            format!("还有 {} 天到期（到期日 {}）", days_left, ev.due_date)
        } else if days_left == 0 {
            format!("今天到期！（到期日 {}）", ev.due_date)
        } else {
            format!("已过期 {} 天，记得处理（到期日 {}）", -days_left, ev.due_date)
        };
        let title = format!("【{}】{}", ev.category, ev.title);
        let _ = app_handle
            .notification()
            .builder()
            // builder 按值消费 title/body，这里 clone，原值还要拼群消息文本
            .title(title.clone())
            .body(body.clone())
            .show();

        // Webhook 推送延后到释放事件锁之后统一发，避免弱网时抱着锁阻塞 UI 的保存操作
        pushes.push(format!("{title}\n{body}"));

        ev.notified_at = Some(now_iso());
        changed = true;
    }

    // 先取设置快照、释放事件锁，再发网络请求（锁内只做内存操作）
    let settings = state.settings.lock().unwrap().clone();
    drop(guard);

    if changed {
        persist(&state);
    }
    for text in pushes {
        push_webhooks(&settings, &text);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();

            // 数据文件路径：各平台标准的应用配置目录下的 events.json
            let dir = handle
                .path()
                .app_config_dir()
                .expect("无法获取应用配置目录");
            fs::create_dir_all(&dir).ok();
            let file_path = dir.join("events.json");
            let events = load_events(&file_path);
            let cat_file_path = dir.join("categories.json");
            let categories = load_categories(&cat_file_path);
            let settings_path = dir.join("settings.json");
            let settings = load_settings(&settings_path);
            app.manage(AppState {
                events: Mutex::new(events),
                file_path,
                categories: Mutex::new(categories),
                cat_file_path,
                settings: Mutex::new(settings),
                settings_path,
            });

            // 系统托盘：显示主窗口 / 退出
            let icon = handle
                .default_window_icon()
                .cloned()
                .expect("缺少窗口图标，请先执行 tauri icon 生成图标");
            let menu = Menu::with_items(handle, &[
                &MenuItem::with_id(handle, "show", "显示主窗口", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(handle).unwrap(),
                &MenuItem::with_id(handle, "quit", "退出", true, None::<&str>).unwrap(),
            ])
            .unwrap();
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("如期而至")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(handle);

            // 后台定时提醒线程
            run_scheduler(handle.clone());

            // 启动后立即检查一次，保证打开当天就能看到该提醒的
            check_due(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_events,
            save_events,
            import_events,
            export_events,
            get_categories,
            save_categories,
            renew_event,
            get_settings,
            save_settings,
            test_webhooks,
            test_notify
        ])
        .build(tauri::generate_context!())
        .expect("构建 Tauri 应用失败")
        .run(|app_handle: &AppHandle, event: RunEvent| {
            // 关闭窗口时最小化到托盘，而不是退出进程（保证后台继续提醒）
            if let RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } = event
            {
                api.prevent_close();
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 造一条最小可用的测试事件
    fn ev(due: &str, rules: Vec<i64>, disabled: bool, deleted: Option<&str>) -> EventItem {
        EventItem {
            id: "t1".into(),
            title: "测试".into(),
            category: "其他".into(),
            due_date: due.into(),
            remind_days_before: 7,
            remind_days: rules,
            cycle_months: 0,
            disabled,
            note: String::new(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            notified_at: None,
            deleted_at: deleted.map(|s| s.to_string()),
        }
    }

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    /// 核心：废纸篓里的条目一律不提醒（这是本次改动的关键规则）
    #[test]
    fn trashed_event_never_fires() {
        let today = d("2026-10-09");
        // 到期当天、规则命中 —— 若不在废纸篓里本该提醒
        let live = ev("2026-10-09", vec![0], false, None);
        assert_eq!(due_hit(&live, today), Some(0), "未删除的条目应当提醒");
        // 同样的数据，只是进了废纸篓
        let trashed = ev("2026-10-09", vec![0], false, Some("2026-10-08T10:00:00Z"));
        assert_eq!(due_hit(&trashed, today), None, "废纸篓里的条目不该提醒");
    }

    #[test]
    fn disabled_event_does_not_fire() {
        let today = d("2026-10-09");
        let e = ev("2026-10-09", vec![0], true, None);
        assert_eq!(due_hit(&e, today), None);
    }

    #[test]
    fn reminds_only_on_exact_rule_day() {
        let today = d("2026-10-09");
        // 到期日 10-16 → 还剩 7 天，规则含 7 → 命中
        assert_eq!(due_hit(&ev("2026-10-16", vec![7, 3, 1, 0], false, None), today), Some(7));
        // 还剩 5 天，规则只有 7/3 → 不命中（是「正好 N 天」而不是「≤N 天」）
        assert_eq!(due_hit(&ev("2026-10-14", vec![7, 3], false, None), today), None);
    }

    #[test]
    fn overdue_nags_within_limit_then_stops() {
        let today = d("2026-10-09");
        // 过期 30 天以内：继续提醒
        assert_eq!(due_hit(&ev("2026-09-10", vec![7], false, None), today), Some(-29));
        // 过期超过 30 天：停止
        assert_eq!(due_hit(&ev("2026-08-01", vec![7], false, None), today), None);
    }

    #[test]
    fn invalid_or_legacy_date_is_skipped() {
        let today = d("2026-10-09");
        assert_eq!(due_hit(&ev("not-a-date", vec![0], false, None), today), None);
        assert_eq!(due_hit(&ev("", vec![0], false, None), today), None);
    }

    /// 旧字段兜底：remind_days 为空时回退 remind_days_before（升级前的数据结构）
    #[test]
    fn falls_back_to_legacy_single_rule() {
        let today = d("2026-10-09");
        assert_eq!(due_hit(&ev("2026-10-16", vec![], false, None), today), Some(7));
    }

    /// 数据安全：旧数据没有 deleted_at 字段，必须仍能解析出「未删除」。
    /// 如果这里失败，load_events 的 unwrap_or_default() 会返回空列表，
    /// 紧接着 persist 就把空列表写回去 —— 用户的全部数据会被静默清空。
    #[test]
    fn legacy_json_without_deleted_at_still_parses() {
        let legacy = r#"[{
            "id":"e1","title":"旧数据","category":"会员","due_date":"2026-12-01",
            "remind_days_before":7,"remind_days":[7,3,1,0],"cycle_months":12,
            "disabled":false,"note":"","created_at":"2026-01-01T00:00:00Z",
            "updated_at":"2026-01-01T00:00:00Z","notified_at":null
        }]"#;
        let list: Vec<EventItem> = serde_json::from_str(legacy).expect("旧数据必须能解析");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].deleted_at, None, "缺字段时应视为未删除");
        assert_eq!(list[0].rules(), vec![7, 3, 1, 0]);
    }

    /// 新数据往返：deleted_at 要能存下来也能读回来
    #[test]
    fn deleted_at_round_trips_through_json() {
        let e = ev("2026-10-09", vec![0], false, Some("2026-10-08T10:00:00Z"));
        let json = serde_json::to_string(&e).unwrap();
        assert!(json.contains("deleted_at"), "序列化结果应含 deleted_at");
        let back: EventItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back.deleted_at.as_deref(), Some("2026-10-08T10:00:00Z"));
    }
}
