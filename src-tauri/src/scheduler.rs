use crate::commands::desktop_panel::panel_counts_on_conn;
use chrono::{DateTime, Days, Local, NaiveDate, Timelike};
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

/// Catch-up window: send once the local clock has passed the target time and
/// today's marker has not been written (covers sleep / 60s loop drift).
pub fn should_send_daily_summary(
    now: DateTime<Local>,
    target_hhmm: &str,
    already_sent: bool,
) -> bool {
    if already_sent {
        return false;
    }
    let parts: Vec<&str> = target_hhmm.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let Ok(hour) = parts[0].parse::<u32>() else {
        return false;
    };
    let Ok(minute) = parts[1].parse::<u32>() else {
        return false;
    };
    if hour > 23 || minute > 59 {
        return false;
    }
    let now_mins = now.hour() * 60 + now.minute();
    now_mins >= hour * 60 + minute
}

fn prune_notify_daily_sent(conn: &Connection, today: NaiveDate) {
    let cutoff = today - Days::new(7);
    let mut stmt = match conn.prepare("SELECT key FROM settings WHERE key LIKE 'notify_daily_sent_%'") {
        Ok(s) => s,
        Err(e) => {
            log::warn!("failed to list daily summary keys: {e}");
            return;
        }
    };
    let keys: Vec<String> = match stmt.query_map([], |row| row.get(0)) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(e) => {
            log::warn!("failed to read daily summary keys: {e}");
            return;
        }
    };
    drop(stmt);
    for key in keys {
        let Some(date_str) = key.strip_prefix("notify_daily_sent_") else {
            continue;
        };
        if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if d < cutoff {
                if let Err(e) = conn.execute("DELETE FROM settings WHERE key=?1", [&key]) {
                    log::warn!("failed to prune {key}: {e}");
                }
            }
        }
    }
}

fn maybe_daily_summary(app: &AppHandle, conn: &Connection) {
    if !setting_bool(conn, crate::db::settings_keys::NOTIFY_DAILY_SUMMARY, true) {
        return;
    }
    let time = setting_str(conn, crate::db::settings_keys::NOTIFY_DAILY_TIME, "08:00");
    let now = Local::now();
    let today = now.date_naive();
    prune_notify_daily_sent(conn, today);

    let today_key = format!("notify_daily_sent_{}", today.format("%Y-%m-%d"));
    let already = setting_bool(conn, &today_key, false);
    if !should_send_daily_summary(now, &time, already) {
        return;
    }
    if let Err(e) = crate::db::set_setting(conn, &today_key, "true") {
        log::warn!("failed to mark daily summary sent: {e}");
    }

    let (today_n, overdue_n) = match panel_counts_on_conn(conn) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("daily summary counts failed: {e}");
            (0, 0)
        }
    };

    if let Err(e) = app
        .notification()
        .builder()
        .title("Docket · 今日概览")
        .body(format!("今日 {today_n} 项，逾期 {overdue_n} 项"))
        .show()
    {
        log::warn!("daily summary notification failed: {e}");
    }
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
        Err(e) => {
            log::warn!("overdue reminder counts failed: {e}");
            return;
        }
    };
    if overdue_n == 0 {
        return;
    }
    let _ = crate::db::set_setting(conn, "notify_overdue_last_at", &now.to_string());
    let _ = app
        .notification()
        .builder()
        .title("Docket · 逾期提醒")
        .body(overdue_reminder_body(overdue_n))
        .show();
}

pub fn overdue_reminder_body(count: usize) -> String {
    format!("你有 {count} 项已逾期")
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
            Err(e) => {
                log::warn!("prepare due reminders failed: {e}");
                return;
            }
        };

        let result = stmt.query_map(rusqlite::params![now], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        });

        match result {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(e) => {
                log::warn!("query due reminders failed: {e}");
                return;
            }
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
            Err(_) => {
                log::warn!("scheduler database lock poisoned");
                continue;
            }
        };

        process_reminders(&app, &conn);
        maybe_daily_summary(&app, &conn);
        maybe_overdue_reminder(&app, &conn);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn local_at(hour: u32, minute: u32) -> DateTime<Local> {
        Local
            .with_ymd_and_hms(2026, 10, 28, hour, minute, 0)
            .single()
            .expect("valid local time")
    }

    #[test]
    fn daily_summary_catch_up_after_target() {
        assert!(should_send_daily_summary(local_at(8, 0), "08:00", false));
        assert!(should_send_daily_summary(local_at(8, 1), "08:00", false));
        assert!(should_send_daily_summary(local_at(18, 0), "08:00", false));
        assert!(!should_send_daily_summary(local_at(7, 59), "08:00", false));
        assert!(!should_send_daily_summary(local_at(18, 0), "08:00", true));
        assert!(!should_send_daily_summary(local_at(8, 0), "bad", false));
    }

    #[test]
    fn overdue_reminder_body_omits_task_word() {
        let body = overdue_reminder_body(3);
        assert!(body.contains("3 项已逾期"));
        assert!(!body.contains("任务"));
    }
}
