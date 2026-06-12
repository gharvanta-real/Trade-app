use super::engine::{IngestResult, MarketDataEngine};
use super::tick::MarketTick;

pub struct MarketReplay<'a> {
    engine: &'a mut MarketDataEngine,
}

impl<'a> MarketReplay<'a> {
    pub fn new(engine: &'a mut MarketDataEngine) -> Self {
        Self { engine }
    }

    pub fn run<I>(&mut self, ticks: I) -> Vec<IngestResult>
    where
        I: IntoIterator<Item = MarketTick>,
    {
        ticks
            .into_iter()
            .map(|tick| self.engine.ingest_tick(tick))
            .collect()
    }
}
