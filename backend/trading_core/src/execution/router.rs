use crate::contracts::orders::ExecutionMode;
use crate::contracts::signals::TradeProposal;
use crate::risk::decision::RiskDecision;

use super::broker::{BrokerAdapter, ExecutionError, ExecutionResult};

use std::sync::Arc;

pub struct ExecutionRouter {
    paper: Arc<dyn BrokerAdapter>,
    live: Option<Arc<dyn BrokerAdapter>>,
}

impl ExecutionRouter {
    pub fn new(paper: Arc<dyn BrokerAdapter>, live: Option<Arc<dyn BrokerAdapter>>) -> Self {
        Self { paper, live }
    }

    pub fn execute(
        &self,
        proposal: &TradeProposal,
        risk: &RiskDecision,
    ) -> Result<ExecutionResult, ExecutionError> {
        if !risk.is_allowed() {
            return Ok(ExecutionResult {
                ok: false,
                mode: format!("{:?}", proposal.order.mode),
                order_id: None,
                message: risk.reason.clone(),
            });
        }

        match proposal.order.mode {
            ExecutionMode::Paper | ExecutionMode::Shadow => self.paper.place_order(&proposal.order, Some(&proposal.protection)),
            ExecutionMode::SupervisedLive | ExecutionMode::AutoLive => {
                let live = self
                    .live
                    .as_ref()
                    .ok_or(ExecutionError::LiveBrokerMissing)?;
                live.place_order(&proposal.order, Some(&proposal.protection))
            }
        }
    }
}
