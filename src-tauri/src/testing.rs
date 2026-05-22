//! Shared in-memory database harness for integration tests.
use crate::db::{self, DbState};
use rusqlite::Connection;
use std::sync::Mutex;

pub fn in_memory_db() -> DbState {
    let conn = Connection::open_in_memory().expect("in-memory sqlite");
    db::init_db(&conn).expect("init schema");
    db::seed_defaults(&conn).expect("seed defaults");
    DbState(Mutex::new(conn))
}
