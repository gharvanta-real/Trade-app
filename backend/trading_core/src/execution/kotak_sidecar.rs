use serde::{Deserialize, Serialize};

use crate::contracts::orders::{OrderIntent, OrderSide, OrderType, ProductType, ProtectivePlan};

use super::broker::{BrokerAdapter, ExecutionError, ExecutionResult};

#[derive(Debug, Clone)]
pub struct KotakSidecarBroker {
    base_url: String,
    client: reqwest::blocking::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KotakOrderPayload {
    pub exchange_segment: String,
    pub product: String,
    pub price: f64,
    pub order_type: String,
    pub quantity: u32,
    pub validity: String,
    pub trading_symbol: String,
    pub transaction_type: String,
    pub trigger_price: f64,
    pub amo: String,
}

#[derive(Debug, Deserialize)]
struct KotakOrderResponse {
    ok: Option<bool>,
    order_id: Option<String>,
    detail: Option<String>,
}

impl KotakSidecarBroker {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            client: reqwest::blocking::Client::new(),
        }
    }

    pub fn payload_from_intent(intent: &OrderIntent) -> KotakOrderPayload {
        KotakOrderPayload {
            exchange_segment: normalize_exchange(&intent.exchange),
            product: map_product(intent.product).to_string(),
            price: match intent.order_type {
                OrderType::Market => 0.0,
                _ => intent.price.unwrap_or(0.0),
            },
            order_type: map_order_type(intent.order_type).to_string(),
            quantity: intent.quantity,
            validity: "DAY".to_string(),
            trading_symbol: intent.symbol.clone(),
            transaction_type: map_side(intent.side).to_string(),
            trigger_price: intent.trigger_price.unwrap_or(0.0),
            amo: "NO".to_string(),
        }
    }
}

impl BrokerAdapter for KotakSidecarBroker {
    fn place_order(&self, intent: &OrderIntent, _protection: Option<&ProtectivePlan>) -> Result<ExecutionResult, ExecutionError> {
        let payload = Self::payload_from_intent(intent);
        let url = format!("{}/api/kotak/order", self.base_url);
        let response = self
            .client
            .post(url)
            .json(&payload)
            .send()
            .map_err(|err| ExecutionError::BrokerRejected(err.to_string()))?;

        let status = response.status();
        let body = response
            .json::<KotakOrderResponse>()
            .map_err(|err| ExecutionError::BrokerRejected(err.to_string()))?;

        if !status.is_success() || body.ok != Some(true) {
            let detail = body
                .detail
                .unwrap_or_else(|| format!("sidecar returned HTTP {status}"));
            return Err(ExecutionError::BrokerRejected(detail));
        }

        let order_id = body
            .order_id
            .ok_or_else(|| ExecutionError::BrokerRejected("missing order_id".to_string()))?;

        Ok(ExecutionResult {
            ok: true,
            mode: "live_sidecar".to_string(),
            order_id: Some(order_id),
            message: "Kotak sidecar accepted order.".to_string(),
        })
    }
}

fn normalize_exchange(exchange: &str) -> String {
    match exchange.to_ascii_uppercase().as_str() {
        "NSE_FO" | "NFO" => "nse_fo".to_string(),
        "NSE_CM" | "NSE" => "nse_cm".to_string(),
        "BSE_CM" | "BSE" => "bse_cm".to_string(),
        "MCX_FO" | "MCX" => "mcx_fo".to_string(),
        other => other.to_ascii_lowercase(),
    }
}

fn map_order_type(order_type: OrderType) -> &'static str {
    match order_type {
        OrderType::Market => "MKT",
        OrderType::Limit => "L",
        OrderType::StopLoss => "SL",
        OrderType::StopLossMarket => "SL-M",
    }
}

fn map_product(product: ProductType) -> &'static str {
    match product {
        ProductType::Intraday => "MIS",
        ProductType::Overnight => "NRML",
        ProductType::Cnc => "CNC",
    }
}

fn map_side(side: OrderSide) -> &'static str {
    match side {
        OrderSide::Buy => "B",
        OrderSide::Sell => "S",
    }
}
