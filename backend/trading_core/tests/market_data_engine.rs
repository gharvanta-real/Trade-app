use trading_core::contracts::market::{Instrument, InstrumentKind};
use trading_core::data::engine::MarketDataEngine;
use trading_core::data::replay::MarketReplay;
use trading_core::data::tick::MarketTick;

fn tick(symbol: &str, ltp: f64, volume: u64, ts_ms: u64) -> MarketTick {
    MarketTick {
        instrument: Instrument {
            symbol: symbol.to_string(),
            exchange: "NSE_FO".to_string(),
            kind: InstrumentKind::Option,
            token: Some("12345".to_string()),
            lot_size: 75,
        },
        ltp,
        bid: Some(ltp - 0.1),
        ask: Some(ltp + 0.1),
        volume: Some(volume),
        open_interest: Some(100_000),
        oi_change: None,
        implied_volatility: None,
        days_to_expiry: None,
        ts_ms,
    }
}

#[test]
fn ingests_ticks_updates_snapshot_and_active_candle() {
    let mut engine = MarketDataEngine::new(10, 1_000);

    engine.ingest_tick(tick("NIFTY26JUN23000CE", 100.0, 10, 100));
    engine.ingest_tick(tick("NIFTY26JUN23000CE", 102.0, 5, 800));

    let snapshot = engine.latest_snapshot("NIFTY26JUN23000CE").unwrap();
    assert_eq!(snapshot.ltp, 102.0);

    let candle = engine.active_candle("NIFTY26JUN23000CE").unwrap();
    assert_eq!(candle.open, 100.0);
    assert_eq!(candle.high, 102.0);
    assert_eq!(candle.low, 100.0);
    assert_eq!(candle.close, 102.0);
    assert_eq!(candle.volume, 15);
    assert_eq!(candle.tick_count, 2);
}

#[test]
fn closes_candle_when_bucket_changes() {
    let mut engine = MarketDataEngine::new(10, 1_000);

    assert!(engine
        .ingest_tick(tick("BANKNIFTY26JUN52000PE", 90.0, 2, 100))
        .closed_candle
        .is_none());
    let result = engine.ingest_tick(tick("BANKNIFTY26JUN52000PE", 95.0, 3, 1_100));

    let closed = result.closed_candle.unwrap();
    assert_eq!(closed.bucket_start_ms, 0);
    assert_eq!(closed.open, 90.0);
    assert_eq!(closed.close, 90.0);
    assert_eq!(engine.closed_candles().len(), 1);
    assert_eq!(
        engine.active_candle("BANKNIFTY26JUN52000PE").unwrap().open,
        95.0
    );
}

#[test]
fn tick_store_respects_capacity() {
    let mut engine = MarketDataEngine::new(2, 1_000);

    engine.ingest_tick(tick("NIFTY", 1.0, 1, 1));
    engine.ingest_tick(tick("NIFTY", 2.0, 1, 2));
    engine.ingest_tick(tick("NIFTY", 3.0, 1, 3));

    assert_eq!(engine.tick_count(), 2);
}

#[test]
fn replay_runs_ticks_through_same_engine() {
    let mut engine = MarketDataEngine::new(10, 1_000);
    let ticks = vec![
        tick("NIFTY26JUN23000CE", 100.0, 1, 0),
        tick("NIFTY26JUN23000CE", 101.0, 1, 500),
        tick("NIFTY26JUN23000CE", 103.0, 1, 1_000),
    ];

    let mut replay = MarketReplay::new(&mut engine);
    let results = replay.run(ticks);

    assert_eq!(results.len(), 3);
    assert!(results[2].closed_candle.is_some());
    assert_eq!(
        engine.latest_snapshot("NIFTY26JUN23000CE").unwrap().ltp,
        103.0
    );
}
