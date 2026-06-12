export type AiTabId = 'overview' | 'operations' | 'data' | 'warnings' | 'models' | 'roadmap';

export const aiTabs: Array<{ id: AiTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'operations', label: 'Live Ops' },
  { id: 'data', label: 'Data Health' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'models', label: 'Model Lab' },
  { id: 'roadmap', label: 'Next Work' },
];

export const aiStatusCards = [
  { label: 'Core Mode', value: 'Paper Shadow', tone: 'info', detail: 'AI can observe and paper execute only.' },
  { label: 'Risk Gate', value: 'Armed', tone: 'good', detail: 'Kill switch, spread guard, confidence guard active.' },
  { label: 'Live Trading', value: 'Locked', tone: 'warn', detail: 'Human approval required before any real order.' },
  { label: 'Last Decision', value: 'Avoid', tone: 'neutral', detail: 'No clean trend plus spread acceptable setup.' },
];

export const operationSteps = [
  { name: 'Market tick ingest', status: 'ready', detail: 'Rust MarketDataEngine accepts normalized live/replay ticks.' },
  { name: 'Snapshot + candle builder', status: 'ready', detail: 'Latest snapshot and rolling candles are generated in core.' },
  { name: 'Feature frame', status: 'ready', detail: 'Spread, candle return, range, option ATM context are calculated.' },
  { name: 'Model scoring', status: 'baseline', detail: 'BaselineRegimeModel can trade, hold, avoid, or mark trap.' },
  { name: 'Strategy plan', status: 'baseline', detail: 'ExpiryScalperStrategy creates CE/PE buy proposal with SL/target.' },
  { name: 'Risk governor', status: 'ready', detail: 'Blocks low confidence, trap regime, high spread, high trade risk.' },
  { name: 'Execution', status: 'guarded', detail: 'Paper broker ready; Kotak sidecar live bridge mapped but guarded.' },
  { name: 'Audit trail', status: 'ready', detail: 'Signals, risk decisions, execution results are recorded.' },
];

export const dataFeeds = [
  { feed: 'Broker ticks', source: 'Kotak feed handler', state: 'Partial', use: 'LTP, bid, ask, volume for live snapshots.' },
  { feed: 'Option chain', source: 'Sidecar chain endpoint', state: 'Needs upgrade', use: 'OI, IV, ATM strike, expiry context.' },
  { feed: 'Candles', source: 'Rust candle builder', state: 'Ready', use: 'Trend, range, volatility, replay alignment.' },
  { feed: 'Account state', source: 'Kotak sidecar', state: 'Available', use: 'Position limits, P&L, margin, active orders.' },
  { feed: 'Historical replay', source: 'Rust replay engine', state: 'Ready', use: 'Same engine for backtest and live simulation.' },
];

export const warnings = [
  { severity: 'High', title: 'Live auto mode is not enabled', detail: 'Correct. AI must prove itself in paper shadow first.' },
  { severity: 'High', title: 'Option chain data needs real IV/OI quality', detail: 'Expiry trading needs reliable OI, IV, spread, and ATM context.' },
  { severity: 'Medium', title: 'Baseline model is not alpha yet', detail: 'It is a safety/regime filter, not a profitable trained model.' },
  { severity: 'Medium', title: 'Execution state machine pending', detail: 'Partial fill, modify, cancel, retry, and reject handling must be hardened.' },
  { severity: 'Low', title: 'UI is monitor only', detail: 'Human screen should supervise, not calculate model decisions.' },
];

export const modelRows = [
  { model: 'BaselineRegimeModel', role: 'Regime and trap filter', state: 'Built', next: 'Feed real option context.' },
  { model: 'ExpiryScalperStrategy', role: 'Protected buy-side expiry plan', state: 'Built', next: 'Use live LTP for SL/target reference.' },
  { model: 'RiskGovernor', role: 'Final trade permission', state: 'Built', next: 'Add daily/session persisted limits.' },
  { model: 'KotakSidecarBroker', role: 'Live broker bridge', state: 'Built', next: 'Run only in supervised mode first.' },
];

export const roadmap = [
  { phase: '1', title: 'Connect feed handler to trading_core', detail: 'Convert real ticks into MarketTick and send into ShadowEngine.' },
  { phase: '2', title: 'Real option chain context', detail: 'Attach ATM strike, OI change, IV, expiry, spread and straddle price.' },
  { phase: '3', title: 'Execution state machine', detail: 'Track placed, open, modified, partial, rejected, exited orders.' },
  { phase: '4', title: 'Backtest and replay lab', detail: 'Replay historical ticks through same live engine, no separate toy simulator.' },
  { phase: '5', title: 'Supervised live mode', detail: 'AI proposes; human approves; risk governor can still block.' },
  { phase: '6', title: 'Guarded auto mode', detail: 'Only after paper metrics, audit replay, and risk limits pass.' },
];
