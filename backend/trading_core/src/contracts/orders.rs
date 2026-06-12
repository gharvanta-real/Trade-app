use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    StopLossMarket,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProductType {
    Intraday,
    Overnight,
    Cnc,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExecutionMode {
    Paper,
    Shadow,
    SupervisedLive,
    AutoLive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderIntent {
    pub strategy_id: String,
    pub symbol: String,
    pub exchange: String,
    pub side: OrderSide,
    pub quantity: u32,
    pub order_type: OrderType,
    pub product: ProductType,
    pub mode: ExecutionMode,
    pub price: Option<f64>,
    pub trigger_price: Option<f64>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtectivePlan {
    pub stop_loss: f64,
    pub target: Option<f64>,
    pub trail_after: Option<f64>,
    pub max_hold_ms: Option<u64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderState {
    Placed,
    Open,
    PartiallyFilled,
    Executed,
    Rejected,
    Modified,
    Cancelled,
    Triggered,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub intent: OrderIntent,
    pub state: OrderState,
    pub filled_qty: u32,
    pub avg_fill_price: f64,
    pub ts_ms: u64,
    pub fail_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub symbol: String,
    pub qty: i32,
    pub avg_price: f64,
    pub realized_pnl: f64,
    pub unrealized_pnl: f64,
    pub ltp: f64,
}
