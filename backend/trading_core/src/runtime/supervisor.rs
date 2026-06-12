use serde_json::json;

use crate::audit::ledger::AuditLedger;
use crate::audit::record::AuditRecord;
use crate::contracts::market::MarketSnapshot;
use crate::data::candle::Candle;
use crate::execution::broker::{ExecutionError, ExecutionResult};
use crate::execution::router::ExecutionRouter;
use crate::features::option_context::OptionContext;
use crate::risk::governor::RiskGovernor;

use super::model::TradingModel;
use super::strategy::Strategy;

pub struct TradingSupervisor<M, S>
where
    M: TradingModel,
    S: Strategy,
{
    pub model: M,
    pub strategy: S,
    pub risk: RiskGovernor,
    pub execution: ExecutionRouter,
    pub audit: AuditLedger,
}

impl<M, S> TradingSupervisor<M, S>
where
    M: TradingModel,
    S: Strategy,
{
    pub fn new(
        model: M,
        strategy: S,
        risk: RiskGovernor,
        execution: ExecutionRouter,
        audit: AuditLedger,
    ) -> Self {
        Self {
            model,
            strategy,
            risk,
            execution,
            audit,
        }
    }

    pub fn on_snapshot(
        &self,
        snapshot: &MarketSnapshot,
    ) -> Result<Option<ExecutionResult>, ExecutionError> {
        self.on_snapshot_with_context(snapshot, None, None)
    }

    pub fn on_snapshot_with_context(
        &self,
        snapshot: &MarketSnapshot,
        active_candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> Result<Option<ExecutionResult>, ExecutionError> {
        let signal = self.model.predict_with_context(snapshot, active_candle, option);
        self.audit.append(AuditRecord::new(
            "model_signal",
            json!({ "model_id": signal.model_id, "symbol": signal.symbol, "confidence": signal.confidence }),
            snapshot.ts_ms,
        ));

        let Some(proposal) = self.strategy.build_proposal(&signal) else {
            self.audit.append(AuditRecord::new(
                "strategy_no_trade",
                json!({ "reason": signal.reason }),
                snapshot.ts_ms,
            ));
            return Ok(None);
        };

        let risk = self.risk.evaluate(&proposal, snapshot);
        self.audit.append(AuditRecord::new(
            "risk_decision",
            json!({ "allowed": risk.is_allowed(), "reason": risk.reason }),
            snapshot.ts_ms,
        ));

        let result = self.execution.execute(&proposal, &risk)?;
        self.audit.append(AuditRecord::new(
            "execution_result",
            json!({ "ok": result.ok, "order_id": result.order_id, "message": result.message }),
            snapshot.ts_ms,
        ));
        Ok(Some(result))
    }
}
