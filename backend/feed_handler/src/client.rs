use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::{SinkExt, StreamExt};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info, warn};

use crate::{
    core_bridge::tick_to_core,
    parser::{parse_feed_ticks, process_feed_message},
    socketio::{build_auth_frame, build_subscribe_frame, parse_frame, pong_frame, EioFrame},
    state::AppState,
};

async fn await_session(sidecar_url: &str) -> (String, String) {
    loop {
        match reqwest::get(format!("{sidecar_url}/api/kotak/status")).await {
            Ok(resp) => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if json["status"] == "CONNECTED" {
                        let token = json["access_token"].as_str().unwrap_or("").to_string();
                        let sid = json["sid"].as_str().unwrap_or("").to_string();
                        if !token.is_empty() && !sid.is_empty() {
                            info!("Session ready: token acquired.");
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

pub async fn run_feed_client(state: Arc<AppState>, sidecar_url: String) {
    loop {
        let (token, sid) = await_session(&sidecar_url).await;

        {
            let mut s = state.session.write().await;
            s.access_token = Some(token.clone());
            s.sid = Some(sid.clone());
            s.status = "CONNECTED".to_string();
        }

        let ws_url = format!(
            "wss://wstreamer.kotaksecurities.com/feed/?EIO=3&transport=websocket&access_token={token}"
        );

        info!("Connecting to Kotak wstreamer...");

        match connect_async(ws_url.as_str()).await {
            Err(e) => {
                error!("WebSocket connect failed: {e}");
                sleep(Duration::from_secs(5)).await;
            }
            Ok((ws_stream, _)) => {
                info!("WebSocket connected to Kotak wstreamer");
                let (mut write, mut read) = ws_stream.split();

                while let Some(msg_result) = read.next().await {
                    let raw_msg = match msg_result {
                        Ok(Message::Text(t)) => t.to_string(),
                        Ok(Message::Close(_)) => {
                            warn!("Server closed connection");
                            break;
                        }
                        Ok(_) => continue,
                        Err(e) => {
                            error!("WS read error: {e}");
                            break;
                        }
                    };

                    match parse_frame(&raw_msg) {
                        EioFrame::Open(_) => {
                            let auth = build_auth_frame(&token, &sid);
                            if write.send(Message::Text(auth.into())).await.is_err() {
                                break;
                            }
                        }
                        EioFrame::Ping => {
                            if write
                                .send(Message::Text(pong_frame().into()))
                                .await
                                .is_err()
                            {
                                break;
                            }
                        }
                        EioFrame::Message(arr) => {
                            if arr.is_empty() {
                                continue;
                            }
                            let event = arr[0].as_str().unwrap_or("");

                            if event == "cn" {
                                let scrips = vec!["nse_cm|11536".to_string()];
                                let sub_frame = build_subscribe_frame(&token, &sid, &scrips);
                                if write.send(Message::Text(sub_frame.into())).await.is_err() {
                                    break;
                                }
                                info!("Subscribed to default scrips");
                            }

                            if event == "mws" || arr.len() > 1 {
                                if let Some(data_arr) = arr.get(1).and_then(|v| v.as_array()) {
                                    ingest_core_ticks(&state, data_arr).await;
                                    if let Some(json_str) = process_feed_message(data_arr) {
                                        let _ = state.tx.send(json_str);
                                    }
                                }
                            }
                        }
                        EioFrame::Unknown(_) => {}
                    }
                }

                warn!("Feed connection lost: reconnecting in 5s");
                {
                    let mut s = state.session.write().await;
                    s.status = "DISCONNECTED".to_string();
                }
                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

async fn ingest_core_ticks(state: &Arc<AppState>, data_arr: &[serde_json::Value]) {
    let core_ticks = parse_feed_ticks(data_arr);
    if core_ticks.is_empty() {
        return;
    }

    let ts_ms = unix_ms();
    let mut shadow = state.shadow_engine.write().await;
    for tick in &core_ticks {
        let mut core_tick = tick_to_core(tick, ts_ms);
        if core_tick.instrument.kind == trading_core::contracts::market::InstrumentKind::Option {
            core_tick.days_to_expiry = Some(0.1);
            core_tick.implied_volatility = Some(15.0);
            core_tick.oi_change = Some(0);
        }
        let _ = shadow.on_tick(core_tick);
    }
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
