use crate::contracts::orders::{
    ExecutionMode, OrderIntent, OrderSide, OrderType, ProductType, ProtectivePlan,
};
use crate::contracts::signals::{Decision, Regime, TradeProposal};
use crate::runtime::strategy::Strategy;

#[derive(Debug, Clone)]
pub struct ExpiryScalperStrategy {
    strategy_id: String,
    exchange: String,
    quantity: u32,
    stop_loss_pct: f64,
    target_pct: f64,
    mode: ExecutionMode,
}

impl ExpiryScalperStrategy {
    pub fn paper(quantity: u32) -> Self {
        Self {
            strategy_id: "expiry_scalper_v1".to_string(),
            exchange: "NSE_FO".to_string(),
            quantity,
            stop_loss_pct: 0.18,
            target_pct: 0.28,
            mode: ExecutionMode::Paper,
        }
    }
}

impl Strategy for ExpiryScalperStrategy {
    fn id(&self) -> &str {
        &self.strategy_id
    }

    fn build_proposal(
        &self,
        signal: &crate::contracts::signals::ModelSignal,
    ) -> Option<TradeProposal> {
        if signal.decision != Decision::Trade || signal.regime != Regime::Trend {
            return None;
        }

        let reference_price = 100.0;
        Some(TradeProposal {
            signal: signal.clone(),
            order: OrderIntent {
                strategy_id: self.strategy_id.clone(),
                symbol: signal.symbol.clone(),
                exchange: self.exchange.clone(),
                side: OrderSide::Buy,
                quantity: self.quantity,
                order_type: OrderType::Market,
                product: ProductType::Intraday,
                mode: self.mode,
                price: None,
                trigger_price: None,
                reason: signal.reason.clone(),
            },
            protection: ProtectivePlan {
                stop_loss: reference_price * (1.0 - self.stop_loss_pct),
                target: Some(reference_price * (1.0 + self.target_pct)),
                trail_after: Some(reference_price * 1.12),
                max_hold_ms: Some(120_000),
            },
        })
    }
}
