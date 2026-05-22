use crate::db::{lock_conn, DbState};
use crate::models::Category;
use tauri::State;

#[tauri::command]
pub fn create_category(
    state: State<DbState>,
    name: String,
    color: Option<String>,
    parent_id: Option<i64>,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "INSERT INTO categories (name, color, parent_id) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, color, parent_id],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_categories(state: State<DbState>) -> Result<Vec<Category>, String> {
    let conn = lock_conn(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, color, parent_id FROM categories ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                parent_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut cats = vec![];
    for row in rows {
        cats.push(row.map_err(|e| e.to_string())?);
    }
    Ok(cats)
}

#[tauri::command]
pub fn update_category(
    state: State<DbState>,
    id: i64,
    name: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE categories SET name=?1 WHERE id=?2",
            rusqlite::params![n, id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(ref c) = color {
        conn.execute(
            "UPDATE categories SET color=?1 WHERE id=?2",
            rusqlite::params![c, id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_category(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE categories SET parent_id=NULL WHERE parent_id=?1",
        rusqlite::params![id],
    ).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
