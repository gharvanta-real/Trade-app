# trading_core

Rust hot-path core for autonomous trading.

Rules:

- No UI state here.
- No Python in the live execution path.
- Models only emit scored signals.
- Strategies convert signals into trade proposals.
- Risk Governor is final authority before execution.
- Execution Router sends to paper, shadow, supervised live, or auto live.
- Audit Ledger records every decision.

First goal:

`MarketSnapshot -> ModelSignal -> TradeProposal -> RiskDecision -> ExecutionResult`

Market data backbone:

- `MarketTick` is the raw normalized live/replay input.
- `MarketDataEngine` maintains latest snapshots, bounded tick memory, and
  rolling candles.
- `MarketReplay` replays historical ticks through the same engine used live.
- Strategy/model code should consume snapshots/features from this layer, not UI
  state.

Feature/model layer:

- `FeatureEngine` turns snapshots, candles, and option context into a
  `FeatureFrame`.
- `BaselineRegimeModel` is the first non-dummy model. It can classify wide
  spread/trap, trend, range, and avoid far-OTM option entries.
- `ExpiryScalperStrategy` converts a trend trade signal into a protected option
  buy plan with stop, target, trail trigger, and max hold time.

Autonomous loop:

- `EngineMode` controls stopped, paper, shadow, supervised live, and auto live.
- `KillSwitch` blocks execution immediately while data ingestion continues.
- `ShadowEngine` wires ticks into `MarketDataEngine` and then into the
  supervisor pipeline.
- `PersistentAuditLedger` writes JSONL records so decisions can be replayed
  outside the process.

Broker path:

- `PaperBroker` is for paper/shadow execution.
- `KotakSidecarBroker` is the first live bridge. The decision/risk path stays in
  Rust, while the existing Python sidecar is used only as a Kotak SDK driver.
- A pure Rust broker adapter can replace the sidecar later without changing
  model, strategy, risk, or audit contracts.
