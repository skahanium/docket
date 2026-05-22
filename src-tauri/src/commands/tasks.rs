use crate::db::{lock_conn, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{SubtaskProgress, Tag, TaskSummary, TaskWithDetails};
use chrono::Utc;
use rusqlite::{params_from_iter, Connection};
use specta::Type;
use std::collections::HashMap;
use tauri::{AppHandle, State};

use crate::db::task_status;

#[derive(Debug, serde::Deserialize, Type)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub recurrence_rule: Option<String>,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
    pub clear_description: Option<bool>,
    pub clear_due_date: Option<bool>,
    pub clear_category_id: Option<bool>,
    pub clear_estimated_minutes: Option<bool>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct ListTasksFilters {
    pub status: Option<String>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    #[specta(type = Option<f64>)]
    pub tag_id: Option<i64>,
    pub due_date: Option<String>,
    pub search_query: Option<String>,
    pub today_view: Option<bool>,
    pub overdue_view: Option<bool>,
    pub priority: Option<i32>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct SortOption {
    pub field: Option<String>,
    pub direction: Option<String>,
}

pub fn create_task_on_conn(conn: &Connection, input: CreateTaskInput) -> AppResult<i64> {
    let now = Utc::now().to_rfc3339();
    let priority = input.priority.unwrap_or(0);

    conn.execute(
        "INSERT INTO tasks (title, description, priority, due_date, category_id, recurrence_rule, estimated_minutes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            input.title,
            input.description,
            priority,
            input.due_date,
            input.category_id,
            input.recurrence_rule,
            input.estimated_minutes,
            now,
            now,
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn create_task(app: AppHandle, state: State<DbState>, input: CreateTaskInput) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = create_task_on_conn(&conn, input).map_err(|e: AppError| e.to_string())?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn update_task(app: AppHandle, state: State<DbState>, id: i64, input: UpdateTaskInput) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];

    if let Some(ref title) = input.title {
        sets.push(format!("title = ?{}", params.len() + 1));
        params.push(Box::new(title.clone()));
    }
    if let Some(ref description) = input.description {
        sets.push(format!("description = ?{}", params.len() + 1));
        params.push(Box::new(description.clone()));
    }
    if let Some(priority) = input.priority {
        sets.push(format!("priority = ?{}", params.len() + 1));
        params.push(Box::new(priority));
    }
    if let Some(ref due_date) = input.due_date {
        sets.push(format!("due_date = ?{}", params.len() + 1));
        params.push(Box::new(due_date.clone()));
    }
    if let Some(category_id) = input.category_id {
        sets.push(format!("category_id = ?{}", params.len() + 1));
        params.push(Box::new(category_id));
    }
    if let Some(estimated_minutes) = input.estimated_minutes {
        sets.push(format!("estimated_minutes = ?{}", params.len() + 1));
        params.push(Box::new(estimated_minutes));
    }
    if input.clear_description.unwrap_or(false) {
        sets.push(format!("description = NULL"));
    }
    if input.clear_due_date.unwrap_or(false) {
        sets.push(format!("due_date = NULL"));
    }
    if input.clear_category_id.unwrap_or(false) {
        sets.push(format!("category_id = NULL"));
    }
    if input.clear_estimated_minutes.unwrap_or(false) {
        sets.push(format!("estimated_minutes = NULL"));
    }

    let where_clause = format!(" WHERE id = ?{}", params.len() + 1);
    params.push(Box::new(id));

    let sql = format!("UPDATE tasks SET {} {}", sets.join(", "), where_clause);
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

pub fn complete_task_on_conn(conn: &Connection, id: i64) -> AppResult<()> {
    let now = Utc::now().to_rfc3339();
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "UPDATE subtasks SET status='completed', completed_at=?1 WHERE task_id=?2 AND status='pending'",
        rusqlite::params![now, id],
    )?;

    tx.execute(
        &format!("UPDATE tasks SET status='{}', completed_at=?1, updated_at=?2 WHERE id=?3", task_status::COMPLETED),
        rusqlite::params![now, now, id],
    )?;

    let recurrence_rule: Option<String> = tx
        .query_row(
            "SELECT recurrence_rule FROM tasks WHERE id=?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    if let Some(rule_json) = recurrence_rule {
        if let Some(rule) = crate::recurrence::parse_rule(&rule_json) {
            let due_date: Option<String> = tx
                .query_row(
                    "SELECT due_date FROM tasks WHERE id=?1",
                    rusqlite::params![id],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            let base_date = due_date.unwrap_or(now.clone());
            if let Some(next_date) = crate::recurrence::next_occurrence(&rule, &base_date) {
                let should_create = if let Some(ref end_count) = rule.end_count {
                    let existing: i64 = tx
                        .query_row(
                            "SELECT COUNT(*) FROM tasks WHERE recurrence_parent_id=?1 OR id=?1",
                            rusqlite::params![id],
                            |row| row.get(0),
                        )
                        .unwrap_or(0);
                    existing < *end_count as i64
                } else {
                    true
                };

                if should_create {
                    tx.execute(
                        "INSERT INTO tasks (title, description, priority, due_date, category_id, recurrence_rule, estimated_minutes, recurrence_parent_id, created_at, updated_at, status)
                         SELECT title, description, priority, ?1, category_id, recurrence_rule, estimated_minutes, ?2, ?3, ?4, 'active'
                         FROM tasks WHERE id=?5",
                        rusqlite::params![next_date, id, now, now, id],
                    )?;
                }
            }
        }
    }

    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn complete_task(app: AppHandle, state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    complete_task_on_conn(&conn, id).map_err(|e: AppError| e.to_string())?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn delete_task(app: AppHandle, state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    conn.execute("DELETE FROM tasks WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

pub fn get_task_on_conn(conn: &Connection, id: i64) -> AppResult<TaskWithDetails> {

    let task = conn
        .query_row(
            "SELECT id, title, description, status, priority, due_date, category_id,
                    recurrence_rule, recurrence_parent_id, estimated_minutes, created_at, updated_at, completed_at, archived_at
             FROM tasks WHERE id=?1",
            rusqlite::params![id],
            |row| {
                Ok(TaskWithDetails {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    due_date: row.get(5)?,
                    category_id: row.get(6)?,
                    recurrence_rule: row.get(7)?,
                    recurrence_parent_id: row.get(8)?,
                    estimated_minutes: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    completed_at: row.get(12)?,
                    archived_at: row.get(13)?,
                    tags: vec![],
                    subtasks: vec![],
                    reminders: vec![],
                })
            },
        )
        .map_err(|_| AppError::TaskNotFound { id })?;

    let mut task = task;

    // Load tags
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color FROM tags t
             INNER JOIN task_tags tt ON t.id = tt.tag_id
             WHERE tt.task_id=?1",
        )
        ?;
    for tag in stmt.query_map(rusqlite::params![id], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
        })
    })? {
        task.tags.push(tag?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, task_id, title, status, sort_order, created_at, completed_at
         FROM subtasks WHERE task_id=?1 ORDER BY sort_order",
    )?;
    for sub in stmt.query_map(rusqlite::params![id], |row| {
        Ok(crate::models::Subtask {
            id: row.get(0)?,
            task_id: row.get(1)?,
            title: row.get(2)?,
            status: row.get(3)?,
            sort_order: row.get(4)?,
            created_at: row.get(5)?,
            completed_at: row.get(6)?,
        })
    })? {
        task.subtasks.push(sub?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, task_id, remind_at, notified FROM reminders WHERE task_id=?1",
    )?;
    for rem in stmt.query_map(rusqlite::params![id], |row| {
        Ok(crate::models::Reminder {
            id: row.get(0)?,
            task_id: row.get(1)?,
            remind_at: row.get(2)?,
            notified: row.get::<_, i32>(3)? != 0,
        })
    })? {
        task.reminders.push(rem?);
    }

    Ok(task)
}

#[tauri::command]
pub fn get_task(state: State<DbState>, id: i64) -> Result<TaskWithDetails, String> {
    let conn = lock_conn(&state)?;
    get_task_on_conn(&conn, id).map_err(Into::into)
}

/// List tasks with tags and subtask progress loaded in O(1) extra queries (not per row).
pub fn list_tasks_on_conn(
    conn: &Connection,
    filters: ListTasksFilters,
    sort: SortOption,
) -> AppResult<Vec<TaskSummary>> {
    let mut sql = String::from(
        "SELECT DISTINCT t.id, t.title, t.status, t.priority, t.due_date, t.category_id, t.created_at
         FROM tasks t",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    let mut conditions: Vec<String> = vec![];

    if let Some(ref status) = filters.status {
        conditions.push(format!("t.status = ?{}", params.len() + 1));
        params.push(Box::new(status.clone()));
    }
    if let Some(category_id) = filters.category_id {
        conditions.push(format!("t.category_id = ?{}", params.len() + 1));
        params.push(Box::new(category_id));
    }
    if let Some(tag_id) = filters.tag_id {
        sql.push_str(" INNER JOIN task_tags tt_filter ON t.id = tt_filter.task_id");
        conditions.push(format!("tt_filter.tag_id = ?{}", params.len() + 1));
        params.push(Box::new(tag_id));
    }
    if let Some(ref due_date) = filters.due_date {
        conditions.push(format!("t.due_date = ?{}", params.len() + 1));
        params.push(Box::new(due_date.clone()));
    }
    if let Some(ref search) = filters.search_query {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let escaped = trimmed.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
            conditions.push(format!(
                "(t.title LIKE ?{} ESCAPE '\\' OR t.description LIKE ?{0} ESCAPE '\\')",
                params.len() + 1
            ));
            params.push(Box::new(format!("%{}%", escaped)));
        }
    }
    if let Some(priority) = filters.priority {
        conditions.push(format!("t.priority = ?{}", params.len() + 1));
        params.push(Box::new(priority));
    }
    if filters.today_view.unwrap_or(false) {
        let today = crate::time::local_today_date();
        conditions.push(format!(
            "(t.due_date = ?{} OR (t.priority >= 2 AND (t.due_date IS NULL OR t.due_date >= ?{})))",
            params.len() + 1,
            params.len() + 2
        ));
        params.push(Box::new(today.clone()));
        params.push(Box::new(today));
    }
    if filters.overdue_view.unwrap_or(false) {
        let today = crate::time::local_today_date();
        conditions.push(format!(
            "t.due_date IS NOT NULL AND t.due_date < ?{}",
            params.len() + 1
        ));
        params.push(Box::new(today));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    let field = sort.field.as_deref().unwrap_or("created_at");
    let dir = sort.direction.as_deref().unwrap_or("DESC");
    let allowed_fields = ["created_at", "due_date", "priority", "title", "archived_at"];
    let sort_field = if allowed_fields.contains(&field) {
        field
    } else {
        "created_at"
    };
    let sort_dir = if dir.to_uppercase() == "ASC" {
        "ASC"
    } else {
        "DESC"
    };
    sql.push_str(&format!(" ORDER BY t.{} {}", sort_field, sort_dir));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;

    let mut tasks: Vec<TaskSummary> = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(TaskSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                priority: row.get(3)?,
                due_date: row.get(4)?,
                category_id: row.get(5)?,
                created_at: row.get(6)?,
                tags: vec![],
                subtasks_progress: SubtaskProgress::new(0, 0),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    if tasks.is_empty() {
        return Ok(tasks);
    }

    let task_ids: Vec<i64> = tasks.iter().map(|t| t.id).collect();
    let tags_by_task = load_tags_for_task_ids(conn, &task_ids)?;
    let progress_by_task = load_subtask_progress_for_task_ids(conn, &task_ids)?;

    for task in &mut tasks {
        task.tags = tags_by_task.get(&task.id).cloned().unwrap_or_default();
        let (total, completed) = progress_by_task
            .get(&task.id)
            .copied()
            .unwrap_or((0, 0));
        task.subtasks_progress = SubtaskProgress::new(total, completed);
    }

    Ok(tasks)
}

fn load_tags_for_task_ids(
    conn: &Connection,
    task_ids: &[i64],
) -> AppResult<HashMap<i64, Vec<Tag>>> {
    let mut map: HashMap<i64, Vec<Tag>> = HashMap::new();
    if task_ids.is_empty() {
        return Ok(map);
    }

    let placeholders = (0..task_ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT tt.task_id, tg.id, tg.name, tg.color
         FROM task_tags tt
         INNER JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.task_id IN ({placeholders})
         ORDER BY tt.task_id, tg.name"
    );

    let mut stmt = conn.prepare(&sql)?;
    for row in stmt.query_map(params_from_iter(task_ids.iter().copied()), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            Tag {
                id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            },
        ))
    })? {
        let (task_id, tag) = row?;
        map.entry(task_id).or_default().push(tag);
    }
    Ok(map)
}

fn load_subtask_progress_for_task_ids(
    conn: &Connection,
    task_ids: &[i64],
) -> AppResult<HashMap<i64, (i32, i32)>> {
    let mut map: HashMap<i64, (i32, i32)> = HashMap::new();
    if task_ids.is_empty() {
        return Ok(map);
    }

    let placeholders = (0..task_ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT task_id,
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS completed
         FROM subtasks
         WHERE task_id IN ({placeholders})
         GROUP BY task_id"
    );

    let mut stmt = conn.prepare(&sql)?;
    for row in stmt.query_map(params_from_iter(task_ids.iter().copied()), |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?, row.get::<_, i32>(2)?))
    })? {
        let (task_id, total, completed) = row?;
        map.insert(task_id, (total, completed));
    }
    Ok(map)
}

#[tauri::command]
pub fn list_tasks(
    state: State<DbState>,
    filters: ListTasksFilters,
    sort: SortOption,
) -> Result<Vec<TaskSummary>, String> {
    let conn = lock_conn(&state)?;
    list_tasks_on_conn(&conn, filters, sort).map_err(Into::into)
}

#[tauri::command]
pub fn archive_task(app: AppHandle, state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        &format!("UPDATE tasks SET status='{}', archived_at=?1, updated_at=?2 WHERE id=?3", task_status::ARCHIVED),
        rusqlite::params![now, now, id],
    ).map_err(|e| e.to_string())?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn restore_task(app: AppHandle, state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        &format!("UPDATE tasks SET status='{}', archived_at=NULL, updated_at=?1 WHERE id=?2", task_status::ACTIVE),
        rusqlite::params![now, id],
    ).map_err(|e| e.to_string())?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn list_archived(state: State<DbState>) -> Result<Vec<TaskSummary>, String> {
    let conn = lock_conn(&state)?;
    list_tasks_on_conn(
        &conn,
        ListTasksFilters {
            status: Some(task_status::ARCHIVED.into()),
            category_id: None,
            tag_id: None,
            due_date: None,
            search_query: None,
            today_view: None,
            overdue_view: None,
            priority: None,
        },
        SortOption {
            field: Some("archived_at".into()),
            direction: Some("DESC".into()),
        },
    )
    .map_err(Into::into)
}

#[cfg(test)]
mod list_tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        conn
    }

    fn insert_task(conn: &Connection, title: &str) -> i64 {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO tasks (title, status, priority, created_at, updated_at)
             VALUES (?1, 'active', 0, ?2, ?2)",
            rusqlite::params![title, now],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn list_tasks_batch_loads_tags_and_subtask_progress() {
        let conn = setup_conn();

        let task_a = insert_task(&conn, "Alpha");
        let task_b = insert_task(&conn, "Beta");

        conn.execute(
            "INSERT INTO tags (name, color) VALUES ('urgent', '#f00'), ('home', '#0f0')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_tags (task_id, tag_id) VALUES (?1, 1), (?1, 2), (?2, 2)",
            rusqlite::params![task_a, task_b],
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO subtasks (task_id, title, status, sort_order, created_at)
             VALUES (?1, 's1', 'completed', 0, ?3),
                    (?1, 's2', 'pending', 1, ?3),
                    (?2, 's3', 'completed', 0, ?3)",
            rusqlite::params![task_a, task_b, now],
        )
        .unwrap();

        let summaries = list_tasks_on_conn(
            &conn,
            ListTasksFilters {
                status: Some("active".into()),
                category_id: None,
                tag_id: None,
                due_date: None,
                search_query: None,
                today_view: None,
                overdue_view: None,
                priority: None,
            },
            SortOption {
                field: Some("title".into()),
                direction: Some("ASC".into()),
            },
        )
        .unwrap();

        assert_eq!(summaries.len(), 2);
        let alpha = summaries.iter().find(|t| t.title == "Alpha").unwrap();
        let beta = summaries.iter().find(|t| t.title == "Beta").unwrap();

        assert_eq!(alpha.tags.len(), 2);
        assert_eq!(beta.tags.len(), 1);
        assert_eq!(alpha.subtasks_progress.total, 2);
        assert_eq!(alpha.subtasks_progress.completed, 1);
        assert_eq!(beta.subtasks_progress.total, 1);
        assert_eq!(beta.subtasks_progress.completed, 1);
    }

    #[test]
    fn list_tasks_filter_by_tag_uses_stable_join_alias() {
        let conn = setup_conn();
        let task_a = insert_task(&conn, "Tagged");
        let _task_b = insert_task(&conn, "Plain");

        conn.execute("INSERT INTO tags (name, color) VALUES ('solo', '#111')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO task_tags (task_id, tag_id) VALUES (?1, 1)",
            [task_a],
        )
        .unwrap();

        let filtered = list_tasks_on_conn(
            &conn,
            ListTasksFilters {
                status: Some("active".into()),
                category_id: None,
                tag_id: Some(1),
                due_date: None,
                search_query: None,
                today_view: None,
                overdue_view: None,
                priority: None,
            },
            SortOption {
                field: None,
                direction: None,
            },
        )
        .unwrap();

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].title, "Tagged");
    }
}
