use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Candle {
    pub symbol: String,
    pub bucket_start_ms: u64,
    pub interval_ms: u64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: u64,
    pub tick_count: u32,
}

impl Candle {
    pub fn new(
        symbol: String,
        bucket_start_ms: u64,
        interval_ms: u64,
        price: f64,
        volume: u64,
    ) -> Self {
        Self {
            symbol,
            bucket_start_ms,
            interval_ms,
            open: price,
            high: price,
            low: price,
            close: price,
            volume,
            tick_count: 1,
        }
    }

    pub fn update(&mut self, price: f64, volume: u64) {
        self.high = self.high.max(price);
        self.low = self.low.min(price);
        self.close = price;
        self.volume = self.volume.saturating_add(volume);
        self.tick_count = self.tick_count.saturating_add(1);
    }
}
