use crate::db::{lock_conn, DbState};
use crate::models::{FocusSession, FocusSummary};
use chrono::Utc;
use tauri::State;

#[tauri::command]
pub fn start_focus(state: State<DbState>, task_id: i64) -> Result<FocusSession, String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE focus_sessions SET ended_at=?1, completed=0 WHERE ended_at IS NULL",
        [&now],
    ).map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO focus_sessions (task_id, started_at, completed) VALUES (?1, ?2, 0)",
        rusqlite::params![task_id, now],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    tx.commit().map_err(|e| e.to_string())?;

    let task_title: Option<String> = conn.query_row(
        "SELECT title FROM tasks WHERE id=?1",
        [task_id],
        |row| row.get(0),
    ).ok();

    Ok(FocusSession {
        id,
        task_id,
        task_title,
        started_at: now,
        ended_at: None,
        duration_minutes: None,
        completed: false,
    })
}

#[tauri::command]
pub fn stop_focus(state: State<DbState>, session_id: i64, completed: Option<bool>) -> Result<FocusSession, String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();
    let completed = completed.unwrap_or(true);

    // Calculate duration
    let started_at: String = conn.query_row(
        "SELECT started_at FROM focus_sessions WHERE id=?1",
        [session_id],
        |row| row.get(0),
    ).map_err(|e| format!("Session not found: {}", e))?;

    let started: chrono::DateTime<Utc> = chrono::DateTime::parse_from_rfc3339(&started_at)
        .map_err(|e| e.to_string())?
        .with_timezone(&Utc);
    let ended: chrono::DateTime<Utc> = chrono::DateTime::parse_from_rfc3339(&now)
        .map_err(|e| e.to_string())?
        .with_timezone(&Utc);
    let duration = (ended - started).num_minutes().max(1);

    conn.execute(
        "UPDATE focus_sessions SET ended_at=?1, duration_minutes=?2, completed=?3 WHERE id=?4",
        rusqlite::params![now, duration, if completed { 1 } else { 0 }, session_id],
    ).map_err(|e| e.to_string())?;

    let session = get_session_by_id(&conn, session_id)?;
    Ok(session)
}

#[tauri::command]
pub fn abandon_focus(state: State<DbState>, session_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE focus_sessions SET ended_at=?1, completed=0, duration_minutes=0 WHERE id=?2",
        rusqlite::params![now, session_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_current_focus(state: State<DbState>) -> Result<Option<FocusSession>, String> {
    let conn = lock_conn(&state)?;

    let session = conn.query_row(
        "SELECT f.id, f.task_id, t.title, f.started_at, f.ended_at, f.duration_minutes, f.completed
         FROM focus_sessions f
         LEFT JOIN tasks t ON f.task_id = t.id
         WHERE f.ended_at IS NULL
         ORDER BY f.started_at DESC LIMIT 1",
        [],
        |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                duration_minutes: row.get(5)?,
                completed: row.get::<_, i32>(6)? != 0,
            })
        },
    );

    match session {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_task_focus_history(state: State<DbState>, task_id: i64) -> Result<Vec<FocusSession>, String> {
    let conn = lock_conn(&state)?;

    let mut stmt = conn.prepare(
        "SELECT f.id, f.task_id, t.title, f.started_at, f.ended_at, f.duration_minutes, f.completed
         FROM focus_sessions f
         LEFT JOIN tasks t ON f.task_id = t.id
         WHERE f.task_id=?1 AND f.ended_at IS NOT NULL
         ORDER BY f.started_at DESC
         LIMIT 50",
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([task_id], |row| {
        Ok(FocusSession {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_title: row.get(2)?,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
            duration_minutes: row.get(5)?,
            completed: row.get::<_, i32>(6)? != 0,
        })
    }).map_err(|e| e.to_string())?;

    let mut sessions = vec![];
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(sessions)
}

#[tauri::command]
pub fn get_focus_summary(state: State<DbState>, date: String) -> Result<FocusSummary, String> {
    let conn = lock_conn(&state)?;

    let total_minutes: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions
         WHERE DATE(started_at) = ?1 AND completed = 1",
        [&date],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let session_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM focus_sessions
         WHERE DATE(started_at) = ?1 AND completed = 1",
        [&date],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT f.id, f.task_id, t.title, f.started_at, f.ended_at, f.duration_minutes, f.completed
         FROM focus_sessions f
         LEFT JOIN tasks t ON f.task_id = t.id
         WHERE DATE(f.started_at) = ?1
         ORDER BY f.started_at DESC",
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([&date], |row| {
        Ok(FocusSession {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_title: row.get(2)?,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
            duration_minutes: row.get(5)?,
            completed: row.get::<_, i32>(6)? != 0,
        })
    }).map_err(|e| e.to_string())?;

    let mut sessions = vec![];
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(FocusSummary {
        total_minutes,
        session_count,
        sessions,
    })
}

#[tauri::command]
pub fn update_task_estimate(state: State<DbState>, task_id: i64, minutes: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "UPDATE tasks SET estimated_minutes=?1, updated_at=?2 WHERE id=?3",
        rusqlite::params![minutes, Utc::now().to_rfc3339(), task_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_session_by_id(conn: &rusqlite::Connection, id: i64) -> Result<FocusSession, String> {
    conn.query_row(
        "SELECT f.id, f.task_id, t.title, f.started_at, f.ended_at, f.duration_minutes, f.completed
         FROM focus_sessions f
         LEFT JOIN tasks t ON f.task_id = t.id
         WHERE f.id=?1",
        [id],
        |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                duration_minutes: row.get(5)?,
                completed: row.get::<_, i32>(6)? != 0,
            })
        },
    ).map_err(|e| e.to_string())
}
