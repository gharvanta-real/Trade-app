use std::collections::HashMap;

use super::candle::Candle;
use super::tick::MarketTick;

#[derive(Debug)]
pub struct CandleBuilder {
    interval_ms: u64,
    active: HashMap<String, Candle>,
    closed: Vec<Candle>,
}

impl CandleBuilder {
    pub fn new(interval_ms: u64) -> Self {
        Self {
            interval_ms,
            active: HashMap::new(),
            closed: Vec::new(),
        }
    }

    pub fn ingest(&mut self, tick: &MarketTick) -> Option<Candle> {
        let symbol = tick.instrument.symbol.clone();
        let bucket = (tick.ts_ms / self.interval_ms) * self.interval_ms;
        let volume = tick.volume.unwrap_or(0);

        match self.active.get_mut(&symbol) {
            Some(candle) if candle.bucket_start_ms == bucket => {
                candle.update(tick.ltp, volume);
                None
            }
            Some(_) => {
                let closed = self.active.remove(&symbol);
                let next = Candle::new(symbol.clone(), bucket, self.interval_ms, tick.ltp, volume);
                self.active.insert(symbol, next);
                if let Some(candle) = closed.clone() {
                    self.closed.push(candle);
                }
                closed
            }
            None => {
                let candle =
                    Candle::new(symbol.clone(), bucket, self.interval_ms, tick.ltp, volume);
                self.active.insert(symbol, candle);
                None
            }
        }
    }

    pub fn active(&self, symbol: &str) -> Option<&Candle> {
        self.active.get(symbol)
    }

    pub fn closed(&self) -> &[Candle] {
        &self.closed
    }
}
