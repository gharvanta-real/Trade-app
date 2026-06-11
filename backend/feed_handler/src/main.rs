/// main.rs — Tradesk Feed Handler entry point.
///
/// Spawns two concurrent async tasks:
///   1. `client::run_feed_client` — connects to Kotak wstreamer, parses ticks
///   2. `server::build_router`    — Axum WS server that fans ticks to the UI
///
/// Port 8002  →  ws://localhost:8002/ws   (frontend connects here)
/// Port 8001  →  Python sidecar           (polled for session token)

mod client;
mod parser;
mod server;
mod socketio;
mod state;

use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const BIND_ADDR:    &str = "127.0.0.1:8002";
const SIDECAR_URL:  &str = "http://127.0.0.1:8001";

#[tokio::main]
async fn main() {
    // Structured logging — set RUST_LOG=feed_handler=debug for verbose output
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "feed_handler=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("🚀 Tradesk Feed Handler starting on {BIND_ADDR}");

    // Build shared state and broadcast channel
    let (app_state, _) = state::AppState::new();
    let state = Arc::new(app_state);

    // Task 1: Kotak wstreamer client
    let feed_state = Arc::clone(&state);
    tokio::spawn(async move {
        client::run_feed_client(feed_state, SIDECAR_URL.to_string()).await;
    });

    // Task 2: Axum WebSocket server
    let router = server::build_router(Arc::clone(&state));
    let listener = tokio::net::TcpListener::bind(BIND_ADDR).await
        .expect("Failed to bind feed-handler port 8002");

    info!("Feed handler WS server listening on ws://{BIND_ADDR}/ws");
    axum::serve(listener, router).await.expect("Axum server error");
}
