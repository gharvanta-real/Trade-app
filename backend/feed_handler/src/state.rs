/// state.rs — Shared application state across all async tasks.
///
/// `AppState` is wrapped in `Arc` and injected into both
/// the Axum router and the Kotak feed client task.

use tokio::sync::{broadcast, RwLock};

/// Runtime session data obtained from the Python sidecar after login.
#[derive(Debug, Default, Clone)]
pub struct SessionInfo {
    pub access_token: Option<String>,
    pub sid:          Option<String>,
    pub status:       String,
}

/// Top-level shared state.
pub struct AppState {
    /// Channel for broadcasting parsed tick JSON to all WS clients.
    /// Capacity 1024: old ticks are dropped if clients are slow.
    pub tx:      broadcast::Sender<String>,
    /// Current Kotak session info (read by server, written by client task).
    pub session: RwLock<SessionInfo>,
}

impl AppState {
    pub fn new() -> (Self, broadcast::Receiver<String>) {
        let (tx, rx) = broadcast::channel(1024);
        let state = Self {
            tx,
            session: RwLock::new(SessionInfo::default()),
        };
        (state, rx)
    }
}
