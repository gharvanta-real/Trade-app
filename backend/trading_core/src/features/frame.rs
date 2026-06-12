use serde::{Deserialize, Serialize};

use crate::contracts::market::MarketSnapshot;
use crate::data::candle::Candle;

use super::option_context::OptionContext;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFrame {
    pub symbol: String,
    pub ltp: f64,
    pub spread_pct: Option<f64>,
    pub candle_return_pct: Option<f64>,
    pub candle_range_pct: Option<f64>,
    pub tick_volume: Option<u64>,
    pub candle_volume: Option<u64>,
    pub option: Option<OptionContext>,
    pub ts_ms: u64,
}

impl FeatureFrame {
    pub fn from_snapshot(
        snapshot: &MarketSnapshot,
        candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> Self {
        let candle_return_pct = candle.and_then(|c| {
            if c.open.abs() <= f64::EPSILON {
                None
            } else {
                Some(((c.close - c.open) / c.open) * 100.0)
            }
        });

        let candle_range_pct = candle.and_then(|c| {
            if c.open.abs() <= f64::EPSILON {
                None
            } else {
                Some(((c.high - c.low) / c.open) * 100.0)
            }
        });

        Self {
            symbol: snapshot.instrument.symbol.clone(),
            ltp: snapshot.ltp,
            spread_pct: snapshot.spread_pct(),
            candle_return_pct,
            candle_range_pct,
            tick_volume: snapshot.volume,
            candle_volume: candle.map(|c| c.volume),
            option,
            ts_ms: snapshot.ts_ms,
        }
    }
}
