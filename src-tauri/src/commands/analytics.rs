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
    let week_ago = (chrono::Utc::now() - chrono::Duration::days(6)).format("%Y-%m-%d").to_string();
    let tomorrow = chrono::Utc::now().date_naive().succ_opt().unwrap().format("%Y-%m-%d").to_string();

    let mut estimated_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT due_date, COALESCE(SUM(estimated_minutes), 0)
             FROM tasks WHERE due_date >= ?1 AND due_date < ?2 AND status='completed'
             GROUP BY due_date",
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
            "SELECT t.due_date, COALESCE(SUM(fs.duration_minutes), 0)
             FROM focus_sessions fs JOIN tasks t ON fs.task_id = t.id
             WHERE t.due_date >= ?1 AND t.due_date < ?2 AND fs.completed=1
             GROUP BY t.due_date",
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
            "SELECT due_date, COUNT(*) FROM tasks WHERE due_date >= ?1 AND due_date < ?2 AND status='completed' GROUP BY due_date",
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
            "SELECT due_date, COUNT(*) FROM tasks WHERE due_date >= ?1 AND due_date < ?2 AND status!='archived' GROUP BY due_date",
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

    for i in (0..7).rev() {
        let d = chrono::Utc::now() - chrono::Duration::days(i);
        let date = d.format("%Y-%m-%d").to_string();
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
    let since = (chrono::Utc::now() - chrono::Duration::days(days as i64))
        .format("%Y-%m-%d")
        .to_string();

    let mut hour_map: std::collections::HashMap<i32, (i64, i64)> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT CAST(strftime('%H', started_at) AS INTEGER) AS h,
                    COALESCE(SUM(duration_minutes), 0), COUNT(*)
             FROM focus_sessions
             WHERE completed=1 AND DATE(started_at) >= ?1
             GROUP BY h",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map([&since], |r| {
            Ok((r.get::<_, i32>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?))
        }).map_err(|e| e.to_string())? {
            let (h, m, s) = row.map_err(|e| e.to_string())?;
            hour_map.insert(h, (m, s));
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
    let date = date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    let is_workday = crate::db::is_workday(&conn, &date);

    let estimated_total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(estimated_minutes), 0) FROM tasks WHERE due_date=?1 AND status='active'",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let scheduled_total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) FROM schedule_entries WHERE date=?1",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let actual_focus: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE DATE(started_at)=?1 AND completed=1",
        [&date],
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
        "SELECT COUNT(*) FROM tasks WHERE due_date=?1 AND status='active'",
        [&date],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;

    let completed_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE due_date=?1 AND status='completed'",
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

#[tauri::command]
pub fn get_daily_review(state: State<DbState>, date: Option<String>) -> Result<DailyReview, String> {
    let conn = lock_conn(&state)?;
    let date = date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    let is_workday = crate::db::is_workday(&conn, &date);

    // Completed tasks
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, t.estimated_minutes,
                COALESCE((SELECT SUM(fs.duration_minutes) FROM focus_sessions fs WHERE fs.task_id=t.id AND fs.completed=1), 0),
                t.priority
         FROM tasks t
         WHERE t.due_date=?1 AND t.status='completed'
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
         WHERE t.due_date=?1 AND t.status='active'
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
         FROM focus_sessions WHERE DATE(started_at)=?1 AND completed=1",
        [&date],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).unwrap_or((0, 0));

    // Plan accuracy
    let total_est: i64 = completed_tasks.iter().filter_map(|t| t.estimated_minutes).sum();
    let total_act: i64 = completed_tasks.iter().map(|t| t.actual_focus_minutes).sum();
    let accuracy = if total_est > 0 { total_act as f64 / total_est as f64 } else { 0.0 };

    Ok(DailyReview {
        date,
        is_workday,
        completed_tasks,
        incomplete_tasks,
        total_focus_minutes: focus_minutes,
        focus_sessions,
        plan_accuracy: accuracy,
    })
}

