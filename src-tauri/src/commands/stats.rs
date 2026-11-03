use crate::commands::analytics::{focus_heatmap_on_conn, weekly_accuracy_on_conn, FocusHeatmapEntry, WeeklyAccuracy};
use crate::db::{lock_conn, DbState};
use crate::models::{DailyCount, Statistics};
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
    let today = crate::time::local_today_date();
    let overdue_pred = crate::agenda::overdue_active_predicate("", "?1");

    let today_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status='active' AND substr(due_date,1,10)=?1",
            rusqlite::params![today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let overdue_count: i32 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM tasks WHERE status='active' AND {overdue_pred}"),
            rusqlite::params![today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let (week_start, tomorrow) = crate::agenda::local_last_n_days_window(7);
    let (range_start, range_end) = crate::agenda::local_range_bounds(week_start, tomorrow)?;

    let completed_week: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE completed_at IS NOT NULL AND completed_at >= ?1 AND completed_at < ?2",
            rusqlite::params![range_start, range_end],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_week = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE (created_at >= ?1 AND created_at < ?2) OR (completed_at >= ?1 AND completed_at < ?2)",
            rusqlite::params![range_start, range_end],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let weekly_completion_rate = if total_week > 0 {
        completed_week as f64 / total_week as f64
    } else {
        0.0
    };

    let mut daily_map: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT completed_at FROM tasks
             WHERE completed_at IS NOT NULL AND completed_at >= ?1 AND completed_at < ?2",
        ).map_err(|e| e.to_string())?;
        for row in stmt.query_map(rusqlite::params![range_start, range_end], |r| {
            r.get::<_, String>(0)
        }).map_err(|e| e.to_string())? {
            let ts = row.map_err(|e| e.to_string())?;
            if let Some(d) = crate::agenda::rfc3339_to_local_date(&ts) {
                *daily_map.entry(d).or_insert(0) += 1;
            }
        }
    }

    let mut daily_counts = vec![];
    let mut cursor = week_start;
    while cursor < tomorrow {
        let date_str = crate::agenda::format_calendar_date(cursor);
        let completed = *daily_map.get(&date_str).unwrap_or(&0);
        daily_counts.push(DailyCount {
            date: date_str,
            completed,
        });
        cursor = cursor.succ_opt().ok_or_else(|| "date overflow".to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::tasks::{
        archive_task_on_conn, complete_task_on_conn, create_task_on_conn, CreateTaskInput,
    };
    use crate::db;
    use rusqlite::Connection;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::init_db(&c).unwrap();
        c
    }

    fn create(conn: &Connection, title: &str, due: Option<String>, rule: Option<String>) -> i64 {
        create_task_on_conn(
            conn,
            CreateTaskInput {
                title: title.into(),
                description: None,
                priority: None,
                due_date: due,
                category_id: None,
                recurrence_rule: rule,
                estimated_minutes: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn archived_completed_task_still_in_daily_counts() {
        let conn = conn();
        let today = crate::time::local_today_date();
        let id = create(&conn, "办完归档", Some(today.clone()), None);
        complete_task_on_conn(&conn, id).unwrap();
        archive_task_on_conn(&conn, id).unwrap();

        let stats = statistics_on_conn(&conn).unwrap();
        let week_completed: i32 = stats.daily_counts.iter().map(|d| d.completed).sum();
        assert_eq!(week_completed, 1, "归档不抹历史：已完成任务归档后仍计入完成趋势");
        assert!(stats.weekly_completion_rate > 0.0);
    }

    #[test]
    fn recurrence_instances_each_counted_once() {
        let conn = conn();
        let today = crate::time::local_today_date();
        let rule = r#"{"freq":"daily","interval":1,"end_type":"count","end_count":2}"#.to_string();
        let root = create(&conn, "重复计数", Some(today), Some(rule));
        complete_task_on_conn(&conn, root).unwrap();
        let child: i64 = conn
            .query_row(
                "SELECT id FROM tasks WHERE recurrence_parent_id=?1",
                [root],
                |r| r.get(0),
            )
            .unwrap();
        complete_task_on_conn(&conn, child).unwrap();

        let stats = statistics_on_conn(&conn).unwrap();
        let week_completed: i32 = stats.daily_counts.iter().map(|d| d.completed).sum();
        assert_eq!(week_completed, 2, "复发链每个实例各计一次完成");
    }
}
