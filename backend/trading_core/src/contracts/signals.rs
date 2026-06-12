use serde::{Deserialize, Serialize};

use super::orders::{OrderIntent, ProtectivePlan};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Regime {
    Trend,
    Range,
    Volatile,
    Trap,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Decision {
    Trade,
    Avoid,
    Exit,
    Hold,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSignal {
    pub model_id: String,
    pub symbol: String,
    pub decision: Decision,
    pub confidence: f64,
    pub regime: Regime,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeProposal {
    pub signal: ModelSignal,
    pub order: OrderIntent,
    pub protection: ProtectivePlan,
}
