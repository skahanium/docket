//! Playbook templates and matter instantiation (copy steps in a transaction).

use crate::db::{matter_status, step_status};
use crate::error::{AppError, AppResult};
use crate::models::{Playbook, PlaybookStep, PlaybookStepInput};
use rusqlite::{params, Connection};

pub fn require_title(title: &str) -> AppResult<String> {
    let t = title.trim();
    if t.is_empty() {
        return Err(AppError::message("标题不能为空"));
    }
    Ok(t.to_string())
}

pub fn create_playbook_on_conn(conn: &Connection, title: &str) -> AppResult<i64> {
    let title = require_title(title)?;
    conn.execute("INSERT INTO playbooks (title) VALUES (?1)", params![title])?;
    Ok(conn.last_insert_rowid())
}

pub fn update_playbook_on_conn(
    conn: &Connection,
    id: i64,
    title: Option<&str>,
    archived: Option<bool>,
) -> AppResult<()> {
    playbook_exists(conn, id)?;
    if let Some(title) = title {
        let title = require_title(title)?;
        conn.execute(
            "UPDATE playbooks SET title=?1 WHERE id=?2",
            params![title, id],
        )?;
    }
    if let Some(archived) = archived {
        if archived {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE playbooks SET archived_at=?1 WHERE id=?2",
                params![now, id],
            )?;
        } else {
            conn.execute(
                "UPDATE playbooks SET archived_at=NULL WHERE id=?1",
                params![id],
            )?;
        }
    }
    Ok(())
}

pub fn playbook_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playbooks WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    if n == 0 {
        return Err(AppError::PlaybookNotFound { id });
    }
    Ok(())
}

pub fn set_playbook_steps_on_conn(
    conn: &Connection,
    playbook_id: i64,
    steps: &[PlaybookStepInput],
) -> AppResult<()> {
    playbook_exists(conn, playbook_id)?;
    for step in steps {
        require_title(&step.title)?;
    }
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM playbook_steps WHERE playbook_id=?1",
        params![playbook_id],
    )?;
    for (i, step) in steps.iter().enumerate() {
        tx.execute(
            "INSERT INTO playbook_steps
             (playbook_id, title, sort_order, optional, evidence_required, estimated_minutes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                playbook_id,
                step.title.trim(),
                i as i32,
                if step.optional { 1 } else { 0 },
                if step.evidence_required { 1 } else { 0 },
                step.estimated_minutes,
            ],
        )?;
    }
    tx.commit()?;
    Ok(())
}

fn load_steps(conn: &Connection, playbook_id: i64) -> AppResult<Vec<PlaybookStep>> {
    let mut stmt = conn.prepare(
        "SELECT id, playbook_id, title, sort_order, optional, evidence_required, estimated_minutes
         FROM playbook_steps WHERE playbook_id=?1 ORDER BY sort_order ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![playbook_id], |row| {
        Ok(PlaybookStep {
            id: row.get(0)?,
            playbook_id: row.get(1)?,
            title: row.get(2)?,
            sort_order: row.get(3)?,
            optional: row.get::<_, i32>(4)? != 0,
            evidence_required: row.get::<_, i32>(5)? != 0,
            estimated_minutes: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn get_playbook_on_conn(conn: &Connection, id: i64) -> AppResult<Playbook> {
    let (title, archived_at): (String, Option<String>) = conn
        .query_row(
            "SELECT title, archived_at FROM playbooks WHERE id=?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| AppError::PlaybookNotFound { id })?;
    Ok(Playbook {
        id,
        title,
        archived_at,
        steps: load_steps(conn, id)?,
    })
}

pub fn list_playbooks_on_conn(conn: &Connection, include_archived: bool) -> AppResult<Vec<Playbook>> {
    let sql = if include_archived {
        "SELECT id FROM playbooks ORDER BY id DESC"
    } else {
        "SELECT id FROM playbooks WHERE archived_at IS NULL ORDER BY id DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let ids: Vec<i64> = stmt
        .query_map([], |r| r.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        out.push(get_playbook_on_conn(conn, id)?);
    }
    Ok(out)
}

/// Copy playbook steps onto a new matter. Rolls back if any insert fails.
pub fn instantiate_matter_on_conn(
    conn: &Connection,
    playbook_id: i64,
    title: &str,
    priority: i32,
    category_id: Option<i64>,
    due_date: Option<&str>,
) -> AppResult<i64> {
    playbook_exists(conn, playbook_id)?;
    let title = require_title(title)?;
    if let Some(d) = due_date {
        crate::agenda::parse_calendar_date(d).map_err(AppError::InvalidDate)?;
    }
    let steps = load_steps(conn, playbook_id)?;
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO matters
         (playbook_id, title, status, priority, category_id, due_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            playbook_id,
            title,
            matter_status::ACTIVE,
            priority,
            category_id,
            due_date,
            now,
        ],
    )?;
    let matter_id = tx.last_insert_rowid();
    for step in steps {
        tx.execute(
            "INSERT INTO matter_steps
             (matter_id, playbook_step_id, title, sort_order, evidence_required, status, estimated_minutes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                matter_id,
                step.id,
                step.title,
                step.sort_order,
                if step.evidence_required { 1 } else { 0 },
                step_status::PENDING,
                step.estimated_minutes,
            ],
        )?;
    }
    tx.commit()?;
    Ok(matter_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::matter::{complete_matter_step_on_conn, current_pending_step, get_matter_on_conn};

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::init_db(&c).unwrap();
        c
    }

    #[test]
    fn instantiate_copies_steps_and_evidence_required() {
        let conn = conn();
        let pb = create_playbook_on_conn(&conn, "立案").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[
                PlaybookStepInput {
                    title: "收材料".into(),
                    optional: false,
                    evidence_required: true,
                    estimated_minutes: Some(30),
                },
                PlaybookStepInput {
                    title: "审查".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
            ],
        )
        .unwrap();

        let mid = instantiate_matter_on_conn(&conn, pb, "张三案", 1, None, None).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(detail.playbook_id, Some(pb));
        assert_eq!(detail.steps.len(), 2);
        assert_eq!(detail.steps[0].title, "收材料");
        assert!(detail.steps[0].evidence_required);
        assert!(!detail.steps[1].evidence_required);
        assert_eq!(detail.steps[0].playbook_step_id, Some(1));
    }

    #[test]
    fn instantiate_preserves_saved_step_order() {
        let conn = conn();
        let pb = create_playbook_on_conn(&conn, "倒序").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[
                PlaybookStepInput {
                    title: "A".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
                PlaybookStepInput {
                    title: "B".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
            ],
        )
        .unwrap();
        // Insertion order is A then B (A has smaller id). Reverse sort_order so B is first.
        conn.execute(
            "UPDATE playbook_steps SET sort_order = CASE title
               WHEN 'B' THEN 0 WHEN 'A' THEN 1 ELSE sort_order END
             WHERE playbook_id=?1",
            rusqlite::params![pb],
        )
        .unwrap();
        let mid = instantiate_matter_on_conn(&conn, pb, "事", 0, None, None).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(detail.steps[0].title, "B");
        assert_eq!(detail.steps[0].sort_order, 0);
        assert_eq!(detail.steps[1].title, "A");
        assert_eq!(detail.steps[1].sort_order, 1);
        assert!(
            detail.steps[0].playbook_step_id.unwrap() > detail.steps[1].playbook_step_id.unwrap(),
            "B 后插入、id 更大，必须靠 sort_order 排到前面"
        );
        let current = current_pending_step(&conn, mid).unwrap().unwrap();
        assert_eq!(current.title, "B");
    }

    #[test]
    fn instantiate_failure_does_not_leave_half_matter() {
        let conn = conn();
        let err = instantiate_matter_on_conn(&conn, 999, "ghost", 0, None, None).unwrap_err();
        assert!(err.to_string().contains("playbook"));
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM matters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn completing_first_step_advances_current() {
        let conn = conn();
        let pb = create_playbook_on_conn(&conn, "两步").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[
                PlaybookStepInput {
                    title: "一".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
                PlaybookStepInput {
                    title: "二".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
            ],
        )
        .unwrap();
        let mid = instantiate_matter_on_conn(&conn, pb, "事", 0, None, None).unwrap();
        let first = current_pending_step(&conn, mid).unwrap().unwrap();
        assert_eq!(first.title, "一");
        complete_matter_step_on_conn(&conn, first.id).unwrap();
        let second = current_pending_step(&conn, mid).unwrap().unwrap();
        assert_eq!(second.title, "二");
    }
}
