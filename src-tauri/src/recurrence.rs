use crate::models::RecurrenceRule;
use chrono::{Datelike, Days, NaiveDate};

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

fn format_date(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

/// Date part of a due value (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`); `None` when invalid.
fn due_date_part(s: &str) -> Option<NaiveDate> {
    s.get(..10).and_then(parse_date)
}

/// `T15:00` tail when the due value carries a local time; empty for date-only.
fn due_time_suffix(s: &str) -> &str {
    if s.len() == 16 && s.as_bytes()[10] == b'T' {
        &s[10..]
    } else {
        ""
    }
}

/// Keep interval math bounded: absurd values should not overflow or walk the
/// calendar out of chrono's supported range.
const MAX_INTERVAL: i32 = 999;

fn clamped_interval(rule: &RecurrenceRule) -> u64 {
    rule.interval.clamp(1, MAX_INTERVAL) as u64
}

pub fn parse_rule(json: &str) -> Option<RecurrenceRule> {
    serde_json::from_str(json).ok()
}

pub fn next_occurrence(rule: &RecurrenceRule, current_date: &str) -> Option<String> {
    let today = crate::time::local_today_naive();
    let current = due_date_part(current_date).unwrap_or(today);
    let time_suffix = due_time_suffix(current_date);

    if let Some(next) = next_occurrence_from(rule, current) {
        // Check end conditions
        if let Some(ref end_date_str) = rule.end_date {
            if let Some(end_date) = due_date_part(end_date_str) {
                if next > end_date {
                    return None;
                }
            }
        }
        Some(format_date(next) + time_suffix)
    } else {
        None
    }
}

/// First occurrence strictly after `not_before` (a local calendar day).
///
/// Completing a recurring task late must not spawn an already-overdue instance:
/// missed dates are skipped rather than generated one by one. `end_date` is
/// still honored on every step; `end_count` is enforced by the caller.
pub fn next_occurrence_after(
    rule: &RecurrenceRule,
    current_date: &str,
    not_before: NaiveDate,
) -> Option<String> {
    let mut candidate = next_occurrence(rule, current_date)?;
    // 100k daily steps cover ~273 years; enough for any realistic late task.
    for _ in 0..100_000 {
        let day = due_date_part(&candidate)?;
        if day > not_before {
            return Some(candidate);
        }
        candidate = next_occurrence(rule, &candidate)?;
    }
    None
}

fn next_occurrence_from(rule: &RecurrenceRule, from: NaiveDate) -> Option<NaiveDate> {
    match rule.freq.as_str() {
        "daily" => from.checked_add_days(Days::new(clamped_interval(rule))),
        "weekly" => {
            let interval_weeks = clamped_interval(rule);
            let interval_days = interval_weeks * 7;
            if let Some(ref days) = rule.days {
                let mut selected: Vec<u32> = days
                    .iter()
                    .map(|&day| day.clamp(1, 7) as u32)
                    .collect();
                selected.sort_unstable();
                selected.dedup();
                if !selected.is_empty() {
                    // The week containing `from` is the active week. Take the
                    // next selected weekday later in this week; otherwise jump
                    // to the first selected weekday of the next active week.
                    let from_offset = from.weekday().num_days_from_monday() as i64;
                    let week_start =
                        from.checked_sub_days(Days::new(from_offset as u64))?;
                    for &day in &selected {
                        let offset = (day - 1) as i64;
                        if offset > from_offset {
                            return week_start.checked_add_days(Days::new(offset as u64));
                        }
                    }
                    let next_week_start =
                        week_start.checked_add_days(Days::new(interval_days))?;
                    let first_offset = (selected[0] - 1) as u64;
                    return next_week_start
                        .checked_add_days(Days::new(first_offset));
                }
            }
            from.checked_add_days(Days::new(interval_days))
        }
        "monthly" => {
            let interval = clamped_interval(rule) as i32;
            let mut month = from.month() as i32 + interval;
            let mut year = from.year();
            while month > 12 {
                month -= 12;
                year += 1;
            }
            let day = from.day().min(28); // Safe day
            NaiveDate::from_ymd_opt(year, month as u32, day)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Weekday;

    #[test]
    fn test_daily_recurrence() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 1,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        // Format should be a valid date, one day after
        let expected = parse_date("2026-05-12").unwrap();
        assert_eq!(parse_date(&next).unwrap(), expected);
    }

    #[test]
    fn test_daily_interval_2() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 2,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        assert_eq!(parse_date(&next).unwrap(), parse_date("2026-05-13").unwrap());
    }

    #[test]
    fn test_weekly_specific_days() {
        let rule = RecurrenceRule {
            freq: "weekly".into(),
            interval: 1,
            days: Some(vec![1, 3, 5]), // Mon, Wed, Fri
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        // From Monday 2026-05-11 (which is a Monday)
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        // Next should be Wednesday 2026-05-13
        let d = parse_date(&next).unwrap();
        assert_eq!(d.weekday(), Weekday::Wed);
        assert!(d > parse_date("2026-05-11").unwrap());
    }

    #[test]
    fn test_weekly_no_days() {
        let rule = RecurrenceRule {
            freq: "weekly".into(),
            interval: 1,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        assert_eq!(parse_date(&next).unwrap(), parse_date("2026-05-18").unwrap());
    }

    #[test]
    fn test_monthly() {
        let rule = RecurrenceRule {
            freq: "monthly".into(),
            interval: 1,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        assert_eq!(parse_date(&next).unwrap(), parse_date("2026-06-11").unwrap());
    }

    #[test]
    fn test_end_date() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 1,
            days: None,
            end_type: "date".into(),
            end_date: Some("2026-05-12".into()),
            end_count: None,
        };
        // From 2026-05-11, next would be 2026-05-12, but end_date is 05-12, so it should NOT be excluded (end is inclusive)
        let next = next_occurrence(&rule, "2026-05-11");
        assert!(next.is_some());

        // From 2026-05-12, next would be 2026-05-13, which is after end
        let next2 = next_occurrence(&rule, "2026-05-12");
        assert!(next2.is_none());
    }

    #[test]
    fn test_parse_rule() {
        let json = r#"{"freq":"daily","interval":1,"end_type":"never"}"#;
        let rule = parse_rule(json).unwrap();
        assert_eq!(rule.freq, "daily");
    }

    #[test]
    fn next_occurrence_keeps_local_time() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 1,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        // 换日跑也要过：基准来自 due 本身，不回退今天
        let next = next_occurrence(&rule, "2026-11-15T15:00").unwrap();
        assert_eq!(next, "2026-11-16T15:00");
    }

    #[test]
    fn next_occurrence_date_only_stays_date_only() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 1,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        };
        let next = next_occurrence(&rule, "2026-05-11").unwrap();
        assert_eq!(next, "2026-05-12");
        assert_eq!(next.len(), 10);
    }

    #[test]
    fn next_occurrence_end_date_compares_date_part() {
        let rule = RecurrenceRule {
            freq: "daily".into(),
            interval: 1,
            days: None,
            end_type: "date".into(),
            end_date: Some("2026-05-12".into()),
            end_count: None,
        };
        // 候选带时刻、end 为纯日期：按日期部分比较，含端点
        let next = next_occurrence(&rule, "2026-05-11T15:00").unwrap();
        assert_eq!(next, "2026-05-12T15:00");
        assert!(next_occurrence(&rule, "2026-05-12T15:00").is_none());
    }

    fn weekly_rule(interval: i32, days: Option<Vec<i32>>) -> RecurrenceRule {
        RecurrenceRule {
            freq: "weekly".into(),
            interval,
            days,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        }
    }

    fn daily_rule(interval: i32) -> RecurrenceRule {
        RecurrenceRule {
            freq: "daily".into(),
            interval,
            days: None,
            end_type: "never".into(),
            end_date: None,
            end_count: None,
        }
    }

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn weekly_interval_two_skips_off_week_at_week_boundary() {
        // 2026-05-15 is Friday; the next Mon/Wed/Fri in an every-2-weeks
        // schedule is Monday 2026-05-25, not Monday 2026-05-18.
        let rule = weekly_rule(2, Some(vec![1, 3, 5]));
        assert_eq!(
            next_occurrence(&rule, "2026-05-15").as_deref(),
            Some("2026-05-25")
        );
    }

    #[test]
    fn weekly_interval_two_keeps_later_day_in_active_week() {
        let rule = weekly_rule(2, Some(vec![1, 3, 5]));
        assert_eq!(
            next_occurrence(&rule, "2026-05-11").as_deref(),
            Some("2026-05-13")
        );
    }

    #[test]
    fn weekly_single_day_interval_two_adds_two_weeks() {
        let rule = weekly_rule(2, Some(vec![1]));
        assert_eq!(
            next_occurrence(&rule, "2026-05-11").as_deref(),
            Some("2026-05-25")
        );
    }

    #[test]
    fn weekly_empty_days_keeps_weekday() {
        let rule = weekly_rule(2, None);
        assert_eq!(
            next_occurrence(&rule, "2026-05-11").as_deref(),
            Some("2026-05-25")
        );
    }

    #[test]
    fn weekly_days_are_deduped_and_clamped() {
        let rule = weekly_rule(1, Some(vec![1, 1, 9]));
        // 9 clamps to Sunday (7); from Monday the next day is Sunday.
        assert_eq!(
            next_occurrence(&rule, "2026-05-11").as_deref(),
            Some("2026-05-17")
        );
    }

    #[test]
    fn late_daily_completion_lands_after_today() {
        let rule = daily_rule(1);
        assert_eq!(
            next_occurrence_after(&rule, "2026-11-01", date("2026-11-05")).as_deref(),
            Some("2026-11-06")
        );
    }

    #[test]
    fn late_daily_completion_keeps_time_suffix() {
        let rule = daily_rule(1);
        assert_eq!(
            next_occurrence_after(&rule, "2026-11-01T15:00", date("2026-11-05")).as_deref(),
            Some("2026-11-06T15:00")
        );
    }

    #[test]
    fn late_weekly_completion_lands_on_next_active_day() {
        let rule = weekly_rule(1, Some(vec![1]));
        assert_eq!(
            next_occurrence_after(&rule, "2026-05-11", date("2026-05-15")).as_deref(),
            Some("2026-05-18")
        );
    }

    #[test]
    fn late_completion_respects_end_date() {
        let mut rule = daily_rule(1);
        rule.end_type = "date".into();
        rule.end_date = Some("2026-11-05".into());
        assert_eq!(
            next_occurrence_after(&rule, "2026-11-01", date("2026-11-05")),
            None
        );
    }

    #[test]
    fn early_completion_keeps_natural_next_date() {
        let rule = daily_rule(1);
        assert_eq!(
            next_occurrence_after(&rule, "2026-11-10", date("2026-11-05")).as_deref(),
            Some("2026-11-11")
        );
    }

    #[test]
    fn very_late_daily_completion_still_rolls_forward() {
        let rule = daily_rule(1);
        assert_eq!(
            next_occurrence_after(&rule, "1990-01-01", date("2026-01-01")).as_deref(),
            Some("2026-01-02")
        );
    }

    #[test]
    fn huge_interval_does_not_overflow() {
        let rule = daily_rule(i32::MAX);
        let next = next_occurrence(&rule, "2026-01-01").expect("clamped interval");
        assert_eq!(next.len(), 10);
        assert!(next > "2026-01-01".to_string());
    }
}
