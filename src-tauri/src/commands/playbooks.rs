use crate::db::{lock_conn, DbState};
use crate::models::{Playbook, PlaybookStepInput};
use crate::playbook::{
    create_playbook_on_conn, get_playbook_on_conn, list_playbooks_on_conn, set_playbook_steps_on_conn,
    update_playbook_on_conn,
};
use specta::Type;
use tauri::State;

#[derive(Debug, serde::Deserialize, Type)]
pub struct CreatePlaybookInput {
    pub title: String,
}

#[derive(Debug, serde::Deserialize, Type)]
pub struct UpdatePlaybookInput {
    pub title: Option<String>,
    pub archived: Option<bool>,
}

#[tauri::command]
pub fn list_playbooks(
    state: State<DbState>,
    include_archived: Option<bool>,
) -> Result<Vec<Playbook>, String> {
    let conn = lock_conn(&state)?;
    list_playbooks_on_conn(&conn, include_archived.unwrap_or(false)).map_err(Into::into)
}

#[tauri::command]
pub fn create_playbook(state: State<DbState>, input: CreatePlaybookInput) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    create_playbook_on_conn(&conn, &input.title).map_err(Into::into)
}

#[tauri::command]
pub fn update_playbook(
    state: State<DbState>,
    id: i64,
    input: UpdatePlaybookInput,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    update_playbook_on_conn(&conn, id, input.title.as_deref(), input.archived).map_err(Into::into)
}

#[tauri::command]
pub fn set_playbook_steps(
    state: State<DbState>,
    playbook_id: i64,
    steps: Vec<PlaybookStepInput>,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    set_playbook_steps_on_conn(&conn, playbook_id, &steps).map_err(Into::into)
}

#[tauri::command]
pub fn get_playbook(state: State<DbState>, id: i64) -> Result<Playbook, String> {
    let conn = lock_conn(&state)?;
    get_playbook_on_conn(&conn, id).map_err(Into::into)
}
