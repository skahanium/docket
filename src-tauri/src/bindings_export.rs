//! TypeScript export post-processing for Specta output.

/// Specta 2 RC may emit required numeric fields as `number | null` when targeting `f64`.
/// Normalize known required fields so generated types match serde IPC wire shapes.
pub fn normalize_generated_typescript(source: &str) -> String {
    let mut out = source.to_string();

    // Only normalize entity keys and clearly non-optional counters — not Option<> fields.
    let required_number_fields = [
        "id",
        "task_id",
        "sort_order",
        "hour",
        "sessions",
        "task_count",
        "completed_count",
        "total_minutes",
        "session_count",
        "estimated_total_minutes",
        "scheduled_total_minutes",
        "actual_focus_minutes",
        "available_minutes",
        "actual_minutes",
        "total_tasks",
        "completed_tasks",
        "focus_sessions",
        "total_focus_minutes",
        "total",
        "completed",
        "today_count",
        "overdue_count",
        "scheduled_minutes",
        "duration_minutes",
        "minutes",
    ];

    for field in required_number_fields {
        let from = format!("\t{field}: number | null,");
        let to = format!("\t{field}: number,");
        out = out.replace(&from, &to);
    }

    let required_float_fields = [
        "weekly_completion_rate",
        "overall_accuracy",
        "plan_accuracy",
    ];

    for field in required_float_fields {
        let from = format!("\t{field}: number | null,");
        let to = format!("\t{field}: number,");
        out = out.replace(&from, &to);
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_required_ids() {
        let raw = "export type Tag = {\n\tid: number | null,\n\tname: string,\n};\n";
        let fixed = normalize_generated_typescript(raw);
        assert!(fixed.contains("id: number,"));
        assert!(!fixed.contains("id: number | null"));
    }
}
