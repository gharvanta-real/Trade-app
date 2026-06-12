use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OptionSide {
    Call,
    Put,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptionContext {
    pub underlying_symbol: String,
    pub spot_ltp: f64,
    pub future_ltp: Option<f64>,
    pub strike: f64,
    pub side: OptionSide,
    pub days_to_expiry: f64,
    pub implied_volatility: Option<f64>,
    pub open_interest: Option<u64>,
    pub oi_change: Option<i64>,
    pub atm_straddle_price: Option<f64>,
}

impl OptionContext {
    pub fn moneyness_pct(&self) -> f64 {
        if self.spot_ltp <= 0.0 {
            return 0.0;
        }
        ((self.strike - self.spot_ltp) / self.spot_ltp) * 100.0
    }

    pub fn is_near_atm(&self, max_abs_moneyness_pct: f64) -> bool {
        self.moneyness_pct().abs() <= max_abs_moneyness_pct
    }
}
