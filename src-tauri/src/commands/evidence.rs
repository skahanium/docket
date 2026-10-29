use crate::db::{lock_conn, DbState};
use crate::evidence::{
    add_step_link_on_conn, get_step_link_on_conn, path_exists, pathbuf_to_stored_path,
    remove_step_link_on_conn, replace_step_link_on_conn,
};
use crate::models::MatterStepLink;
use specta::Type;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, serde::Deserialize, Type)]
pub struct AddStepLinkInput {
    pub kind: String,
    pub path: String,
}

#[tauri::command]
pub fn add_step_link(
    app: AppHandle,
    state: State<DbState>,
    matter_step_id: i64,
    input: AddStepLinkInput,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = add_step_link_on_conn(&conn, matter_step_id, &input.kind, &input.path)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn remove_step_link(app: AppHandle, state: State<DbState>, link_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    remove_step_link_on_conn(&conn, link_id)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn replace_step_link(
    app: AppHandle,
    state: State<DbState>,
    link_id: i64,
    path: String,
) -> Result<i64, String> {
    let conn = lock_conn(&state)?;
    let id = replace_step_link_on_conn(&conn, link_id, &path)?;
    crate::app_windows::emit_tasks_changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn open_step_link(app: AppHandle, state: State<DbState>, link_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let link = get_step_link_on_conn(&conn, link_id)?;
    drop(conn);
    if !path_exists(&link.path) {
        return Err("路径已失效，请重新绑定".into());
    }
    app.opener()
        .open_path(link.path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_step_link(app: AppHandle, state: State<DbState>, link_id: i64) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let link = get_step_link_on_conn(&conn, link_id)?;
    drop(conn);
    if !path_exists(&link.path) {
        return Err("路径已失效，请重新绑定".into());
    }
    let parent = std::path::Path::new(&link.path)
        .parent()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| link.path.clone());
    app.opener()
        .open_path(parent, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pick_evidence_path(app: AppHandle, directory: bool) -> Result<Option<String>, String> {
    let picked = if directory {
        app.dialog().file().blocking_pick_folder()
    } else {
        app.dialog().file().blocking_pick_file()
    };
    match picked {
        None => Ok(None),
        Some(p) => {
            let pb = p.into_path().map_err(|e| e.to_string())?;
            Ok(Some(pathbuf_to_stored_path(pb).map_err(|e| e.to_string())?))
        }
    }
}

#[tauri::command]
pub fn get_step_link(state: State<DbState>, link_id: i64) -> Result<MatterStepLink, String> {
    let conn = lock_conn(&state)?;
    let mut link = get_step_link_on_conn(&conn, link_id)?;
    link.exists = path_exists(&link.path);
    Ok(link)
}
