use crate::agenda::list_agenda_on_conn;
use crate::db::{lock_conn, DbState};
use crate::models::AgendaItem;
use tauri::State;

#[tauri::command]
pub fn list_agenda(state: State<DbState>, view: String) -> Result<Vec<AgendaItem>, String> {
    let conn = lock_conn(&state)?;
    list_agenda_on_conn(&conn, &view).map_err(Into::into)
}
