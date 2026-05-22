use thiserror::Error;

/// Application errors surfaced to the UI via Tauri IPC (`Result<_, String>`).
#[derive(Debug, Error)]
pub enum AppError {
    #[error("database lock poisoned")]
    LockPoisoned,

    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("task not found (id={id})")]
    TaskNotFound { id: i64 },

    #[error("invalid date: {0}")]
    InvalidDate(String),

    #[error("{0}")]
    Message(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn message(msg: impl Into<String>) -> Self {
        Self::Message(msg.into())
    }
}

impl From<AppError> for String {
    fn from(value: AppError) -> String {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn displays_task_not_found() {
        let err = AppError::TaskNotFound { id: 42 };
        assert!(err.to_string().contains("42"));
    }
}
