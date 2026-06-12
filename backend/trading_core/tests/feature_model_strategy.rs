use trading_core::contracts::market::{Instrument, InstrumentKind, MarketSnapshot};
use trading_core::contracts::signals::{Decision, Regime};
use trading_core::data::candle::Candle;
use trading_core::features::engine::FeatureEngine;
use trading_core::features::option_context::{OptionContext, OptionSide};
use trading_core::models::baseline_regime::BaselineRegimeModel;
use trading_core::runtime::strategy::Strategy;
use trading_core::strategies::expiry_scalper::ExpiryScalperStrategy;

fn snapshot(symbol: &str, ltp: f64, bid: f64, ask: f64) -> MarketSnapshot {
    MarketSnapshot {
        instrument: Instrument {
            symbol: symbol.to_string(),
            exchange: "NSE_FO".to_string(),
            kind: InstrumentKind::Option,
            token: Some("12345".to_string()),
            lot_size: 75,
        },
        ltp,
        bid: Some(bid),
        ask: Some(ask),
        volume: Some(1_000),
        open_interest: Some(100_000),
        oi_change: None,
        implied_volatility: None,
        days_to_expiry: None,
        ts_ms: 1,
    }
}

fn option_context(strike: f64, spot: f64) -> OptionContext {
    OptionContext {
        underlying_symbol: "NIFTY".to_string(),
        spot_ltp: spot,
        future_ltp: Some(spot + 5.0),
        strike,
        side: OptionSide::Call,
        days_to_expiry: 0.2,
        implied_volatility: Some(14.0),
        open_interest: Some(100_000),
        oi_change: Some(5_000),
        atm_straddle_price: Some(180.0),
    }
}

#[test]
fn feature_frame_extracts_spread_and_candle_stats() {
    let snap = snapshot("NIFTY26JUN23000CE", 100.0, 99.9, 100.1);
    let mut candle = Candle::new("NIFTY26JUN23000CE".to_string(), 0, 1_000, 100.0, 10);
    candle.update(101.0, 5);

    let frame = FeatureEngine::default().build(&snap, Some(&candle), None);

    assert!(frame.spread_pct.unwrap() < 0.3);
    assert_eq!(frame.candle_return_pct.unwrap(), 1.0);
    assert_eq!(frame.candle_volume, Some(15));
}

#[test]
fn baseline_model_trades_near_atm_trend() {
    let snap = snapshot("NIFTY26JUN23000CE", 100.0, 99.9, 100.1);
    let mut candle = Candle::new("NIFTY26JUN23000CE".to_string(), 0, 1_000, 100.0, 10);
    candle.update(100.2, 5);
    let model = BaselineRegimeModel::default();

    let signal =
        model.predict_with_context(&snap, Some(&candle), Some(option_context(23000.0, 23010.0)));

    assert_eq!(signal.decision, Decision::Trade);
    assert_eq!(signal.regime, Regime::Trend);
    assert!(signal.confidence >= 0.55);
}

#[test]
fn baseline_model_avoids_wide_spread() {
    let snap = snapshot("NIFTY26JUN23000CE", 100.0, 98.0, 102.0);
    let model = BaselineRegimeModel::default();

    let signal = model.predict_with_context(&snap, None, Some(option_context(23000.0, 23010.0)));

    assert_eq!(signal.decision, Decision::Avoid);
    assert_eq!(signal.regime, Regime::Trap);
}

#[test]
fn expiry_scalper_builds_protective_buy_plan_for_trade_signal() {
    let snap = snapshot("NIFTY26JUN23000CE", 100.0, 99.9, 100.1);
    let mut candle = Candle::new("NIFTY26JUN23000CE".to_string(), 0, 1_000, 100.0, 10);
    candle.update(100.2, 5);
    let signal = BaselineRegimeModel::default().predict_with_context(
        &snap,
        Some(&candle),
        Some(option_context(23000.0, 23010.0)),
    );

    let proposal = ExpiryScalperStrategy::paper(75)
        .build_proposal(&signal)
        .unwrap();

    assert_eq!(proposal.order.symbol, "NIFTY26JUN23000CE");
    assert_eq!(proposal.order.quantity, 75);
    assert!(proposal.protection.stop_loss < 100.0);
    assert!(proposal.protection.target.unwrap() > 100.0);
}
