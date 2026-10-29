use crate::cadence::{
    cadence_progress_on_conn, create_cadence_on_conn, list_cadences_on_conn, update_cadence_on_conn,
};
use crate::db::{lock_conn, DbState};
use crate::models::{Cadence, CadenceProgress};
use specta::Type;
use tauri::State;

#[derive(Debug, serde::Deserialize, Type)]
pub struct CreateCadenceInput {
    pub title: String,
    pub period: String,
    #[specta(type = Option<f64>)]
    pub target_count: Option<i64>,
    #[specta(type = Vec<f64>)]
    pub playbook_ids: Option<Vec<i64>>,
    #[specta(type = Vec<f64>)]
    pub tag_ids: Option<Vec<i64>>,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct UpdateCadenceInput {
    pub title: Option<String>,
    pub period: Option<String>,
    #[specta(type = Option<f64>)]
    pub target_count: Option<i64>,
    pub clear_target_count: Option<bool>,
    #[specta(type = Option<Vec<f64>>)]
    pub playbook_ids: Option<Vec<i64>>,
    #[specta(type = Option<Vec<f64>>)]
    pub tag_ids: Option<Vec<i64>>,
}

#[tauri::command]
pub fn list_cadences(state: State<DbState>) -> Result<Vec<Cadence>, String> {
    let conn = lock_conn(&state)?;
    list_cadences_on_conn(&conn).map_err(Into::into)
}

#[tauri::command]
pub fn create_cadence(state: State<DbState>, input: CreateCadenceInput) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    create_cadence_on_conn(
        &conn,
        &input.title,
        &input.period,
        input.target_count,
        input.playbook_ids.as_deref().unwrap_or(&[]),
        input.tag_ids.as_deref().unwrap_or(&[]),
    )
    .map_err(Into::into)
}

#[tauri::command]
pub fn update_cadence(
    state: State<DbState>,
    id: i64,
    input: UpdateCadenceInput,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let target = if input.clear_target_count.unwrap_or(false) {
        Some(None)
    } else {
        input.target_count.map(Some)
    };
    update_cadence_on_conn(
        &conn,
        id,
        input.title.as_deref(),
        input.period.as_deref(),
        target,
        input.playbook_ids.as_deref(),
        input.tag_ids.as_deref(),
    )
    .map_err(Into::into)
}

#[tauri::command]
pub fn get_cadence_progress(
    state: State<DbState>,
    id: i64,
    as_of: Option<String>,
) -> Result<CadenceProgress, String> {
    let conn = lock_conn(&state)?;
    let as_of = as_of.unwrap_or_else(crate::time::local_today_date);
    cadence_progress_on_conn(&conn, id, &as_of).map_err(Into::into)
}
