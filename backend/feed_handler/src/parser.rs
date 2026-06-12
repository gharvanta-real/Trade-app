/// parser.rs — Tick payload normaliser.
///
/// Raw Kotak Neo stock_feed payloads look like:
///   [{"tk":"11536","ltp":"22450.50","ltq":"75","pc":"-0.45",...}, ...]
///
/// We normalise them into a clean, frontend-ready TickUpdate struct and
/// serialise once so the server.rs broadcast channel gets a flat &str.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::warn;

/// Clean, frontend-ready tick data structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickUpdate {
    pub token: String, // instrument token (tk)
    pub ltp: f64,      // last traded price
    pub ltq: u64,      // last traded quantity
    pub change: f64,   // percent change (pc)
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: u64,
}

/// Parse a raw Kotak stock_feed array element into a `TickUpdate`.
/// Returns `None` if the minimum required fields are missing.
pub fn parse_tick(raw: &Value) -> Option<TickUpdate> {
    let get_f64 = |key: &str| -> f64 {
        raw.get(key)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0)
    };
    let get_u64 = |key: &str| -> u64 {
        raw.get(key)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    };

    let token = raw.get("tk")?.as_str()?.to_string();
    if token.is_empty() {
        warn!("Received tick with empty token — skipping");
        return None;
    }

    Some(TickUpdate {
        token,
        ltp: get_f64("ltp"),
        ltq: get_u64("ltq"),
        change: get_f64("pc"),
        open: get_f64("o"),
        high: get_f64("h"),
        low: get_f64("l"),
        close: get_f64("c"),
        volume: get_u64("v"),
    })
}

pub fn parse_feed_ticks(data: &[Value]) -> Vec<TickUpdate> {
    data.iter().filter_map(parse_tick).collect()
}

/// Parse a full stock_feed message array and return serialised JSON string
/// ready for broadcasting to frontend WebSocket clients.
pub fn process_feed_message(data: &[Value]) -> Option<String> {
    let ticks = parse_feed_ticks(data);

    if ticks.is_empty() {
        return None;
    }

    serde_json::to_string(&serde_json::json!({
        "type": "tick",
        "data": ticks
    }))
    .ok()
}
