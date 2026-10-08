#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use chrono::{Local, NaiveDate};
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
    /// 提前多少天开始提醒
    remind_days_before: i64,
    note: String,
    created_at: String,
    updated_at: String,
    /// 最近一次成功发出系统通知的时间（RFC3339），用于去重，避免同一天重复弹窗
    notified_at: Option<String>,
}

/// 全局状态：事件列表 + 数据文件路径
struct AppState {
    events: Mutex<Vec<EventItem>>,
    file_path: PathBuf,
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
fn import_events(state: tauri::State<AppState>, app: AppHandle) -> Result<Vec<EventItem>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("JSON 备份", &["json"])
        .blocking_pick_file()
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
fn export_events(state: tauri::State<AppState>, app: AppHandle) -> Result<String, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("JSON 备份", &["json"])
        .set_file_name("到期事件备份")
        .blocking_save_file()
        .ok_or("未选择保存位置")?;
    let path = file.to_string();
    let events = state.events.lock().unwrap();
    let json = serde_json::to_string_pretty(&*events).map_err(|e| e.to_string())?;
    drop(events);
    fs::write(&path, json).map_err(|e| format!("写入失败：{e}"))?;
    Ok(path)
}

#[tauri::command]
fn test_notify(app: AppHandle) {
    let _ = app
        .notification()
        .builder()
        .title("如期而至")
        .body("这是一条测试通知，说明系统通知已正常工作。")
        .show();
}

/// 启动后台调度线程：每 60 秒检查一次临近/到期事件并弹系统通知
fn run_scheduler(app_handle: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        check_due(&app_handle);
    });
}

/// 核心提醒逻辑：扫描所有事件，命中提醒窗口且当天尚未通知过的，发系统通知
fn check_due(app_handle: &AppHandle) {
    let state = app_handle.state::<AppState>();
    let today = today_naive();
    let today_iso = today.format("%Y-%m-%d").to_string();

    let mut guard = state.events.lock().unwrap();
    let mut changed = false;

    for ev in guard.iter_mut() {
        let due = match NaiveDate::parse_from_str(&ev.due_date, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue, // 日期格式非法，跳过
        };
        let days_left = (due - today).num_days();
        // 提醒窗口：提前 N 天 ~ 过期后 7 天内
        let in_window = days_left <= ev.remind_days_before && days_left >= -7;
        if !in_window {
            continue;
        }
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
            format!("已过期 {} 天（到期日 {}）", -days_left, ev.due_date)
        };
        let title = format!("【{}】{}", ev.category, ev.title);
        let _ = app_handle
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show();

        ev.notified_at = Some(now_iso());
        changed = true;
    }

    if changed {
        drop(guard);
        persist(&state);
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
            app.manage(AppState {
                events: Mutex::new(events),
                file_path,
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
