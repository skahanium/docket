use crate::db::{lock_conn, DbState};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScheduleEntry {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub task_id: i64,
    pub task_title: String,
    pub task_priority: i32,
    pub date: String,
    pub start_time: String,
    #[specta(type = f64)]
    pub duration_minutes: i64,
    pub sort_order: i32,
    pub completed: bool,
    pub category_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScheduleDay {
    pub date: String,
    pub is_workday: bool,
    pub am_block: TimeBlock,
    pub pm_block: TimeBlock,
    pub entries: Vec<ScheduleEntry>,
    pub unscheduled: Vec<ScheduleEntry>,
    /// Total estimated minutes of scheduled tasks
    #[specta(type = f64)]
    pub scheduled_minutes: i64,
    /// Total available work minutes
    #[specta(type = f64)]
    pub available_minutes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TimeBlock {
    pub start: String,
    pub end: String,
    pub label: String,
}

/// Get the day's schedule
#[tauri::command]
pub fn get_schedule(state: State<DbState>, date: String) -> Result<ScheduleDay, String> {
    let conn = lock_conn(&state)?;

    let is_workday = crate::db::is_workday(&conn, &date);

    let am_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_AM).unwrap_or_else(|| "08:30".into());
    let am_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_AM).unwrap_or_else(|| "12:00".into());
    let pm_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_PM).unwrap_or_else(|| "14:30".into());
    let pm_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_PM).unwrap_or_else(|| "18:00".into());

    let am_block = TimeBlock { start: am_start.clone(), end: am_end.clone(), label: "上午".into() };
    let pm_block = TimeBlock { start: pm_start.clone(), end: pm_end.clone(), label: "下午".into() };

    // Calculate available minutes
    let available = if is_workday {
        crate::time::time_diff_minutes(&am_start, &am_end)
            + crate::time::time_diff_minutes(&pm_start, &pm_end)
    } else {
        0
    };

    // Get scheduled entries
    let mut stmt = conn.prepare(
        "SELECT se.id, se.task_id, t.title, t.priority, se.date, se.start_time, se.duration_minutes,
                se.sort_order, t.status='completed', c.color
         FROM schedule_entries se
         JOIN tasks t ON se.task_id = t.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE se.date = ?1 AND t.status != 'archived'
         ORDER BY se.start_time, se.sort_order"
    ).map_err(|e| e.to_string())?;

    let entries: Vec<ScheduleEntry> = stmt.query_map([&date], |row| {
        Ok(ScheduleEntry {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_title: row.get(2)?,
            task_priority: row.get(3)?,
            date: row.get(4)?,
            start_time: row.get(5)?,
            duration_minutes: row.get(6)?,
            sort_order: row.get(7)?,
            completed: row.get(8)?,
            category_color: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let scheduled_minutes: i64 = entries.iter().map(|e| e.duration_minutes).sum();

    // Get unscheduled tasks (due today, active, not scheduled)
    let mut stmt2 = conn.prepare(
        "SELECT t.id, t.title, t.priority, t.due_date, COALESCE(t.estimated_minutes, 30), c.color
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.due_date = ?1
           AND t.status = 'active'
           AND t.id NOT IN (SELECT task_id FROM schedule_entries WHERE date = ?1)
         ORDER BY t.priority DESC, t.created_at ASC"
    ).map_err(|e| e.to_string())?;

    let unscheduled: Vec<ScheduleEntry> = stmt2.query_map([&date], |row| {
        Ok(ScheduleEntry {
            id: 0,
            task_id: row.get(0)?,
            task_title: row.get(1)?,
            task_priority: row.get(2)?,
            date: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            start_time: String::new(),
            duration_minutes: row.get(4)?,
            sort_order: 0,
            completed: false,
            category_color: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    Ok(ScheduleDay {
        date,
        is_workday,
        am_block,
        pm_block,
        entries,
        unscheduled,
        scheduled_minutes,
        available_minutes: available,
    })
}

/// Auto-assign unscheduled tasks to time slots
#[tauri::command]
pub fn auto_schedule(state: State<DbState>, date: String) -> Result<ScheduleDay, String> {
    let am_start;
    let am_end;
    let pm_start;
    let pm_end;

    {
        let conn = lock_conn(&state)?;
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

        tx.execute("DELETE FROM schedule_entries WHERE date=?1", [&date])
            .map_err(|e| e.to_string())?;

        am_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_AM).unwrap_or_else(|| "08:30".into());
        am_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_AM).unwrap_or_else(|| "12:00".into());
        pm_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_PM).unwrap_or_else(|| "14:30".into());
        pm_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_PM).unwrap_or_else(|| "18:00".into());

        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.priority, COALESCE(t.estimated_minutes, 30)
             FROM tasks t
             WHERE t.due_date = ?1 AND t.status = 'active'
             ORDER BY t.priority DESC, COALESCE(t.estimated_minutes, 30) ASC"
        ).map_err(|e| e.to_string())?;

        let tasks: Vec<(i64, String, i32, i64)> = stmt.query_map([&date], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get::<_, Option<i64>>(3)?.unwrap_or(30)))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

        drop(stmt);

        let (big_tasks, small_tasks): (Vec<_>, Vec<_>) = tasks
            .into_iter()
            .partition(|(_, _, _, dur)| *dur >= 60);

        let mut scheduled: Vec<(i64, String, i64)> = Vec::new();

        fill_block(&mut scheduled, &big_tasks, &small_tasks, &am_start, &am_end);
        let (remaining_big, remaining_small) = partition_unused(&big_tasks, &small_tasks, &scheduled);
        fill_block(&mut scheduled, &remaining_big, &remaining_small, &pm_start, &pm_end);

        for (idx, (task_id, ref start_time, duration)) in scheduled.iter().enumerate() {
            tx.execute(
                "INSERT INTO schedule_entries (task_id, date, start_time, duration_minutes, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![task_id, date, start_time, duration, idx as i32],
            ).map_err(|e| e.to_string())?;
        }

        tx.commit().map_err(|e| e.to_string())?;
    }

    get_schedule(state, date)
}

fn fill_block(
    scheduled: &mut Vec<(i64, String, i64)>,
    big_tasks: &[(i64, String, i32, i64)],
    small_tasks: &[(i64, String, i32, i64)],
    block_start: &str,
    block_end: &str,
) {
    let total_minutes = crate::time::time_diff_minutes(block_start, block_end);
    let mut used = 0i64;
    let mut cursor = block_start.to_string();

    // Place big tasks first
    for (id, _title, _pri, dur) in big_tasks {
        if scheduled.iter().any(|(tid, _, _)| tid == id) { continue }
        if used + dur > total_minutes { break }
        scheduled.push((*id, cursor.clone(), *dur));
        used += dur;
        cursor = crate::time::add_minutes(&cursor, *dur);
    }

    // Fill remaining with small tasks
    for (id, _title, _pri, dur) in small_tasks {
        if scheduled.iter().any(|(tid, _, _)| tid == id) { continue }
        if used + dur > total_minutes { break }
        scheduled.push((*id, cursor.clone(), *dur));
        used += dur;
        cursor = crate::time::add_minutes(&cursor, *dur);
    }
}

fn partition_unused(
    big: &[(i64, String, i32, i64)],
    small: &[(i64, String, i32, i64)],
    scheduled: &[(i64, String, i64)],
) -> (Vec<(i64, String, i32, i64)>, Vec<(i64, String, i32, i64)>) {
    let used_ids: std::collections::HashSet<i64> = scheduled.iter().map(|(id, _, _)| *id).collect();
    let rem_big: Vec<_> = big.iter().filter(|(id, ..)| !used_ids.contains(id)).cloned().collect();
    let rem_small: Vec<_> = small.iter().filter(|(id, ..)| !used_ids.contains(id)).cloned().collect();
    (rem_big, rem_small)
}

/// Manually add/update a schedule entry
#[tauri::command]
pub fn update_schedule_entry(
    state: State<DbState>,
    task_id: i64,
    date: String,
    start_time: String,
    duration_minutes: i64,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM schedule_entries WHERE task_id=?1 AND date=?2",
        rusqlite::params![task_id, date],
    ).map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO schedule_entries (task_id, date, start_time, duration_minutes, sort_order)
         VALUES (?1, ?2, ?3, ?4, 0)",
        rusqlite::params![task_id, date, start_time, duration_minutes],
    ).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a task from the schedule
#[tauri::command]
pub fn remove_schedule_entry(state: State<DbState>, task_id: i64, date: String) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute(
        "DELETE FROM schedule_entries WHERE task_id=?1 AND date=?2",
        rusqlite::params![task_id, date],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Clear entire day schedule
#[tauri::command]
pub fn clear_schedule(state: State<DbState>, date: String) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute("DELETE FROM schedule_entries WHERE date=?1", [&date])
        .map_err(|e| e.to_string())?;
    Ok(())
}

