use trading_core::audit::ledger::AuditLedger;
use trading_core::contracts::market::{Instrument, InstrumentKind, MarketSnapshot};
use trading_core::contracts::orders::{
    ExecutionMode, OrderIntent, OrderSide, OrderType, ProductType, ProtectivePlan,
};
use trading_core::contracts::signals::{Decision, ModelSignal, Regime, TradeProposal};
use trading_core::control::mode::EngineMode;
use trading_core::data::engine::MarketDataEngine;
use trading_core::data::tick::MarketTick;
use trading_core::execution::paper::PaperBroker;
use trading_core::execution::router::ExecutionRouter;
use trading_core::risk::governor::RiskGovernor;
use trading_core::risk::limits::RiskLimits;
use trading_core::runtime::model::TradingModel;
use trading_core::runtime::shadow_engine::ShadowEngine;
use trading_core::runtime::strategy::Strategy;
use trading_core::runtime::supervisor::TradingSupervisor;

struct AlwaysTradeModel;

impl TradingModel for AlwaysTradeModel {
    fn id(&self) -> &str {
        "always_trade"
    }

    fn predict(&self, snapshot: &MarketSnapshot) -> ModelSignal {
        ModelSignal {
            model_id: self.id().to_string(),
            symbol: snapshot.instrument.symbol.clone(),
            decision: Decision::Trade,
            confidence: 0.8,
            regime: Regime::Trend,
            reason: "test signal".to_string(),
        }
    }

    fn predict_with_context(
        &self,
        snapshot: &MarketSnapshot,
        _active_candle: Option<&trading_core::data::candle::Candle>,
        _option: Option<trading_core::features::option_context::OptionContext>,
    ) -> ModelSignal {
        self.predict(snapshot)
    }
}

struct BuyOneStrategy;

impl Strategy for BuyOneStrategy {
    fn id(&self) -> &str {
        "buy_one"
    }

    fn build_proposal(&self, signal: &ModelSignal) -> Option<TradeProposal> {
        Some(TradeProposal {
            signal: signal.clone(),
            order: OrderIntent {
                strategy_id: self.id().to_string(),
                symbol: signal.symbol.clone(),
                exchange: "NSE_FO".to_string(),
                side: OrderSide::Buy,
                quantity: 1,
                order_type: OrderType::Market,
                product: ProductType::Intraday,
                mode: ExecutionMode::Paper,
                price: None,
                trigger_price: None,
                reason: signal.reason.clone(),
            },
            protection: ProtectivePlan {
                stop_loss: 95.0,
                target: Some(120.0),
                trail_after: None,
                max_hold_ms: None,
            },
        })
    }
}

fn tick(ts_ms: u64, ltp: f64) -> MarketTick {
    MarketTick {
        instrument: Instrument {
            symbol: "NIFTY26JUN23000CE".to_string(),
            exchange: "NSE_FO".to_string(),
            kind: InstrumentKind::Option,
            token: Some("12345".to_string()),
            lot_size: 75,
        },
        ltp,
        bid: Some(ltp - 0.1),
        ask: Some(ltp + 0.1),
        volume: Some(1),
        open_interest: Some(100_000),
        oi_change: None,
        implied_volatility: None,
        days_to_expiry: None,
        ts_ms,
    }
}

fn engine(mode: EngineMode) -> ShadowEngine<AlwaysTradeModel, BuyOneStrategy> {
    let paper_broker = std::sync::Arc::new(PaperBroker::default());
    let supervisor = TradingSupervisor::new(
        AlwaysTradeModel,
        BuyOneStrategy,
        RiskGovernor::new(RiskLimits::default()),
        ExecutionRouter::new(std::sync::Arc::clone(&paper_broker) as std::sync::Arc<dyn trading_core::execution::broker::BrokerAdapter>, None),
        AuditLedger::default(),
    );
    ShadowEngine::new(mode, MarketDataEngine::new(100, 1_000), supervisor, paper_broker)
}

#[test]
fn stopped_mode_ingests_data_but_skips_execution() {
    let mut engine = engine(EngineMode::Stopped);

    let result = engine.on_tick(tick(0, 100.0)).unwrap();

    assert!(result.execution.is_none());
    assert_eq!(
        result.skipped_reason.as_deref(),
        Some("Engine mode is stopped.")
    );
    assert_eq!(engine.data().tick_count(), 1);
    assert_eq!(
        engine
            .data()
            .latest_snapshot("NIFTY26JUN23000CE")
            .unwrap()
            .ltp,
        100.0
    );
}

#[test]
fn paper_mode_executes_through_supervisor() {
    let mut engine = engine(EngineMode::Paper);

    let result = engine.on_tick(tick(0, 100.0)).unwrap();

    assert!(result.execution.unwrap().ok);
    assert!(result.skipped_reason.is_none());
}

#[test]
fn kill_switch_blocks_execution_but_keeps_data_flowing() {
    let mut engine = engine(EngineMode::Paper);
    engine.trip_kill_switch();

    let first = engine.on_tick(tick(0, 100.0)).unwrap();
    let second = engine.on_tick(tick(1_100, 101.0)).unwrap();

    assert!(first.execution.is_none());
    assert_eq!(
        first.skipped_reason.as_deref(),
        Some("Kill switch is active.")
    );
    assert!(second.closed_candle.is_some());
    assert_eq!(engine.data().tick_count(), 2);
}
