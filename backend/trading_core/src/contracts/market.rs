use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum InstrumentKind {
    Index,
    Option,
    Future,
    Equity,
    Commodity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instrument {
    pub symbol: String,
    pub exchange: String,
    pub kind: InstrumentKind,
    pub token: Option<String>,
    pub lot_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSnapshot {
    pub instrument: Instrument,
    pub ltp: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub volume: Option<u64>,
    pub open_interest: Option<u64>,
    pub oi_change: Option<i64>,
    pub implied_volatility: Option<f64>,
    pub days_to_expiry: Option<f64>,
    pub ts_ms: u64,
}

impl MarketSnapshot {
    pub fn spread_pct(&self) -> Option<f64> {
        let bid = self.bid?;
        let ask = self.ask?;
        if bid <= 0.0 || ask <= 0.0 {
            return None;
        }
        Some(((ask - bid) / self.ltp.max(1.0)) * 100.0)
    }
}
