/// state.rs — Shared application state across all async tasks.
///
/// `AppState` is wrapped in `Arc` and injected into both
/// the Axum router and the Kotak feed client task.
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use trading_core::control::mode::EngineMode;
use trading_core::data::engine::MarketDataEngine;
use trading_core::execution::paper::PaperBroker;
use trading_core::execution::router::ExecutionRouter;
use trading_core::models::baseline_regime::BaselineRegimeModel;
use trading_core::strategies::expiry_scalper::ExpiryScalperStrategy;
use trading_core::runtime::shadow_engine::ShadowEngine;
use trading_core::runtime::supervisor::TradingSupervisor;
use trading_core::risk::governor::RiskGovernor;
use trading_core::risk::limits::RiskLimits;
use trading_core::audit::ledger::AuditLedger;

pub type CoreShadowEngine = ShadowEngine<BaselineRegimeModel, ExpiryScalperStrategy>;

/// Runtime session data obtained from the Python sidecar after login.
#[derive(Debug, Default, Clone)]
pub struct SessionInfo {
    pub access_token: Option<String>,
    pub sid: Option<String>,
    pub status: String,
}

/// Top-level shared state.
pub struct AppState {
    /// Channel for broadcasting parsed tick JSON to all WS clients.
    /// Capacity 1024: old ticks are dropped if clients are slow.
    pub tx: broadcast::Sender<String>,
    /// Current Kotak session info (read by server, written by client task).
    pub session: RwLock<SessionInfo>,
    pub paper_broker: Arc<PaperBroker>,
    pub shadow_engine: RwLock<CoreShadowEngine>,
}

impl AppState {
    pub fn new() -> (Self, broadcast::Receiver<String>) {
        let (tx, rx) = broadcast::channel(1024);

        let paper_broker = Arc::new(PaperBroker::new());
        let model = BaselineRegimeModel::default();
        let strategy = ExpiryScalperStrategy::paper(75);
        let risk = RiskGovernor::new(RiskLimits::default());
        let execution = ExecutionRouter::new(
            Arc::clone(&paper_broker) as Arc<dyn trading_core::execution::broker::BrokerAdapter>,
            None,
        );
        let audit = AuditLedger::default();

        let supervisor = TradingSupervisor::new(model, strategy, risk, execution, audit);
        let data_engine = MarketDataEngine::new(50_000, 1_000);
        let shadow_engine = ShadowEngine::new(
            EngineMode::Paper,
            data_engine,
            supervisor,
            Arc::clone(&paper_broker),
        );

        let state = Self {
            tx,
            session: RwLock::new(SessionInfo::default()),
            paper_broker,
            shadow_engine: RwLock::new(shadow_engine),
        };
        (state, rx)
    }
}
