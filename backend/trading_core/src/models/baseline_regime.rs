use crate::contracts::market::MarketSnapshot;
use crate::contracts::signals::{Decision, ModelSignal, Regime};
use crate::data::candle::Candle;
use crate::features::engine::FeatureEngine;
use crate::features::option_context::OptionContext;
use crate::runtime::model::TradingModel;

#[derive(Debug, Clone)]
pub struct BaselineRegimeModel {
    model_id: String,
    min_trend_return_pct: f64,
    max_spread_pct: f64,
    trap_range_pct: f64,
}

impl Default for BaselineRegimeModel {
    fn default() -> Self {
        Self {
            model_id: "baseline_regime_v1".to_string(),
            min_trend_return_pct: 0.08,
            max_spread_pct: 0.8,
            trap_range_pct: 0.5,
        }
    }
}

impl BaselineRegimeModel {
    pub fn predict_with_context(
        &self,
        snapshot: &MarketSnapshot,
        active_candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> ModelSignal {
        let features = FeatureEngine::default().build(snapshot, active_candle, option);

        if features.spread_pct.unwrap_or(0.0) > self.max_spread_pct {
            return ModelSignal {
                model_id: self.model_id.clone(),
                symbol: features.symbol,
                decision: Decision::Avoid,
                confidence: 0.2,
                regime: Regime::Trap,
                reason: "Spread too wide; execution risk high.".to_string(),
            };
        }

        if let Some(option) = features.option.as_ref() {
            if !option.is_near_atm(1.0) {
                return ModelSignal {
                    model_id: self.model_id.clone(),
                    symbol: features.symbol,
                    decision: Decision::Avoid,
                    confidence: 0.35,
                    regime: Regime::Trap,
                    reason: "Option is too far from ATM for expiry scalping.".to_string(),
                };
            }
        }

        let ret = features.candle_return_pct.unwrap_or(0.0);
        let range = features.candle_range_pct.unwrap_or(0.0);

        if range >= self.trap_range_pct && ret.abs() < self.min_trend_return_pct {
            return ModelSignal {
                model_id: self.model_id.clone(),
                symbol: features.symbol,
                decision: Decision::Avoid,
                confidence: 0.45,
                regime: Regime::Trap,
                reason: "Large range without close follow-through; trap risk.".to_string(),
            };
        }

        if ret.abs() >= self.min_trend_return_pct {
            let confidence = (0.55 + ret.abs().min(0.5)).min(0.9);
            return ModelSignal {
                model_id: self.model_id.clone(),
                symbol: features.symbol,
                decision: Decision::Trade,
                confidence,
                regime: Regime::Trend,
                reason: "Trend continuation candidate.".to_string(),
            };
        }

        ModelSignal {
            model_id: self.model_id.clone(),
            symbol: features.symbol,
            decision: Decision::Hold,
            confidence: 0.5,
            regime: Regime::Range,
            reason: "No clear trade regime.".to_string(),
        }
    }
}

impl TradingModel for BaselineRegimeModel {
    fn id(&self) -> &str {
        &self.model_id
    }

    fn predict(&self, snapshot: &MarketSnapshot) -> ModelSignal {
        self.predict_with_context(snapshot, None, None)
    }

    fn predict_with_context(
        &self,
        snapshot: &MarketSnapshot,
        active_candle: Option<&Candle>,
        option: Option<OptionContext>,
    ) -> ModelSignal {
        self.predict_with_context(snapshot, active_candle, option)
    }
}
