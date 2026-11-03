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
    let next_year = if month == 12 {
        year.checked_add(1)
            .ok_or_else(|| AppError::InvalidDate(format!("{year}-{month}")))?
    } else {
        year
    };
    let next_month = if month == 12 { 1 } else { month + 1 };
    let last_day = NaiveDate::from_ymd_opt(next_year, next_month as u32, 1)
        .and_then(|d| d.pred_opt())
        .ok_or_else(|| AppError::InvalidDate(format!("{year}-{month}")))?;

    let first_str = first.format("%Y-%m-%d").to_string();
    let last_str = last_day.format("%Y-%m-%d").to_string();

    let mut task_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut completed_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut step_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();

    {
        let mut stmt = conn.prepare(
            "SELECT substr(due_date,1,10), COUNT(*) FROM tasks
             WHERE substr(due_date,1,10) >= ?1 AND substr(due_date,1,10) <= ?2
               AND (status != 'archived' OR completed_at IS NOT NULL)
             GROUP BY substr(due_date,1,10)",
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
            "SELECT substr(due_date,1,10), COUNT(*) FROM tasks
             WHERE substr(due_date,1,10) >= ?1 AND substr(due_date,1,10) <= ?2
               AND status IN ('completed', 'archived') AND completed_at IS NOT NULL
             GROUP BY substr(due_date,1,10)",
        )?;
        for row in stmt.query_map(rusqlite::params![first_str, last_str], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
        })? {
            let (d, c) = row?;
            completed_counts.insert(d, c);
        }
    }

    {
        let mut stmt = conn.prepare(
            "SELECT substr(s.due_date,1,10), COUNT(*)
             FROM matter_steps s
             JOIN matters m ON m.id = s.matter_id
             WHERE m.status = 'active'
               AND s.status = 'pending'
               AND s.due_date IS NOT NULL
               AND substr(s.due_date,1,10) >= ?1 AND substr(s.due_date,1,10) <= ?2
               AND s.id = (
                 SELECT s2.id FROM matter_steps s2
                 WHERE s2.matter_id = s.matter_id AND s2.status = 'pending'
                 ORDER BY s2.sort_order ASC, s2.id ASC LIMIT 1
               )
             GROUP BY substr(s.due_date,1,10)",
        )?;
        for row in stmt.query_map(rusqlite::params![first_str, last_str], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
        })? {
            let (d, c) = row?;
            step_counts.insert(d, c);
        }
    }

    let mut days = vec![];
    let mut current = first;
    while current <= last_day {
        let date_str = current.format("%Y-%m-%d").to_string();
        days.push(CalendarDay {
            task_count: *task_counts.get(&date_str).unwrap_or(&0),
            completed_count: *completed_counts.get(&date_str).unwrap_or(&0),
            matter_step_count: *step_counts.get(&date_str).unwrap_or(&0),
            date: date_str,
        });
        let Some(next) = current.succ_opt() else {
            break;
        };
        current = next;
    }

    Ok(days)
}

#[tauri::command]
pub fn get_calendar_month(state: State<DbState>, year: i32, month: i32) -> Result<Vec<CalendarDay>, String> {
    let conn = lock_conn(&state)?;
    get_calendar_month_on_conn(&conn, year, month).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::tasks::{
        archive_task_on_conn, complete_task_on_conn, create_task_on_conn, CreateTaskInput,
    };
    use crate::matter::{
        add_matter_step_on_conn, complete_matter_step_on_conn, create_blank_matter_on_conn,
        current_pending_step,
    };
    use rusqlite::Connection;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::init_db(&conn).unwrap();
        conn
    }

    fn create_task_due(conn: &Connection, due: &str) -> i64 {
        create_task_on_conn(
            conn,
            CreateTaskInput {
                title: "日历任务".into(),
                description: None,
                priority: None,
                due_date: Some(due.into()),
                category_id: None,
                recurrence_rule: None,
                estimated_minutes: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn calendar_month_separates_task_and_step_counts() {
        let conn = conn();
        create_task_due(&conn, "2026-06-15");
        let mid = create_blank_matter_on_conn(&conn, "日历事项", 0, None, None).unwrap();
        add_matter_step_on_conn(&conn, mid, "当前步", false, Some("2026-06-15"), None).unwrap();

        let days = get_calendar_month_on_conn(&conn, 2026, 6).unwrap();
        let day = days.iter().find(|d| d.date == "2026-06-15").unwrap();
        assert_eq!(day.task_count, 1);
        assert_eq!(day.completed_count, 0);
        assert_eq!(day.matter_step_count, 1);
    }

    #[test]
    fn calendar_month_step_count_clears_when_step_completed() {
        let conn = conn();
        let mid = create_blank_matter_on_conn(&conn, "日历事项", 0, None, None).unwrap();
        add_matter_step_on_conn(&conn, mid, "当前步", false, Some("2026-06-20"), None).unwrap();

        let first = current_pending_step(&conn, mid).unwrap().unwrap();
        complete_matter_step_on_conn(&conn, first.id).unwrap();

        let days = get_calendar_month_on_conn(&conn, 2026, 6).unwrap();
        let day = days.iter().find(|d| d.date == "2026-06-20").unwrap();
        assert_eq!(day.task_count, 0);
        assert_eq!(day.matter_step_count, 0);
    }

    #[test]
    fn calendar_month_keeps_archived_completed_task_in_history() {
        let conn = conn();
        let id = create_task_due(&conn, "2026-06-15");
        complete_task_on_conn(&conn, id).unwrap();
        archive_task_on_conn(&conn, id).unwrap();

        // Archived *active* work stays invisible, but completed history does not
        // disappear just because the task was archived.
        let archived_active = create_task_due(&conn, "2026-06-16");
        archive_task_on_conn(&conn, archived_active).unwrap();

        let days = get_calendar_month_on_conn(&conn, 2026, 6).unwrap();
        let done = days.iter().find(|d| d.date == "2026-06-15").unwrap();
        assert_eq!(done.task_count, 1);
        assert_eq!(done.completed_count, 1);
        let hidden = days.iter().find(|d| d.date == "2026-06-16").unwrap();
        assert_eq!(hidden.task_count, 0);
        assert_eq!(hidden.completed_count, 0);
    }

    #[test]
    fn calendar_month_rejects_out_of_range_year_without_panic() {
        let conn = conn();
        let err = get_calendar_month_on_conn(&conn, i32::MAX, 12);
        assert!(err.is_err());
    }
}
