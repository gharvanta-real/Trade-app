use std::collections::HashMap;

use crate::contracts::market::MarketSnapshot;

use super::tick::MarketTick;

#[derive(Debug, Default)]
pub struct SnapshotCache {
    latest: HashMap<String, MarketSnapshot>,
}

impl SnapshotCache {
    pub fn update(&mut self, tick: &MarketTick) -> MarketSnapshot {
        let snapshot = tick.to_snapshot();
        self.latest
            .insert(snapshot.instrument.symbol.clone(), snapshot.clone());
        snapshot
    }

    pub fn get(&self, symbol: &str) -> Option<&MarketSnapshot> {
        self.latest.get(symbol)
    }

    pub fn len(&self) -> usize {
        self.latest.len()
    }
}
