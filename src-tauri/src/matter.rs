//! Matter lifecycle: current step (derived), complete / skip / reopen.

use crate::db::{matter_status, step_status};
use crate::error::{AppError, AppResult};
use crate::evidence::{load_links_for_steps, missing_evidence};
use crate::models::{MatterDetail, MatterStep, MatterStepBrief, MatterSummary, Tag};
use crate::playbook::require_title;
use rusqlite::{params, params_from_iter, Connection};
use std::collections::HashMap;

pub fn create_blank_matter_on_conn(
    conn: &Connection,
    title: &str,
    priority: i32,
    category_id: Option<i64>,
    due_date: Option<&str>,
) -> AppResult<i64> {
    let title = require_title(title)?;
    if let Some(d) = due_date {
        crate::agenda::parse_calendar_date(d).map_err(AppError::InvalidDate)?;
    }
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO matters
         (playbook_id, title, status, priority, category_id, due_date, created_at, updated_at)
         VALUES (NULL, ?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![title, matter_status::ACTIVE, priority, category_id, due_date, now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_matter_on_conn(
    conn: &Connection,
    id: i64,
    title: Option<&str>,
    priority: Option<i32>,
    category_id: Option<Option<i64>>,
    due_date: Option<Option<&str>>,
) -> AppResult<()> {
    matter_exists(conn, id)?;
    if let Some(title) = title {
        let title = require_title(title)?;
        conn.execute(
            "UPDATE matters SET title=?1, updated_at=?2 WHERE id=?3",
            params![title, chrono::Utc::now().to_rfc3339(), id],
        )?;
    }
    if let Some(priority) = priority {
        conn.execute(
            "UPDATE matters SET priority=?1, updated_at=?2 WHERE id=?3",
            params![priority, chrono::Utc::now().to_rfc3339(), id],
        )?;
    }
    if let Some(cat) = category_id {
        conn.execute(
            "UPDATE matters SET category_id=?1, updated_at=?2 WHERE id=?3",
            params![cat, chrono::Utc::now().to_rfc3339(), id],
        )?;
    }
    if let Some(due) = due_date {
        if let Some(d) = due {
            crate::agenda::parse_calendar_date(d).map_err(AppError::InvalidDate)?;
        }
        conn.execute(
            "UPDATE matters SET due_date=?1, updated_at=?2 WHERE id=?3",
            params![due, chrono::Utc::now().to_rfc3339(), id],
        )?;
    }
    Ok(())
}

pub fn matter_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM matters WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    if n == 0 {
        return Err(AppError::MatterNotFound { id });
    }
    Ok(())
}

pub fn add_matter_step_on_conn(
    conn: &Connection,
    matter_id: i64,
    title: &str,
    evidence_required: bool,
    due_date: Option<&str>,
    estimated_minutes: Option<i64>,
) -> AppResult<i64> {
    matter_exists(conn, matter_id)?;
    let title = require_title(title)?;
    if let Some(d) = due_date {
        crate::agenda::parse_calendar_date(d).map_err(AppError::InvalidDate)?;
    }
    let next: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM matter_steps WHERE matter_id=?1",
            params![matter_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO matter_steps
         (matter_id, playbook_step_id, title, sort_order, evidence_required, status, due_date, estimated_minutes)
         VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            matter_id,
            title,
            next,
            if evidence_required { 1 } else { 0 },
            step_status::PENDING,
            due_date,
            estimated_minutes,
        ],
    )?;
    let id = conn.last_insert_rowid();
    maybe_refresh_matter_status(conn, matter_id)?;
    Ok(id)
}

pub fn current_pending_step(conn: &Connection, matter_id: i64) -> AppResult<Option<MatterStepBrief>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, sort_order, evidence_required, status, due_date
         FROM matter_steps
         WHERE matter_id=?1 AND status=?2
         ORDER BY sort_order ASC, id ASC LIMIT 1",
    )?;
    let mut rows = stmt.query_map(params![matter_id, step_status::PENDING], |row| {
        Ok(MatterStepBrief {
            id: row.get(0)?,
            title: row.get(1)?,
            sort_order: row.get(2)?,
            evidence_required: row.get::<_, i32>(3)? != 0,
            status: row.get(4)?,
            due_date: row.get(5)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn complete_matter_step_on_conn(conn: &Connection, step_id: i64) -> AppResult<()> {
    set_step_status(conn, step_id, step_status::COMPLETED, true)
}

pub fn skip_matter_step_on_conn(conn: &Connection, step_id: i64) -> AppResult<()> {
    set_step_status(conn, step_id, step_status::SKIPPED, true)
}

pub fn reopen_matter_step_on_conn(conn: &Connection, step_id: i64) -> AppResult<()> {
    set_step_status(conn, step_id, step_status::PENDING, false)
}

fn set_step_status(
    conn: &Connection,
    step_id: i64,
    status: &str,
    stamp_completed: bool,
) -> AppResult<()> {
    let (matter_id, current): (i64, String) = conn
        .query_row(
            "SELECT matter_id, status FROM matter_steps WHERE id=?1",
            params![step_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| AppError::message(format!("步骤不存在 (id={step_id})")))?;

    if stamp_completed && current != step_status::PENDING {
        return Err(AppError::message("只能完成或跳过未完成的步骤"));
    }
    if !stamp_completed && current == step_status::PENDING {
        return Err(AppError::message("步骤已是未完成状态"));
    }

    let now = chrono::Utc::now().to_rfc3339();
    if stamp_completed {
        conn.execute(
            "UPDATE matter_steps SET status=?1, completed_at=?2 WHERE id=?3",
            params![status, now, step_id],
        )?;
    } else {
        conn.execute(
            "UPDATE matter_steps SET status=?1, completed_at=NULL WHERE id=?2",
            params![status, step_id],
        )?;
    }
    maybe_refresh_matter_status(conn, matter_id)?;
    Ok(())
}

fn maybe_refresh_matter_status(conn: &Connection, matter_id: i64) -> AppResult<()> {
    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM matter_steps WHERE matter_id=?1 AND status=?2",
        params![matter_id, step_status::PENDING],
        |r| r.get(0),
    )?;
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM matter_steps WHERE matter_id=?1",
        params![matter_id],
        |r| r.get(0),
    )?;
    let now = chrono::Utc::now().to_rfc3339();
    if total > 0 && pending == 0 {
        conn.execute(
            "UPDATE matters SET status=?1, completed_at=COALESCE(completed_at, ?2), updated_at=?2 WHERE id=?3",
            params![matter_status::COMPLETED, now, matter_id],
        )?;
    } else {
        conn.execute(
            "UPDATE matters SET status=?1, completed_at=NULL, updated_at=?2 WHERE id=?3",
            params![matter_status::ACTIVE, now, matter_id],
        )?;
    }
    Ok(())
}

pub fn add_tag_to_matter_on_conn(conn: &Connection, matter_id: i64, tag_id: i64) -> AppResult<()> {
    matter_exists(conn, matter_id)?;
    conn.execute(
        "INSERT OR IGNORE INTO matter_tags (matter_id, tag_id) VALUES (?1, ?2)",
        params![matter_id, tag_id],
    )?;
    Ok(())
}

pub fn remove_tag_from_matter_on_conn(conn: &Connection, matter_id: i64, tag_id: i64) -> AppResult<()> {
    conn.execute(
        "DELETE FROM matter_tags WHERE matter_id=?1 AND tag_id=?2",
        params![matter_id, tag_id],
    )?;
    Ok(())
}

fn load_tags_map(conn: &Connection, matter_ids: &[i64]) -> AppResult<HashMap<i64, Vec<Tag>>> {
    let mut map = HashMap::new();
    if matter_ids.is_empty() {
        return Ok(map);
    }
    let placeholders = matter_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT mt.matter_id, t.id, t.name, t.color
         FROM matter_tags mt JOIN tags t ON t.id = mt.tag_id
         WHERE mt.matter_id IN ({placeholders}) ORDER BY t.id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(matter_ids.iter()), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            Tag {
                id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            },
        ))
    })?;
    for row in rows {
        let (mid, tag) = row?;
        map.entry(mid).or_insert_with(Vec::new).push(tag);
    }
    Ok(map)
}

fn load_link_counts(conn: &Connection, step_ids: &[i64]) -> AppResult<HashMap<i64, usize>> {
    let mut map = HashMap::new();
    if step_ids.is_empty() {
        return Ok(map);
    }
    let placeholders = step_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT matter_step_id, COUNT(*) FROM matter_step_links
         WHERE matter_step_id IN ({placeholders}) GROUP BY matter_step_id"
    );
    let mut stmt = conn.prepare(&sql)?;
    for row in stmt.query_map(params_from_iter(step_ids.iter()), |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)? as usize))
    })? {
        let (id, n) = row?;
        map.insert(id, n);
    }
    Ok(map)
}

fn row_to_summary(
    id: i64,
    playbook_id: Option<i64>,
    title: String,
    status: String,
    priority: i32,
    category_id: Option<i64>,
    due_date: Option<String>,
    created_at: String,
    completed_at: Option<String>,
    tags: Vec<Tag>,
    current: Option<MatterStepBrief>,
    missing: bool,
) -> MatterSummary {
    MatterSummary {
        id,
        playbook_id,
        title,
        status,
        priority,
        category_id,
        due_date,
        created_at,
        completed_at,
        tags,
        current_step: current,
        missing_evidence: missing,
    }
}

pub fn list_matters_on_conn(conn: &Connection, status: Option<&str>) -> AppResult<Vec<MatterSummary>> {
    let sql = if let Some(_s) = status {
        "SELECT id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at
         FROM matters WHERE status=?1 ORDER BY updated_at DESC, id DESC"
    } else {
        "SELECT id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at
         FROM matters ORDER BY updated_at DESC, id DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let mut summaries = Vec::new();
    if let Some(s) = status {
        let rows = stmt.query_map(params![s], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })?;
        for row in rows {
            let (id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at) =
                row?;
            summaries.push((
                id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at,
            ));
        }
    } else {
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })?;
        for row in rows {
            let (id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at) =
                row?;
            summaries.push((
                id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at,
            ));
        }
    }

    let ids: Vec<i64> = summaries.iter().map(|s| s.0).collect();
    let tags_map = load_tags_map(conn, &ids)?;

    let mut current_map: HashMap<i64, MatterStepBrief> = HashMap::new();
    if !ids.is_empty() {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT s.id, s.matter_id, s.title, s.sort_order, s.evidence_required, s.status, s.due_date
             FROM matter_steps s
             WHERE s.status=?1 AND s.matter_id IN ({placeholders})
             AND s.id = (
               SELECT s2.id FROM matter_steps s2
               WHERE s2.matter_id = s.matter_id AND s2.status=?1
               ORDER BY s2.sort_order ASC, s2.id ASC LIMIT 1
             )"
        );
        let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        params_vec.push(Box::new(step_status::PENDING.to_string()));
        for id in &ids {
            params_vec.push(Box::new(*id));
        }
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())), |row| {
            Ok((
                row.get::<_, i64>(1)?,
                MatterStepBrief {
                    id: row.get(0)?,
                    title: row.get(2)?,
                    sort_order: row.get(3)?,
                    evidence_required: row.get::<_, i32>(4)? != 0,
                    status: row.get(5)?,
                    due_date: row.get(6)?,
                },
            ))
        })?;
        for row in rows {
            let (mid, brief) = row?;
            current_map.insert(mid, brief);
        }
    }

    let step_ids: Vec<i64> = current_map.values().map(|s| s.id).collect();
    let link_counts = load_link_counts(conn, &step_ids)?;

    Ok(summaries
        .into_iter()
        .map(|(id, playbook_id, title, status, priority, category_id, due_date, created_at, completed_at)| {
            let current = current_map.get(&id).cloned();
            let missing = current
                .as_ref()
                .map(|s| missing_evidence(s.evidence_required, *link_counts.get(&s.id).unwrap_or(&0)))
                .unwrap_or(false);
            row_to_summary(
                id,
                playbook_id,
                title,
                status,
                priority,
                category_id,
                due_date,
                created_at,
                completed_at,
                tags_map.get(&id).cloned().unwrap_or_default(),
                current,
                missing,
            )
        })
        .collect())
}

pub fn list_completed_matters_in_range(
    conn: &Connection,
    range_start: &str,
    range_end: &str,
) -> AppResult<Vec<MatterSummary>> {
    let all = list_matters_on_conn(conn, Some(matter_status::COMPLETED))?;
    Ok(all
        .into_iter()
        .filter(|m| {
            m.completed_at
                .as_deref()
                .map(|ts| ts >= range_start && ts < range_end)
                .unwrap_or(false)
        })
        .collect())
}

pub fn get_matter_on_conn(conn: &Connection, id: i64) -> AppResult<MatterDetail> {
    let (playbook_id, title, status, priority, category_id, due_date, created_at, updated_at, completed_at): (
        Option<i64>,
        String,
        String,
        i32,
        Option<i64>,
        Option<String>,
        String,
        String,
        Option<String>,
    ) = conn
        .query_row(
            "SELECT playbook_id, title, status, priority, category_id, due_date, created_at, updated_at, completed_at
             FROM matters WHERE id=?1",
            params![id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                ))
            },
        )
        .map_err(|_| AppError::MatterNotFound { id })?;

    let mut stmt = conn.prepare(
        "SELECT id, matter_id, playbook_step_id, title, sort_order, evidence_required, status,
                due_date, estimated_minutes, completed_at
         FROM matter_steps WHERE matter_id=?1 ORDER BY sort_order ASC, id ASC",
    )?;
    let step_rows: Vec<MatterStep> = stmt
        .query_map(params![id], |row| {
            Ok(MatterStep {
                id: row.get(0)?,
                matter_id: row.get(1)?,
                playbook_step_id: row.get(2)?,
                title: row.get(3)?,
                sort_order: row.get(4)?,
                evidence_required: row.get::<_, i32>(5)? != 0,
                status: row.get(6)?,
                due_date: row.get(7)?,
                estimated_minutes: row.get(8)?,
                completed_at: row.get(9)?,
                links: vec![],
                missing_evidence: false,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let step_ids: Vec<i64> = step_rows.iter().map(|s| s.id).collect();
    let mut links = load_links_for_steps(conn, &step_ids)?;
    let steps: Vec<MatterStep> = step_rows
        .into_iter()
        .map(|mut s| {
            s.links = links.remove(&s.id).unwrap_or_default();
            s.missing_evidence = missing_evidence(s.evidence_required, s.links.len());
            s
        })
        .collect();

    let tags = load_tags_map(conn, &[id])?.remove(&id).unwrap_or_default();
    let current = steps
        .iter()
        .find(|s| s.status == step_status::PENDING)
        .map(|s| MatterStepBrief {
            id: s.id,
            title: s.title.clone(),
            sort_order: s.sort_order,
            evidence_required: s.evidence_required,
            status: s.status.clone(),
            due_date: s.due_date.clone(),
        });

    Ok(MatterDetail {
        id,
        playbook_id,
        title,
        status,
        priority,
        category_id,
        due_date,
        created_at,
        updated_at,
        completed_at,
        tags,
        steps,
        current_step: current,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::playbook::{create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn};
    use crate::models::PlaybookStepInput;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::init_db(&c).unwrap();
        c
    }

    fn seeded_matter(conn: &Connection) -> (i64, i64) {
        let pb = create_playbook_on_conn(conn, "模板").unwrap();
        set_playbook_steps_on_conn(
            conn,
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
        let mid = instantiate_matter_on_conn(conn, pb, "事项", 0, None, None).unwrap();
        (pb, mid)
    }

    #[test]
    fn playbook_id_stays_after_title_update() {
        let conn = conn();
        let (pb, mid) = seeded_matter(&conn);
        update_matter_on_conn(&conn, mid, Some("新标题"), None, None, None).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(detail.playbook_id, Some(pb));
        assert_eq!(detail.title, "新标题");
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('matters') WHERE name='playbook_id'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn skip_is_legal_and_advances() {
        let conn = conn();
        let (_pb, mid) = seeded_matter(&conn);
        let first = current_pending_step(&conn, mid).unwrap().unwrap();
        skip_matter_step_on_conn(&conn, first.id).unwrap();
        let second = current_pending_step(&conn, mid).unwrap().unwrap();
        assert_eq!(second.title, "二");
    }

    #[test]
    fn last_step_sets_completed_at_rfc3339() {
        let conn = conn();
        let (_pb, mid) = seeded_matter(&conn);
        let first = current_pending_step(&conn, mid).unwrap().unwrap();
        complete_matter_step_on_conn(&conn, first.id).unwrap();
        let second = current_pending_step(&conn, mid).unwrap().unwrap();
        complete_matter_step_on_conn(&conn, second.id).unwrap();
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(detail.status, matter_status::COMPLETED);
        let ts = detail.completed_at.expect("completed_at");
        assert!(chrono::DateTime::parse_from_rfc3339(&ts).is_ok());
        let local = crate::agenda::rfc3339_to_local_date(&ts).expect("local day");
        assert_eq!(local.len(), 10);
    }

    #[test]
    fn reopen_reactivates_matter() {
        let conn = conn();
        let (_pb, mid) = seeded_matter(&conn);
        while let Some(s) = current_pending_step(&conn, mid).unwrap() {
            complete_matter_step_on_conn(&conn, s.id).unwrap();
        }
        let detail = get_matter_on_conn(&conn, mid).unwrap();
        reopen_matter_step_on_conn(&conn, detail.steps[1].id).unwrap();
        let after = get_matter_on_conn(&conn, mid).unwrap();
        assert_eq!(after.status, matter_status::ACTIVE);
        assert!(after.completed_at.is_none());
        assert_eq!(after.current_step.unwrap().title, "二");
    }

    #[test]
    fn blank_title_rejected() {
        let conn = conn();
        assert!(create_blank_matter_on_conn(&conn, "  ", 0, None, None).is_err());
    }
}
