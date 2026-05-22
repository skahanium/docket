use crate::db::{lock_conn, DbState};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct Settings {
    pub work_start_am: String,
    pub work_end_am: String,
    pub work_start_pm: String,
    pub work_end_pm: String,
    pub default_focus_minutes: String,
}

#[tauri::command]
pub fn get_settings(state: State<DbState>) -> Result<Settings, String> {
    let conn = lock_conn(&state)?;
    Ok(Settings {
        work_start_am: crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_AM).unwrap_or_else(|| "08:30".into()),
        work_end_am: crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_AM).unwrap_or_else(|| "12:00".into()),
        work_start_pm: crate::db::get_setting(&conn, crate::db::settings_keys::WORK_START_PM).unwrap_or_else(|| "14:30".into()),
        work_end_pm: crate::db::get_setting(&conn, crate::db::settings_keys::WORK_END_PM).unwrap_or_else(|| "18:00".into()),
        default_focus_minutes: crate::db::get_setting(&conn, crate::db::settings_keys::DEFAULT_FOCUS_MINUTES).unwrap_or_else(|| "45".into()),
    })
}

#[tauri::command]
pub fn update_settings(state: State<DbState>, settings: Settings) -> Result<(), String> {
    if !crate::time::is_valid_hhmm(&settings.work_start_am)
        || !crate::time::is_valid_hhmm(&settings.work_end_am)
        || !crate::time::is_valid_hhmm(&settings.work_start_pm)
        || !crate::time::is_valid_hhmm(&settings.work_end_pm)
    {
        return Err("时间格式无效，请使用 HH:MM 格式（如 08:30）".into());
    }
    let focus: i64 = settings.default_focus_minutes.parse().map_err(|_| "专注时长必须为数字".to_string())?;
    if focus < 1 || focus > 480 {
        return Err("专注时长必须在 1-480 分钟之间".into());
    }
    let conn = lock_conn(&state)?;
    crate::db::set_setting(&conn, crate::db::settings_keys::WORK_START_AM, &settings.work_start_am).map_err(|e| e.to_string())?;
    crate::db::set_setting(&conn, crate::db::settings_keys::WORK_END_AM, &settings.work_end_am).map_err(|e| e.to_string())?;
    crate::db::set_setting(&conn, crate::db::settings_keys::WORK_START_PM, &settings.work_start_pm).map_err(|e| e.to_string())?;
    crate::db::set_setting(&conn, crate::db::settings_keys::WORK_END_PM, &settings.work_end_pm).map_err(|e| e.to_string())?;
    crate::db::set_setting(&conn, crate::db::settings_keys::DEFAULT_FOCUS_MINUTES, &settings.default_focus_minutes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_database_path(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(crate::db::get_db_path(&dir).display().to_string())
}

#[tauri::command]
pub fn reveal_database_folder(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_holidays(state: State<DbState>) -> Result<Vec<HolidayEntry>, String> {
    let conn = lock_conn(&state)?;
    let mut stmt = conn
        .prepare("SELECT date, name FROM holidays ORDER BY date")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(HolidayEntry {
                date: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn is_workday(state: State<DbState>, date: String) -> Result<bool, String> {
    let conn = lock_conn(&state)?;
    Ok(crate::db::is_workday(&conn, &date))
}

#[tauri::command]
pub fn update_holidays(state: State<DbState>, holidays: Vec<HolidayEntry>) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM holidays", []).map_err(|e| e.to_string())?;
    for h in &holidays {
        tx.execute(
            "INSERT INTO holidays (date, name) VALUES (?1, ?2)",
            [&h.date, &h.name],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct NotificationSettings {
    pub notify_daily_summary: bool,
    pub notify_daily_time: String,
    pub notify_overdue: bool,
    pub notify_overdue_interval_minutes: String,
}

fn setting_bool(conn: &rusqlite::Connection, key: &str, default: bool) -> bool {
    crate::db::get_setting(conn, key)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(default)
}

#[tauri::command]
pub fn get_notification_settings(state: State<DbState>) -> Result<NotificationSettings, String> {
    let conn = lock_conn(&state)?;
    Ok(NotificationSettings {
        notify_daily_summary: setting_bool(&conn, crate::db::settings_keys::NOTIFY_DAILY_SUMMARY, true),
        notify_daily_time: crate::db::get_setting(&conn, crate::db::settings_keys::NOTIFY_DAILY_TIME)
            .unwrap_or_else(|| "08:00".into()),
        notify_overdue: setting_bool(&conn, crate::db::settings_keys::NOTIFY_OVERDUE, true),
        notify_overdue_interval_minutes: crate::db::get_setting(
            &conn,
            crate::db::settings_keys::NOTIFY_OVERDUE_INTERVAL_MINUTES,
        )
        .unwrap_or_else(|| "60".into()),
    })
}

#[tauri::command]
pub fn update_notification_settings(
    state: State<DbState>,
    settings: NotificationSettings,
) -> Result<(), String> {
    let conn = lock_conn(&state)?;
    crate::db::set_setting(
        &conn,
        crate::db::settings_keys::NOTIFY_DAILY_SUMMARY,
        if settings.notify_daily_summary {
            "1"
        } else {
            "0"
        },
    )
    .map_err(|e| e.to_string())?;
    crate::db::set_setting(&conn, crate::db::settings_keys::NOTIFY_DAILY_TIME, &settings.notify_daily_time)
        .map_err(|e| e.to_string())?;
    crate::db::set_setting(
        &conn,
        crate::db::settings_keys::NOTIFY_OVERDUE,
        if settings.notify_overdue { "1" } else { "0" },
    )
    .map_err(|e| e.to_string())?;
    crate::db::set_setting(
        &conn,
        crate::db::settings_keys::NOTIFY_OVERDUE_INTERVAL_MINUTES,
        &settings.notify_overdue_interval_minutes,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Fetch holidays from online API. Requires explicit user confirmation (S2).
#[tauri::command]
pub fn fetch_holidays_online(
    state: State<DbState>,
    year: Option<i32>,
    user_confirmed: bool,
) -> Result<Vec<HolidayEntry>, String> {
    if !user_confirmed {
        return Err("需要用户确认后才能访问节假日 API".into());
    }
    let current_year = chrono::Utc::now().format("%Y").to_string().parse::<i32>().unwrap_or(2026);
    let target_year = year.unwrap_or(current_year);

    let url = format!("https://timor.tech/api/holiday/year/{}", target_year);
    let response = ureq::get(&url)
        .set("User-Agent", "Docket/0.1")
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let body: serde_json::Value = response.into_json()
        .map_err(|e| format!("解析失败: {}", e))?;

    let mut holidays: Vec<HolidayEntry> = vec![];

    if let Some(holiday_map) = body["holiday"].as_object() {
        for (date_str, info) in holiday_map {
            if let Some(holiday) = info.get("holiday").and_then(|v| v.as_bool()) {
                if holiday {
                    let name = info.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("节假日")
                        .to_string();
                    holidays.push(HolidayEntry {
                        date: date_str.clone(),
                        name,
                    });
                }
            }
        }
    }

    let conn = lock_conn(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for h in &holidays {
        tx.execute(
            "INSERT OR REPLACE INTO holidays (date, name) VALUES (?1, ?2)",
            [&h.date, &h.name],
        ).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(holidays)
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct HolidayEntry {
    pub date: String,
    pub name: String,
}
