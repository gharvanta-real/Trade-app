/// server.rs — Local WebSocket server for the SolidJS frontend.
///
/// Listens on ws://127.0.0.1:8002/ws.
/// Receives parsed tick JSON from the `tokio::sync::broadcast` channel
/// and fans out to all connected browser clients.
///
/// Exposes endpoints to query the state of the Rust Core Engine.
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use serde_json::json;

use crate::state::{AppState, CoreShadowEngine};
use trading_core::control::mode::EngineMode;

/// Axum router — mounts the WS upgrade handler and core status/order routing endpoints.
pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health))
        .route("/token", get(get_token))
        .route("/core/status", get(core_status))
        .route("/core/mode", post(set_engine_mode))
        .route("/core/orders", get(get_core_orders))
        .route("/core/positions", get(get_core_positions))
        .route("/core/proposals", get(get_core_proposals))
        .route("/core/order/approve", post(approve_core_proposal))
        .route("/core/order/reject", post(reject_core_proposal))
        .route("/core/kill", post(trip_core_kill_switch))
        .route("/core/reset-kill", post(reset_core_kill_switch))
        .route("/core/clear", post(clear_core_data))
        .layer(cors)
        .with_state(state)
}

/// HTTP handler — upgrades to WebSocket.
async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// WebSocket lifecycle — subscribes to the broadcast channel and
/// forwards every tick message to this client.
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Task: forward broadcast messages → this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break; // client disconnected
            }
        }
    });

    // Task: drain incoming messages from client (keep-alive / ignore)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(_msg)) = receiver.next().await {
            // no client→server messages needed for feed-only mode
        }
    });

    // Abort the other task when either side finishes
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    info!("Frontend WebSocket client disconnected");
}

// Rename receiver_task in select to avoid name mismatch
// Wait, receiver_task -> recv_task. Let's fix that.

/// Exposes current Kotak session token so the UI can inspect it.
async fn get_token(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let guard = state.session.read().await;
    Json(json!({
        "access_token": guard.access_token,
        "sid":          guard.sid,
        "status":       guard.status,
    }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "feed-handler" }))
}

async fn core_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let shadow = state.shadow_engine.read().await;
    let mode = shadow.mode();
    let tick_count = shadow.data().tick_count();
    let closed_candles = shadow.data().closed_candles().len();
    let realized_pnl = state.paper_broker.realized_pnl();
    let unrealized_pnl = state.paper_broker.unrealized_pnl();
    let total_pnl = realized_pnl + unrealized_pnl;
    let kill_switch_active = shadow.kill_switch.is_tripped();
    let audit_logs = shadow.supervisor.audit.list();
    let active_positions = state.paper_broker.positions();

    Json(json!({
        "status": "ok",
        "mode": format!("{:?}", mode),
        "tick_count": tick_count,
        "closed_candles": closed_candles,
        "realized_pnl": realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "total_pnl": total_pnl,
        "kill_switch_active": kill_switch_active,
        "warnings": get_live_warnings(&shadow),
        "positions_count": active_positions.iter().filter(|p| p.qty != 0).count(),
        "audit_logs": audit_logs.iter().rev().take(30).collect::<Vec<_>>(),
    }))
}

fn get_live_warnings(shadow: &CoreShadowEngine) -> Vec<serde_json::Value> {
    let mut list = Vec::new();
    if shadow.kill_switch.is_tripped() {
        list.push(json!({ "severity": "High", "title": "Kill switch is active", "detail": "All order placements and strategy executions are blocked." }));
    }
    if shadow.mode() == EngineMode::Stopped {
        list.push(json!({ "severity": "Medium", "title": "Engine mode is stopped", "detail": "Engine will ingest ticks but skip strategies scoring." }));
    }
    if shadow.supervisor.risk.state().total_trades_today >= shadow.supervisor.risk.limits.max_trades_per_day {
        list.push(json!({ "severity": "High", "title": "Daily trades limit hit", "detail": "Daily limit of trades is reached. Risk governor will block new orders." }));
    }
    if shadow.paper_broker.realized_pnl() <= -shadow.supervisor.risk.limits.max_daily_loss.abs() {
        list.push(json!({ "severity": "High", "title": "Daily max loss hit", "detail": "Daily loss limits hit. Risk governor will block new orders." }));
    }
    list
}

async fn set_engine_mode(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    let mode_str = payload["mode"].as_str().unwrap_or("Paper");
    let mode = match mode_str {
        "Paper" => EngineMode::Paper,
        "Shadow" => EngineMode::Shadow,
        "SupervisedLive" => EngineMode::SupervisedLive,
        "AutoLive" => EngineMode::AutoLive,
        _ => EngineMode::Stopped,
    };

    let mut shadow = state.shadow_engine.write().await;
    shadow.set_mode(mode);
    Json(json!({ "status": "ok", "mode": format!("{:?}", mode) }))
}

async fn get_core_orders(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let orders = state.paper_broker.orders();
    Json(json!(orders))
}

async fn get_core_positions(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let positions = state.paper_broker.positions();
    Json(json!(positions))
}

async fn get_core_proposals(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let shadow = state.shadow_engine.read().await;
    let proposals = shadow.pending_proposals.lock().unwrap().clone();
    Json(json!(proposals))
}

async fn approve_core_proposal(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    let symbol = payload["symbol"].as_str().unwrap_or("");
    let mut shadow = state.shadow_engine.write().await;
    match shadow.approve_proposal(symbol) {
        Ok(Some(res)) => Json(json!({ "status": "ok", "result": res })),
        Ok(None) => Json(json!({ "status": "error", "message": "No pending proposal found for symbol" })),
        Err(e) => Json(json!({ "status": "error", "message": format!("Execution rejected: {e}") })),
    }
}

async fn reject_core_proposal(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    let symbol = payload["symbol"].as_str().unwrap_or("");
    let shadow = state.shadow_engine.read().await;
    let removed = shadow.reject_proposal(symbol);
    Json(json!({ "status": "ok", "removed": removed }))
}

async fn trip_core_kill_switch(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let shadow = state.shadow_engine.read().await;
    shadow.trip_kill_switch();
    Json(json!({ "status": "ok", "kill_switch_active": true }))
}

async fn reset_core_kill_switch(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let shadow = state.shadow_engine.read().await;
    shadow.reset_kill_switch();
    Json(json!({ "status": "ok", "kill_switch_active": false }))
}

async fn clear_core_data(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    state.paper_broker.clear_all();
    let shadow = state.shadow_engine.write().await;
    shadow.pending_proposals.lock().unwrap().clear();
    Json(json!({ "status": "ok", "message": "All shadow engine data cleared." }))
}
