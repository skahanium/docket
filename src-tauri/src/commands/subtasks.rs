use crate::db::{lock_conn, DbState};
use chrono::Utc;
use tauri::State;

#[tauri::command]
pub fn add_subtask(state: State<DbState>, task_id: i64, title: String) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();

    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM subtasks WHERE task_id=?1",
            rusqlite::params![task_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO subtasks (task_id, title, sort_order, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![task_id, title, max_order + 1, now],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_subtask(
    state: State<DbState>,
    id: i64,
    title: Option<String>,
    status: Option<String>,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();

    if let Some(ref t) = title {
        conn.execute(
            "UPDATE subtasks SET title=?1 WHERE id=?2",
            rusqlite::params![t, id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(ref s) = status {
        let completed_at = if s == "completed" { Some(now) } else { None };
        conn.execute(
            "UPDATE subtasks SET status=?1, completed_at=?2 WHERE id=?3",
            rusqlite::params![s, completed_at, id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_subtask(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute("DELETE FROM subtasks WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_subtasks(state: State<DbState>, task_id: i64, ordered_ids: Vec<i64>) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for (i, sub_id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE subtasks SET sort_order=?1 WHERE id=?2 AND task_id=?3",
            rusqlite::params![i as i32, sub_id, task_id],
        ).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
