/// socketio.rs — Socket.IO / Engine.IO frame codec for Kotak Neo.
///
/// Kotak Neo's wstreamer uses Engine.IO v3 (EIO=3) over a raw WebSocket
/// transport.  The protocol is simple text frames:
///
///   "0{...}"  → OPEN handshake (server → client)
///   "2"       → PING  (server → client, every ~25s)
///   "3"       → PONG  (client → server, reply to PING)
///   "42[...]" → MESSAGE event (stock feed / connection ack)
///
/// After connection, we must send an auth frame then the subscription.
use serde_json::Value;
use tracing::{debug, warn};

/// Decoded Engine.IO frame variants we care about.
#[derive(Debug)]
pub enum EioFrame {
    Open(()),            // server hello — contains ping_interval / ping_timeout
    Ping,                // server keepalive request
    Message(Vec<Value>), // 42[event, payload] → parsed inner array
    Unknown(()),         // anything else — log and ignore
}

/// Parse a raw text frame received from the Kotak wstreamer WebSocket.
pub fn parse_frame(raw: &str) -> EioFrame {
    if raw.starts_with('0') {
        let json_part = &raw[1..];
        match serde_json::from_str::<Value>(json_part) {
            Ok(_) => EioFrame::Open(()),
            Err(e) => {
                warn!("Bad OPEN frame: {e}");
                EioFrame::Unknown(())
            }
        }
    } else if raw == "2" {
        EioFrame::Ping
    } else if raw.starts_with("42") {
        let json_part = &raw[2..];
        match serde_json::from_str::<Vec<Value>>(json_part) {
            Ok(arr) => EioFrame::Message(arr),
            Err(e) => {
                warn!("Bad 42 frame: {e}");
                EioFrame::Unknown(())
            }
        }
    } else {
        debug!("Unhandled EIO frame: {raw}");
        EioFrame::Unknown(())
    }
}

/// Build the PONG response frame (client replies to server PING).
pub fn pong_frame() -> String {
    "3".to_string()
}

/// Build the auth + connection frame sent immediately after the socket opens.
/// Kotak expects:  `42["cn", {"Authorization": TOKEN, "Sid": SID}]`
pub fn build_auth_frame(token: &str, sid: &str) -> String {
    let payload = serde_json::json!({
        "type": "cn",
        "Authorization": token,
        "Sid": sid
    });
    format!("42[\"cn\",{}]", payload)
}

/// Build a live-quote subscription frame for a list of instrument tokens.
/// Format:  `42["mws", {"Authorization": TOKEN, "Sid": SID, "scrips": "nse_cm|11536&nse_cm|1333"}]`
pub fn build_subscribe_frame(token: &str, sid: &str, scrips: &[String]) -> String {
    let scrips_str = scrips.join("&");
    let payload = serde_json::json!({
        "type": "mws",
        "Authorization": token,
        "Sid": sid,
        "scrips": scrips_str
    });
    format!("42[\"mws\",{}]", payload)
}
