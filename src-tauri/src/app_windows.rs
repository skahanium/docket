use tauri::{AppHandle, Emitter, Manager};

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

pub fn show_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.show();
    }
}

pub fn hide_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.hide();
    }
}

pub fn toggle_panel(app: &AppHandle) -> bool {
    if is_panel_visible(app) {
        hide_panel(app);
        false
    } else {
        show_panel(app);
        true
    }
}
