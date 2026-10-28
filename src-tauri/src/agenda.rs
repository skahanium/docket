//! Shared "today" / overdue predicates and local-calendar timestamp bounds.

use chrono::{DateTime, Days, Local, NaiveDate, TimeZone, Timelike};

fn qualify(alias: &str, column: &str) -> String {
    if alias.is_empty() {
        column.to_string()
    } else {
        format!("{alias}.{column}")
    }
}

/// Active tasks due today, or high-priority not-yet-due (including no due date).
pub fn today_active_predicate(alias: &str, today_placeholder: &str) -> String {
    let due = qualify(alias, "due_date");
    let pri = qualify(alias, "priority");
    format!(
        "({due} = {today_placeholder} OR ({pri} >= 2 AND ({due} IS NULL OR {due} >= {today_placeholder})))"
    )
}

pub fn overdue_active_predicate(alias: &str, today_placeholder: &str) -> String {
    let due = qualify(alias, "due_date");
    format!("{due} IS NOT NULL AND {due} < {today_placeholder}")
}

pub fn parse_calendar_date(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| format!("invalid date: {date}"))
}

pub fn format_calendar_date(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn local_midnight(date: NaiveDate) -> Result<DateTime<Local>, String> {
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

pub fn rfc3339_to_local_hour(ts: &str) -> Option<i32> {
    DateTime::parse_from_rfc3339(ts)
        .ok()
        .map(|dt| dt.with_timezone(&Local).hour() as i32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn today_predicate_qualifies_alias() {
        let sql = today_active_predicate("t", "?3");
        assert!(sql.contains("t.due_date = ?3"));
        assert!(sql.contains("t.priority >= 2"));
    }

    #[test]
    fn overdue_predicate_unqualified() {
        let sql = overdue_active_predicate("", "?2");
        assert_eq!(sql, "due_date IS NOT NULL AND due_date < ?2");
    }

    #[test]
    fn local_day_bounds_are_ordered() {
        let (start, end) = local_day_bounds("2026-10-28").unwrap();
        assert!(start < end);
        assert!(start.contains("2026-10-2"));
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
