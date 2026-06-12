use crate::contracts::market::MarketSnapshot;
use crate::data::candle::Candle;

use super::frame::FeatureFrame;
use super::option_context::OptionContext;

#[derive(Debug, Default)]
pub struct FeatureEngine;

impl FeatureEngine {
    pub fn build(
        &self,
        snapshot: &MarketSnapshot,
        active_candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> FeatureFrame {
        FeatureFrame::from_snapshot(snapshot, active_candle, option)
    }
}
