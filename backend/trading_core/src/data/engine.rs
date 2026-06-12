use crate::contracts::market::MarketSnapshot;

use super::candle::Candle;
use super::candle_builder::CandleBuilder;
use super::snapshot_cache::SnapshotCache;
use super::tick::MarketTick;
use super::tick_store::TickStore;

#[derive(Debug)]
pub struct MarketDataEngine {
    ticks: TickStore,
    snapshots: SnapshotCache,
    candle_builder: CandleBuilder,
}

#[derive(Debug, Clone)]
pub struct IngestResult {
    pub snapshot: MarketSnapshot,
    pub closed_candle: Option<Candle>,
}

impl MarketDataEngine {
    pub fn new(tick_capacity: usize, candle_interval_ms: u64) -> Self {
        Self {
            ticks: TickStore::new(tick_capacity),
            snapshots: SnapshotCache::default(),
            candle_builder: CandleBuilder::new(candle_interval_ms),
        }
    }

    pub fn ingest_tick(&mut self, tick: MarketTick) -> IngestResult {
        let snapshot = self.snapshots.update(&tick);
        let closed_candle = self.candle_builder.ingest(&tick);
        self.ticks.push(tick);
        IngestResult {
            snapshot,
            closed_candle,
        }
    }

    pub fn latest_snapshot(&self, symbol: &str) -> Option<&MarketSnapshot> {
        self.snapshots.get(symbol)
    }

    pub fn active_candle(&self, symbol: &str) -> Option<&Candle> {
        self.candle_builder.active(symbol)
    }

    pub fn closed_candles(&self) -> &[Candle] {
        self.candle_builder.closed()
    }

    pub fn tick_count(&self) -> usize {
        self.ticks.len()
    }
}
