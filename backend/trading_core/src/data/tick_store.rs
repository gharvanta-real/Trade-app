use std::collections::VecDeque;

use super::tick::MarketTick;

#[derive(Debug)]
pub struct TickStore {
    capacity: usize,
    ticks: VecDeque<MarketTick>,
}

impl TickStore {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity: capacity.max(1),
            ticks: VecDeque::with_capacity(capacity.max(1)),
        }
    }

    pub fn push(&mut self, tick: MarketTick) {
        if self.ticks.len() == self.capacity {
            self.ticks.pop_front();
        }
        self.ticks.push_back(tick);
    }

    pub fn len(&self) -> usize {
        self.ticks.len()
    }

    pub fn latest(&self) -> Option<&MarketTick> {
        self.ticks.back()
    }

    pub fn iter(&self) -> impl Iterator<Item = &MarketTick> {
        self.ticks.iter()
    }
}
