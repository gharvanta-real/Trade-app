#[derive(Debug, Clone, Default)]
pub struct RiskState {
    pub realized_pnl: f64,
    pub open_positions: u32,
    pub orders_this_second: u32,
    pub total_trades_today: u32,
    pub last_trade_ts_ms: u64,
}
