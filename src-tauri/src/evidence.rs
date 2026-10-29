//! Step evidence: store absolute paths only. Never copy or read file contents.

use crate::db::link_kind;
use crate::error::{AppError, AppResult};
use crate::models::MatterStepLink;
use rusqlite::{params, Connection};
use std::path::Path;

pub fn normalize_path(path: &str) -> AppResult<String> {
    let p = path.trim();
    if p.is_empty() {
        return Err(AppError::message("路径不能为空"));
    }
    if !Path::new(p).is_absolute() {
        return Err(AppError::message("请使用绝对路径"));
    }
    Ok(p.to_string())
}

pub fn normalize_kind(kind: &str) -> AppResult<String> {
    match kind {
        link_kind::FILE | link_kind::FOLDER => Ok(kind.to_string()),
        _ => Err(AppError::message("依据类型须为 file 或 folder")),
    }
}

pub fn path_exists(path: &str) -> bool {
    std::fs::metadata(path).is_ok()
}

pub fn add_step_link_on_conn(
    conn: &Connection,
    matter_step_id: i64,
    kind: &str,
    path: &str,
) -> AppResult<i64> {
    step_exists(conn, matter_step_id)?;
    let kind = normalize_kind(kind)?;
    let path = normalize_path(path)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO matter_step_links (matter_step_id, kind, path, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![matter_step_id, kind, path, now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn remove_step_link_on_conn(conn: &Connection, link_id: i64) -> AppResult<()> {
    let n = conn.execute(
        "DELETE FROM matter_step_links WHERE id=?1",
        params![link_id],
    )?;
    if n == 0 {
        return Err(AppError::message("依据不存在"));
    }
    Ok(())
}

pub fn get_step_link_on_conn(conn: &Connection, link_id: i64) -> AppResult<MatterStepLink> {
    conn.query_row(
        "SELECT id, matter_step_id, kind, path, created_at FROM matter_step_links WHERE id=?1",
        params![link_id],
        |row| {
            Ok(MatterStepLink {
                id: row.get(0)?,
                matter_step_id: row.get(1)?,
                kind: row.get(2)?,
                path: row.get(3)?,
                created_at: row.get(4)?,
                exists: false,
            })
        },
    )
    .map_err(|_| AppError::message("依据不存在"))
}

pub fn load_links_for_steps(
    conn: &Connection,
    step_ids: &[i64],
) -> AppResult<std::collections::HashMap<i64, Vec<MatterStepLink>>> {
    let mut map = std::collections::HashMap::new();
    if step_ids.is_empty() {
        return Ok(map);
    }
    let placeholders = step_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT id, matter_step_id, kind, path, created_at
         FROM matter_step_links WHERE matter_step_id IN ({placeholders})
         ORDER BY id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(step_ids.iter()), |row| {
        let path: String = row.get(3)?;
        Ok(MatterStepLink {
            id: row.get(0)?,
            matter_step_id: row.get(1)?,
            kind: row.get(2)?,
            exists: path_exists(&path),
            path,
            created_at: row.get(4)?,
        })
    })?;
    for row in rows {
        let link = row?;
        map.entry(link.matter_step_id).or_insert_with(Vec::new).push(link);
    }
    Ok(map)
}

pub fn missing_evidence(evidence_required: bool, link_count: usize) -> bool {
    evidence_required && link_count == 0
}

fn step_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM matter_steps WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    if n == 0 {
        return Err(AppError::message(format!("步骤不存在 (id={id})")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::matter::{
        complete_matter_step_on_conn, create_blank_matter_on_conn, get_matter_on_conn,
    };
    use crate::playbook::{create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn};
    use crate::models::PlaybookStepInput;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::init_db(&c).unwrap();
        c
    }

    #[test]
    fn rejects_empty_and_relative_paths() {
        assert!(normalize_path("").is_err());
        assert!(normalize_path("   ").is_err());
        assert!(normalize_path("relative/file.pdf").is_err());
    }

    #[test]
    fn accepts_absolute_temp_path() {
        let p = std::env::temp_dir();
        let s = p.to_string_lossy();
        assert!(normalize_path(&s).is_ok());
        assert!(path_exists(&s));
    }

    #[test]
    fn missing_evidence_does_not_block_complete() {
        let conn = conn();
        let pb = create_playbook_on_conn(&conn, "需依据").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[PlaybookStepInput {
                title: "归档".into(),
                optional: false,
                evidence_required: true,
                estimated_minutes: None,
            }],
        )
        .unwrap();
        let mid = instantiate_matter_on_conn(&conn, pb, "一件", 0, None, None).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert!(detail.steps[0].missing_evidence);
        complete_matter_step_on_conn(&conn, detail.steps[0].id).unwrap();
        let after = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(after.status, crate::db::matter_status::COMPLETED);
        assert!(after.steps[0].missing_evidence);
    }

    #[test]
    fn add_link_clears_missing_flag() {
        let conn = conn();
        let mid = create_blank_matter_on_conn(&conn, "空白", 0, None, None).unwrap();
        crate::matter::add_matter_step_on_conn(&conn, mid, "步", true, None, None).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert!(detail.steps[0].missing_evidence);
        let abs = std::env::temp_dir().to_string_lossy().to_string();
        add_step_link_on_conn(&conn, detail.steps[0].id, link_kind::FOLDER, &abs).unwrap();
        let after = get_matter_on_conn(&conn, mid).unwrap();
        assert!(!after.steps[0].missing_evidence);
        assert_eq!(after.steps[0].links.len(), 1);
    }
}
