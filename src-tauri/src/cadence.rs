//! Cadence period bounds and completed-matter counting (query, not accumulator).

use crate::agenda::{format_calendar_date, parse_calendar_date};
use crate::db::cadence_period;
use crate::error::{AppError, AppResult};
use crate::matter::list_completed_matters_in_range;
use crate::models::{Cadence, CadenceProgress, MatterSummary};
use chrono::{Datelike, NaiveDate};
use rusqlite::{params, Connection};

pub fn period_bounds(period: &str, as_of_local_date: &str) -> AppResult<(NaiveDate, NaiveDate)> {
    let d = parse_calendar_date(as_of_local_date).map_err(AppError::InvalidDate)?;
    match period {
        cadence_period::MONTH => {
            let start = NaiveDate::from_ymd_opt(d.year(), d.month(), 1)
                .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            let end = if d.month() == 12 {
                NaiveDate::from_ymd_opt(d.year() + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(d.year(), d.month() + 1, 1)
            }
            .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            Ok((start, end))
        }
        cadence_period::QUARTER => {
            let q = ((d.month() - 1) / 3) * 3 + 1;
            let start = NaiveDate::from_ymd_opt(d.year(), q, 1)
                .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            let end = if q == 10 {
                NaiveDate::from_ymd_opt(d.year() + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(d.year(), q + 3, 1)
            }
            .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            Ok((start, end))
        }
        cadence_period::YEAR => {
            let start = NaiveDate::from_ymd_opt(d.year(), 1, 1)
                .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            let end = NaiveDate::from_ymd_opt(d.year() + 1, 1, 1)
                .ok_or_else(|| AppError::InvalidDate(as_of_local_date.into()))?;
            Ok((start, end))
        }
        _ => Err(AppError::message("期间须为 month、quarter 或 year")),
    }
}

/// Empty playbook filter = unrestricted (includes blank matters).
/// Empty tag filter = unrestricted. Non-empty tags require ALL selected tags.
pub fn matter_matches_filter(
    playbook_id: Option<i64>,
    matter_tag_ids: &[i64],
    filter_playbook_ids: &[i64],
    filter_tag_ids: &[i64],
) -> bool {
    let playbook_ok = filter_playbook_ids.is_empty()
        || playbook_id
            .map(|id| filter_playbook_ids.contains(&id))
            .unwrap_or(false);
    let tags_ok = filter_tag_ids.iter().all(|id| matter_tag_ids.contains(id));
    playbook_ok && tags_ok
}

pub fn create_cadence_on_conn(
    conn: &Connection,
    title: &str,
    period: &str,
    target_count: Option<i64>,
    playbook_ids: &[i64],
    tag_ids: &[i64],
) -> AppResult<i64> {
    let title = crate::playbook::require_title(title)?;
    period_bounds(period, "2026-01-01")?;
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO cadences (title, period, target_count, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![title, period, target_count, now],
    )?;
    let id = tx.last_insert_rowid();
    replace_filters(&tx, id, playbook_ids, tag_ids)?;
    tx.commit()?;
    Ok(id)
}

pub fn update_cadence_on_conn(
    conn: &Connection,
    id: i64,
    title: Option<&str>,
    period: Option<&str>,
    target_count: Option<Option<i64>>,
    playbook_ids: Option<&[i64]>,
    tag_ids: Option<&[i64]>,
) -> AppResult<()> {
    cadence_exists(conn, id)?;
    if let Some(title) = title {
        let title = crate::playbook::require_title(title)?;
        conn.execute("UPDATE cadences SET title=?1 WHERE id=?2", params![title, id])?;
    }
    if let Some(period) = period {
        period_bounds(period, "2026-01-01")?;
        conn.execute("UPDATE cadences SET period=?1 WHERE id=?2", params![period, id])?;
    }
    if let Some(target) = target_count {
        conn.execute(
            "UPDATE cadences SET target_count=?1 WHERE id=?2",
            params![target, id],
        )?;
    }
    if playbook_ids.is_some() || tag_ids.is_some() {
        let current_pb = if let Some(ids) = playbook_ids {
            ids.to_vec()
        } else {
            load_playbook_ids(conn, id)?
        };
        let current_tags = if let Some(ids) = tag_ids {
            ids.to_vec()
        } else {
            load_tag_ids(conn, id)?
        };
        let tx = conn.unchecked_transaction()?;
        replace_filters(&tx, id, &current_pb, &current_tags)?;
        tx.commit()?;
    }
    Ok(())
}

fn replace_filters(
    conn: &rusqlite::Transaction<'_>,
    cadence_id: i64,
    playbook_ids: &[i64],
    tag_ids: &[i64],
) -> AppResult<()> {
    conn.execute(
        "DELETE FROM cadence_playbooks WHERE cadence_id=?1",
        params![cadence_id],
    )?;
    conn.execute(
        "DELETE FROM cadence_tags WHERE cadence_id=?1",
        params![cadence_id],
    )?;
    for pid in playbook_ids {
        conn.execute(
            "INSERT OR IGNORE INTO cadence_playbooks (cadence_id, playbook_id) VALUES (?1, ?2)",
            params![cadence_id, pid],
        )?;
    }
    for tid in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO cadence_tags (cadence_id, tag_id) VALUES (?1, ?2)",
            params![cadence_id, tid],
        )?;
    }
    Ok(())
}

fn cadence_exists(conn: &Connection, id: i64) -> AppResult<()> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM cadences WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    if n == 0 {
        return Err(AppError::CadenceNotFound { id });
    }
    Ok(())
}

fn load_playbook_ids(conn: &Connection, cadence_id: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT playbook_id FROM cadence_playbooks WHERE cadence_id=?1 ORDER BY playbook_id",
    )?;
    let ids: Vec<i64> = stmt
        .query_map(params![cadence_id], |r| r.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

fn load_tag_ids(conn: &Connection, cadence_id: i64) -> AppResult<Vec<i64>> {
    let mut stmt =
        conn.prepare("SELECT tag_id FROM cadence_tags WHERE cadence_id=?1 ORDER BY tag_id")?;
    let ids: Vec<i64> = stmt
        .query_map(params![cadence_id], |r| r.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

pub fn get_cadence_on_conn(conn: &Connection, id: i64) -> AppResult<Cadence> {
    let (title, period, target_count, created_at): (String, String, Option<i64>, String) = conn
        .query_row(
            "SELECT title, period, target_count, created_at FROM cadences WHERE id=?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| AppError::CadenceNotFound { id })?;
    Ok(Cadence {
        id,
        title,
        period,
        target_count,
        created_at,
        playbook_ids: load_playbook_ids(conn, id)?,
        tag_ids: load_tag_ids(conn, id)?,
    })
}

pub fn list_cadences_on_conn(conn: &Connection) -> AppResult<Vec<Cadence>> {
    let mut stmt = conn.prepare("SELECT id FROM cadences ORDER BY id DESC")?;
    let ids: Vec<i64> = stmt
        .query_map([], |r| r.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    ids.into_iter().map(|id| get_cadence_on_conn(conn, id)).collect()
}

pub fn count_completed(
    matters: &[MatterSummary],
    filter_playbook_ids: &[i64],
    filter_tag_ids: &[i64],
) -> Vec<MatterSummary> {
    matters
        .iter()
        .filter(|m| {
            let tags: Vec<i64> = m.tags.iter().map(|t| t.id).collect();
            matter_matches_filter(m.playbook_id, &tags, filter_playbook_ids, filter_tag_ids)
        })
        .cloned()
        .collect()
}

pub fn cadence_progress_on_conn(
    conn: &Connection,
    cadence_id: i64,
    as_of_local_date: &str,
) -> AppResult<CadenceProgress> {
    let cadence = get_cadence_on_conn(conn, cadence_id)?;
    let (start, end) = period_bounds(&cadence.period, as_of_local_date)?;
    let completed = list_completed_matters_in_range(conn, start, end)?;
    let matching = count_completed(&completed, &cadence.playbook_ids, &cadence.tag_ids);
    Ok(CadenceProgress {
        cadence,
        completed_count: matching.len() as i32,
        matching_matters: matching,
        period_start: format_calendar_date(start),
        period_end: format_calendar_date(end),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::matter::{
        add_tag_to_matter_on_conn, complete_matter_step_on_conn, create_blank_matter_on_conn,
        current_pending_step, get_matter_on_conn,
    };
    use crate::playbook::{create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn};
    use crate::models::PlaybookStepInput;
    use chrono::Local;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::init_db(&c).unwrap();
        c
    }

    fn two_step_playbook(conn: &Connection) -> i64 {
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
        pb
    }

    fn finish_matter(conn: &Connection, matter_id: i64) {
        while let Some(step) = current_pending_step(conn, matter_id).unwrap() {
            complete_matter_step_on_conn(conn, step.id).unwrap();
        }
    }

    #[test]
    fn month_quarter_year_bounds() {
        let (s, e) = period_bounds("month", "2026-10-15").unwrap();
        assert_eq!(s, NaiveDate::from_ymd_opt(2026, 10, 1).unwrap());
        assert_eq!(e, NaiveDate::from_ymd_opt(2026, 11, 1).unwrap());
        let (s, e) = period_bounds("quarter", "2026-10-15").unwrap();
        assert_eq!(s, NaiveDate::from_ymd_opt(2026, 10, 1).unwrap());
        assert_eq!(e, NaiveDate::from_ymd_opt(2027, 1, 1).unwrap());
        let (s, e) = period_bounds("year", "2026-10-15").unwrap();
        assert_eq!(s, NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
        assert_eq!(e, NaiveDate::from_ymd_opt(2027, 1, 1).unwrap());
    }

    fn set_completed_at(conn: &Connection, matter_id: i64, ts: &str) {
        conn.execute(
            "UPDATE matters SET completed_at=?1 WHERE id=?2",
            rusqlite::params![ts, matter_id],
        )
        .unwrap();
    }

    fn mid_month(date: NaiveDate) -> String {
        format!("{:04}-{:02}-15", date.year(), date.month())
    }

    fn prev_month_mid(date: NaiveDate) -> String {
        let (y, m) = if date.month() == 1 {
            (date.year() - 1, 12)
        } else {
            (date.year(), date.month() - 1)
        };
        format!("{:04}-{:02}-15", y, m)
    }

    fn next_month_mid(date: NaiveDate) -> String {
        let (y, m) = if date.month() == 12 {
            (date.year() + 1, 1)
        } else {
            (date.year(), date.month() + 1)
        };
        format!("{:04}-{:02}-15", y, m)
    }

    #[test]
    fn cadence_progress_buckets_by_local_calendar_day() {
        let conn = conn();
        let pb = two_step_playbook(&conn);
        let mid = instantiate_matter_on_conn(&conn, pb, "边界办结", 0, None, None).unwrap();
        finish_matter(&conn, mid);

        const TS: &str = "2026-10-31T16:00:00+00:00";
        set_completed_at(&conn, mid, TS);
        let local = crate::agenda::rfc3339_to_local_date(TS).expect("local day");
        let local_d = crate::agenda::parse_calendar_date(&local).unwrap();

        let cadence = create_cadence_on_conn(&conn, "月度", "month", None, &[], &[]).unwrap();
        let in_month = cadence_progress_on_conn(&conn, cadence, &mid_month(local_d)).unwrap();
        assert!(
            in_month.matching_matters.iter().any(|m| m.id == mid),
            "办结应计入 completed_at 的本机日所在月 {local}"
        );
        let prev = cadence_progress_on_conn(&conn, cadence, &prev_month_mid(local_d)).unwrap();
        assert!(
            !prev.matching_matters.iter().any(|m| m.id == mid),
            "办结不应计入本机日的上一月"
        );
        let next = cadence_progress_on_conn(&conn, cadence, &next_month_mid(local_d)).unwrap();
        assert!(
            !next.matching_matters.iter().any(|m| m.id == mid),
            "办结不应计入本机日的下一月"
        );

        let offset = Local::now().offset().local_minus_utc();
        if offset == 8 * 3600 {
            let oct = cadence_progress_on_conn(&conn, cadence, "2026-10-15").unwrap();
            let nov = cadence_progress_on_conn(&conn, cadence, "2026-11-02").unwrap();
            assert!(!oct.matching_matters.iter().any(|m| m.id == mid));
            assert!(nov.matching_matters.iter().any(|m| m.id == mid));

            set_completed_at(&conn, mid, "2026-10-31T15:59:00+00:00");
            let oct2 = cadence_progress_on_conn(&conn, cadence, "2026-10-15").unwrap();
            let nov2 = cadence_progress_on_conn(&conn, cadence, "2026-11-02").unwrap();
            assert!(oct2.matching_matters.iter().any(|m| m.id == mid));
            assert!(!nov2.matching_matters.iter().any(|m| m.id == mid));
        }
    }

    #[test]
    fn unrestricted_counts_blank_restricted_does_not() {
        let conn = conn();
        let pb = two_step_playbook(&conn);
        let templated = instantiate_matter_on_conn(&conn, pb, "有模板", 0, None, None).unwrap();
        let blank = create_blank_matter_on_conn(&conn, "空白", 0, None, None).unwrap();
        crate::matter::add_matter_step_on_conn(&conn, blank, "一步", false, None, None).unwrap();
        finish_matter(&conn, templated);
        finish_matter(&conn, blank);

        let open = create_cadence_on_conn(&conn, "不限", "month", Some(10), &[], &[]).unwrap();
        let limited = create_cadence_on_conn(&conn, "限模板", "month", Some(10), &[pb], &[]).unwrap();
        let today = crate::time::local_today_date();
        let open_p = cadence_progress_on_conn(&conn, open, &today).unwrap();
        let lim_p = cadence_progress_on_conn(&conn, limited, &today).unwrap();
        assert!(open_p.completed_count >= 2);
        assert!(open_p.matching_matters.iter().any(|m| m.playbook_id.is_none()));
        assert!(lim_p.matching_matters.iter().all(|m| m.playbook_id == Some(pb)));
        assert!(!lim_p.matching_matters.iter().any(|m| m.playbook_id.is_none()));
    }

    #[test]
    fn tag_filter_requires_all_selected_tags() {
        let conn = conn();
        conn.execute("INSERT INTO tags (name) VALUES ('甲')", []).unwrap();
        conn.execute("INSERT INTO tags (name) VALUES ('乙')", []).unwrap();
        let pb = two_step_playbook(&conn);
        let mid = instantiate_matter_on_conn(&conn, pb, "带标签", 0, None, None).unwrap();
        add_tag_to_matter_on_conn(&conn, mid, 1).unwrap();
        finish_matter(&conn, mid);

        let need_both = create_cadence_on_conn(&conn, "双标签", "month", None, &[pb], &[1, 2]).unwrap();
        let need_one = create_cadence_on_conn(&conn, "单标签", "month", None, &[pb], &[1]).unwrap();
        let today = crate::time::local_today_date();
        assert_eq!(
            cadence_progress_on_conn(&conn, need_both, &today)
                .unwrap()
                .completed_count,
            0
        );
        assert_eq!(
            cadence_progress_on_conn(&conn, need_one, &today)
                .unwrap()
                .completed_count,
            1
        );
        let _ = get_matter_on_conn(&conn, mid);
    }
}
