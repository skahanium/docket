use crate::db::{lock_conn, DbState};
use crate::error::{AppError, AppResult};
use crate::models::CalendarDay;
use chrono::NaiveDate;
use tauri::State;

pub fn get_calendar_month_on_conn(
    conn: &rusqlite::Connection,
    year: i32,
    month: i32,
) -> AppResult<Vec<CalendarDay>> {
    if month < 1 || month > 12 {
        return Err(AppError::InvalidDate(format!("{year}-{month}")));
    }
    let first = NaiveDate::from_ymd_opt(year, month as u32, 1)
        .ok_or_else(|| AppError::InvalidDate(format!("{year}-{month}")))?;
    let last_day = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month as u32 + 1, 1)
    }
    .unwrap()
    .pred_opt()
    .unwrap();

    let first_str = first.format("%Y-%m-%d").to_string();
    let last_str = last_day.format("%Y-%m-%d").to_string();

    let mut task_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut completed_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();

    {
        let mut stmt = conn.prepare(
            "SELECT due_date, COUNT(*) FROM tasks
             WHERE due_date >= ?1 AND due_date <= ?2 AND status != 'archived'
             GROUP BY due_date",
        )?;
        for row in stmt.query_map(rusqlite::params![first_str, last_str], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
        })? {
            let (d, c) = row?;
            task_counts.insert(d, c);
        }
    }

    {
        let mut stmt = conn.prepare(
            "SELECT due_date, COUNT(*) FROM tasks
             WHERE due_date >= ?1 AND due_date <= ?2 AND status = 'completed'
             GROUP BY due_date",
        )?;
        for row in stmt.query_map(rusqlite::params![first_str, last_str], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
        })? {
            let (d, c) = row?;
            completed_counts.insert(d, c);
        }
    }

    let mut days = vec![];
    let mut current = first;
    while current <= last_day {
        let date_str = current.format("%Y-%m-%d").to_string();
        days.push(CalendarDay {
            task_count: *task_counts.get(&date_str).unwrap_or(&0),
            completed_count: *completed_counts.get(&date_str).unwrap_or(&0),
            date: date_str,
        });
        current = current.succ_opt().unwrap();
    }

    Ok(days)
}

#[tauri::command]
pub fn get_calendar_month(state: State<DbState>, year: i32, month: i32) -> Result<Vec<CalendarDay>, String> {
    let conn = lock_conn(&state)?;
    get_calendar_month_on_conn(&conn, year, month).map_err(Into::into)
}
