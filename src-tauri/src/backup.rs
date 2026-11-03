//! Daily startup snapshots: VACUUM INTO a timestamped copy, keep the newest N.
//!
//! Backups live next to `docket.db` in `backups/` and contain only the database;
//! evidence files referenced by matter steps are never copied.

use chrono::{Local, NaiveDate};
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

const AUTO_BACKUP_KEEP: usize = 14;

pub fn auto_backup_on_start(
    db_path: &Path,
    app_data_dir: &Path,
) -> Result<Option<PathBuf>, String> {
    auto_backup_on_date(db_path, app_data_dir, Local::now().date_naive())
}

fn auto_backup_on_date(
    db_path: &Path,
    app_data_dir: &Path,
    today: NaiveDate,
) -> Result<Option<PathBuf>, String> {
    let dir = app_data_dir.join("backups");
    fs::create_dir_all(&dir).map_err(|e| format!("创建备份目录失败: {e}"))?;
    cleanup_stale_temps(&dir);

    let stamp = today.format("%Y%m%d").to_string();
    let dest = dir.join(format!("docket-auto-{stamp}.db"));
    let tmp = dir.join(format!(".docket-auto-{stamp}.tmp"));

    // A crashed run can leave a temp file behind; never let it block today's
    // backup. A zero-byte destination is also treated as unusable.
    if tmp.exists() {
        let _ = fs::remove_file(&tmp);
    }
    if dest.exists() {
        let healthy = fs::metadata(&dest).map(|m| m.len() > 0).unwrap_or(false);
        if healthy {
            if let Err(e) = prune_auto_backups(&dir, AUTO_BACKUP_KEEP) {
                log::warn!("auto backup prune failed: {e}");
            }
            return Ok(None);
        }
        let _ = fs::remove_file(&dest);
    }

    let conn = Connection::open(db_path).map_err(|e| format!("打开数据库失败: {e}"))?;
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|e| format!("设置备份超时失败: {e}"))?;
    if let Err(e) = conn.execute("VACUUM INTO ?1", [tmp.display().to_string()]) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("自动备份失败: {e}"));
    }
    drop(conn);

    if let Err(e) = fs::rename(&tmp, &dest) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("自动备份落盘失败: {e}"));
    }
    if let Err(e) = prune_auto_backups(&dir, AUTO_BACKUP_KEEP) {
        log::warn!("auto backup prune failed: {e}");
    }
    Ok(Some(dest))
}

fn cleanup_stale_temps(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !(name.starts_with(".docket-auto-") && name.ends_with(".tmp")) {
            continue;
        }
        let stale = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .map(|age| age.as_secs() > 3600)
            .unwrap_or(false);
        if stale {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn prune_auto_backups(dir: &Path, keep: usize) -> Result<(), String> {
    let mut names = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("读取备份目录失败: {e}"))? {
        let entry = entry.map_err(|e| format!("读取备份条目失败: {e}"))?;
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("docket-auto-") && name.ends_with(".db") {
            names.push(name);
        }
    }
    names.sort();
    names.reverse();
    for name in names.into_iter().skip(keep) {
        let _ = fs::remove_file(dir.join(name));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "docket-backup-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn init_db_file(path: &Path) {
        let conn = Connection::open(path).unwrap();
        db::init_db(&conn).unwrap();
        db::set_setting(&conn, "backup_test_key", "42").unwrap();
    }

    fn auto_files(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
            .filter(|n| n.starts_with("docket-auto-") && n.ends_with(".db"))
            .collect();
        names.sort();
        names
    }

    #[test]
    fn auto_backup_creates_one_snapshot_per_day() {
        let dir = temp_dir("one");
        let db_path = dir.join("docket.db");
        init_db_file(&db_path);
        let today = NaiveDate::from_ymd_opt(2026, 5, 15).unwrap();

        let first = auto_backup_on_date(&db_path, &dir, today).unwrap();
        assert!(first.is_some());
        let second = auto_backup_on_date(&db_path, &dir, today).unwrap();
        assert!(second.is_none());
        assert_eq!(auto_files(&dir.join("backups")).len(), 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn auto_backup_snapshot_is_readable() {
        let dir = temp_dir("readable");
        let db_path = dir.join("docket.db");
        init_db_file(&db_path);
        let today = NaiveDate::from_ymd_opt(2026, 5, 15).unwrap();

        let snapshot = auto_backup_on_date(&db_path, &dir, today)
            .unwrap()
            .expect("snapshot");
        let conn = Connection::open(&snapshot).unwrap();
        assert_eq!(
            db::get_setting(&conn, "backup_test_key").as_deref(),
            Some("42")
        );
        drop(conn);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_keeps_newest_fourteen_and_ignores_manual() {
        let dir = temp_dir("prune");
        let backups = dir.join("backups");
        fs::create_dir_all(&backups).unwrap();
        for day in 1..=16 {
            fs::write(
                backups.join(format!("docket-auto-202605{day:02}.db")),
                b"x",
            )
            .unwrap();
        }
        fs::write(backups.join("docket-manual.db"), b"keep").unwrap();

        prune_auto_backups(&backups, AUTO_BACKUP_KEEP).unwrap();

        let names = auto_files(&backups);
        assert_eq!(names.len(), 14);
        assert!(names.contains(&"docket-auto-20260503.db".to_string()));
        assert!(names.contains(&"docket-auto-20260516.db".to_string()));
        assert!(backups.join("docket-manual.db").exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
