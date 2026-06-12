use crate::contracts::signals::{ModelSignal, TradeProposal};

pub trait Strategy: Send + Sync {
    fn id(&self) -> &str;
    fn build_proposal(&self, signal: &ModelSignal) -> Option<TradeProposal>;
}
