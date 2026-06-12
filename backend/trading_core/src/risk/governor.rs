use crate::contracts::market::MarketSnapshot;
use crate::contracts::signals::{Decision, Regime, TradeProposal};

use super::decision::RiskDecision;
use super::limits::RiskLimits;
use super::state::RiskState;

#[derive(Debug, Clone)]
pub struct RiskGovernor {
    pub limits: RiskLimits,
    pub state: RiskState,
}

impl RiskGovernor {
    pub fn new(limits: RiskLimits) -> Self {
        Self {
            limits,
            state: RiskState::default(),
        }
    }

    pub fn with_state(limits: RiskLimits, state: RiskState) -> Self {
        Self { limits, state }
    }

    pub fn state(&self) -> &RiskState {
        &self.state
    }

    pub fn state_mut(&mut self) -> &mut RiskState {
        &mut self.state
    }

    pub fn evaluate(&self, proposal: &TradeProposal, snapshot: &MarketSnapshot) -> RiskDecision {
        if proposal.signal.decision != Decision::Trade {
            return RiskDecision::block("Signal is not a trade decision.");
        }

        if proposal.signal.regime == Regime::Trap {
            return RiskDecision::block("Trap regime blocks new entries.");
        }

        if proposal.signal.confidence < self.limits.min_confidence {
            return RiskDecision::block("Model confidence below threshold.");
        }

        if self.state.realized_pnl <= -self.limits.max_daily_loss.abs() {
            return RiskDecision::block("Daily loss limit reached.");
        }

        if self.state.open_positions >= self.limits.max_open_positions {
            return RiskDecision::block("Open position limit reached.");
        }

        if self.state.orders_this_second >= self.limits.max_orders_per_second {
            return RiskDecision::block("Order rate limit reached.");
        }

        if self.state.total_trades_today >= self.limits.max_trades_per_day {
            return RiskDecision::block("Daily max trades limit reached.");
        }

        let current_ts = snapshot.ts_ms;
        if current_ts > 0 && self.state.last_trade_ts_ms > 0 {
            let elapsed = current_ts.saturating_sub(self.state.last_trade_ts_ms);
            if elapsed < self.limits.cooldown_period_ms {
                return RiskDecision::block("Trade blocked by cooldown guard.");
            }
        }

        if let Some(days) = snapshot.days_to_expiry {
            // Convert days_to_expiry to minutes: days * 1440
            let mins_to_expiry = days * 1440.0;
            if mins_to_expiry < self.limits.expiry_time_guard_mins as f64 {
                return RiskDecision::block("Too close to expiry time.");
            }
        }

        if let Some(spread_pct) = snapshot.spread_pct() {
            if spread_pct > self.limits.max_spread_pct {
                return RiskDecision::block("Spread too wide for safe execution.");
            }
        }

        let trade_risk =
            (snapshot.ltp - proposal.protection.stop_loss).abs() * proposal.order.quantity as f64;
        if trade_risk > self.limits.max_trade_loss {
            return RiskDecision::block("Per-trade risk exceeds limit.");
        }

        if proposal.order.quantity == 0 {
            return RiskDecision::block("Invalid quantity.");
        }

        RiskDecision::allow(proposal.order.quantity)
    }
}
