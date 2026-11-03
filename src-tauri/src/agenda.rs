//! Shared "today" / overdue predicates, local-calendar bounds, and agenda union.

use crate::db::{matter_status, step_status, task_status};
use crate::error::{AppError, AppResult};
use crate::evidence::{load_links_for_steps, missing_evidence};
use crate::models::AgendaItem;
use chrono::{DateTime, Days, Local, NaiveDate, TimeZone, Timelike};
use rusqlite::{params_from_iter, Connection};
use std::collections::HashMap;

pub const AGENDA_KIND_TASK: &str = "task";
pub const AGENDA_KIND_MATTER_STEP: &str = "matter_step";

fn qualify(alias: &str, column: &str) -> String {
    if alias.is_empty() {
        column.to_string()
    } else {
        format!("{alias}.{column}")
    }
}

pub fn due_day_expr(alias: &str) -> String {
    format!("substr({},1,10)", qualify(alias, "due_date"))
}

/// Active tasks due today, or high-priority not-yet-due (including no due date).
pub fn today_active_predicate(alias: &str, today_placeholder: &str) -> String {
    let due_day = due_day_expr(alias);
    let due = qualify(alias, "due_date");
    let pri = qualify(alias, "priority");
    format!(
        "({due_day} = {today_placeholder} OR ({pri} >= 2 AND ({due} IS NULL OR {due_day} >= {today_placeholder})))"
    )
}

pub fn overdue_active_predicate(alias: &str, today_placeholder: &str) -> String {
    let due = qualify(alias, "due_date");
    let due_day = due_day_expr(alias);
    format!("{due} IS NOT NULL AND {due_day} < {today_placeholder}")
}

pub fn parse_calendar_date(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| format!("invalid date: {date}"))
}

/// Accepts `YYYY-MM-DD` or local `YYYY-MM-DDTHH:MM`.
pub fn parse_due_date(value: &str) -> Result<(), String> {
    if value.len() == 10 {
        parse_calendar_date(value)?;
        return Ok(());
    }
    if value.len() == 16 && value.as_bytes().get(10) == Some(&b'T') {
        parse_calendar_date(&value[..10])?;
        let hh: u32 = value[11..13]
            .parse()
            .map_err(|_| format!("invalid date: {value}"))?;
        let mm: u32 = value[14..16]
            .parse()
            .map_err(|_| format!("invalid date: {value}"))?;
        if value.as_bytes()[13] != b':' || hh > 23 || mm > 59 {
            return Err(format!("invalid date: {value}"));
        }
        return Ok(());
    }
    Err(format!("invalid date: {value}"))
}

pub fn due_day(value: &str) -> Option<String> {
    if value.len() >= 10 && parse_calendar_date(&value[..10]).is_ok() {
        Some(value[..10].to_string())
    } else {
        None
    }
}

pub fn format_calendar_date(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

pub(crate) fn local_midnight(date: NaiveDate) -> Result<DateTime<Local>, String> {
    let naive = date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| format!("invalid midnight for {date}"))?;
    match Local.from_local_datetime(&naive) {
        chrono::LocalResult::Single(dt) => Ok(dt),
        chrono::LocalResult::Ambiguous(earliest, _) => Ok(earliest),
        chrono::LocalResult::None => {
            let shifted = date
                .and_hms_opt(1, 0, 0)
                .ok_or_else(|| format!("invalid fallback datetime for {date}"))?;
            match Local.from_local_datetime(&shifted) {
                chrono::LocalResult::Single(dt) | chrono::LocalResult::Ambiguous(dt, _) => Ok(dt),
                chrono::LocalResult::None => {
                    Err(format!("cannot resolve local midnight for {date}"))
                }
            }
        }
    }
}

/// Local timezone `[start, end)` RFC3339 bounds for a calendar date.
pub fn local_day_bounds(date: &str) -> Result<(String, String), String> {
    let d = parse_calendar_date(date)?;
    let start = local_midnight(d)?;
    let next = d.succ_opt().ok_or_else(|| format!("date overflow: {date}"))?;
    let end = local_midnight(next)?;
    Ok((start.to_rfc3339(), end.to_rfc3339()))
}

pub fn local_range_bounds(
    start: NaiveDate,
    end_exclusive: NaiveDate,
) -> Result<(String, String), String> {
    Ok((
        local_midnight(start)?.to_rfc3339(),
        local_midnight(end_exclusive)?.to_rfc3339(),
    ))
}

/// Inclusive start / exclusive end calendar dates for the last `days` local days
/// (including today). Returns `(start_date, tomorrow)`.
pub fn local_last_n_days_window(days: i32) -> (NaiveDate, NaiveDate) {
    let today = crate::time::local_today_naive();
    let n = days.max(1) as u64;
    let start = today - Days::new(n - 1);
    let tomorrow = today + Days::new(1);
    (start, tomorrow)
}

pub fn rfc3339_to_local_date(ts: &str) -> Option<String> {
    DateTime::parse_from_rfc3339(ts)
        .ok()
        .map(|dt| dt.with_timezone(&Local).format("%Y-%m-%d").to_string())
}

/// Whether `completed_at` (UTC RFC3339) falls on a local calendar day in `[start, end)`.
pub fn local_date_in_period(completed_at: &str, start: NaiveDate, end: NaiveDate) -> bool {
    rfc3339_to_local_date(completed_at)
        .and_then(|s| parse_calendar_date(&s).ok())
        .map(|d| d >= start && d < end)
        .unwrap_or(false)
}

pub fn rfc3339_to_local_hour(ts: &str) -> Option<i32> {
    DateTime::parse_from_rfc3339(ts)
        .ok()
        .map(|dt| dt.with_timezone(&Local).hour() as i32)
}

fn list_task_agenda(
    conn: &Connection,
    today: &str,
    overdue_only: bool,
) -> AppResult<Vec<AgendaItem>> {
    let extra = if overdue_only {
        overdue_active_predicate("", "?2")
    } else {
        today_active_predicate("", "?2")
    };
    let sql = format!(
        "SELECT id, title, due_date, priority, category_id FROM tasks
         WHERE status = ?1 AND {extra}
         ORDER BY priority DESC, due_date ASC, title ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![task_status::ACTIVE, today], |row| {
        Ok(AgendaItem {
            kind: AGENDA_KIND_TASK.into(),
            id: row.get(0)?,
            title: row.get(1)?,
            subtitle: None,
            due_date: row.get(2)?,
            priority: row.get(3)?,
            matter_id: None,
            missing_evidence: false,
            category_id: row.get(4)?,
            tag_ids: Vec::new(),
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn list_current_step_agenda(
    conn: &Connection,
    today: &str,
    overdue_only: bool,
) -> AppResult<Vec<AgendaItem>> {
    let overdue_clause = if overdue_only {
        "AND ((s.due_date IS NOT NULL AND substr(s.due_date,1,10) < ?2) OR (m.due_date IS NOT NULL AND substr(m.due_date,1,10) < ?2))"
    } else {
        ""
    };
    let sql = format!(
        "SELECT s.id, s.title, s.due_date, s.evidence_required, m.id, m.title, m.priority, m.due_date, m.category_id
         FROM matter_steps s
         JOIN matters m ON m.id = s.matter_id
         WHERE m.status = ?1
           AND s.status = ?3
           AND s.id = (
             SELECT s2.id FROM matter_steps s2
             WHERE s2.matter_id = s.matter_id AND s2.status = ?3
             ORDER BY s2.sort_order ASC, s2.id ASC LIMIT 1
           )
           {overdue_clause}
         ORDER BY m.priority DESC, s.due_date ASC, s.id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![matter_status::ACTIVE, today, step_status::PENDING],
        map_step_row,
    )?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    let step_ids: Vec<i64> = items.iter().map(|i| i.id).collect();
    let links = load_links_for_steps(conn, &step_ids)?;
    for item in &mut items {
        let n = links.get(&item.id).map(|v| v.len()).unwrap_or(0);
        let required = item.missing_evidence;
        item.missing_evidence = missing_evidence(required, n);
    }
    Ok(items)
}

fn map_step_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgendaItem> {
    let evidence_required: i32 = row.get(3)?;
    let step_due: Option<String> = row.get(2)?;
    let matter_due: Option<String> = row.get(7)?;
    Ok(AgendaItem {
        kind: AGENDA_KIND_MATTER_STEP.into(),
        id: row.get(0)?,
        title: row.get(1)?,
        subtitle: row.get(5)?,
        due_date: step_due.or(matter_due),
        priority: row.get(6)?,
        matter_id: row.get(4)?,
        missing_evidence: evidence_required != 0,
        category_id: row.get(8)?,
        tag_ids: Vec::new(),
    })
}

fn load_tag_ids_for(
    conn: &Connection,
    table: &str,
    owner_column: &str,
    owner_ids: &[i64],
) -> AppResult<HashMap<i64, Vec<i64>>> {
    let mut map: HashMap<i64, Vec<i64>> = HashMap::new();
    if owner_ids.is_empty() {
        return Ok(map);
    }
    let placeholders = (0..owner_ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT {owner_column}, tag_id FROM {table} WHERE {owner_column} IN ({placeholders}) ORDER BY tag_id"
    );
    let mut stmt = conn.prepare(&sql)?;
    for row in stmt.query_map(params_from_iter(owner_ids.iter().copied()), |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    })? {
        let (owner_id, tag_id) = row?;
        map.entry(owner_id).or_default().push(tag_id);
    }
    Ok(map)
}

fn attach_agenda_tags(conn: &Connection, items: &mut [AgendaItem]) -> AppResult<()> {
    let task_ids: Vec<i64> = items
        .iter()
        .filter(|i| i.kind == AGENDA_KIND_TASK)
        .map(|i| i.id)
        .collect();
    let matter_ids: Vec<i64> = items
        .iter()
        .filter_map(|i| {
            if i.kind == AGENDA_KIND_MATTER_STEP {
                i.matter_id
            } else {
                None
            }
        })
        .collect();
    let task_tags = load_tag_ids_for(conn, "task_tags", "task_id", &task_ids)?;
    let matter_tags = load_tag_ids_for(conn, "matter_tags", "matter_id", &matter_ids)?;
    for item in items {
        if item.kind == AGENDA_KIND_TASK {
            item.tag_ids = task_tags.get(&item.id).cloned().unwrap_or_default();
        } else if let Some(mid) = item.matter_id {
            item.tag_ids = matter_tags.get(&mid).cloned().unwrap_or_default();
        }
    }
    Ok(())
}

/// `view` is `today` or `overdue`. Today includes every active matter's current step.
pub fn list_agenda_on_conn(conn: &Connection, view: &str) -> AppResult<Vec<AgendaItem>> {
    let today = crate::time::local_today_date();
    let overdue_only = match view {
        "today" => false,
        "overdue" => true,
        _ => return Err(AppError::message("议程视图须为 today 或 overdue")),
    };
    let mut items = list_task_agenda(conn, &today, overdue_only)?;
    items.extend(list_current_step_agenda(conn, &today, overdue_only)?);
    attach_agenda_tags(conn, &mut items)?;
    items.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| a.due_date.cmp(&b.due_date))
            .then_with(|| a.title.cmp(&b.title))
    });
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn today_predicate_qualifies_alias() {
        let sql = today_active_predicate("t", "?3");
        assert!(sql.contains("substr(t.due_date,1,10) = ?3"));
        assert!(sql.contains("t.priority >= 2"));
    }

    #[test]
    fn overdue_predicate_unqualified() {
        let sql = overdue_active_predicate("", "?2");
        assert_eq!(
            sql,
            "due_date IS NOT NULL AND substr(due_date,1,10) < ?2"
        );
    }

    #[test]
    fn parse_due_date_accepts_day_or_local_time() {
        assert!(parse_due_date("2026-11-01").is_ok());
        assert!(parse_due_date("2026-11-01T15:00").is_ok());
        assert!(parse_due_date("2026-11-01T15:00:00").is_err());
        assert!(parse_due_date("2026-11-01 15:00").is_err());
        assert!(parse_due_date("file:///tmp").is_err());
    }

    #[test]
    fn due_day_strips_optional_time() {
        assert_eq!(due_day("2026-11-01").as_deref(), Some("2026-11-01"));
        assert_eq!(due_day("2026-11-01T15:00").as_deref(), Some("2026-11-01"));
        assert_eq!(due_day("bad"), None);
    }

    #[test]
    fn local_day_bounds_are_ordered() {
        let (start, end) = local_day_bounds("2026-10-28").unwrap();
        assert!(start < end);
        assert!(start.contains("2026-10-2"));
    }

    #[test]
    fn list_agenda_today_includes_current_step_not_completed() {
        use crate::db;
        use crate::matter::{complete_matter_step_on_conn, current_pending_step};
        use crate::models::PlaybookStepInput;
        use crate::playbook::{
            create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn,
        };
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        let pb = create_playbook_on_conn(&conn, "议程模板").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[
                PlaybookStepInput {
                    title: "当前步".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
                PlaybookStepInput {
                    title: "下一步".into(),
                    optional: false,
                    evidence_required: false,
                    estimated_minutes: None,
                },
            ],
        )
        .unwrap();
        let mid = instantiate_matter_on_conn(&conn, pb, "议程事项", 2, None, None).unwrap();
        let today = list_agenda_on_conn(&conn, "today").unwrap();
        assert!(today.iter().any(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.title == "当前步"));
        assert!(!today.iter().any(|i| i.title == "下一步"));
        let first = current_pending_step(&conn, mid).unwrap().unwrap();
        complete_matter_step_on_conn(&conn, first.id).unwrap();
        let after = list_agenda_on_conn(&conn, "today").unwrap();
        assert!(after.iter().any(|i| i.title == "下一步"));
        assert!(!after.iter().any(|i| i.title == "当前步"));
    }

    #[test]
    fn list_agenda_today_includes_category_and_tags() {
        use crate::commands::tasks::{create_task_on_conn, CreateTaskInput};
        use crate::db;
        use crate::matter::add_tag_to_matter_on_conn;
        use crate::models::PlaybookStepInput;
        use crate::playbook::{
            create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn,
        };
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        conn.execute("INSERT INTO categories (name) VALUES ('工')", []).unwrap();
        let cat_id = conn.last_insert_rowid();
        conn.execute("INSERT INTO tags (name) VALUES ('甲')", []).unwrap();
        let tag_id = conn.last_insert_rowid();
        let today = crate::time::local_today_date();
        let tagged_task = create_task_on_conn(
            &conn,
            CreateTaskInput {
                title: "带分类标签任务".into(),
                description: None,
                priority: Some(2),
                due_date: Some(today.clone()),
                category_id: Some(cat_id),
                recurrence_rule: None,
                estimated_minutes: None,
            },
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![tagged_task, tag_id],
        )
        .unwrap();
        let plain_task = create_task_on_conn(
            &conn,
            CreateTaskInput {
                title: "无分类任务".into(),
                description: None,
                priority: Some(2),
                due_date: Some(today.clone()),
                category_id: None,
                recurrence_rule: None,
                estimated_minutes: None,
            },
        )
        .unwrap();
        let pb = create_playbook_on_conn(&conn, "带分类模板").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[PlaybookStepInput {
                title: "当前步".into(),
                optional: false,
                evidence_required: false,
                estimated_minutes: None,
            }],
        )
        .unwrap();
        let mid = instantiate_matter_on_conn(&conn, pb, "带分类事项", 2, Some(cat_id), None).unwrap();
        add_tag_to_matter_on_conn(&conn, mid, tag_id).unwrap();

        let items = list_agenda_on_conn(&conn, "today").unwrap();
        let tagged = items.iter().find(|i| i.id == tagged_task).expect("tagged task");
        assert_eq!(tagged.category_id, Some(cat_id));
        assert_eq!(tagged.tag_ids, vec![tag_id]);
        let plain = items.iter().find(|i| i.id == plain_task).expect("plain task");
        assert_eq!(plain.category_id, None);
        assert!(plain.tag_ids.is_empty());
        let step = items
            .iter()
            .find(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.matter_id == Some(mid))
            .expect("matter step");
        assert_eq!(step.category_id, Some(cat_id));
        assert_eq!(step.tag_ids, vec![tag_id]);
    }

    #[test]
    fn overdue_agenda_uses_matter_or_current_step_due() {
        use crate::db;
        use crate::matter::{current_pending_step, update_matter_on_conn, update_matter_step_on_conn};
        use crate::models::PlaybookStepInput;
        use crate::playbook::{
            create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn,
        };
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        let pb = create_playbook_on_conn(&conn, "逾期模板").unwrap();
        set_playbook_steps_on_conn(
            &conn,
            pb,
            &[PlaybookStepInput {
                title: "当前步".into(),
                optional: false,
                evidence_required: false,
                estimated_minutes: None,
            }],
        )
        .unwrap();
        let today = crate::time::local_today_naive();
        let yesterday = format_calendar_date(today - chrono::Days::new(1));
        let tomorrow = format_calendar_date(today + chrono::Days::new(1));
        let mid = instantiate_matter_on_conn(&conn, pb, "逾期事项", 2, None, Some(&yesterday)).unwrap();

        let overdue = list_agenda_on_conn(&conn, "overdue").unwrap();
        assert!(overdue.iter().any(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.matter_id == Some(mid)));

        update_matter_on_conn(&conn, mid, None, None, None, Some(Some(tomorrow.as_str())), None).unwrap();
        let later = list_agenda_on_conn(&conn, "overdue").unwrap();
        assert!(!later.iter().any(|i| i.matter_id == Some(mid)));

        update_matter_on_conn(&conn, mid, None, None, None, Some(None), None).unwrap();
        let step = current_pending_step(&conn, mid).unwrap().unwrap();
        update_matter_step_on_conn(&conn, step.id, None, Some(Some(yesterday.as_str()))).unwrap();
        let by_step = list_agenda_on_conn(&conn, "overdue").unwrap();
        assert!(by_step.iter().any(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.matter_id == Some(mid)));

        update_matter_on_conn(&conn, mid, None, None, None, Some(Some(tomorrow.as_str())), None).unwrap();
        let step_over_matter = list_agenda_on_conn(&conn, "overdue").unwrap();
        assert!(
            step_over_matter
                .iter()
                .any(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.matter_id == Some(mid)),
            "事项 due 在未来时，当前步昨日 due 仍应逾期（OR，不是 AND）"
        );
    }

    #[test]
    fn today_agenda_includes_task_with_local_time() {
        use crate::commands::tasks::{create_task_on_conn, CreateTaskInput};
        use crate::db;
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        let today = crate::time::local_today_date();
        create_task_on_conn(
            &conn,
            CreateTaskInput {
                title: "带时刻今日".into(),
                description: None,
                priority: Some(0),
                due_date: Some(format!("{today}T15:00")),
                category_id: None,
                recurrence_rule: None,
                estimated_minutes: None,
            },
        )
        .unwrap();
        let items = list_agenda_on_conn(&conn, "today").unwrap();
        assert!(items.iter().any(|i| i.title == "带时刻今日"));
    }

    #[test]
    fn local_date_in_period_uses_local_calendar_not_string_order() {
        let oct_s = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let oct_e = NaiveDate::from_ymd_opt(2026, 11, 1).unwrap();
        let nov_s = NaiveDate::from_ymd_opt(2026, 11, 1).unwrap();
        let nov_e = NaiveDate::from_ymd_opt(2026, 12, 1).unwrap();
        let ts = "2026-10-31T16:00:00+00:00";
        let local = rfc3339_to_local_date(ts).unwrap();
        let d = parse_calendar_date(&local).unwrap();
        assert_eq!(local_date_in_period(ts, oct_s, oct_e), d >= oct_s && d < oct_e);
        assert_eq!(local_date_in_period(ts, nov_s, nov_e), d >= nov_s && d < nov_e);
    }

    #[test]
    fn rfc3339_utc_evening_maps_to_next_local_day_in_east() {
        // 16:00 UTC on Oct 28 is 00:00 Oct 29 in UTC+8.
        let hour = rfc3339_to_local_hour("2026-10-28T16:30:00+00:00");
        let date = rfc3339_to_local_date("2026-10-28T16:30:00+00:00");
        assert!(hour.is_some());
        assert!(date.is_some());
        let offset = Local::now().offset().local_minus_utc();
        if offset == 8 * 3600 {
            assert_eq!(hour, Some(0));
            assert_eq!(date.as_deref(), Some("2026-10-29"));
        }
    }
}
