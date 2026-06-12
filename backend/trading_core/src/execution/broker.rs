use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::contracts::orders::{OrderIntent, ProtectivePlan};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub ok: bool,
    pub mode: String,
    pub order_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum ExecutionError {
    #[error("live broker is not configured")]
    LiveBrokerMissing,
    #[error("broker rejected order: {0}")]
    BrokerRejected(String),
}

pub trait BrokerAdapter: Send + Sync {
    fn place_order(&self, intent: &OrderIntent, protection: Option<&ProtectivePlan>) -> Result<ExecutionResult, ExecutionError>;
}
