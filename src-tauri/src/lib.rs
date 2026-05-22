mod app_windows;
pub mod bindings_export;
pub mod commands;
pub mod db;
mod error;
pub mod models;
mod recurrence;
mod scheduler;
mod time;

pub use error::AppError;
pub mod testing;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub use db::DbState;

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
    let today = MenuItemBuilder::with_id("today", "今日任务").build(app)?;
    let quick_add = MenuItemBuilder::with_id("quick_add", "快速添加").build(app)?;
    let toggle_panel = MenuItemBuilder::with_id("toggle_panel", "显示/隐藏任务面板").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&today)
        .item(&quick_add)
        .item(&toggle_panel)
        .separator()
        .item(&quit)
        .build()?;

    let app_handle = app.handle().clone();
    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => app_windows::show_main_window(app),
            "today" => app_windows::show_main_today(app),
            "quick_add" => app_windows::show_main_quick_add(app),
            "toggle_panel" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_windows::toggle_panel_async(&app).await;
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                app_windows::show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    let _ = app_handle;
    Ok(())
}

fn wire_main_window_events(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    let builder = tauri::Builder::default().plugin(tauri_plugin_single_instance::init(
        |app, _args, _cwd| {
            app_windows::show_main_window(app);
        },
    ));

    #[cfg(not(desktop))]
    let builder = tauri::Builder::default();

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data_dir = app.path().app_data_dir()?;
            let db_path = db::get_db_path(&app_data_dir);

            let conn = Connection::open(&db_path)
                .map_err(|e| {
                    log::error!("Failed to open database: {e}");
                    format!("无法打开数据库: {e}")
                })?;

            db::init_db(&conn).map_err(|e| {
                log::error!("Failed to initialize database: {e}");
                format!("无法初始化数据库: {e}")
            })?;
            db::seed_defaults(&conn).map_err(|e| {
                log::error!("Failed to seed defaults: {e}");
                format!("无法初始化默认数据: {e}")
            })?;

            let db_path_for_integrity = db_path.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(check_conn) = Connection::open(&db_path_for_integrity) {
                    if !db::check_integrity(&check_conn).unwrap_or(false) {
                        log::warn!("Database integrity check failed — continuing anyway");
                    }
                }
            });

            let scheduler_conn =
                Connection::open(&db_path).map_err(|e| {
                    log::error!("Failed to open scheduler database: {e}");
                    format!("无法打开调度器数据库: {e}")
                })?;
            scheduler_conn
                .execute_batch("PRAGMA busy_timeout=5000;")
                .map_err(|e| format!("设置 busy_timeout 失败: {e}"))?;

            let app_handle = app.handle().clone();
            scheduler::start_reminder_loop(app_handle, Arc::new(Mutex::new(scheduler_conn)));

            app.manage(DbState(Mutex::new(conn)));

            #[cfg(desktop)]
            {
                setup_tray(app)?;
                wire_main_window_events(app.handle());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::complete_task,
            commands::tasks::delete_task,
            commands::tasks::get_task,
            commands::tasks::list_tasks,
            commands::tasks::archive_task,
            commands::tasks::restore_task,
            commands::tasks::list_archived,
            commands::subtasks::add_subtask,
            commands::subtasks::update_subtask,
            commands::subtasks::delete_subtask,
            commands::subtasks::reorder_subtasks,
            commands::categories::create_category,
            commands::categories::list_categories,
            commands::categories::update_category,
            commands::categories::delete_category,
            commands::tags::create_tag,
            commands::tags::list_tags,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::tags::add_tag_to_task,
            commands::tags::remove_tag_from_task,
            commands::stats::get_stats_panel,
            commands::calendar::get_calendar_month,
            commands::reminders::add_reminder,
            commands::reminders::remove_reminder,
            commands::reminders::list_reminders,
            commands::focus::start_focus,
            commands::focus::stop_focus,
            commands::focus::abandon_focus,
            commands::focus::get_current_focus,
            commands::focus::get_task_focus_history,
            commands::focus::get_focus_summary,
            commands::focus::update_task_estimate,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_notification_settings,
            commands::settings::update_notification_settings,
            commands::settings::is_workday,
            commands::settings::update_holidays,
            commands::settings::fetch_holidays_online,
            commands::schedule::get_schedule,
            commands::schedule::auto_schedule,
            commands::schedule::update_schedule_entry,
            commands::schedule::remove_schedule_entry,
            commands::schedule::clear_schedule,
            commands::analytics::get_workload_summary,
            commands::analytics::get_daily_review,
            commands::settings::get_database_path,
            commands::settings::reveal_database_folder,
            commands::settings::list_holidays,
            commands::desktop_panel::get_desktop_panel_snapshot,
            commands::desktop_panel::get_panel_settings,
            commands::desktop_panel::update_panel_settings,
            commands::desktop_panel::focus_task_from_panel,
            commands::desktop_panel::toggle_desktop_panel,
            commands::desktop_panel::is_desktop_panel_visible,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Ready = event {
                #[cfg(desktop)]
                {
                    let app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        app_windows::restore_panel_if_saved_async(&app).await;
                    });
                }
            }
        });
}
