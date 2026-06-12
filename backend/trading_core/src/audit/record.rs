use serde::{Deserialize, Serialize};

use crate::contracts::ids::new_id;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub id: String,
    pub topic: String,
    pub payload: serde_json::Value,
    pub ts_ms: u64,
}

impl AuditRecord {
    pub fn new(topic: impl Into<String>, payload: serde_json::Value, ts_ms: u64) -> Self {
        Self {
            id: new_id("audit"),
            topic: topic.into(),
            payload,
            ts_ms,
        }
    }
}
