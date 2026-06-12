use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RiskAction {
    Allow,
    Block,
    Reduce,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskDecision {
    pub action: RiskAction,
    pub reason: String,
    pub allowed_quantity: Option<u32>,
}

impl RiskDecision {
    pub fn allow(quantity: u32) -> Self {
        Self {
            action: RiskAction::Allow,
            reason: "Risk checks passed.".to_string(),
            allowed_quantity: Some(quantity),
        }
    }

    pub fn block(reason: impl Into<String>) -> Self {
        Self {
            action: RiskAction::Block,
            reason: reason.into(),
            allowed_quantity: None,
        }
    }

    pub fn is_allowed(&self) -> bool {
        matches!(self.action, RiskAction::Allow | RiskAction::Reduce)
    }
}
