use crate::db::{get_setting, lock_conn, set_setting, DbState};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TaskPanelRow {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub due_date: Option<String>,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DesktopPanelSnapshot {
    pub today: Vec<TaskPanelRow>,
    pub overdue: Vec<TaskPanelRow>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PanelSettings {
    pub panel_opaque: bool,
    pub panel_always_on_top: bool,
    #[specta(type = f64)]
    pub panel_refresh_seconds: u64,
}

const ACTIVE: &str = "active";

fn list_panel_rows(
    conn: &Connection,
    today: &str,
    overdue_only: bool,
) -> Result<Vec<TaskPanelRow>, String> {
    let sql = if overdue_only {
        "SELECT id, title, due_date, priority FROM tasks
         WHERE status = ?1 AND due_date IS NOT NULL AND due_date < ?2
         ORDER BY due_date ASC, priority DESC"
    } else {
        "SELECT id, title, due_date, priority FROM tasks
         WHERE status = ?1
           AND (
             due_date = ?2
             OR (priority >= 2 AND (due_date IS NULL OR due_date >= ?2))
           )
         ORDER BY priority DESC, due_date ASC, title ASC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![ACTIVE, today], |row| {
            Ok(TaskPanelRow {
                id: row.get(0)?,
                title: row.get(1)?,
                due_date: row.get(2)?,
                priority: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn snapshot_on_conn(conn: &Connection) -> Result<DesktopPanelSnapshot, String> {
    let today_key = crate::time::local_today_date();
    let today = list_panel_rows(conn, &today_key, false)?;
    let overdue = list_panel_rows(conn, &today_key, true)?;
    Ok(DesktopPanelSnapshot {
        today,
        overdue,
        generated_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Lightweight counts for the notification scheduler (no tags/subtasks).
pub fn panel_counts_on_conn(conn: &Connection) -> Result<(usize, usize), String> {
    let today_key = crate::time::local_today_date();
    let today_n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE status = ?1
               AND (
                 due_date = ?2
                 OR (priority >= 2 AND (due_date IS NULL OR due_date >= ?2))
               )",
            rusqlite::params![ACTIVE, today_key],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let overdue_n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE status = ?1 AND due_date IS NOT NULL AND due_date < ?2",
            rusqlite::params![ACTIVE, today_key],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok((today_n as usize, overdue_n as usize))
}

fn setting_bool(conn: &Connection, key: &str, default: bool) -> bool {
    get_setting(conn, key)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(default)
}

#[tauri::command]
pub fn get_desktop_panel_snapshot(state: State<DbState>) -> Result<DesktopPanelSnapshot, String> {
    let conn = lock_conn(&state).map_err(|e| e.to_string())?;
    snapshot_on_conn(&conn)
}

#[tauri::command]
pub fn get_panel_settings(state: State<DbState>) -> Result<PanelSettings, String> {
    let conn = lock_conn(&state).map_err(|e| e.to_string())?;
    let refresh = get_setting(&conn, crate::db::settings_keys::PANEL_REFRESH_SECONDS)
        .unwrap_or_else(|| "120".into())
        .parse::<u64>()
        .unwrap_or(120)
        .clamp(30, 600);
    Ok(PanelSettings {
        panel_opaque: setting_bool(&conn, crate::db::settings_keys::PANEL_OPAQUE, false),
        panel_always_on_top: setting_bool(
            &conn,
            crate::db::settings_keys::PANEL_ALWAYS_ON_TOP,
            false,
        ),
        panel_refresh_seconds: refresh,
    })
}

#[tauri::command]
pub async fn update_panel_settings(
    app: AppHandle,
    state: State<'_, DbState>,
    settings: PanelSettings,
) -> Result<(), String> {
    let refresh = settings.panel_refresh_seconds.clamp(30, 600);
    let conn = lock_conn(&state).map_err(|e| e.to_string())?;
    set_setting(
        &conn,
        crate::db::settings_keys::PANEL_OPAQUE,
        if settings.panel_opaque { "1" } else { "0" },
    )
    .map_err(|e| e.to_string())?;
    set_setting(
        &conn,
        crate::db::settings_keys::PANEL_ALWAYS_ON_TOP,
        if settings.panel_always_on_top { "1" } else { "0" },
    )
    .map_err(|e| e.to_string())?;
    set_setting(
        &conn,
        crate::db::settings_keys::PANEL_REFRESH_SECONDS,
        &refresh.to_string(),
    )
    .map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.set_always_on_top(settings.panel_always_on_top);
    }
    let _ = app.emit_to("panel", "panel-settings-changed", settings);
    Ok(())
}

#[tauri::command]
pub fn focus_task_from_panel(app: tauri::AppHandle, task_id: i64) -> Result<(), String> {
    crate::app_windows::open_task_in_main(&app, task_id);
    Ok(())
}

#[tauri::command]
pub async fn toggle_desktop_panel(app: AppHandle) -> Result<bool, String> {
    crate::app_windows::toggle_panel_async(&app).await
}

#[tauri::command]
pub fn is_desktop_panel_visible(app: AppHandle) -> Result<bool, String> {
    Ok(crate::app_windows::is_panel_visible(&app))
}
