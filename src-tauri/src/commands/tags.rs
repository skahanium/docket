use crate::db::{lock_conn, DbState};
use crate::models::Tag;
use tauri::State;

#[tauri::command]
pub fn create_tag(state: State<DbState>, name: String, color: Option<String>) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        rusqlite::params![name, color],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_tags(state: State<DbState>) -> Result<Vec<Tag>, String> {
    let conn = lock_conn(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM tags ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = vec![];
    for row in rows {
        tags.push(row.map_err(|e| e.to_string())?);
    }
    Ok(tags)
}

#[tauri::command]
pub fn update_tag(
    state: State<DbState>,
    id: i64,
    name: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE tags SET name=?1 WHERE id=?2",
            rusqlite::params![n, id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(ref c) = color {
        conn.execute(
            "UPDATE tags SET color=?1 WHERE id=?2",
            rusqlite::params![c, id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_tag(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute("DELETE FROM tags WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_tag_to_task(state: State<DbState>, task_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
        rusqlite::params![task_id, tag_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_tag_from_task(state: State<DbState>, task_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "DELETE FROM task_tags WHERE task_id=?1 AND tag_id=?2",
        rusqlite::params![task_id, tag_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
