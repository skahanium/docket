use crate::db::{lock_conn, DbState};
use crate::error::AppResult;
use crate::matter::{
    add_matter_step_on_conn, add_tag_to_matter_on_conn, complete_matter_step_on_conn,
    create_blank_matter_on_conn, get_matter_on_conn, list_matters_on_conn, remove_tag_from_matter_on_conn,
    reopen_matter_step_on_conn, skip_matter_step_on_conn, update_matter_on_conn,
    update_matter_step_on_conn,
};
use crate::models::{MatterDetail, MatterSummary};
use crate::playbook::instantiate_matter_on_conn;
use rusqlite::Connection;
use specta::Type;
use tauri::{AppHandle, State};

#[derive(Debug, serde::Deserialize, Type)]
pub struct CreateMatterInput {
    #[specta(type = f64)]
    pub playbook_id: i64,
    pub title: String,
    pub priority: Option<i32>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub due_date: Option<String>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct CreateBlankMatterInput {
    pub title: String,
    pub priority: Option<i32>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub due_date: Option<String>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct UpdateMatterInput {
    pub title: Option<String>,
    pub priority: Option<i32>,
    #[specta(type = Option<f64>)]
    pub category_id: Option<i64>,
    pub due_date: Option<String>,
    pub clear_category_id: Option<bool>,
    pub clear_due_date: Option<bool>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct AddMatterStepInput {
    pub title: String,
    pub evidence_required: Option<bool>,
    pub due_date: Option<String>,
    #[specta(type = Option<f64>)]
    pub estimated_minutes: Option<i64>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct UpdateMatterStepInput {
    pub due_date: Option<String>,
    pub clear_due_date: Option<bool>,
}

#[tauri::command]
pub fn list_matters(state: State<DbState>, status: Option<String>) -> Result<Vec<MatterSummary>, String> {
    let conn = lock_conn(&state)?;
    list_matters_on_conn(&conn, status.as_deref()).map_err(Into::into)
}

#[tauri::command]
pub fn create_matter(
    app: AppHandle,
    state: State<DbState>,
    input: CreateMatterInput,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = instantiate_matter_on_conn(
        &conn,
        input.playbook_id,
        &input.title,
        input.priority.unwrap_or(0),
        input.category_id,
        input.due_date.as_deref(),
    )?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn create_blank_matter(
    app: AppHandle,
    state: State<DbState>,
    input: CreateBlankMatterInput,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = create_blank_matter_on_conn(
        &conn,
        &input.title,
        input.priority.unwrap_or(0),
        input.category_id,
        input.due_date.as_deref(),
    )?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn get_matter(state: State<DbState>, id: i64) -> Result<MatterDetail, String> {
    let conn = lock_conn(&state)?;
    get_matter_on_conn(&conn, id).map_err(Into::into)
}

pub(crate) fn apply_update_matter_input(
    conn: &Connection,
    id: i64,
    input: UpdateMatterInput,
) -> AppResult<()> {
    let category = if input.clear_category_id.unwrap_or(false) {
        Some(None)
    } else {
        input.category_id.map(Some)
    };
    let due = if input.clear_due_date.unwrap_or(false) {
        Some(None)
    } else {
        input.due_date.as_deref().map(Some)
    };
    update_matter_on_conn(conn, id, input.title.as_deref(), input.priority, category, due)
}

#[tauri::command]
pub fn update_matter(
    app: AppHandle,
    state: State<DbState>,
    id: i64,
    input: UpdateMatterInput,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    apply_update_matter_input(&conn, id, input)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn complete_matter_step(app: AppHandle, state: State<DbState>, step_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    complete_matter_step_on_conn(&conn, step_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn skip_matter_step(app: AppHandle, state: State<DbState>, step_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    skip_matter_step_on_conn(&conn, step_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn reopen_matter_step(app: AppHandle, state: State<DbState>, step_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    reopen_matter_step_on_conn(&conn, step_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn add_matter_step(
    app: AppHandle,
    state: State<DbState>,
    matter_id: i64,
    input: AddMatterStepInput,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = add_matter_step_on_conn(
        &conn,
        matter_id,
        &input.title,
        input.evidence_required.unwrap_or(false),
        input.due_date.as_deref(),
        input.estimated_minutes,
    )?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn update_matter_step(
    app: AppHandle,
    state: State<DbState>,
    step_id: i64,
    input: UpdateMatterStepInput,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let due = if input.clear_due_date.unwrap_or(false) {
        Some(None)
    } else {
        input.due_date.as_deref().map(Some)
    };
    update_matter_step_on_conn(&conn, step_id, due)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn add_tag_to_matter(
    app: AppHandle,
    state: State<DbState>,
    matter_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    add_tag_to_matter_on_conn(&conn, matter_id, tag_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn remove_tag_from_matter(
    app: AppHandle,
    state: State<DbState>,
    matter_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    remove_tag_from_matter_on_conn(&conn, matter_id, tag_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}
