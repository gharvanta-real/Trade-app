use trading_core::contracts::market::{Instrument, InstrumentKind};
use trading_core::data::tick::MarketTick;

use crate::parser::TickUpdate;

pub fn tick_to_core(tick: &TickUpdate, ts_ms: u64) -> MarketTick {
    let (symbol, exchange, kind, lot_size) = instrument_from_token(&tick.token);
    MarketTick {
        instrument: Instrument {
            symbol,
            exchange,
            kind,
            token: Some(tick.token.clone()),
            lot_size,
        },
        ltp: tick.ltp,
        bid: None,
        ask: None,
        volume: Some(tick.volume),
        open_interest: None,
        oi_change: None,
        implied_volatility: None,
        days_to_expiry: None,
        ts_ms,
    }
}

fn instrument_from_token(token: &str) -> (String, String, InstrumentKind, u32) {
    match token {
        "26000" => (
            "NIFTY 50".to_string(),
            "NSE".to_string(),
            InstrumentKind::Index,
            50,
        ),
        "26009" => (
            "BANKNIFTY".to_string(),
            "NSE".to_string(),
            InstrumentKind::Index,
            15,
        ),
        "26037" => (
            "FINNIFTY".to_string(),
            "NSE".to_string(),
            InstrumentKind::Index,
            40,
        ),
        "26074" => (
            "MIDCPNIFTY".to_string(),
            "NSE".to_string(),
            InstrumentKind::Index,
            75,
        ),
        other => (
            format!("TOKEN_{other}"),
            "NSE".to_string(),
            InstrumentKind::Equity,
            1,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_index_token() {
        let tick = TickUpdate {
            token: "26000".to_string(),
            ltp: 23_000.0,
            ltq: 1,
            change: 0.2,
            open: 22_900.0,
            high: 23_020.0,
            low: 22_880.0,
            close: 22_950.0,
            volume: 10,
        };

        let core = tick_to_core(&tick, 100);

        assert_eq!(core.instrument.symbol, "NIFTY 50");
        assert_eq!(core.instrument.kind, InstrumentKind::Index);
        assert_eq!(core.ltp, 23_000.0);
    }
}
