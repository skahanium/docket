use crate::error::{AppError, AppResult};
use chrono::Datelike;
use rusqlite::{Connection, Result as SqlResult};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

pub struct DbState(pub Mutex<Connection>);

pub fn lock_conn(state: &DbState) -> AppResult<MutexGuard<'_, Connection>> {
    state.0.lock().map_err(|_| AppError::LockPoisoned)
}

pub fn get_db_path(app_data_dir: &PathBuf) -> PathBuf {
    let _ = fs::create_dir_all(app_data_dir);
    app_data_dir.join("docket.db")
}

pub mod settings_keys {
    pub const WORK_START_AM: &str = "work_start_am";
    pub const WORK_END_AM: &str = "work_end_am";
    pub const WORK_START_PM: &str = "work_start_pm";
    pub const WORK_END_PM: &str = "work_end_pm";
    pub const DEFAULT_FOCUS_MINUTES: &str = "default_focus_minutes";
    pub const NOTIFY_DAILY_SUMMARY: &str = "notify_daily_summary";
    pub const NOTIFY_DAILY_TIME: &str = "notify_daily_time";
    pub const NOTIFY_OVERDUE: &str = "notify_overdue";
    pub const NOTIFY_OVERDUE_INTERVAL_MINUTES: &str = "notify_overdue_interval_minutes";
    pub const PANEL_X: &str = "panel_x";
    pub const PANEL_Y: &str = "panel_y";
    pub const PANEL_WIDTH: &str = "panel_width";
    pub const PANEL_HEIGHT: &str = "panel_height";
    pub const PANEL_VISIBLE: &str = "panel_visible";
    pub const PANEL_OPAQUE: &str = "panel_opaque";
    pub const PANEL_ALWAYS_ON_TOP: &str = "panel_always_on_top";
    pub const PANEL_REFRESH_SECONDS: &str = "panel_refresh_seconds";
}

pub mod task_status {
    pub const ACTIVE: &str = "active";
    pub const COMPLETED: &str = "completed";
    pub const ARCHIVED: &str = "archived";
}

pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    // Create _migrations table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version   INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );"
    )?;

    let current_version: i32 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM _migrations", [], |row| row.get(0))
        .unwrap_or(0);

    // Version 0 (base schema)
    if current_version < 1 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS categories (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT UNIQUE NOT NULL,
                color      TEXT,
                parent_id  INTEGER,
                FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT UNIQUE NOT NULL,
                color TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                title                 TEXT NOT NULL,
                description           TEXT,
                status                TEXT NOT NULL DEFAULT 'active',
                priority              INTEGER NOT NULL DEFAULT 0,
                due_date              TEXT,
                category_id           INTEGER,
                recurrence_rule       TEXT,
                recurrence_parent_id  INTEGER,
                created_at            TEXT NOT NULL,
                updated_at            TEXT NOT NULL,
                completed_at          TEXT,
                archived_at           TEXT,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (recurrence_parent_id) REFERENCES tasks(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER NOT NULL,
                tag_id  INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS subtasks (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id       INTEGER NOT NULL,
                title         TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',
                sort_order    INTEGER NOT NULL DEFAULT 0,
                created_at    TEXT NOT NULL,
                completed_at  TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reminders (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id   INTEGER NOT NULL,
                remind_at TEXT NOT NULL,
                notified  INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );"
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute("INSERT INTO _migrations (version, applied_at) VALUES (1, ?1)", [&now])?;
    }

    // Version 2: Task time estimation, focus sessions, settings, holidays
    if current_version < 2 {
        conn.execute_batch(
            "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id          INTEGER NOT NULL,
                started_at       TEXT NOT NULL,
                ended_at         TEXT,
                duration_minutes INTEGER,
                completed        INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS holidays (
                date TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );"
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute("INSERT INTO _migrations (version, applied_at) VALUES (2, ?1)", [&now])?;
    }

    // Version 3: Schedule entries
    if current_version < 3 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schedule_entries (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id          INTEGER NOT NULL,
                date             TEXT NOT NULL,
                start_time       TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 30,
                sort_order       INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );"
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute("INSERT INTO _migrations (version, applied_at) VALUES (3, ?1)", [&now])?;
    }

    // Version 4: Query indexes for list/filter hot paths
    if current_version < 4 {
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
             CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
             CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
             CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date);
             CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
             CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
             CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
             CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, notified);
             CREATE INDEX IF NOT EXISTS idx_schedule_entries_date ON schedule_entries(date);
             CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id);",
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute("INSERT INTO _migrations (version, applied_at) VALUES (4, ?1)", [&now])?;
    }

    Ok(())
}

pub fn seed_defaults(conn: &Connection) -> SqlResult<()> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
        .unwrap_or(0);

    if count == 0 {
        conn.execute(
            "INSERT INTO categories (name, color) VALUES (?1, ?2)",
            ["工作", "#0070F3"],
        )?;
        conn.execute(
            "INSERT INTO categories (name, color) VALUES (?1, ?2)",
            ["个人", "#10B981"],
        )?;
    }

    // Seed default settings
    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
        .unwrap_or(0);

    if settings_count == 0 {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('work_start_am', '08:30')",
            [],
        )?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('work_end_am', '12:00')",
            [],
        )?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('work_start_pm', '14:30')",
            [],
        )?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('work_end_pm', '18:00')",
            [],
        )?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('default_focus_minutes', '45')",
            [],
        )?;
    }

    for (key, value) in [
        (settings_keys::PANEL_OPAQUE, "0"),
        (settings_keys::PANEL_ALWAYS_ON_TOP, "0"),
        (settings_keys::PANEL_REFRESH_SECONDS, "120"),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
    }

    // Seed holidays for 2024-2030 (mainland China)
    let holiday_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM holidays", [], |row| row.get(0))
        .unwrap_or(0);

    if holiday_count == 0 {
        let holidays = HOLIDAY_SEED;
        for &(date, name) in holidays {
            conn.execute(
                "INSERT OR IGNORE INTO holidays (date, name) VALUES (?1, ?2)",
                [date, name],
            )?;
        }
    }

    Ok(())
}

pub fn check_integrity(conn: &Connection) -> SqlResult<bool> {
    let result: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    Ok(result == "ok")
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key=?1",
        [key],
        |row| row.get(0),
    ).ok()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, value],
    )?;
    Ok(())
}

/// Monday–Friday dates that are not listed in `holidays`.
pub fn is_workday(conn: &Connection, date: &str) -> bool {
    let is_holiday: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM holidays WHERE date=?1",
            [date],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if is_holiday {
        return false;
    }
    let Ok(parsed) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") else {
        return true;
    };
    let weekday = parsed.weekday().num_days_from_monday();
    weekday < 5
}

/// Seed holiday data for mainland China 2024-2030
const HOLIDAY_SEED: &[(&str, &str)] = &[
    // 2024
    ("2024-01-01", "元旦"),
    ("2024-02-10", "春节"),
    ("2024-02-11", "春节"),
    ("2024-02-12", "春节"),
    ("2024-02-13", "春节"),
    ("2024-02-14", "春节"),
    ("2024-02-15", "春节"),
    ("2024-02-16", "春节"),
    ("2024-04-04", "清明节"),
    ("2024-04-05", "清明节"),
    ("2024-04-06", "清明节"),
    ("2024-05-01", "劳动节"),
    ("2024-05-02", "劳动节"),
    ("2024-05-03", "劳动节"),
    ("2024-05-04", "劳动节"),
    ("2024-05-05", "劳动节"),
    ("2024-06-10", "端午节"),
    ("2024-09-15", "中秋节"),
    ("2024-09-16", "中秋节"),
    ("2024-09-17", "中秋节"),
    ("2024-10-01", "国庆节"),
    ("2024-10-02", "国庆节"),
    ("2024-10-03", "国庆节"),
    ("2024-10-04", "国庆节"),
    ("2024-10-05", "国庆节"),
    ("2024-10-06", "国庆节"),
    ("2024-10-07", "国庆节"),
    // 2025
    ("2025-01-01", "元旦"),
    ("2025-01-28", "春节"),
    ("2025-01-29", "春节"),
    ("2025-01-30", "春节"),
    ("2025-01-31", "春节"),
    ("2025-02-01", "春节"),
    ("2025-02-02", "春节"),
    ("2025-02-03", "春节"),
    ("2025-02-04", "春节"),
    ("2025-04-04", "清明节"),
    ("2025-04-05", "清明节"),
    ("2025-04-06", "清明节"),
    ("2025-05-01", "劳动节"),
    ("2025-05-02", "劳动节"),
    ("2025-05-03", "劳动节"),
    ("2025-05-04", "劳动节"),
    ("2025-05-05", "劳动节"),
    ("2025-05-31", "端午节"),
    ("2025-06-01", "端午节"),
    ("2025-06-02", "端午节"),
    ("2025-10-01", "中秋节"),
    ("2025-10-02", "中秋节"),
    ("2025-10-03", "中秋节"),
    ("2025-10-04", "中秋节"),
    ("2025-10-05", "中秋节"),
    ("2025-10-06", "中秋节"),
    ("2025-10-07", "国庆节"),
    ("2025-10-08", "国庆节"),
    // 2026
    ("2026-01-01", "元旦"),
    ("2026-01-02", "元旦"),
    ("2026-01-03", "元旦"),
    ("2026-02-17", "春节"),
    ("2026-02-18", "春节"),
    ("2026-02-19", "春节"),
    ("2026-02-20", "春节"),
    ("2026-02-21", "春节"),
    ("2026-02-22", "春节"),
    ("2026-02-23", "春节"),
    ("2026-04-05", "清明节"),
    ("2026-04-06", "清明节"),
    ("2026-04-07", "清明节"),
    ("2026-05-01", "劳动节"),
    ("2026-05-02", "劳动节"),
    ("2026-05-03", "劳动节"),
    ("2026-05-04", "劳动节"),
    ("2026-05-05", "劳动节"),
    ("2026-06-19", "端午节"),
    ("2026-06-20", "端午节"),
    ("2026-06-21", "端午节"),
    ("2026-09-25", "中秋节"),
    ("2026-09-26", "中秋节"),
    ("2026-09-27", "中秋节"),
    ("2026-10-01", "国庆节"),
    ("2026-10-02", "国庆节"),
    ("2026-10-03", "国庆节"),
    ("2026-10-04", "国庆节"),
    ("2026-10-05", "国庆节"),
    ("2026-10-06", "国庆节"),
    ("2026-10-07", "国庆节"),
    // 2027
    ("2027-01-01", "元旦"),
    ("2027-02-06", "春节"),
    ("2027-02-07", "春节"),
    ("2027-02-08", "春节"),
    ("2027-02-09", "春节"),
    ("2027-02-10", "春节"),
    ("2027-02-11", "春节"),
    ("2027-02-12", "春节"),
    ("2027-04-05", "清明节"),
    ("2027-05-01", "劳动节"),
    ("2027-05-02", "劳动节"),
    ("2027-05-03", "劳动节"),
    ("2027-06-09", "端午节"),
    ("2027-09-15", "中秋节"),
    ("2027-10-01", "国庆节"),
    ("2027-10-02", "国庆节"),
    ("2027-10-03", "国庆节"),
    ("2027-10-04", "国庆节"),
    ("2027-10-05", "国庆节"),
    ("2027-10-06", "国庆节"),
    ("2027-10-07", "国庆节"),
    // 2028
    ("2028-01-01", "元旦"),
    ("2028-01-26", "春节"),
    ("2028-01-27", "春节"),
    ("2028-01-28", "春节"),
    ("2028-01-29", "春节"),
    ("2028-01-30", "春节"),
    ("2028-01-31", "春节"),
    ("2028-02-01", "春节"),
    ("2028-04-04", "清明节"),
    ("2028-04-05", "清明节"),
    ("2028-05-01", "劳动节"),
    ("2028-05-02", "劳动节"),
    ("2028-05-03", "劳动节"),
    ("2028-05-28", "端午节"),
    ("2028-10-03", "中秋节"),
    ("2028-10-01", "国庆节"),
    ("2028-10-02", "国庆节"),
    ("2028-10-03", "国庆节"),
    ("2028-10-04", "国庆节"),
    ("2028-10-05", "国庆节"),
    ("2028-10-06", "国庆节"),
    ("2028-10-07", "国庆节"),
    // 2029
    ("2029-01-01", "元旦"),
    ("2029-02-13", "春节"),
    ("2029-02-14", "春节"),
    ("2029-02-15", "春节"),
    ("2029-02-16", "春节"),
    ("2029-02-17", "春节"),
    ("2029-02-18", "春节"),
    ("2029-02-19", "春节"),
    ("2029-04-05", "清明节"),
    ("2029-05-01", "劳动节"),
    ("2029-05-02", "劳动节"),
    ("2029-05-03", "劳动节"),
    ("2029-06-16", "端午节"),
    ("2029-09-22", "中秋节"),
    ("2029-10-01", "国庆节"),
    ("2029-10-02", "国庆节"),
    ("2029-10-03", "国庆节"),
    ("2029-10-04", "国庆节"),
    ("2029-10-05", "国庆节"),
    ("2029-10-06", "国庆节"),
    ("2029-10-07", "国庆节"),
    // 2030
    ("2030-01-01", "元旦"),
    ("2030-02-03", "春节"),
    ("2030-02-04", "春节"),
    ("2030-02-05", "春节"),
    ("2030-02-06", "春节"),
    ("2030-02-07", "春节"),
    ("2030-02-08", "春节"),
    ("2030-02-09", "春节"),
    ("2030-04-05", "清明节"),
    ("2030-05-01", "劳动节"),
    ("2030-05-02", "劳动节"),
    ("2030-05-03", "劳动节"),
    ("2030-06-05", "端午节"),
    ("2030-09-12", "中秋节"),
    ("2030-10-01", "国庆节"),
    ("2030-10-02", "国庆节"),
    ("2030-10-03", "国庆节"),
    ("2030-10-04", "国庆节"),
    ("2030-10-05", "国庆节"),
    ("2030-10-06", "国庆节"),
    ("2030-10-07", "国庆节"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn test_init_db_creates_tables() {
        let conn = test_conn();
        init_db(&conn).unwrap();

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"categories".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"tasks".to_string()));
        assert!(tables.contains(&"task_tags".to_string()));
        assert!(tables.contains(&"subtasks".to_string()));
        assert!(tables.contains(&"reminders".to_string()));
        assert!(tables.contains(&"focus_sessions".to_string()));
        assert!(tables.contains(&"settings".to_string()));
        assert!(tables.contains(&"holidays".to_string()));
        assert!(tables.contains(&"schedule_entries".to_string()));
        assert!(tables.contains(&"_migrations".to_string()));
    }

    #[test]
    fn test_migration_v4_creates_indexes() {
        let conn = test_conn();
        init_db(&conn).unwrap();

        let indexes: Vec<String> = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
            )
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(indexes.contains(&"idx_tasks_status".to_string()));
        assert!(indexes.contains(&"idx_task_tags_task_id".to_string()));
        assert!(indexes.contains(&"idx_subtasks_task_id".to_string()));
    }

    #[test]
    fn test_seed_defaults() {
        let conn = test_conn();
        init_db(&conn).unwrap();
        seed_defaults(&conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        seed_defaults(&conn).unwrap();
        let count2: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count2, 2);

        // Settings should be seeded
        let settings_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert!(settings_count >= 5);

        // Holidays should be seeded
        let holiday_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM holidays", [], |row| row.get(0))
            .unwrap();
        assert!(holiday_count > 0);
    }

    #[test]
    fn test_integrity_check() {
        let conn = test_conn();
        init_db(&conn).unwrap();
        assert!(check_integrity(&conn).unwrap());
    }

    #[test]
    fn test_is_workday() {
        let conn = test_conn();
        init_db(&conn).unwrap();

        assert!(is_workday(&conn, "2026-05-19")); // Tuesday
        assert!(!is_workday(&conn, "2026-05-16")); // Saturday

        conn.execute(
            "INSERT INTO holidays (date, name) VALUES ('2026-05-19', '调休')",
            [],
        )
        .unwrap();
        assert!(!is_workday(&conn, "2026-05-19"));
    }

    #[test]
    fn test_crud_basics() {
        let conn = test_conn();
        init_db(&conn).unwrap();

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO tasks (title, status, priority, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["测试任务", "active", "1", &now, &now],
        ).unwrap();

        let title: String = conn
            .query_row("SELECT title FROM tasks WHERE id=1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(title, "测试任务");

        conn.execute("UPDATE tasks SET title=?1 WHERE id=1", ["更新后的任务"]).unwrap();

        conn.execute("INSERT INTO subtasks (task_id, title, created_at) VALUES (1, '子任务', ?1)", [&now]).unwrap();
        conn.execute("DELETE FROM tasks WHERE id=1", []).unwrap();

        let sub_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM subtasks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(sub_count, 0);
    }
}