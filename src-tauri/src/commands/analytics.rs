use crate::db::{lock_conn, DbState};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WorkloadSummary {
    pub date: String,
    pub is_workday: bool,
    #[specta(type = f64)]
    pub estimated_total_minutes: i64,
    #[specta(type = f64)]
    pub scheduled_total_minutes: i64,
    #[specta(type = f64)]
    pub actual_focus_minutes: i64,
    #[specta(type = f64)]
    pub available_minutes: i64,
    #[specta(type = f64)]
    pub task_count: i64,
    #[specta(type = f64)]
    pub completed_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DailyAccuracy {
    pub date: String,
    #[specta(type = f64)]
    pub estimated_minutes: i64,
    #[specta(type = f64)]
    pub actual_minutes: i64,
    #[specta(type = f64)]
    pub completed_tasks: i64,
    #[specta(type = f64)]
    pub total_tasks: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WeeklyAccuracy {
    pub days: Vec<DailyAccuracy>,
    pub overall_accuracy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FocusHeatmapEntry {
    pub hour: i32,
    #[specta(type = f64)]
    pub minutes: i64,
    #[specta(type = f64)]
    pub sessions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DailyReview {
    pub date: String,
    pub is_workday: bool,
    pub completed_tasks: Vec<ReviewTask>,
    pub incomplete_tasks: Vec<ReviewTask>,
    #[specta(type = f64)]
    pub total_focus_minutes: i64,
    #[specta(type = f64)]
    pub focus_sessions: i64,
    pub plan_accuracy: f64,
    pub completed_steps: i32,
    pub completed_matters: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ReviewTask {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
    #[specta(type = f64)]
    pub actual_focus_minutes: i64,
    pub priority: i32,
}

pub fn weekly_accuracy_on_conn(
    conn: &rusqlite::Connection,
) -> Result<WeeklyAccuracy, String> {
    let (week_start, tomorrow_d) = crate::agenda::local_last_n_days_window(7);
    let week_ago = crate::agenda::format_calendar_date(week_start);
    let tomorrow = crate::agenda::format_calendar_date(tomorrow_d);

    let mut estimated_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT substr(due_date,1,10), COALESCE(SUM(estimated_minutes), 0)
             FROM tasks WHERE substr(due_date,1,10) >= ?1 AND substr(due_date,1,10) < ?2 AND status='completed'
             GROUP BY substr(due_date,1,10)",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&week_ago, &tomorrow], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())? {
            let (d, v) = row.map_err(|e| e.to_string())?;
            estimated_map.insert(d, v);
        }
    }

    let mut actual_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT substr(t.due_date,1,10), COALESCE(SUM(fs.duration_minutes), 0)
             FROM focus_sessions fs JOIN tasks t ON fs.task_id = t.id
             WHERE substr(t.due_date,1,10) >= ?1 AND substr(t.due_date,1,10) < ?2 AND fs.completed=1
             GROUP BY substr(t.due_date,1,10)",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&week_ago, &tomorrow], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())? {
            let (d, v) = row.map_err(|e| e.to_string())?;
            actual_map.insert(d, v);
        }
    }

    let mut completed_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT substr(due_date,1,10), COUNT(*) FROM tasks WHERE substr(due_date,1,10) >= ?1 AND substr(due_date,1,10) < ?2 AND status='completed' GROUP BY substr(due_date,1,10)",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&week_ago, &tomorrow], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())? {
            let (d, v) = row.map_err(|e| e.to_string())?;
            completed_map.insert(d, v);
        }
    }

    let mut total_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT substr(due_date,1,10), COUNT(*) FROM tasks WHERE substr(due_date,1,10) >= ?1 AND substr(due_date,1,10) < ?2 AND status!='archived' GROUP BY substr(due_date,1,10)",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&week_ago, &tomorrow], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())? {
            let (d, v) = row.map_err(|e| e.to_string())?;
            total_map.insert(d, v);
        }
    }

    let mut days = vec![];
    let mut total_estimated = 0i64;
    let mut total_actual = 0i64;

    let mut cursor = week_start;
    while cursor < tomorrow_d {
        let date = crate::agenda::format_calendar_date(cursor);
        let estimated = *estimated_map.get(&date).unwrap_or(&0);
        let actual = *actual_map.get(&date).unwrap_or(&0);
        let completed = *completed_map.get(&date).unwrap_or(&0);
        let total = *total_map.get(&date).unwrap_or(&0);

        days.push(DailyAccuracy {
            date,
            estimated_minutes: estimated,
            actual_minutes: actual,
            completed_tasks: completed,
            total_tasks: total,
        });

        total_estimated += estimated;
        total_actual += actual;
        cursor = cursor.succ_opt().ok_or_else(|| "date overflow".to_string())?;
    }

    let accuracy = if total_estimated > 0 {
        total_actual as f64 / total_estimated as f64
    } else {
        0.0
    };

    Ok(WeeklyAccuracy {
        days,
        overall_accuracy: accuracy,
    })
}

pub fn focus_heatmap_on_conn(
    conn: &rusqlite::Connection,
    days: i32,
) -> Result<Vec<FocusHeatmapEntry>, String> {
    let (window_start, tomorrow) = crate::agenda::local_last_n_days_window(days);
    let (range_start, range_end) = crate::agenda::local_range_bounds(window_start, tomorrow)?;

    let mut hour_map: std::collections::HashMap<i32, (i64, i64)> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT started_at, COALESCE(duration_minutes, 0)
             FROM focus_sessions
             WHERE completed=1 AND started_at >= ?1 AND started_at < ?2",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&range_start, &range_end], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())? {
            let (started_at, minutes) = row.map_err(|e| e.to_string())?;
            if let Some(h) = crate::agenda::rfc3339_to_local_hour(&started_at) {
                let entry = hour_map.entry(h).or_insert((0, 0));
                entry.0 += minutes;
                entry.1 += 1;
            }
        }
    }

    let mut heatmap = vec![];
    for hour in 0..24 {
        let (minutes, sessions) = hour_map.remove(&hour).unwrap_or((0, 0));
        heatmap.push(FocusHeatmapEntry {
            hour,
            minutes,
            sessions,
        });
    }

    Ok(heatmap)
}

#[tauri::command]
pub fn get_workload_summary(state: State<DbState>, date: Option<String>) -> Result<WorkloadSummary, String> {
    let conn = lock_conn(&state)?;
    let date = date.unwrap_or_else(crate::time::local_today_date);
    let (day_start, day_end) = crate::agenda::local_day_bounds(&date)?;

    let is_workday = crate::db::is_workday(&conn, &date);

    let estimated_total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(estimated_minutes), 0) FROM tasks WHERE substr(due_date,1,10)=?1 AND status='active'",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let scheduled_total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) FROM schedule_entries WHERE date=?1",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let actual_focus: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE completed=1 AND started_at >= ?1 AND started_at < ?2",
        [&day_start, &day_end],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let am_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_AM).unwrap_or_else(|| "08:30".into());
    let am_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_AM).unwrap_or_else(|| "12:00".into());
    let pm_start = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_PM).unwrap_or_else(|| "14:30".into());
    let pm_end = crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_PM).unwrap_or_else(|| "18:00".into());

    let available = if is_workday {
        crate::time::time_diff_minutes(&am_start, &am_end)
            + crate::time::time_diff_minutes(&pm_start, &pm_end)
    } else { 0 };

    let task_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE substr(due_date,1,10)=?1 AND status='active'",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let completed_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE substr(due_date,1,10)=?1 AND status='completed'",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(WorkloadSummary {
        date,
        is_workday,
        estimated_total_minutes: estimated_total,
        scheduled_total_minutes: scheduled_total,
        actual_focus_minutes: actual_focus,
        available_minutes: available,
        task_count,
        completed_count,
    })
}

fn count_local_completed(conn: &rusqlite::Connection, table: &str, date: &str, extra: &str) -> i32 {
    let day = match crate::agenda::parse_calendar_date(date) {
        Ok(d) => d,
        Err(_) => return 0,
    };
    let next = match day.succ_opt() {
        Some(d) => d,
        None => return 0,
    };
    let sql = format!("SELECT completed_at FROM {table} WHERE completed_at IS NOT NULL{extra}");
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    stmt.query_map([], |r| r.get::<_, String>(0))
        .ok()
        .map(|rows| {
            rows.filter_map(|r| r.ok())
                .filter(|ts| crate::agenda::local_date_in_period(ts, day, next))
                .count() as i32
        })
        .unwrap_or(0)
}

pub fn get_daily_review_on_conn(
    conn: &rusqlite::Connection,
    date: Option<String>,
) -> Result<DailyReview, String> {
    let date = date.unwrap_or_else(crate::time::local_today_date);
    let (day_start, day_end) = crate::agenda::local_day_bounds(&date)?;

    let is_workday = crate::db::is_workday(&conn, &date);

    // Completed tasks
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, t.estimated_minutes,
                COALESCE((SELECT SUM(fs.duration_minutes) FROM focus_sessions fs WHERE fs.task_id=t.id AND fs.completed=1), 0),
                t.priority
         FROM tasks t
         WHERE substr(t.due_date,1,10)=?1 AND t.status='completed'
         ORDER BY t.completed_at"
    ).map_err(|e| e.to_string())?;

    let completed_tasks: Vec<ReviewTask> = stmt.query_map([&date], |r| {
        Ok(ReviewTask {
            id: r.get(0)?,
            title: r.get(1)?,
            estimated_minutes: r.get(2)?,
            actual_focus_minutes: r.get(3)?,
            priority: r.get(4)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    // Incomplete tasks due today
    let mut stmt2 = conn.prepare(
        "SELECT t.id, t.title, t.estimated_minutes,
                COALESCE((SELECT SUM(fs.duration_minutes) FROM focus_sessions fs WHERE fs.task_id=t.id AND fs.completed=1), 0),
                t.priority
         FROM tasks t
         WHERE substr(t.due_date,1,10)=?1 AND t.status='active'
         ORDER BY t.priority DESC"
    ).map_err(|e| e.to_string())?;

    let incomplete_tasks: Vec<ReviewTask> = stmt2.query_map([&date], |r| {
        Ok(ReviewTask {
            id: r.get(0)?,
            title: r.get(1)?,
            estimated_minutes: r.get(2)?,
            actual_focus_minutes: r.get(3)?,
            priority: r.get(4)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    // Focus stats
    let (focus_minutes, focus_sessions): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0), COUNT(*)
         FROM focus_sessions WHERE completed=1 AND started_at >= ?1 AND started_at < ?2",
        [&day_start, &day_end],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0, 0));

    // Plan accuracy
    let total_est: i64 = completed_tasks.iter().filter_map(|t| t.estimated_minutes).sum();
    let total_act: i64 = completed_tasks.iter().map(|t| t.actual_focus_minutes).sum();
    let accuracy = if total_est > 0 { total_act as f64 / total_est as f64 } else { 0.0 };

    Ok(DailyReview {
        date: date.clone(),
        is_workday,
        completed_tasks,
        incomplete_tasks,
        total_focus_minutes: focus_minutes,
        focus_sessions,
        plan_accuracy: accuracy,
        completed_steps: count_local_completed(conn, "matter_steps", &date, " AND status='completed'"),
        completed_matters: count_local_completed(conn, "matters", &date, ""),
    })
}

#[tauri::command]
pub fn get_daily_review(state: State<DbState>, date: Option<String>) -> Result<DailyReview, String> {
    let conn = lock_conn(&state)?;
    get_daily_review_on_conn(&conn, date)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::matter::{add_matter_step_on_conn, complete_matter_step_on_conn, create_blank_matter_on_conn};
    use chrono::Local;
    use rusqlite::Connection;

    #[test]
    fn daily_review_counts_use_local_completed_at() {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        let mid = create_blank_matter_on_conn(&conn, "复盘事项", 0, None, None).unwrap();
        let sid = add_matter_step_on_conn(&conn, mid, "一步", false, None, None).unwrap();
        complete_matter_step_on_conn(&conn, sid).unwrap();
        let today = crate::time::local_today_date();
        let review = get_daily_review_on_conn(&conn, Some(today.clone())).unwrap();
        assert_eq!(review.completed_steps, 1);
        assert_eq!(review.completed_matters, 1);

        let skipped_matter = create_blank_matter_on_conn(&conn, "跳过不算完成步", 0, None, None).unwrap();
        let skipped = add_matter_step_on_conn(&conn, skipped_matter, "跳过步", false, None, None).unwrap();
        crate::matter::skip_matter_step_on_conn(&conn, skipped).unwrap();
        let after_skip = get_daily_review_on_conn(&conn, Some(today.clone())).unwrap();
        assert_eq!(after_skip.completed_steps, 1, "跳过的步不应计入完成步数");
        assert_eq!(after_skip.completed_matters, 2);

        let offset = Local::now().offset().local_minus_utc();
        if offset == 8 * 3600 {
            let conn = Connection::open_in_memory().unwrap();
            db::init_db(&conn).unwrap();
            let other = create_blank_matter_on_conn(&conn, "跨日", 0, None, None).unwrap();
            let step = add_matter_step_on_conn(&conn, other, "跨日步", false, None, None).unwrap();
            complete_matter_step_on_conn(&conn, step).unwrap();
            conn.execute(
                "UPDATE matter_steps SET completed_at='2026-10-31T16:00:00+00:00' WHERE id=?1",
                rusqlite::params![step],
            )
            .unwrap();
            conn.execute(
                "UPDATE matters SET completed_at='2026-10-31T16:00:00+00:00' WHERE id=?1",
                rusqlite::params![other],
            )
            .unwrap();
            let nov = get_daily_review_on_conn(&conn, Some("2026-11-01".into())).unwrap();
            let oct = get_daily_review_on_conn(&conn, Some("2026-10-31".into())).unwrap();
            assert_eq!(nov.completed_steps, 1);
            assert_eq!(nov.completed_matters, 1);
            assert_eq!(oct.completed_steps, 0);
            assert_eq!(oct.completed_matters, 0);
        }
    }
}

