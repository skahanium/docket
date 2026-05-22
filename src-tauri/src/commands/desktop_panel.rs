use crate::commands::tasks::{list_tasks_on_conn, ListTasksFilters, SortOption};
use crate::db::{lock_conn, DbState};
use crate::models::TaskSummary;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DesktopPanelSnapshot {
    pub today: Vec<TaskSummary>,
    pub overdue: Vec<TaskSummary>,
    pub generated_at: String,
}

pub fn snapshot_on_conn(conn: &rusqlite::Connection) -> Result<DesktopPanelSnapshot, String> {
    let today = list_tasks_on_conn(
        conn,
        ListTasksFilters {
            status: Some("active".into()),
            category_id: None,
            tag_id: None,
            due_date: None,
            search_query: None,
            today_view: Some(true),
            priority: None,
            overdue_view: None,
        },
        SortOption {
            field: Some("priority".into()),
            direction: Some("DESC".into()),
        },
    )
    .map_err(|e| e.to_string())?;

    let overdue = list_tasks_on_conn(
        conn,
        ListTasksFilters {
            status: Some("active".into()),
            category_id: None,
            tag_id: None,
            due_date: None,
            search_query: None,
            today_view: None,
            priority: None,
            overdue_view: Some(true),
        },
        SortOption {
            field: Some("due_date".into()),
            direction: Some("ASC".into()),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(DesktopPanelSnapshot {
        today,
        overdue,
        generated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn get_desktop_panel_snapshot(state: State<DbState>) -> Result<DesktopPanelSnapshot, String> {
    let conn = lock_conn(&state).map_err(|e| e.to_string())?;
    snapshot_on_conn(&conn)
}

#[tauri::command]
pub fn focus_task_from_panel(app: tauri::AppHandle, task_id: i64) -> Result<(), String> {
    crate::app_windows::open_task_in_main(&app, task_id);
    Ok(())
}
