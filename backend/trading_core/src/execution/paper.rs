use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::contracts::ids::new_id;
use crate::contracts::orders::{
    Order, OrderIntent, OrderSide, OrderState, OrderType, Position, ProtectivePlan,
};
use crate::data::tick::MarketTick;

use super::broker::{BrokerAdapter, ExecutionError, ExecutionResult};

#[derive(Debug)]
pub struct PaperBroker {
    orders: Mutex<Vec<Order>>,
    positions: Mutex<HashMap<String, Position>>,
    realized_pnl: Mutex<f64>,
    protective_plans: Mutex<HashMap<String, ProtectivePlan>>,
    latest_prices: Mutex<HashMap<String, f64>>,
}

impl Default for PaperBroker {
    fn default() -> Self {
        Self {
            orders: Mutex::new(Vec::new()),
            positions: Mutex::new(HashMap::new()),
            realized_pnl: Mutex::new(0.0),
            protective_plans: Mutex::new(HashMap::new()),
            latest_prices: Mutex::new(HashMap::new()),
        }
    }
}

impl PaperBroker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn orders(&self) -> Vec<Order> {
        self.orders.lock().unwrap().clone()
    }

    pub fn positions(&self) -> Vec<Position> {
        self.positions.lock().unwrap().values().cloned().collect()
    }

    pub fn realized_pnl(&self) -> f64 {
        *self.realized_pnl.lock().unwrap()
    }

    pub fn unrealized_pnl(&self) -> f64 {
        self.positions
            .lock()
            .unwrap()
            .values()
            .map(|p| p.unrealized_pnl)
            .sum()
    }

    pub fn clear_all(&self) {
        self.orders.lock().unwrap().clear();
        self.positions.lock().unwrap().clear();
        *self.realized_pnl.lock().unwrap() = 0.0;
        self.protective_plans.lock().unwrap().clear();
        self.latest_prices.lock().unwrap().clear();
    }

    pub fn on_tick(&self, tick: &MarketTick) {
        let symbol = &tick.instrument.symbol;
        let ltp = tick.ltp;

        // 1. Update latest prices cache
        {
            let mut prices = self.latest_prices.lock().unwrap();
            prices.insert(symbol.clone(), ltp);
        }

        // 2. Update existing position ltp and unrealized P&L
        {
            let mut positions = self.positions.lock().unwrap();
            if let Some(pos) = positions.get_mut(symbol) {
                pos.ltp = ltp;
                if pos.qty > 0 {
                    pos.unrealized_pnl = (ltp - pos.avg_price) * pos.qty as f64;
                } else if pos.qty < 0 {
                    pos.unrealized_pnl = (pos.avg_price - ltp) * pos.qty.abs() as f64;
                } else {
                    pos.unrealized_pnl = 0.0;
                }
            }
        }

        // 3. Process open orders
        let mut fills = Vec::new();
        {
            let mut orders = self.orders.lock().unwrap();
            for order in orders.iter_mut() {
                if order.intent.symbol != *symbol {
                    continue;
                }
                if order.state != OrderState::Open && order.state != OrderState::Placed {
                    continue;
                }

                let trigger = match order.intent.order_type {
                    OrderType::Market => true,
                    OrderType::Limit => {
                        let limit_price = order.intent.price.unwrap_or(0.0);
                        match order.intent.side {
                            OrderSide::Buy => ltp <= limit_price,
                            OrderSide::Sell => ltp >= limit_price,
                        }
                    }
                    OrderType::StopLoss | OrderType::StopLossMarket => {
                        let trigger_price = order.intent.trigger_price.unwrap_or(0.0);
                        match order.intent.side {
                            OrderSide::Buy => ltp >= trigger_price,
                            OrderSide::Sell => ltp <= trigger_price,
                        }
                    }
                };

                if trigger {
                    order.state = OrderState::Executed;
                    order.filled_qty = order.intent.quantity;
                    let fill_price = match order.intent.order_type {
                        OrderType::Limit => order.intent.price.unwrap_or(ltp),
                        OrderType::StopLoss | OrderType::StopLossMarket => {
                            order.intent.trigger_price.unwrap_or(ltp)
                        }
                        OrderType::Market => ltp,
                    };
                    order.avg_fill_price = fill_price;
                    fills.push((order.intent.side, order.intent.quantity, fill_price));
                }
            }
        }

        // 4. Apply fills to positions
        for (side, qty, price) in fills {
            self.apply_trade(symbol, side, qty, price);
        }

        // 5. Evaluate stop loss / target exits from protective plans
        let mut exit_intent = None;
        {
            let positions = self.positions.lock().unwrap();
            if let Some(pos) = positions.get(symbol) {
                if pos.qty != 0 {
                    let plans = self.protective_plans.lock().unwrap();
                    if let Some(plan) = plans.get(symbol) {
                        let hit_sl = if pos.qty > 0 {
                            ltp <= plan.stop_loss
                        } else {
                            ltp >= plan.stop_loss
                        };

                        let hit_tp = plan.target.map(|target| {
                            if pos.qty > 0 {
                                ltp >= target
                            } else {
                                ltp <= target
                            }
                        }).unwrap_or(false);

                        if hit_sl {
                            exit_intent = Some((
                                if pos.qty > 0 { OrderSide::Sell } else { OrderSide::Buy },
                                pos.qty.abs() as u32,
                                format!("SL trigger hit at {ltp} (Set: {})", plan.stop_loss),
                            ));
                        } else if hit_tp {
                            let tp_val = plan.target.unwrap_or(0.0);
                            exit_intent = Some((
                                if pos.qty > 0 { OrderSide::Sell } else { OrderSide::Buy },
                                pos.qty.abs() as u32,
                                format!("Target trigger hit at {ltp} (Set: {tp_val})"),
                            ));
                        }
                    }
                }
            }
        }

        if let Some((side, qty, reason)) = exit_intent {
            let exit_order = OrderIntent {
                strategy_id: "protective_exit".to_string(),
                symbol: symbol.clone(),
                exchange: "NSE_FO".to_string(),
                side,
                quantity: qty,
                order_type: OrderType::Market,
                product: crate::contracts::orders::ProductType::Intraday,
                mode: crate::contracts::orders::ExecutionMode::Paper,
                price: None,
                trigger_price: None,
                reason,
            };
            let _ = self.place_order(&exit_order, None);
        }
    }

    fn apply_trade(&self, symbol: &str, side: OrderSide, qty: u32, price: f64) {
        let mut positions = self.positions.lock().unwrap();
        let mut realized_pnl = self.realized_pnl.lock().unwrap();
        let pos = positions.entry(symbol.to_string()).or_insert_with(|| Position {
            symbol: symbol.to_string(),
            qty: 0,
            avg_price: 0.0,
            realized_pnl: 0.0,
            unrealized_pnl: 0.0,
            ltp: price,
        });

        pos.ltp = price;

        match side {
            OrderSide::Buy => {
                if pos.qty >= 0 {
                    let total_qty = pos.qty + qty as i32;
                    if total_qty > 0 {
                        pos.avg_price = ((pos.avg_price * pos.qty as f64) + (price * qty as f64)) / total_qty as f64;
                    }
                    pos.qty = total_qty;
                } else {
                    let closed_qty = qty.min(pos.qty.abs() as u32) as i32;
                    let pnl = (pos.avg_price - price) * closed_qty as f64;
                    pos.realized_pnl += pnl;
                    *realized_pnl += pnl;

                    let remaining_qty = qty as i32 - closed_qty;
                    if remaining_qty > 0 {
                        pos.qty = remaining_qty;
                        pos.avg_price = price;
                    } else {
                        pos.qty += qty as i32;
                        if pos.qty == 0 {
                            pos.avg_price = 0.0;
                        }
                    }
                }
            }
            OrderSide::Sell => {
                if pos.qty <= 0 {
                    let total_qty = pos.qty - qty as i32;
                    if total_qty.abs() > 0 {
                        pos.avg_price = ((pos.avg_price * pos.qty.abs() as f64) + (price * qty as f64)) / total_qty.abs() as f64;
                    }
                    pos.qty = total_qty;
                } else {
                    let closed_qty = qty.min(pos.qty as u32) as i32;
                    let pnl = (price - pos.avg_price) * closed_qty as f64;
                    pos.realized_pnl += pnl;
                    *realized_pnl += pnl;

                    let remaining_qty = qty as i32 - closed_qty;
                    if remaining_qty > 0 {
                        pos.qty = -remaining_qty;
                        pos.avg_price = price;
                    } else {
                        pos.qty -= qty as i32;
                        if pos.qty == 0 {
                            pos.avg_price = 0.0;
                        }
                    }
                }
            }
        }

        if pos.qty > 0 {
            pos.unrealized_pnl = (price - pos.avg_price) * pos.qty as f64;
        } else if pos.qty < 0 {
            pos.unrealized_pnl = (pos.avg_price - price) * pos.qty.abs() as f64;
        } else {
            pos.unrealized_pnl = 0.0;
        }
    }
}

impl BrokerAdapter for PaperBroker {
    fn place_order(
        &self,
        intent: &OrderIntent,
        protection: Option<&ProtectivePlan>,
    ) -> Result<ExecutionResult, ExecutionError> {
        let order_id = new_id("paper_order");
        let ts_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut order = Order {
            id: order_id.clone(),
            intent: intent.clone(),
            state: OrderState::Placed,
            filled_qty: 0,
            avg_fill_price: 0.0,
            ts_ms,
            fail_reason: None,
        };

        if intent.order_type == OrderType::Market {
            let execution_price = {
                let prices = self.latest_prices.lock().unwrap();
                prices.get(&intent.symbol).cloned().unwrap_or(intent.price.unwrap_or(100.0))
            };

            order.state = OrderState::Executed;
            order.filled_qty = intent.quantity;
            order.avg_fill_price = execution_price;

            self.apply_trade(&intent.symbol, intent.side, intent.quantity, execution_price);

            if let Some(plan) = protection {
                let mut plans = self.protective_plans.lock().unwrap();
                plans.insert(intent.symbol.clone(), plan.clone());
            }

            self.orders.lock().unwrap().push(order);

            return Ok(ExecutionResult {
                ok: true,
                mode: "paper".to_string(),
                order_id: Some(order_id),
                message: format!("Paper market order filled at {}", execution_price),
            });
        }

        order.state = OrderState::Open;
        if let Some(plan) = protection {
            let mut plans = self.protective_plans.lock().unwrap();
            plans.insert(intent.symbol.clone(), plan.clone());
        }

        self.orders.lock().unwrap().push(order);

        Ok(ExecutionResult {
            ok: true,
            mode: "paper".to_string(),
            order_id: Some(order_id),
            message: format!("Paper order placed: {:?}", intent.order_type),
        })
    }
}
