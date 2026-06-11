/// server.rs — Local WebSocket server for the SolidJS frontend.
///
/// Listens on ws://127.0.0.1:8002/ws.
/// Receives parsed tick JSON from the `tokio::sync::broadcast` channel
/// and fans out to all connected browser clients.
///
/// Also exposes GET /token so the frontend can read the current
/// Kotak session token (fetched from the Python sidecar).

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::state::AppState;

/// Axum router — mounts the WS upgrade handler and a /health endpoint.
pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health))
        .route("/token", get(get_token))
        .layer(cors)
        .with_state(state)
}

/// HTTP handler — upgrades to WebSocket.
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
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

/// Exposes current Kotak session token so the UI can inspect it.
async fn get_token(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let guard = state.session.read().await;
    Json(serde_json::json!({
        "access_token": guard.access_token,
        "sid":          guard.sid,
        "status":       guard.status,
    }))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "feed-handler" }))
}
