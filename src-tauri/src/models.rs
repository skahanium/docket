use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Category {
    #[specta(type = f64)]
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    #[specta(type = Option<f64>)]
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Tag {
    #[specta(type = f64)]
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Subtask {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub task_id: i64,
    pub title: String,
    pub status: String,      // 'pending' | 'completed'
    pub sort_order: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Reminder {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub task_id: i64,
    pub remind_at: String,
    pub notified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TaskSummary {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub status: String,
    pub priority: i32,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub created_at: String,
    pub tags: Vec<Tag>,
    pub subtasks_progress: SubtaskProgress,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SubtaskProgress {
    pub total: i32,
    pub completed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TaskWithDetails {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: i32,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub recurrence_rule: Option<String>,
    #[specta(type = Option<f64>)]
    pub recurrence_parent_id: Option<i64>,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
    pub tags: Vec<Tag>,
    pub subtasks: Vec<Subtask>,
    pub reminders: Vec<Reminder>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CalendarDay {
    pub date: String,
    pub task_count: i32,
    pub completed_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Statistics {
    pub today_count: i32,
    pub overdue_count: i32,
    pub weekly_completion_rate: f64,
    pub daily_counts: Vec<DailyCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DailyCount {
    pub date: String,
    pub completed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub freq: String,            // "daily" | "weekly" | "monthly"
    pub interval: i32,
    pub days: Option<Vec<i32>>,  // 1=Mon..7=Sun, only for weekly
    pub end_type: String,        // "never" | "date" | "count"
    pub end_date: Option<String>,
    pub end_count: Option<i32>,
}

impl SubtaskProgress {
    pub fn new(total: i32, completed: i32) -> Self {
        Self { total, completed }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FocusSession {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub task_id: i64,
    pub task_title: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    #[specta(type = Option<f64>)]
    pub duration_minutes: Option<i64>,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FocusSummary {
    #[specta(type = f64)]
    pub total_minutes: i64,
    #[specta(type = f64)]
    pub session_count: i64,
    pub sessions: Vec<FocusSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PlaybookStepInput {
    pub title: String,
    pub optional: bool,
    pub evidence_required: bool,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PlaybookStep {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub playbook_id: i64,
    pub title: String,
    pub sort_order: i32,
    pub optional: bool,
    pub evidence_required: bool,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Playbook {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub archived_at: Option<String>,
    pub steps: Vec<PlaybookStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterStepLink {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub matter_step_id: i64,
    pub kind: String,
    pub path: String,
    pub created_at: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterStepBrief {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub sort_order: i32,
    pub evidence_required: bool,
    pub status: String,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterStep {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = f64)]
    pub matter_id: i64,
    #[specta(type = Option<f64>)]
    pub playbook_step_id: Option<i64>,
    pub title: String,
    pub sort_order: i32,
    pub evidence_required: bool,
    pub status: String,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
    pub completed_at: Option<String>,
    pub links: Vec<MatterStepLink>,
    pub missing_evidence: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterSummary {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = Option<f64>)]
    pub playbook_id: Option<i64>,
    pub title: String,
    pub status: String,
    pub priority: i32,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub due_date: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub tags: Vec<Tag>,
    pub current_step: Option<MatterStepBrief>,
    pub missing_evidence: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterDetail {
    #[specta(type = f64)]
    pub id: i64,
    #[specta(type = Option<f64>)]
    pub playbook_id: Option<i64>,
    pub title: String,
    pub status: String,
    pub priority: i32,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub tags: Vec<Tag>,
    pub steps: Vec<MatterStep>,
    pub current_step: Option<MatterStepBrief>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Cadence {
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub period: String,
    #[specta(type = Option<f64>)]
    pub target_count: Option<i64>,
    pub created_at: String,
    #[specta(type = Vec<f64>)]
    pub playbook_ids: Vec<i64>,
    #[specta(type = Vec<f64>)]
    pub tag_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CadenceProgress {
    pub cadence: Cadence,
    pub completed_count: i32,
    pub matching_matters: Vec<MatterSummary>,
    pub period_start: String,
    pub period_end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgendaItem {
    pub kind: String,
    #[specta(type = f64)]
    pub id: i64,
    pub title: String,
    pub subtitle: Option<String>,
    pub due_date: Option<String>,
    pub priority: i32,
    #[specta(type = Option<f64>)]
    pub matter_id: Option<i64>,
    pub missing_evidence: bool,
}

