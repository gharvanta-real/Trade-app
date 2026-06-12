use trading_core::audit::ledger::AuditLedger;
use trading_core::contracts::market::{Instrument, InstrumentKind, MarketSnapshot};
use trading_core::contracts::orders::{
    ExecutionMode, OrderIntent, OrderSide, OrderType, ProductType, ProtectivePlan,
};
use trading_core::contracts::signals::{Decision, ModelSignal, Regime, TradeProposal};
use trading_core::execution::paper::PaperBroker;
use trading_core::execution::router::ExecutionRouter;
use trading_core::risk::governor::RiskGovernor;
use trading_core::risk::limits::RiskLimits;
use trading_core::runtime::model::TradingModel;
use trading_core::runtime::strategy::Strategy;
use trading_core::runtime::supervisor::TradingSupervisor;

struct DummyModel;

impl TradingModel for DummyModel {
    fn id(&self) -> &str {
        "dummy_model"
    }

    fn predict(&self, snapshot: &MarketSnapshot) -> ModelSignal {
        ModelSignal {
            model_id: self.id().to_string(),
            symbol: snapshot.instrument.symbol.clone(),
            decision: Decision::Trade,
            confidence: 0.72,
            regime: Regime::Trend,
            reason: "smoke test".to_string(),
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

struct DummyStrategy;

impl Strategy for DummyStrategy {
    fn id(&self) -> &str {
        "dummy_scalper"
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
                trail_after: Some(110.0),
                max_hold_ms: Some(60_000),
            },
        })
    }
}

#[test]
fn supervisor_runs_model_risk_execution_audit_path() {
    let audit = AuditLedger::default();
    let supervisor = TradingSupervisor::new(
        DummyModel,
        DummyStrategy,
        RiskGovernor::new(RiskLimits::default()),
        ExecutionRouter::new(std::sync::Arc::new(PaperBroker::default()), None),
        audit.clone(),
    );

    let snapshot = MarketSnapshot {
        instrument: Instrument {
            symbol: "NIFTY26JUN23000CE".to_string(),
            exchange: "NSE_FO".to_string(),
            kind: InstrumentKind::Option,
            token: Some("12345".to_string()),
            lot_size: 75,
        },
        ltp: 100.0,
        bid: Some(99.9),
        ask: Some(100.1),
        volume: Some(10_000),
        open_interest: Some(100_000),
        oi_change: None,
        implied_volatility: None,
        days_to_expiry: None,
        ts_ms: 1,
    };

    let result = supervisor.on_snapshot(&snapshot).unwrap().unwrap();

    assert!(result.ok);
    assert_eq!(result.mode, "paper");
    assert!(result.order_id.is_some());
    assert_eq!(audit.list().len(), 3);
}
