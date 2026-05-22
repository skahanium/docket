//! HH:MM clock helpers shared by schedule and analytics commands.

/// Local calendar date as `YYYY-MM-DD` (used for "today" / overdue boundaries).
pub fn local_today_date() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Parse `"HH:MM"` into minutes since midnight.
pub fn time_to_minutes(time: &str) -> i64 {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() == 2 {
        let h: i64 = parts[0].parse().unwrap_or(0);
        let m: i64 = parts[1].parse().unwrap_or(0);
        h * 60 + m
    } else {
        0
    }
}

/// Format minutes since midnight as `"HH:MM"`.
pub fn minutes_to_time(minutes: i64) -> String {
    let h = minutes / 60;
    let m = minutes % 60;
    format!("{:02}:{:02}", h, m)
}

/// Elapsed minutes from `start` to `end` on the same day; returns 0 if `end <= start`.
pub fn time_diff_minutes(start: &str, end: &str) -> i64 {
    let s = time_to_minutes(start);
    let e = time_to_minutes(end);
    if e > s { e - s } else { 0 }
}

/// Add `add` minutes to a `"HH:MM"` time string.
pub fn add_minutes(time: &str, add: i64) -> String {
    minutes_to_time(time_to_minutes(time) + add)
}

/// Validate that a string is a valid `"HH:MM"` time (00:00–23:59).
pub fn is_valid_hhmm(s: &str) -> bool {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let Ok(h) = parts[0].parse::<u32>() else {
        return false;
    };
    let Ok(m) = parts[1].parse::<u32>() else {
        return false;
    };
    h < 24 && m < 60 && parts[0].len() == 2 && parts[1].len() == 2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_today_is_yyyy_mm_dd() {
        let d = local_today_date();
        assert_eq!(d.len(), 10);
        assert!(d.as_bytes()[4] == b'-');
    }

    #[test]
    fn round_trip_minutes() {
        assert_eq!(time_to_minutes("08:30"), 8 * 60 + 30);
        assert_eq!(minutes_to_time(8 * 60 + 30), "08:30");
    }

    #[test]
    fn diff_and_add() {
        assert_eq!(time_diff_minutes("08:30", "12:00"), 210);
        assert_eq!(add_minutes("08:30", 45), "09:15");
    }

    #[test]
    fn invalid_time_returns_zero() {
        assert_eq!(time_to_minutes("invalid"), 0);
        assert_eq!(time_diff_minutes("12:00", "08:00"), 0);
    }

    #[test]
    fn valid_hhmm_check() {
        assert!(is_valid_hhmm("08:30"));
        assert!(is_valid_hhmm("23:59"));
        assert!(is_valid_hhmm("00:00"));
        assert!(!is_valid_hhmm("24:00"));
        assert!(!is_valid_hhmm("8:30"));
        assert!(!is_valid_hhmm("abc"));
        assert!(!is_valid_hhmm("0830"));
    }
}
