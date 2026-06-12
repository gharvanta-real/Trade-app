use std::sync::{Arc, Mutex};

use crate::contracts::market::{InstrumentKind, MarketSnapshot};
use crate::contracts::signals::TradeProposal;
use crate::control::kill_switch::KillSwitch;
use crate::control::mode::EngineMode;
use crate::data::candle::Candle;
use crate::data::engine::MarketDataEngine;
use crate::data::tick::MarketTick;
use crate::execution::broker::{ExecutionError, ExecutionResult};
use crate::execution::paper::PaperBroker;
use crate::features::option_context::{OptionContext, OptionSide};

use super::model::TradingModel;
use super::strategy::Strategy;
use super::supervisor::TradingSupervisor;

#[derive(Debug)]
pub struct ShadowTickResult {
    pub mode: EngineMode,
    pub closed_candle: Option<Candle>,
    pub execution: Option<ExecutionResult>,
    pub skipped_reason: Option<String>,
}

pub struct ShadowEngine<M, S>
where
    M: TradingModel,
    S: Strategy,
{
    pub mode: EngineMode,
    pub kill_switch: KillSwitch,
    pub data: MarketDataEngine,
    pub supervisor: TradingSupervisor<M, S>,
    pub paper_broker: Arc<PaperBroker>,
    pub pending_proposals: Arc<Mutex<Vec<TradeProposal>>>,
}

impl<M, S> ShadowEngine<M, S>
where
    M: TradingModel,
    S: Strategy,
{
    pub fn new(
        mode: EngineMode,
        data: MarketDataEngine,
        supervisor: TradingSupervisor<M, S>,
        paper_broker: Arc<PaperBroker>,
    ) -> Self {
        Self {
            mode,
            kill_switch: KillSwitch::default(),
            data,
            supervisor,
            paper_broker,
            pending_proposals: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn mode(&self) -> EngineMode {
        self.mode
    }

    pub fn set_mode(&mut self, mode: EngineMode) {
        self.mode = mode;
    }

    pub fn trip_kill_switch(&self) {
        self.kill_switch.trip();
    }

    pub fn reset_kill_switch(&self) {
        self.kill_switch.reset();
    }

    pub fn sync_risk_state(&mut self) {
        let realized = self.paper_broker.realized_pnl();
        let open_positions = self.paper_broker.positions().iter().filter(|p| p.qty != 0).count() as u32;
        let state = self.supervisor.risk.state_mut();
        state.realized_pnl = realized;
        state.open_positions = open_positions;
    }

    pub fn approve_proposal(&mut self, symbol: &str) -> Result<Option<ExecutionResult>, ExecutionError> {
        let proposal = {
            let mut proposals = self.pending_proposals.lock().unwrap();
            let index = proposals.iter().position(|p| p.order.symbol == symbol);
            match index {
                Some(idx) => Some(proposals.remove(idx)),
                None => None,
            }
        };
        let Some(proposal) = proposal else {
            return Ok(None);
        };

        self.sync_risk_state();
        let snapshot = self.data.latest_snapshot(&proposal.order.symbol)
            .ok_or_else(|| ExecutionError::BrokerRejected("missing symbol snapshot for execution".to_string()))?;

        let risk = self.supervisor.risk.evaluate(&proposal, snapshot);
        let result = self.supervisor.execution.execute(&proposal, &risk)?;

        if result.ok {
            let state = self.supervisor.risk.state_mut();
            state.total_trades_today += 1;
            state.last_trade_ts_ms = snapshot.ts_ms;
        }

        Ok(Some(result))
    }

    pub fn reject_proposal(&self, symbol: &str) -> bool {
        let mut proposals = self.pending_proposals.lock().unwrap();
        if let Some(idx) = proposals.iter().position(|p| p.order.symbol == symbol) {
            proposals.remove(idx);
            true
        } else {
            false
        }
    }

    pub fn on_tick(&mut self, tick: MarketTick) -> Result<ShadowTickResult, ExecutionError> {
        // Feed tick to PaperBroker to update open orders/positions P&L
        self.paper_broker.on_tick(&tick);

        let ingest = self.data.ingest_tick(tick);

        if self.kill_switch.is_tripped() {
            return Ok(ShadowTickResult {
                mode: self.mode,
                closed_candle: ingest.closed_candle,
                execution: None,
                skipped_reason: Some("Kill switch is active.".to_string()),
            });
        }

        if !self.mode.can_execute() {
            return Ok(ShadowTickResult {
                mode: self.mode,
                closed_candle: ingest.closed_candle,
                execution: None,
                skipped_reason: Some("Engine mode is stopped.".to_string()),
            });
        }

        let symbol = &ingest.snapshot.instrument.symbol;
        let active_candle = self.data.active_candle(symbol);

        // Build option context if evaluating an option
        let option_context = if ingest.snapshot.instrument.kind == InstrumentKind::Option {
            self.build_option_context(&ingest.snapshot)
        } else {
            None
        };

        // Score model
        let signal = self.supervisor.model.predict_with_context(&ingest.snapshot, active_candle, option_context);
        
        let Some(proposal) = self.supervisor.strategy.build_proposal(&signal) else {
            return Ok(ShadowTickResult {
                mode: self.mode,
                closed_candle: ingest.closed_candle,
                execution: None,
                skipped_reason: None,
            });
        };

        self.sync_risk_state();

        if self.mode == EngineMode::SupervisedLive {
            // Check risk evaluate first to filter out bad proposals
            let risk = self.supervisor.risk.evaluate(&proposal, &ingest.snapshot);
            if !risk.is_allowed() {
                return Ok(ShadowTickResult {
                    mode: self.mode,
                    closed_candle: ingest.closed_candle,
                    execution: None,
                    skipped_reason: Some(format!("Proposal blocked by risk: {}", risk.reason)),
                });
            }

            let mut queue = self.pending_proposals.lock().unwrap();
            if !queue.iter().any(|p| p.order.symbol == proposal.order.symbol) {
                queue.push(proposal);
            }

            return Ok(ShadowTickResult {
                mode: self.mode,
                closed_candle: ingest.closed_candle,
                execution: None,
                skipped_reason: Some("Awaiting human approval.".to_string()),
            });
        }

        let risk = self.supervisor.risk.evaluate(&proposal, &ingest.snapshot);
        let execution = self.supervisor.execution.execute(&proposal, &risk)?;

        if execution.ok {
            let state = self.supervisor.risk.state_mut();
            state.total_trades_today += 1;
            state.last_trade_ts_ms = ingest.snapshot.ts_ms;
        }

        Ok(ShadowTickResult {
            mode: self.mode,
            closed_candle: ingest.closed_candle,
            execution: Some(execution),
            skipped_reason: None,
        })
    }

    pub fn data(&self) -> &MarketDataEngine {
        &self.data
    }

    fn build_option_context(&self, snapshot: &MarketSnapshot) -> Option<OptionContext> {
        let symbol = &snapshot.instrument.symbol;
        let underlying = if symbol.starts_with("NIFTY") {
            "NIFTY 50"
        } else if symbol.starts_with("BANKNIFTY") {
            "BANKNIFTY"
        } else if symbol.starts_with("FINNIFTY") {
            "FINNIFTY"
        } else if symbol.starts_with("MIDCPNIFTY") {
            "MIDCPNIFTY"
        } else {
            return None;
        };

        let spot_snapshot = self.data.latest_snapshot(underlying)?;
        let spot_ltp = spot_snapshot.ltp;
        let (strike, side) = parse_option_symbol(symbol)?;

        Some(OptionContext {
            underlying_symbol: underlying.to_string(),
            spot_ltp,
            future_ltp: None,
            strike,
            side,
            days_to_expiry: snapshot.days_to_expiry.unwrap_or(0.0),
            implied_volatility: snapshot.implied_volatility,
            open_interest: snapshot.open_interest,
            oi_change: snapshot.oi_change,
            atm_straddle_price: None,
        })
    }
}

fn parse_option_symbol(symbol: &str) -> Option<(f64, OptionSide)> {
    let side = if symbol.ends_with("CE") {
        OptionSide::Call
    } else if symbol.ends_with("PE") {
        OptionSide::Put
    } else {
        return None;
    };

    let without_side = &symbol[..symbol.len() - 2];
    let mut digits = String::new();
    for c in without_side.chars().rev() {
        if c.is_ascii_digit() {
            digits.insert(0, c);
        } else {
            break;
        }
    }

    if digits.is_empty() {
        return None;
    }

    let strike: f64 = digits.parse().ok()?;
    Some((strike, side))
}
