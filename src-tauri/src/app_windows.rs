use crate::db::{get_setting, lock_conn, set_setting, DbState};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::webview::WebviewWindowBuilder;
use tauri::WebviewUrl;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

static PANEL_EVENTS_WIRED: AtomicBool = AtomicBool::new(false);
static PANEL_BUILD_LOCK: Mutex<()> = Mutex::new(());

struct PanelPrefs {
    always_on_top: bool,
}

fn db(app: &AppHandle) -> &DbState {
    app.state::<DbState>().inner()
}

fn read_panel_prefs(app: &AppHandle) -> PanelPrefs {
    let Ok(conn) = lock_conn(db(app)) else {
        return PanelPrefs {
            always_on_top: false,
        };
    };
    let always_on_top = get_setting(&conn, crate::db::settings_keys::PANEL_ALWAYS_ON_TOP)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    PanelPrefs { always_on_top }
}

fn panel_should_restore(app: &AppHandle) -> bool {
    lock_conn(db(app))
        .ok()
        .and_then(|conn| get_setting(&conn, crate::db::settings_keys::PANEL_VISIBLE))
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

pub fn emit_tasks_changed(app: &AppHandle) {
    let _ = app.emit("tasks-changed", ());
}

fn emit_panel_visibility(app: &AppHandle, visible: bool) {
    let _ = app.emit_to("main", "panel-visibility", visible);
    let _ = app.emit_to("panel", "panel-visibility", visible);
}

fn persist_panel_visible(app: &AppHandle, visible: bool) {
    if let Ok(conn) = lock_conn(db(app)) {
        let _ = set_setting(
            &conn,
            crate::db::settings_keys::PANEL_VISIBLE,
            if visible { "1" } else { "0" },
        );
    }
}

pub fn save_panel_geometry(app: &AppHandle, window: &WebviewWindow) {
    let Ok(conn) = lock_conn(db(app)) else {
        return;
    };
    if let Ok(pos) = window.outer_position() {
        if is_reasonable_position(pos.x, pos.y) {
            let _ = set_setting(&conn, crate::db::settings_keys::PANEL_X, &pos.x.to_string());
            let _ = set_setting(&conn, crate::db::settings_keys::PANEL_Y, &pos.y.to_string());
        }
    }
    if let Ok(size) = window.outer_size() {
        if size.width >= 280 && size.height >= 200 && size.width <= 4000 && size.height <= 4000 {
            let _ = set_setting(
                &conn,
                crate::db::settings_keys::PANEL_WIDTH,
                &size.width.to_string(),
            );
            let _ = set_setting(
                &conn,
                crate::db::settings_keys::PANEL_HEIGHT,
                &size.height.to_string(),
            );
        }
    }
}

fn is_reasonable_position(x: i32, y: i32) -> bool {
    (-16_000..=16_000).contains(&x) && (-16_000..=16_000).contains(&y)
}

pub fn restore_panel_geometry(app: &AppHandle, window: &WebviewWindow) {
    let Ok(conn) = lock_conn(db(app)) else {
        return;
    };
    if let (Some(x), Some(y)) = (
        get_setting(&conn, crate::db::settings_keys::PANEL_X).and_then(|s| s.parse::<i32>().ok()),
        get_setting(&conn, crate::db::settings_keys::PANEL_Y).and_then(|s| s.parse::<i32>().ok()),
    ) {
        if is_reasonable_position(x, y) {
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
    if let (Some(w), Some(h)) = (
        get_setting(&conn, crate::db::settings_keys::PANEL_WIDTH).and_then(|s| s.parse::<u32>().ok()),
        get_setting(&conn, crate::db::settings_keys::PANEL_HEIGHT).and_then(|s| s.parse::<u32>().ok()),
    ) {
        if w >= 280 && h >= 200 && w <= 4000 && h <= 4000 {
            let _ = window.set_size(PhysicalSize::new(w, h));
        }
    }
}

/// Windows 上在同步命令里 `build()` 会死锁；仅在 async 命令中创建面板窗口。
pub async fn ensure_panel_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("panel") {
        return Ok(window);
    }

    let _guard = PANEL_BUILD_LOCK
        .lock()
        .map_err(|_| "任务面板正在初始化".to_string())?;

    if let Some(window) = app.get_webview_window("panel") {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("panel.html".into()))
        .title("Docket 任务")
        .inner_size(320.0, 480.0)
        .resizable(true)
        .minimizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .visible(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("创建任务面板失败: {e}"))?;

    wire_panel_window_events(app);
    Ok(window)
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn show_main_today(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit_to("main", "navigate", "today");
}

pub fn show_main_quick_add(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit_to("main", "quick-add", ());
}

pub fn open_task_in_main(app: &AppHandle, task_id: i64) {
    show_main_window(app);
    let _ = app.emit_to("main", "open-task", task_id);
}

pub fn is_panel_visible(app: &AppHandle) -> bool {
    app.get_webview_window("panel")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

fn apply_panel_prefs_to_window(window: &WebviewWindow, prefs: &PanelPrefs) {
    let _ = window.set_always_on_top(prefs.always_on_top);
}

pub fn show_panel_on_window(app: &AppHandle, window: &WebviewWindow) {
    let prefs = read_panel_prefs(app);
    apply_panel_prefs_to_window(window, &prefs);
    restore_panel_geometry(app, window);
    let _ = window.show();
    persist_panel_visible(app, true);
    emit_panel_visibility(app, true);
}

pub async fn show_panel_async(app: &AppHandle) -> Result<(), String> {
    let window = ensure_panel_window(app).await?;
    show_panel_on_window(app, &window);
    Ok(())
}

pub fn hide_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        save_panel_geometry(app, &window);
        let _ = window.hide();
        persist_panel_visible(app, false);
        emit_panel_visibility(app, false);
    } else {
        persist_panel_visible(app, false);
        emit_panel_visibility(app, false);
    }
}

pub async fn toggle_panel_async(app: &AppHandle) -> Result<bool, String> {
    if is_panel_visible(app) {
        hide_panel(app);
        return Ok(false);
    }
    show_panel_async(app).await?;
    Ok(true)
}

pub async fn restore_panel_if_saved_async(app: &AppHandle) {
    if !panel_should_restore(app) {
        return;
    }
    // 主窗口 WebView2 先完成初始化，再懒创建第二个 webview，避免 Windows 竞态崩溃。
    let _ = tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(Duration::from_millis(200));
    })
    .await;
    if let Ok(window) = ensure_panel_window(app).await {
        show_panel_on_window(app, &window);
    }
}

pub fn wire_panel_window_events(app: &AppHandle) {
    if PANEL_EVENTS_WIRED.swap(true, Ordering::SeqCst) {
        return;
    }
    let Some(window) = app.get_webview_window("panel") else {
        PANEL_EVENTS_WIRED.store(false, Ordering::SeqCst);
        return;
    };
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                hide_panel(&app_handle);
            }
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                if let Some(w) = app_handle.get_webview_window("panel") {
                    save_panel_geometry(&app_handle, &w);
                }
            }
            _ => {}
        }
    });
}
