/// client.rs — Kotak Neo wstreamer WebSocket client.
///
/// Connects to wss://livefeeds.kotaksecurities.com using the access_token
/// and sid obtained from the Python sidecar (/api/kotak/status).
/// Handles: EIO handshake → auth → ping/pong → tick parsing → broadcast.

use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info, warn};

use crate::{
    parser::process_feed_message,
    socketio::{build_auth_frame, build_subscribe_frame, parse_frame, pong_frame, EioFrame},
    state::AppState,
};

/// Poll the Python sidecar until a CONNECTED session appears.
/// Returns (access_token, sid) when ready.
async fn await_session(sidecar_url: &str) -> (String, String) {
    loop {
        match reqwest::get(format!("{sidecar_url}/api/kotak/status")).await {
            Ok(resp) => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if json["status"] == "CONNECTED" {
                        let token = json["access_token"].as_str().unwrap_or("").to_string();
                        let sid   = json["sid"].as_str().unwrap_or("").to_string();
                        if !token.is_empty() && !sid.is_empty() {
                            info!("Session ready — token acquired.");
                            return (token, sid);
                        }
                    }
                }
            }
            Err(e) => warn!("Sidecar not reachable yet: {e}"),
        }
        sleep(Duration::from_secs(3)).await;
    }
}

/// Main feed client loop.  Reconnects automatically on any error.
pub async fn run_feed_client(state: Arc<AppState>, sidecar_url: String) {
    loop {
        // Wait for Python sidecar to have a valid session
        let (token, sid) = await_session(&sidecar_url).await;

        // Update shared session state
        {
            let mut s = state.session.write().await;
            s.access_token = Some(token.clone());
            s.sid = Some(sid.clone());
            s.status = "CONNECTED".to_string();
        }

        // Build Kotak wstreamer URL
        // EIO=3 → Engine.IO v3 | transport=websocket → skip long-poll
        let ws_url = format!(
            "wss://wstreamer.kotaksecurities.com/feed/?EIO=3&transport=websocket&access_token={token}"
        );

        info!("Connecting to Kotak wstreamer…");

        match connect_async(ws_url.as_str()).await {
            Err(e) => {
                error!("WebSocket connect failed: {e}");
                sleep(Duration::from_secs(5)).await;
                continue;
            }
            Ok((ws_stream, _)) => {
                info!("WebSocket connected to Kotak wstreamer");
                let (mut write, mut read) = ws_stream.split();

                while let Some(msg_result) = read.next().await {
                    let raw_msg = match msg_result {
                        Ok(Message::Text(t))  => t.to_string(),
                        Ok(Message::Close(_)) => { warn!("Server closed connection"); break; }
                        Ok(_)                 => continue,
                        Err(e)                => { error!("WS read error: {e}"); break; }
                    };

                    match parse_frame(&raw_msg) {
                        EioFrame::Open(_) => {
                            // Send auth frame immediately after handshake
                            let auth = build_auth_frame(&token, &sid);
                            if write.send(Message::Text(auth.into())).await.is_err() { break; }
                        }

                        EioFrame::Ping => {
                            // Reply with PONG to keep connection alive
                            if write.send(Message::Text(pong_frame().into())).await.is_err() { break; }
                        }

                        EioFrame::Message(arr) => {
                            // arr[0] is event type (e.g. "cn"), arr[1] is payload
                            if arr.is_empty() { continue; }
                            let event = arr[0].as_str().unwrap_or("");

                            if event == "cn" {
                                // Connection ack — subscribe to default instruments
                                // (In production, frontend sends desired scrips via REST)
                                let scrips = vec!["nse_cm|11536".to_string()]; // NIFTY50 default
                                let sub_frame = build_subscribe_frame(&token, &sid, &scrips);
                                if write.send(Message::Text(sub_frame.into())).await.is_err() { break; }
                                info!("Subscribed to default scrips");
                            }

                            if event == "mws" || arr.len() > 1 {
                                // Stock feed data
                                if let Some(data_arr) = arr.get(1).and_then(|v| v.as_array()) {
                                    if let Some(json_str) = process_feed_message(data_arr) {
                                        // Broadcast — lagged receivers simply miss old ticks (fine)
                                        let _ = state.tx.send(json_str);
                                    }
                                }
                            }
                        }

                        EioFrame::Unknown(_) => {}
                    }
                }

                warn!("Feed connection lost — reconnecting in 5s…");
                {
                    let mut s = state.session.write().await;
                    s.status = "DISCONNECTED".to_string();
                }
                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
