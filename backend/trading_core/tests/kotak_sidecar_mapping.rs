use trading_core::contracts::orders::{
    ExecutionMode, OrderIntent, OrderSide, OrderType, ProductType,
};
use trading_core::execution::kotak_sidecar::KotakSidecarBroker;

#[test]
fn maps_market_option_order_to_sidecar_payload() {
    let intent = OrderIntent {
        strategy_id: "expiry_scalper".to_string(),
        symbol: "NIFTY26JUN23000CE".to_string(),
        exchange: "NSE_FO".to_string(),
        side: OrderSide::Buy,
        quantity: 75,
        order_type: OrderType::Market,
        product: ProductType::Intraday,
        mode: ExecutionMode::AutoLive,
        price: Some(101.25),
        trigger_price: None,
        reason: "breakout confirmed".to_string(),
    };

    let payload = KotakSidecarBroker::payload_from_intent(&intent);

    assert_eq!(payload.exchange_segment, "nse_fo");
    assert_eq!(payload.product, "MIS");
    assert_eq!(payload.price, 0.0);
    assert_eq!(payload.order_type, "MKT");
    assert_eq!(payload.quantity, 75);
    assert_eq!(payload.trading_symbol, "NIFTY26JUN23000CE");
    assert_eq!(payload.transaction_type, "B");
    assert_eq!(payload.trigger_price, 0.0);
    assert_eq!(payload.amo, "NO");
}

#[test]
fn maps_limit_sell_order_to_sidecar_payload() {
    let intent = OrderIntent {
        strategy_id: "risk_exit".to_string(),
        symbol: "BANKNIFTY26JUN52000PE".to_string(),
        exchange: "NFO".to_string(),
        side: OrderSide::Sell,
        quantity: 30,
        order_type: OrderType::Limit,
        product: ProductType::Overnight,
        mode: ExecutionMode::SupervisedLive,
        price: Some(88.5),
        trigger_price: None,
        reason: "target exit".to_string(),
    };

    let payload = KotakSidecarBroker::payload_from_intent(&intent);

    assert_eq!(payload.exchange_segment, "nse_fo");
    assert_eq!(payload.product, "NRML");
    assert_eq!(payload.price, 88.5);
    assert_eq!(payload.order_type, "L");
    assert_eq!(payload.transaction_type, "S");
}
