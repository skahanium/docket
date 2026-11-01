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
fn calendar_month_groups_timed_dues_on_same_day() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");

    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "上午".into(),
            description: None,
            priority: None,
            due_date: Some("2026-06-15T09:00".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create morning");
    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "下午".into(),
            description: None,
            priority: None,
            due_date: Some("2026-06-15T15:00".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create afternoon");

    let days = get_calendar_month_on_conn(&conn, 2026, 6).expect("calendar");
    let day = days
        .iter()
        .find(|d| d.date == "2026-06-15")
        .expect("june 15");
    assert_eq!(day.task_count, 2);
}

#[test]
fn calendar_month_counts_current_pending_step_due() {
    use app_lib::matter::{
        complete_matter_step_on_conn, create_blank_matter_on_conn, current_pending_step,
        add_matter_step_on_conn,
    };

    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let mid = create_blank_matter_on_conn(&conn, "日历事项", 0, None, None).expect("matter");
    add_matter_step_on_conn(&conn, mid, "第一步", false, Some("2026-06-10"), None).expect("step1");
    add_matter_step_on_conn(&conn, mid, "第二步", false, Some("2026-06-20"), None).expect("step2");

    let days = get_calendar_month_on_conn(&conn, 2026, 6).expect("calendar");
    let tenth = days.iter().find(|d| d.date == "2026-06-10").expect("10");
    let twentieth = days.iter().find(|d| d.date == "2026-06-20").expect("20");
    assert_eq!(tenth.task_count, 1);
    assert_eq!(twentieth.task_count, 0);

    let first = current_pending_step(&conn, mid).unwrap().unwrap();
    complete_matter_step_on_conn(&conn, first.id).unwrap();
    let after = get_calendar_month_on_conn(&conn, 2026, 6).expect("calendar after");
    let tenth_after = after.iter().find(|d| d.date == "2026-06-10").expect("10");
    let twentieth_after = after.iter().find(|d| d.date == "2026-06-20").expect("20");
    assert_eq!(tenth_after.task_count, 0);
    assert_eq!(twentieth_after.task_count, 1);
}

#[test]
fn desktop_panel_snapshot_lists_today_and_overdue() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let today = app_lib::local_today_date();

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
fn high_priority_overdue_not_duplicated_in_today() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");

    create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Urgent overdue".into(),
            description: None,
            priority: Some(2),
            due_date: Some("2020-01-01".into()),
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .expect("create");

    let snap = snapshot_on_conn(&conn).expect("snapshot");
    assert!(!snap.today.iter().any(|t| t.title == "Urgent overdue"));
    assert!(snap.overdue.iter().any(|t| t.title == "Urgent overdue"));
}

#[test]
fn desktop_panel_snapshot_marks_missing_evidence() {
    use app_lib::models::PlaybookStepInput;
    use app_lib::playbook::{create_playbook_on_conn, instantiate_matter_on_conn, set_playbook_steps_on_conn};

    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let pb = create_playbook_on_conn(&conn, "要依据").expect("playbook");
    set_playbook_steps_on_conn(
        &conn,
        pb,
        &[PlaybookStepInput {
            title: "缺依据步".into(),
            optional: false,
            evidence_required: true,
            estimated_minutes: None,
        }],
    )
    .expect("steps");
    instantiate_matter_on_conn(&conn, pb, "缺依据事项", 2, None, None).expect("matter");

    let snap = snapshot_on_conn(&conn).expect("snapshot");
    let row = snap
        .today
        .iter()
        .find(|t| t.title == "缺依据步")
        .expect("today step");
    assert!(row.missing_evidence);
}

#[test]
fn get_missing_task_returns_structured_error() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let err = get_task_on_conn(&conn, 9999).unwrap_err();
    assert!(err.to_string().contains("9999"));
}

fn daily_rule(end_count: i32) -> String {
    format!(r#"{{"freq":"daily","interval":1,"end_type":"count","end_count":{end_count}}}"#)
}

fn series_ids(conn: &rusqlite::Connection, root: i64) -> Vec<i64> {
    let mut stmt = conn
        .prepare("SELECT id FROM tasks WHERE id=?1 OR recurrence_parent_id=?1 ORDER BY id")
        .unwrap();
    stmt.query_map([root], |r| r.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

#[test]
fn recurrence_end_count_two_stops_after_second_instance() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let root = create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Repeat twice".into(),
            description: None,
            priority: None,
            due_date: Some("2026-05-11".into()),
            category_id: None,
            recurrence_rule: Some(daily_rule(2)),
            estimated_minutes: None,
        },
    )
    .expect("create");

    complete_task_on_conn(&conn, root).expect("complete root");
    let after_root = series_ids(&conn, root);
    assert_eq!(after_root.len(), 2);
    let child = *after_root.iter().find(|id| **id != root).unwrap();
    let child_parent: i64 = conn
        .query_row(
            "SELECT recurrence_parent_id FROM tasks WHERE id=?1",
            [child],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(child_parent, root);

    complete_task_on_conn(&conn, child).expect("complete child");
    assert_eq!(series_ids(&conn, root).len(), 2);
}

#[test]
fn recurrence_end_count_one_does_not_spawn() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let root = create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Once".into(),
            description: None,
            priority: None,
            due_date: Some("2026-05-11".into()),
            category_id: None,
            recurrence_rule: Some(daily_rule(1)),
            estimated_minutes: None,
        },
    )
    .expect("create");

    complete_task_on_conn(&conn, root).expect("complete");
    assert_eq!(series_ids(&conn, root).len(), 1);
}

#[test]
fn recurrence_instance_inherits_tags_and_pending_subtasks() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let root = create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "Templated".into(),
            description: None,
            priority: None,
            due_date: Some("2026-05-11".into()),
            category_id: None,
            recurrence_rule: Some(daily_rule(5)),
            estimated_minutes: None,
        },
    )
    .expect("create");

    conn.execute("INSERT INTO tags (name, color) VALUES ('work', '#00f')", [])
        .unwrap();
    conn.execute(
        "INSERT INTO task_tags (task_id, tag_id) VALUES (?1, 1)",
        [root],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO subtasks (task_id, title, status, sort_order, created_at)
         VALUES (?1, 'prep', 'pending', 0, '2026-05-11T00:00:00+00:00')",
        [root],
    )
    .unwrap();

    complete_task_on_conn(&conn, root).expect("complete");
    let child = *series_ids(&conn, root)
        .iter()
        .find(|id| **id != root)
        .unwrap();

    let tag_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM task_tags WHERE task_id=?1",
            [child],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(tag_count, 1);

    let (title, status): (String, String) = conn
        .query_row(
            "SELECT title, status FROM subtasks WHERE task_id=?1",
            [child],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(title, "prep");
    assert_eq!(status, "pending");
}

#[test]
fn create_task_rejects_blank_title() {
    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let err = create_task_on_conn(
        &conn,
        CreateTaskInput {
            title: "   ".into(),
            description: None,
            priority: None,
            due_date: None,
            category_id: None,
            recurrence_rule: None,
            estimated_minutes: None,
        },
    )
    .unwrap_err();
    assert!(err.to_string().contains("标题"));
}

fn two_step_playbook(conn: &rusqlite::Connection) -> i64 {
    use app_lib::models::PlaybookStepInput;
    use app_lib::playbook::{create_playbook_on_conn, set_playbook_steps_on_conn};
    let pb = create_playbook_on_conn(conn, "集成模板").unwrap();
    set_playbook_steps_on_conn(
        conn,
        pb,
        &[
            PlaybookStepInput {
                title: "收材料".into(),
                optional: false,
                evidence_required: true,
                estimated_minutes: Some(15),
            },
            PlaybookStepInput {
                title: "办结".into(),
                optional: false,
                evidence_required: false,
                estimated_minutes: None,
            },
        ],
    )
    .unwrap();
    pb
}

#[test]
fn matter_flow_current_step_and_agenda() {
    use app_lib::agenda::{list_agenda_on_conn, AGENDA_KIND_MATTER_STEP};
    use app_lib::matter::{
        complete_matter_step_on_conn, current_pending_step, get_matter_on_conn,
        skip_matter_step_on_conn,
    };
    use app_lib::playbook::instantiate_matter_on_conn;

    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let pb = two_step_playbook(&conn);
    let mid = instantiate_matter_on_conn(&conn, pb, "集成事项", 1, None, None).unwrap();
    let first = current_pending_step(&conn, mid).unwrap().unwrap();
    assert_eq!(first.title, "收材料");

    let today = list_agenda_on_conn(&conn, "today").unwrap();
    assert!(today
        .iter()
        .any(|i| i.kind == AGENDA_KIND_MATTER_STEP && i.title == "收材料"));
    assert!(!today.iter().any(|i| i.title == "办结"));

    skip_matter_step_on_conn(&conn, first.id).unwrap();
    let second = current_pending_step(&conn, mid).unwrap().unwrap();
    assert_eq!(second.title, "办结");
    complete_matter_step_on_conn(&conn, second.id).unwrap();

    let detail = get_matter_on_conn(&conn, mid).unwrap();
    assert_eq!(detail.status, "completed");
    assert!(detail.completed_at.is_some());
    assert_eq!(detail.playbook_id, Some(pb));

    let after = list_agenda_on_conn(&conn, "today").unwrap();
    assert!(!after.iter().any(|i| i.matter_id == Some(mid)));
}

#[test]
fn cadence_blank_matter_only_in_open_filter() {
    use app_lib::cadence::{cadence_progress_on_conn, create_cadence_on_conn};
    use app_lib::matter::{
        add_matter_step_on_conn, complete_matter_step_on_conn, create_blank_matter_on_conn,
        current_pending_step,
    };
    use app_lib::playbook::instantiate_matter_on_conn;

    let db = in_memory_db();
    let conn = lock_conn(&db).expect("lock");
    let pb = two_step_playbook(&conn);
    let mid = instantiate_matter_on_conn(&conn, pb, "模板事项", 0, None, None).unwrap();
    while let Some(s) = current_pending_step(&conn, mid).unwrap() {
        complete_matter_step_on_conn(&conn, s.id).unwrap();
    }
    let blank = create_blank_matter_on_conn(&conn, "空白", 0, None, None).unwrap();
    let step = add_matter_step_on_conn(&conn, blank, "独自一步", false, None, None).unwrap();
    complete_matter_step_on_conn(&conn, step).unwrap();

    let open = create_cadence_on_conn(&conn, "不限", "month", None, &[], &[]).unwrap();
    let limited = create_cadence_on_conn(&conn, "限模板", "month", None, &[pb], &[]).unwrap();
    let today = app_lib::local_today_date();
    let open_p = cadence_progress_on_conn(&conn, open, &today).unwrap();
    let lim_p = cadence_progress_on_conn(&conn, limited, &today).unwrap();
    assert!(open_p.matching_matters.iter().any(|m| m.playbook_id.is_none()));
    assert!(lim_p.matching_matters.iter().all(|m| m.playbook_id == Some(pb)));
}
