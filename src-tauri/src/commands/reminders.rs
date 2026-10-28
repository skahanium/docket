use crate::db::{lock_conn, DbState};
use crate::models::Reminder;
use tauri::State;

pub fn normalize_remind_at(remind_at: &str) -> Result<String, String> {
    chrono::DateTime::parse_from_rfc3339(remind_at)
        .map(|dt| dt.with_timezone(&chrono::Utc).to_rfc3339())
        .map_err(|_| "提醒时间格式无效".into())
}

#[tauri::command]
pub fn add_reminder(state: State<DbState>, task_id: i64, remind_at: String) -> Result<i64, String> {
    let stored = normalize_remind_at(&remind_at)?;
    let conn = lock_conn(&state)?;
    conn.execute(
        "INSERT INTO reminders (task_id, remind_at) VALUES (?1, ?2)",
        rusqlite::params![task_id, stored],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn remove_reminder(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute("DELETE FROM reminders WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_reminders(state: State<DbState>, task_id: i64) -> Result<Vec<Reminder>, String> {
    let conn = lock_conn(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, task_id, remind_at, notified FROM reminders WHERE task_id=?1 ORDER BY remind_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![task_id], |row| {
            Ok(Reminder {
                id: row.get(0)?,
                task_id: row.get(1)?,
                remind_at: row.get(2)?,
                notified: row.get::<_, i32>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = vec![];
    for r in rows { result.push(r.map_err(|e| e.to_string())?); }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_zulu_and_offset_to_utc() {
        let a = normalize_remind_at("2026-10-28T08:00:00.000Z").unwrap();
        let b = normalize_remind_at("2026-10-28T16:00:00+08:00").unwrap();
        assert!(a.starts_with("2026-10-28T08:00:00"));
        assert!(b.starts_with("2026-10-28T08:00:00"));
        assert!(!a.ends_with('Z'));
        assert!(a.contains('+') || a.contains("08:00:00"));
    }

    #[test]
    fn reject_invalid_remind_at() {
        assert!(normalize_remind_at("not-a-date").is_err());
    }
}
