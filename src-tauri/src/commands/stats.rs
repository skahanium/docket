use crate::commands::analytics::{focus_heatmap_on_conn, weekly_accuracy_on_conn, FocusHeatmapEntry, WeeklyAccuracy};
use crate::db::{lock_conn, DbState};
use crate::models::{DailyCount, Statistics};
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StatsPanelData {
    pub statistics: Statistics,
    pub weekly_accuracy: WeeklyAccuracy,
    pub focus_heatmap: Vec<FocusHeatmapEntry>,
}

pub fn statistics_on_conn(conn: &Connection) -> Result<Statistics, String> {
    let today = Utc::now().format("%Y-%m-%d").to_string();

    let today_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status='active' AND due_date=?1",
            rusqlite::params![today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let overdue_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status='active' AND due_date IS NOT NULL AND due_date < ?1",
            rusqlite::params![today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let week_start = Utc::now()
        .date_naive()
        .checked_sub_days(chrono::Days::new(6))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();

    let completed_week: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status='completed' AND completed_at >= ?1",
            rusqlite::params![week_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_week = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE created_at >= ?1 OR (completed_at >= ?1)",
            rusqlite::params![week_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let weekly_completion_rate = if total_week > 0 {
        completed_week as f64 / total_week as f64
    } else {
        0.0
    };

    let week_start_date = Utc::now()
        .date_naive()
        .checked_sub_days(chrono::Days::new(6))
        .unwrap();
    let week_end_date = Utc::now().date_naive();
    let ws = week_start_date.format("%Y-%m-%d").to_string();
    let we = week_end_date.succ_opt().unwrap().format("%Y-%m-%d").to_string();

    let mut daily_map: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DATE(completed_at) AS d, COUNT(*)
             FROM tasks
             WHERE status='completed' AND completed_at >= ?1 AND completed_at < ?2
             GROUP BY d",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map(rusqlite::params![ws, we], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
        }).map_err(|e| e.to_string())? {
            let (d, c) = row.map_err(|e| e.to_string())?;
            daily_map.insert(d, c);
        }
    }

    let mut daily_counts = vec![];
    for i in (0..7).rev() {
        let d = Utc::now()
            .date_naive()
            .checked_sub_days(chrono::Days::new(i as u64))
            .unwrap();
        let date_str = d.format("%Y-%m-%d").to_string();
        let completed = *daily_map.get(&date_str).unwrap_or(&0);
        daily_counts.push(DailyCount {
            date: date_str,
            completed,
        });
    }

    Ok(Statistics {
        today_count,
        overdue_count,
        weekly_completion_rate,
        daily_counts,
    })
}

#[tauri::command]
pub fn get_stats_panel(
    state: State<DbState>,
    heatmap_days: Option<i32>,
) -> Result<StatsPanelData, String> {
    let conn = lock_conn(&state)?;
    let days = heatmap_days.unwrap_or(7);
    Ok(StatsPanelData {
        statistics: statistics_on_conn(&conn)?,
        weekly_accuracy: weekly_accuracy_on_conn(&conn)?,
        focus_heatmap: focus_heatmap_on_conn(&conn, days)?,
    })
}
