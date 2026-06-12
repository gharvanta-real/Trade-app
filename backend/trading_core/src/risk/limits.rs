#[derive(Debug, Clone)]
pub struct RiskLimits {
    pub max_daily_loss: f64,
    pub max_trade_loss: f64,
    pub max_orders_per_second: u32,
    pub max_open_positions: u32,
    pub min_confidence: f64,
    pub max_spread_pct: f64,
    pub max_trades_per_day: u32,
    pub cooldown_period_ms: u64,
    pub max_slippage_pct: f64,
    pub expiry_time_guard_mins: u32,
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            max_daily_loss: 1_000.0,
            max_trade_loss: 300.0,
            max_orders_per_second: 5,
            max_open_positions: 3,
            min_confidence: 0.55,
            max_spread_pct: 0.8,
            max_trades_per_day: 50,
            cooldown_period_ms: 10_000, // 10s between trades
            max_slippage_pct: 1.0,      // max 1% slippage
            expiry_time_guard_mins: 15, // don't trade within 15 mins of expiry
        }
    }
}
