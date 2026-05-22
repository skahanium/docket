use crate::models::RecurrenceRule;
use chrono::{Datelike, Days, NaiveDate, Utc, Weekday};

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

fn format_date(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn get_weekday_num(w: Weekday) -> i32 {
    match w {
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
        Weekday::Sun => 7,
    }
}

pub fn parse_rule(json: &str) -> Option<RecurrenceRule> {
    serde_json::from_str(json).ok()
}

pub fn next_occurrence(rule: &RecurrenceRule, current_date: &str) -> Option<String> {
    let today = Utc::now().date_naive();
    let current = parse_date(current_date).unwrap_or(today);

    if let Some(next) = next_occurrence_from(rule, current) {
        // Check end conditions
        if let Some(ref end_date_str) = rule.end_date {
            if let Some(end_date) = parse_date(end_date_str) {
                if next > end_date {
                    return None;
                }
            }
        }
        Some(format_date(next))
    } else {
        None
    }
}

fn next_occurrence_from(rule: &RecurrenceRule, from: NaiveDate) -> Option<NaiveDate> {
    match rule.freq.as_str() {
        "daily" => {
            let interval = rule.interval.max(1);
            Some(from + Days::new(interval as u64))
        }
        "weekly" => {
            let interval_days = (rule.interval.max(1) * 7) as u64;
            if let Some(ref days) = rule.days {
                if !days.is_empty() {
                    let from_weekday = get_weekday_num(from.weekday());
                    let mut best: Option<NaiveDate> = None;
                    for &day in days.iter() {
                        let day = day.max(1).min(7);
                        let day_diff = (day - from_weekday + 7) % 7;
                        let candidate = if day_diff == 0 {
                            from + Days::new(interval_days)
                        } else {
                            from + Days::new(day_diff as u64)
                        };
                        best = Some(match best {
                            None => candidate,
                            Some(b) => if candidate < b { candidate } else { b },
                        });
                    }
                    return best;
                }
            }
            Some(from + Days::new(interval_days))
        }
        "monthly" => {
            let interval = rule.interval.max(1);
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
}
