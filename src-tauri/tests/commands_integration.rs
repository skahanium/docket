//! Command-layer integration tests against an in-memory SQLite database.
use app_lib::commands::calendar::get_calendar_month_on_conn;
use app_lib::commands::desktop_panel::snapshot_on_conn;
use app_lib::commands::tasks::{
    complete_task_on_conn, create_task_on_conn, get_task_on_conn, list_tasks_on_conn,
    CreateTaskInput, ListTasksFilters, SortOption,
};
use app_lib::db::lock_conn;
use app_lib::testing::in_memory_db;

#[test]
fn create_list_complete_task_flow() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");

    let id = create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "集成测试任务".into(),
            description: Some("desc".into()),
            priority: Some(2),
            due_date: Some("2026-06-01".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: Some(30),
        },
    )
    .expect("create");

    let listed = list_tasks_on_conn(
        &conn,
        ListTasksFilters {
            status: Some("active".into()),
            category_id: None,
            tag_id: None,
            due_date: None,
            search_query: Some("集成".into()),
            today_view: None,
            overdue_view: None,
            priority: None,
        },
        SortOption {
            field: None,
            direction: None,
        },
    )
    .expect("list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, id);

    let detail = get_task_on_conn(&conn, id).expect("get");
    assert_eq!(detail.title, "集成测试任务");
    assert_eq!(detail.estimated_minutes, Some(30));

    complete_task_on_conn(&conn, id).expect("complete");

    let after = list_tasks_on_conn(
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
            field: None,
            direction: None,
        },
    )
    .expect("list after complete");
    assert!(!after.iter().any(|t| t.id == id));

    let completed_detail = get_task_on_conn(&conn, id).expect("get completed");
    assert_eq!(completed_detail.status, "completed");
}

#[test]
fn calendar_month_reflects_due_dates() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");

    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Cal".into(),
            description: None,
            priority: None,
            due_date: Some("2026-06-15".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create");

    let days = get_calendar_month_on_conn(&conn, 2026, 6).expect("calendar");
    let day = days
        .iter()
        .find(|d| d.date == "2026-06-15")
        .expect("june 15");
    assert!(day.task_count >= 1);
}

#[test]
fn desktop_panel_snapshot_lists_today_and_overdue() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Today task".into(),
            description: None,
            priority: None,
            due_date: Some(today.clone()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create today");

    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Overdue task".into(),
            description: None,
            priority: None,
            due_date: Some("2020-01-01".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create overdue");

    let snap = snapshot_on_conn(&conn).expect("snapshot");
    assert!(snap.today.iter().any(|t| t.title == "Today task"));
    assert!(snap.overdue.iter().any(|t| t.title == "Overdue task"));
}

#[test]
fn get_missing_task_returns_structured_error() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let err = get_task_on_conn(&conn, 9999).unwrap_err();
    assert!(err.to_string().contains("9999"));
}
