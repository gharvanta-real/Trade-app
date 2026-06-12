use serde::{Deserialize, Serialize};

use crate::contracts::market::{Instrument, MarketSnapshot};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketTick {
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

impl MarketTick {
    pub fn to_snapshot(&self) -> MarketSnapshot {
        MarketSnapshot {
            instrument: self.instrument.clone(),
            ltp: self.ltp,
            bid: self.bid,
            ask: self.ask,
            volume: self.volume,
            open_interest: self.open_interest,
            oi_change: self.oi_change,
            implied_volatility: self.implied_volatility,
            days_to_expiry: self.days_to_expiry,
            ts_ms: self.ts_ms,
        }
    }
}
