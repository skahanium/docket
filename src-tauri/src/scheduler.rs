use crate::commands::desktop_panel::panel_counts_on_conn;
use chrono::Timelike;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

fn setting_bool(conn: &Connection, key: &str, default: bool) -> bool {
    crate::db::get_setting(conn, key)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(default)
}

fn setting_str(conn: &Connection, key: &str, default: &str) -> String {
    crate::db::get_setting(conn, key).unwrap_or_else(|| default.to_string())
}

fn maybe_daily_summary(app: &AppHandle, conn: &Connection) {
    if !setting_bool(conn, crate::db::settings_keys::NOTIFY_DAILY_SUMMARY, true) {
        return;
    }
    let time = setting_str(conn, crate::db::settings_keys::NOTIFY_DAILY_TIME, "08:00");
    let now = chrono::Local::now();
    let target: Vec<&str> = time.split(':').collect();
    if target.len() != 2 {
        return;
    }
    let hour: u32 = target[0].parse().unwrap_or(8);
    let minute: u32 = target[1].parse().unwrap_or(0);
    if now.hour() != hour || now.minute() != minute {
        return;
    }
    let today_key = format!("notify_daily_sent_{}", now.format("%Y-%m-%d"));
    if setting_bool(conn, &today_key, false) {
        return;
    }
    let _ = crate::db::set_setting(conn, &today_key, "true");

    let (today_n, overdue_n) = panel_counts_on_conn(conn).unwrap_or((0, 0));

    let _ = app
        .notification()
        .builder()
        .title("Docket · 今日概览")
        .body(format!("今日 {today_n} 项，逾期 {overdue_n} 项"))
        .show();
}

fn maybe_overdue_reminder(app: &AppHandle, conn: &Connection) {
    if !setting_bool(conn, crate::db::settings_keys::NOTIFY_OVERDUE, true) {
        return;
    }
    let interval = setting_str(conn, crate::db::settings_keys::NOTIFY_OVERDUE_INTERVAL_MINUTES, "60")
        .parse::<i64>()
        .unwrap_or(60)
        .max(15);
    let last = setting_str(conn, "notify_overdue_last_at", "");
    let now = chrono::Utc::now().timestamp();
    if let Ok(last_ts) = last.parse::<i64>() {
        if now - last_ts < interval * 60 {
            return;
        }
    }

    let (_, overdue_n) = match panel_counts_on_conn(conn) {
        Ok((_, o)) => (0, o),
        Err(_) => return,
    };
    if overdue_n == 0 {
        return;
    }
    let _ = crate::db::set_setting(conn, "notify_overdue_last_at", &now.to_string());
    let _ = app
        .notification()
        .builder()
        .title("Docket · 逾期提醒")
        .body(format!("你有 {overdue_n} 项任务已逾期"))
        .show();
}

fn process_reminders(app: &AppHandle, conn: &Connection) {
    let now = chrono::Utc::now().to_rfc3339();

    let due: Vec<(i64, String)> = {
        let mut stmt = match conn.prepare(
            "SELECT r.id, t.title FROM reminders r
                 INNER JOIN tasks t ON r.task_id = t.id
                 WHERE r.remind_at <= ?1 AND r.notified = 0
                 AND t.status = 'active'",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };

        let result = stmt.query_map(rusqlite::params![now], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        });

        match result {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(_) => return,
        }
    };

    for (reminder_id, task_title) in &due {
        if conn
            .execute(
                "UPDATE reminders SET notified=1 WHERE id=?1",
                rusqlite::params![reminder_id],
            )
            .is_ok()
        {
            let _ = app
                .notification()
                .builder()
                .title("Docket")
                .body(format!("提醒: {task_title}"))
                .show();
        }
    }
}

pub fn start_reminder_loop(app: AppHandle, db: Arc<Mutex<Connection>>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60));

        let conn = match db.lock() {
            Ok(c) => c,
            Err(_) => continue,
        };

        process_reminders(&app, &conn);
        maybe_daily_summary(&app, &conn);
        maybe_overdue_reminder(&app, &conn);
    });
}
