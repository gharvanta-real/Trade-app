use crate::contracts::market::MarketSnapshot;
use crate::contracts::signals::ModelSignal;
use crate::data::candle::Candle;
use crate::features::option_context::OptionContext;

pub trait TradingModel: Send + Sync {
    fn id(&self) -> &str;
    fn predict(&self, snapshot: &MarketSnapshot) -> ModelSignal;
    fn predict_with_context(
        &self,
        snapshot: &MarketSnapshot,
        active_candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> ModelSignal;
}
