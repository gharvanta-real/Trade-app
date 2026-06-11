import { createStore } from 'solid-js/store';

// 1. TYPES & INTERFACES

export interface MarketSymbol {
  name: string;
  price: number;
  change: number;
  pct: number;
  up: boolean;
  type?: string;
  volume?: string;
  signal?: string;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  oi?: string;
  token?: string;
  exchange?: string;
  lotSize?: number;
}

export interface OrderLog {
  title: string;
  desc: string;
  time: string;
  status: 'completed' | 'active' | 'failed' | string;
}

export interface Order {
  id: string;
  time: string;
  inst: string;
  type: 'Market' | 'Limit' | 'SL' | 'SL-M' | string;
  side: 'Buy' | 'Sell' | string;
  qty: number;
  price: number;
  trigger: number;
  status: 'open' | 'executed' | 'cancelled' | 'triggered' | 'rejected' | 'trigger_pending' | 'partially_filled' | 'submitting' | string;
  prod: 'MIS' | 'NRML' | 'CNC' | string;
  broker?: string;
  exchange?: string;
  orderId?: string;
  logs?: OrderLog[];
  failReason?: string;
}

export interface Position {
  inst: string;
  qty: number;
  avg: number;
  ltp: number;
  pnl: number;
  pct: number;
  prod: 'MIS' | 'NRML' | string;
  up: boolean;
  exchange?: string;
  token?: string;
}

export interface Holding {
  inst: string;
  qty: number;
  avg: number;
  ltp: number;
  invested: number;
  current: number;
  pnl: number;
  pct: number;
  up: boolean;
}

export interface Alert {
  id: string;
  inst: string;
  cond: 'Price Above' | 'Price Below' | string;
  val: number;
  status: 'active' | 'triggered' | 'paused' | 'expired';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  targetTab?: string;
  timestamp: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  refreshRate: number;
  timezone: string;
  confirmOrder: boolean;
  showSummary: boolean;
  autoSquareOff: boolean;
  chartType: 'candlestick' | 'line' | 'bar';
  showGrid: boolean;
  showVolume: boolean;
  notificationTimeout: number;
  soundAlerts: boolean;
}

export interface BacktestState {
  status: 'idle' | 'running' | 'done';
  progress: number;
  metrics: {
    winRate: number;
    profitFactor: number;
    drawdown: number;
    sharpe: number;
    trades: number;
  };
  curve: number[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isGreen?: boolean;
}

// Initial Indian market symbols
const initialSymbols: Record<string, MarketSymbol> = {
  'NIFTY 50':   { name: 'NIFTY 50',   price: 24198.85, change: 142.15,  pct: 0.59,  up: true,  type: 'Index',  volume: '--',    signal: 'Bullish',      open: 24060.00, high: 24230.00, low: 24010.00, prevClose: 24056.70, oi: '--',    token: '26000', exchange: 'NSE', lotSize: 50  },
  'BANKNIFTY':  { name: 'BANKNIFTY',  price: 52143.60, change: 343.85,  pct: 0.66,  up: true,  type: 'Index',  volume: '--',    signal: 'Bullish',      open: 51800.00, high: 52250.00, low: 51760.00, prevClose: 51799.75, oi: '--',    token: '26009', exchange: 'NSE', lotSize: 15  },
  'FINNIFTY':   { name: 'FINNIFTY',   price: 23812.10, change: 95.53,   pct: 0.40,  up: true,  type: 'Index',  volume: '--',    signal: 'Bullish',      open: 23720.00, high: 23860.00, low: 23700.00, prevClose: 23716.57, oi: '--',    token: '26037', exchange: 'NSE', lotSize: 40  },
  'RELIANCE':   { name: 'RELIANCE',   price: 2987.45,  change: 33.55,   pct: 1.14,  up: true,  type: 'Equity', volume: '1.23Cr', signal: 'Bullish',     open: 2953.90,  high: 3002.00, low: 2945.00,  prevClose: 2953.90,  oi: '--',    token: '2885',  exchange: 'NSE', lotSize: 1   },
  'HDFCBANK':   { name: 'HDFCBANK',   price: 1756.30,  change: 12.80,   pct: 0.73,  up: true,  type: 'Equity', volume: '85.12L', signal: 'Neutral',     open: 1743.50,  high: 1762.00, low: 1740.00,  prevClose: 1743.50,  oi: '--',    token: '1333',  exchange: 'NSE', lotSize: 1   },
  'TCS':        { name: 'TCS',        price: 4127.90,  change: 28.40,   pct: 0.69,  up: true,  type: 'Equity', volume: '31.22L', signal: 'Neutral',     open: 4099.50,  high: 4140.00, low: 4095.00,  prevClose: 4099.50,  oi: '--',    token: '11536', exchange: 'NSE', lotSize: 1   },
  'INFY':       { name: 'INFY',       price: 1621.35,  change: -8.60,   pct: -0.53, up: false, type: 'Equity', volume: '92.76L', signal: 'Weak Bearish', open: 1629.95, high: 1635.00, low: 1616.00,  prevClose: 1629.95,  oi: '--',    token: '1594',  exchange: 'NSE', lotSize: 1   },
  'ICICIBANK':  { name: 'ICICIBANK',  price: 1285.70,  change: 18.25,   pct: 1.44,  up: true,  type: 'Equity', volume: '2.14Cr', signal: 'Bullish',     open: 1267.45,  high: 1292.00, low: 1265.00,  prevClose: 1267.45,  oi: '--',    token: '4963',  exchange: 'NSE', lotSize: 1   },
  'KOTAKBANK':  { name: 'KOTAKBANK',  price: 2043.50,  change: -5.30,   pct: -0.26, up: false, type: 'Equity', volume: '45.87L', signal: 'Neutral',     open: 2048.80,  high: 2055.00, low: 2038.00,  prevClose: 2048.80,  oi: '--',    token: '1922',  exchange: 'NSE', lotSize: 1   },
  'SBIN':       { name: 'SBIN',       price: 836.45,   change: 9.35,    pct: 1.13,  up: true,  type: 'Equity', volume: '3.45Cr', signal: 'Bullish',     open: 827.10,   high: 840.00,  low: 825.00,   prevClose: 827.10,   oi: '--',    token: '3045',  exchange: 'NSE', lotSize: 1   },
};

const [store, setStore] = createStore({
  symbols: initialSymbols,
  watchlist: [
    'NIFTY 50', 'BANKNIFTY', 'FINNIFTY',
    'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'KOTAKBANK', 'SBIN'
  ],
  orders: [] as Order[],
  positions: [] as Position[],
  holdings: [] as Holding[],
  alerts: [] as Alert[],
  margins: { available: 0, used: 0 },
  brokerConnected: false,
  paperTradeMode: false,
  notifications: [] as Notification[],
  instrumentSearch: [] as any[],
  candleCache: {} as Record<string, Candle[]>,
  activeBacktest: {
    status: 'idle',
    progress: 0,
    metrics: { winRate: 0, profitFactor: 0, drawdown: 0, sharpe: 0, trades: 0 },
    curve: []
  } as BacktestState,
  settings: {
    theme: 'light',
    refreshRate: 2,
    timezone: 'kolkata',
    confirmOrder: true,
    showSummary: true,
    autoSquareOff: false,
    chartType: 'candlestick',
    showGrid: true,
    showVolume: true,
    notificationTimeout: 6,
    soundAlerts: true
  } as UserSettings
});

// 3. NAVIGATION REGISTRATION
let navigateTabCallback: ((tab: string) => void) | null = null;
export const registerTabNavigator = (callback: (tab: string) => void) => { navigateTabCallback = callback; };
export const navigateToTab = (tab: string) => { if (navigateTabCallback) navigateTabCallback(tab); };

// 4. SETTINGS
export const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
  setStore('settings', key, value);
};

// 5. PAPER TRADE TOGGLE
export const togglePaperTrade = () => {
  const next = !store.paperTradeMode;
  setStore('paperTradeMode', next);
  addNotification('Mode Changed', next ? 'ðŸ“ Paper Trading Mode ON â€” no real orders' : 'ðŸ”´ Live Trading Mode ON', next ? 'info' : 'warning');
};

// 6. NOTIFICATIONS
export const playNotificationSound = (type: Notification['type']) => {
  if (typeof window === 'undefined' || !store.settings.soundAlerts) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(587.33, now);
      gainNode.gain.setValueAtTime(0.06, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
    } else if (type === 'error') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(220.00, now);
      gainNode.gain.setValueAtTime(0.08, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    } else {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440.00, now);
      gainNode.gain.setValueAtTime(0.05, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
    }
  } catch { /* quiet */ }
};

export const addNotification = (title: string, message: string, type: Notification['type'] = 'info', targetTab?: string) => {
  const id = Math.random().toString(36).substring(2, 9);
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const newNotif: Notification = { id, title, message, type, targetTab, timestamp };
  setStore('notifications', (notifs) => [newNotif, ...notifs].slice(0, 50));
  playNotificationSound(type);
  const timeout = store.settings.notificationTimeout * 1000;
  if (timeout > 0) setTimeout(() => removeNotification(id), timeout);
};

export const removeNotification = (id: string) => {
  setStore('notifications', (notifs) => notifs.filter(n => n.id !== id));
};

// 7. SIDECAR URL
const SIDECAR = 'http://localhost:8001';
let brokerSyncInFlight = false;
let accountSyncInFlight = false;
let lastAccountSync = 0;
let lastStatusSync = 0;
const ACCOUNT_SYNC_INTERVAL_MS = 15000;
const STATUS_SYNC_INTERVAL_MS = 10000;
const MARKET_SYNC_INTERVAL_MS = 1000;

const refreshBrokerStatus = async (force = false) => {
  const now = Date.now();
  if (!force && store.brokerConnected && now - lastStatusSync < STATUS_SYNC_INTERVAL_MS) {
    return true;
  }

  const statusRes = await fetch(`${SIDECAR}/api/kotak/status`);
  lastStatusSync = now;
  if (!statusRes.ok) {
    setStore('brokerConnected', false);
    return false;
  }

  const session = await statusRes.json();
  const connected = session.status === 'CONNECTED';
  setStore('brokerConnected', connected);
  return connected;
};

const applyQuotePayload = (payload: Record<string, any>) => {
  Object.entries(payload).forEach(([sym, data]: [string, any]) => {
    const prev = store.symbols[sym];
    if (prev) {
      const ltp = data.ltp || prev.price;
      const change = data.change ?? (ltp - (data.close || prev.prevClose || ltp));
      const pct = data.change_pct ?? (prev.prevClose ? ((ltp - prev.prevClose) / prev.prevClose) * 100 : 0);
      setStore('symbols', sym, {
        price: ltp,
        change: Number(change.toFixed(2)),
        pct: Number(pct.toFixed(2)),
        up: change >= 0,
        open: data.open || prev.open,
        high: data.high || prev.high,
        low: data.low || prev.low,
        prevClose: data.close || prev.prevClose,
        volume: data.volume ? formatVolume(data.volume) : prev.volume,
      });
    }
  });
};

// 8. BROKER DATA SYNC
export const syncBrokerData = async (forceAccount = false) => {
  if (brokerSyncInFlight) return;
  brokerSyncInFlight = true;
  try {
    const connected = await refreshBrokerStatus(!store.brokerConnected);

    if (connected) {
      const nowForQuotes = Date.now();
      const feedIsFresh = nowForQuotes - lastFeedTick <= 3000;
      // ── When WebSocket feed is live, we NEVER hit REST for quotes. ────────────
      // Ticks arrive in <100ms from Kotak's own feed — REST would only add latency.
      // Fall back to REST only when the WS feed has been silent for >3 seconds.
      if (!feedIsFresh) {
        const quotesRes = await fetch(`${SIDECAR}/api/kotak/quotes?symbols=${encodeURIComponent(store.watchlist.join(','))}`);
        if (quotesRes.status === 401) {
          await refreshBrokerStatus(true);
          return;
        }
        if (quotesRes.ok) {
          applyQuotePayload(await quotesRes.json());
        }
      }

      const now = Date.now();
      if (accountSyncInFlight || (!forceAccount && now - lastAccountSync < ACCOUNT_SYNC_INTERVAL_MS)) return;
      accountSyncInFlight = true;
      lastAccountSync = now;
      try {
        const [marginsResult, positionsResult, holdingsResult, ordersResult] = await Promise.allSettled([
          fetch(`${SIDECAR}/api/kotak/margins`).then(r => r.ok ? r.json() : null),
          fetch(`${SIDECAR}/api/kotak/positions`).then(r => r.ok ? r.json() : null),
          fetch(`${SIDECAR}/api/kotak/holdings`).then(r => r.ok ? r.json() : null),
          fetch(`${SIDECAR}/api/kotak/orders`).then(r => r.ok ? r.json() : null),
        ]);

        if (marginsResult.status === 'fulfilled' && marginsResult.value) {
          const margins = marginsResult.value;
          setStore('margins', { available: margins.available, used: margins.used });
        }

      if (positionsResult.status === 'fulfilled' && Array.isArray(positionsResult.value)) {
        const mapped = positionsResult.value.map((p: any) => {
          const qty = Number(p.quantity || p.netQty || 0);
          const avg = Number(p.averageprice || p.buyAvgPrc || p.avgprc || 0);
          const ltp = Number(p.last_price || p.ltp || p.netUpldPrc || 0) || avg;
          const pnl = Number(p.unrealised_pnl || p.urmtom || p.pnl || 0);
          const inst = p.tradingsymbol || p.trdSym || 'UNKNOWN';
          const prod = (p.product || p.prd || 'MIS').toUpperCase();
          return {
            inst, qty, avg, ltp, pnl,
            pct: avg > 0 ? (pnl / (avg * Math.abs(qty || 1))) * 100 : 0,
            prod: prod === 'CNC' ? 'CNC' : prod === 'NRML' ? 'NRML' : 'MIS',
            up: pnl >= 0,
            exchange: p.exchange || p.exSeg || 'NSE',
          } as Position;
        });
        setStore('positions', mapped);
      }

      if (holdingsResult.status === 'fulfilled' && Array.isArray(holdingsResult.value)) {
        const mapped = holdingsResult.value.map((h: any) => {
          const qty = Number(h.quantity || h.qty || 0);
          const avg = Number(h.averageprice || h.buyAvgPrc || 0);
          const ltp = Number(h.last_price || h.ltp || 0) || avg;
          const current = qty * ltp;
          const invested = qty * avg;
          const pnl = current - invested;
          return {
            inst: h.tradingsymbol || h.trdSym || 'UNKNOWN',
            qty, avg, ltp, invested, current, pnl,
            pct: invested > 0 ? (pnl / invested) * 100 : 0,
            up: pnl >= 0,
          } as Holding;
        });
        setStore('holdings', mapped);
      }

      if (ordersResult.status === 'fulfilled' && Array.isArray(ordersResult.value)) {
        const mapped = ordersResult.value.map((o: any) => {
          const statusRaw = (o.status || o.ordSt || 'executed').toLowerCase();
          let status: Order['status'] = 'executed';
          if (statusRaw.includes('open') || statusRaw.includes('pending')) status = 'open';
          else if (statusRaw.includes('trigger')) status = 'trigger_pending';
          else if (statusRaw.includes('cancel') || statusRaw.includes('cncl')) status = 'cancelled';
          else if (statusRaw.includes('reject') || statusRaw.includes('fail')) status = 'rejected';
          else if (statusRaw.includes('partial')) status = 'partially_filled';

          const typeRaw = o.order_type || o.ordTyp || 'M';
          let type: Order['type'] = 'Market';
          if (typeRaw === 'L' || typeRaw === 'Limit') type = 'Limit';
          else if (typeRaw === 'SL') type = 'SL';
          else if (typeRaw === 'SL-M') type = 'SL-M';

          const sideRaw = o.transaction_type || o.trnsTp || 'B';
          const side: Order['side'] = (sideRaw === 'B' || sideRaw === 'Buy') ? 'Buy' : 'Sell';

          const srvOrder: Order = {
            id: o.nApplNo || o.order_id || o.ordNo || Math.random().toString(36).substring(2, 9),
            orderId: o.nApplNo || o.order_id || o.ordNo || '',
            time: o.ordTime || o.time || new Date().toLocaleTimeString('en-US', { hour12: false }),
            inst: o.trdSym || o.tradingsymbol || 'UNKNOWN',
            type, side,
            qty: Number(o.quantity || o.qty || o.ordQty || 0),
            price: Number(o.price || o.prc || 0),
            trigger: Number(o.trigger_price || o.trgPrc || 0),
            status,
            prod: (o.product || o.prd || 'MIS').toUpperCase() as Order['prod'],
            broker: 'KOTAK',
            exchange: o.exchange || o.exSeg || 'NSE',
          };

          const localMatch = store.orders.find(lo => lo.id === srvOrder.id || (lo.orderId && lo.orderId === srvOrder.orderId));
          if (localMatch && localMatch.logs) {
            srvOrder.logs = localMatch.logs;
            srvOrder.failReason = localMatch.failReason || srvOrder.failReason;
          }

          return srvOrder;
        });

        const currentOrders = store.orders;
        const localOrders = currentOrders.filter(o =>
          (o.id.startsWith('local_') || o.status === 'submitting') &&
          !mapped.some(srv => srv.id === o.id || (o.orderId && srv.orderId === o.orderId))
        );

        setStore('orders', [...localOrders, ...mapped]);
      }
      } finally {
        accountSyncInFlight = false;
      }
    } else {
      setStore('brokerConnected', false);
    }
  } catch (e) {
    console.error('syncBrokerData failed:', e);
  } finally {
    brokerSyncInFlight = false;
  }
};

function formatVolume(vol: number): string {
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return String(vol);
}

const extractBrokerOrderId = (value: any): string => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractBrokerOrderId(item);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';

  for (const key of ['order_id', 'orderId', 'nApplNo', 'ordNo', 'orderNo', 'nOrdNo', 'nestOrderNumber']) {
    const id = value[key];
    if (id !== undefined && id !== null && String(id).trim() && String(id) !== '0') return String(id);
  }

  for (const key of ['data', 'Data', 'result', 'Result', 'message', 'Message']) {
    const found = extractBrokerOrderId(value[key]);
    if (found) return found;
  }
  return '';
};

const extractBrokerError = (value: any): string => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractBrokerError(item);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';

  for (const key of ['detail', 'Error', 'error', 'Error Message', 'error_message', 'errMsg', 'emsg']) {
    const error = value[key];
    if (error !== undefined && error !== null && error !== false && String(error).trim()) return String(error);
  }

  for (const key of ['data', 'Data', 'result', 'Result', 'message', 'Message']) {
    const found = extractBrokerError(value[key]);
    if (found) return found;
  }
  return '';
};

// 9. FEED WEBSOCKET
let feedWs: WebSocket | null = null;
let lastFeedTick = 0;

export const initFeedWebSocket = () => {
  if (feedWs) return;
  feedWs = new WebSocket('ws://localhost:8001/api/kotak/ws');

  feedWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'feed_status') {
        if (msg.connected) setStore('brokerConnected', true);
        return;
      }
      if (msg.type === 'tick' && msg.data) {
        lastFeedTick = Date.now();
        msg.data.forEach((tick: any) => {
          const ltp = tick.ltp || tick.last_price || tick.lp || 0;
          const token = String(tick.token || tick.instrument_token || tick.tk || '');
          const sym = tick.symbol || Object.keys(store.symbols).find(k => store.symbols[k].token === token);
          if (sym) {
            const prev = store.symbols[sym];
            if (!prev) return;
            const change = ltp - (prev.prevClose || ltp);
            const pct = prev.prevClose ? (change / prev.prevClose) * 100 : 0;
            setStore('symbols', sym, {
              price: ltp,
              change: Number(change.toFixed(2)),
              pct: Number(pct.toFixed(2)),
              up: change >= 0,
            });
          }
        });
      }
    } catch { /* ignore */ }
  };

  feedWs.onerror = () => {};
  feedWs.onclose = () => {
    feedWs = null;
    setTimeout(initFeedWebSocket, 4000);
  };
};

// 10. INIT (called on app mount)
export const initMarketWebSocket = () => {
  syncBrokerData();
  setInterval(() => syncBrokerData(), MARKET_SYNC_INTERVAL_MS);
  initFeedWebSocket();

  // Local price simulation when broker not connected
  setInterval(() => {
    if (store.brokerConnected) return;
    Object.keys(initialSymbols).forEach(key => {
      const sym = store.symbols[key];
      if (!sym) return;
      const changePercent = (Math.random() - 0.49) * 0.0008;
      const oldPrice = sym.price;
      const newPrice = Number((oldPrice * (1 + changePercent)).toFixed(2));
      const diff = newPrice - (sym.prevClose || oldPrice);
      const pct = ((newPrice - (sym.prevClose || oldPrice)) / (sym.prevClose || oldPrice)) * 100;
      setStore('symbols', key, {
        price: newPrice,
        change: Number(diff.toFixed(2)),
        pct: Number(pct.toFixed(2)),
        up: diff >= 0,
      });
    });
  }, 1500);
};

// 11. REAL ORDER PLACEMENT
export const placeRealOrder = async (params: {
  inst: string;
  side: 'Buy' | 'Sell';
  type: 'Market' | 'Limit' | 'SL' | 'SL-M';
  qty: number;
  price: number;
  trigger?: number;
  prod: 'MIS' | 'NRML' | 'CNC';
  validity?: 'DAY' | 'IOC';
  amo?: boolean;
  exchange?: string;
}): Promise<{ success: boolean; message: string }> => {
  // Paper trade mode â€” use local store
  if (store.paperTradeMode) {
    const success = placeOrder({
      inst: params.inst,
      type: params.type,
      side: params.side,
      qty: params.qty,
      price: params.price,
      trigger: params.trigger || 0,
      prod: params.prod,
    });
    return { success: !!success, message: success ? 'Paper order placed' : 'Insufficient margin' };
  }

  const curTime = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const localId = 'local_' + Math.random().toString(36).substring(2, 9);
  const exchange = params.exchange || (params.inst.includes('NIFTY') || params.inst.includes('FIN') ? 'nse_fo' : 'nse_cm');
  const syntheticOptionSymbol = exchange === 'nse_fo' && /\b\d{1,2}\s+[A-Z]{3}\s+\d{4}\s+\d+\s+(CE|PE)$/i.test(params.inst);

  if (syntheticOptionSymbol) {
    const errorMsg = 'Option order blocked: this leg is generated for analysis only. Load a real Kotak F&O contract before placing live option orders.';
    addNotification('Real Contract Required', errorMsg, 'error', 'orders');
    return { success: false, message: errorMsg };
  }

  const newOrder: Order = {
    id: localId,
    orderId: '',
    time: curTime,
    inst: params.inst,
    type: params.type,
    side: params.side,
    qty: params.qty,
    price: params.price,
    trigger: params.trigger || 0,
    status: 'submitting',
    prod: params.prod,
    broker: 'KOTAK',
    exchange,
    logs: [
      { title: 'Order Initiated', desc: `Requesting ${params.side} ${params.qty} qty via Kotak Neo API`, time: curTime, status: 'completed' },
      { title: 'Submitting', desc: 'Connecting to Kotak order routing gateway...', time: curTime, status: 'active' }
    ]
  };

  // Pre-insert the order so it appears instantly in the order book!
  setStore('orders', (o) => [newOrder, ...o]);

  if (!store.brokerConnected) {
    const errorMsg = 'Please login to Kotak Neo first';
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setStore('orders', o => o.id === localId, {
      status: 'rejected',
      failReason: errorMsg,
      logs: [
        { title: 'Order Initiated', desc: `Requesting ${params.side} ${params.qty} qty via Kotak Neo API`, time: curTime, status: 'completed' },
        { title: 'Failed to Submit', desc: `Error: ${errorMsg}`, time: nowTime, status: 'failed' }
      ]
    });
    addNotification('Not Connected', errorMsg, 'error');
    return { success: false, message: errorMsg };
  }

  // Map to Kotak API format
  const orderTypeMap: Record<string, string> = { 'Market': 'M', 'Limit': 'L', 'SL': 'SL', 'SL-M': 'SL-M' };
  const txnTypeMap: Record<string, string> = { 'Buy': 'B', 'Sell': 'S' };

  try {
    const res = await fetch(`${SIDECAR}/api/kotak/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exchange_segment: exchange,
        product: params.prod,
        price: params.type === 'Market' ? 0 : params.price,
        order_type: orderTypeMap[params.type] || 'M',
        quantity: params.qty,
        validity: params.validity || 'DAY',
        trading_symbol: params.inst,
        transaction_type: txnTypeMap[params.side] || 'B',
        trigger_price: params.trigger || 0,
        amo: params.amo ? 'YES' : 'NO',
      }),
    });

    const data = await res.json().catch(() => ({}));
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour12: false });
    const realId = extractBrokerOrderId(data);

    if (!res.ok || !data.ok || !realId) {
      const errorMsg = extractBrokerError(data) || (!realId ? 'Kotak did not return a real order id' : 'Order placement failed');
      setStore('orders', o => o.id === localId, {
        status: 'rejected',
        failReason: errorMsg,
        logs: [
          { title: 'Order Initiated', desc: `Requesting ${params.side} ${params.qty} qty via Kotak Neo API`, time: curTime, status: 'completed' },
          { title: 'Order Rejected', desc: `Broker error: ${errorMsg}`, time: nowTime, status: 'failed' }
        ]
      });
      addNotification('Order Failed', errorMsg, 'error', 'orders');
      return { success: false, message: errorMsg };
    }

    setStore('orders', o => o.id === localId, {
      id: realId,
      orderId: realId,
      status: 'open',
      logs: [
        { title: 'Order Initiated', desc: `Requesting ${params.side} ${params.qty} qty via Kotak Neo API`, time: curTime, status: 'completed' },
        { title: 'Acknowledged by Broker', desc: `Kotak accepted order. ID: ${realId}`, time: nowTime, status: 'completed' },
        { title: 'Syncing Order Book', desc: 'Waiting for latest broker order status...', time: nowTime, status: 'active' }
      ]
    });

    addNotification('Order Accepted', `${params.side} ${params.qty} ${params.inst} @ ${params.type === 'Market' ? 'MKT' : 'Rs. ' + params.price}`, 'success', 'orders');
    setTimeout(() => syncBrokerData(true), 700);
    return { success: true, message: `Kotak accepted order ${realId}` };
  } catch (e: any) {
    const errorMsg = e.message || 'Network error';
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setStore('orders', o => o.id === localId, {
      status: 'rejected',
      failReason: errorMsg,
      logs: [
        { title: 'Order Initiated', desc: `Requesting ${params.side} ${params.qty} qty via Kotak Neo API`, time: curTime, status: 'completed' },
        { title: 'Network Error', desc: `Could not connect to sidecar server: ${errorMsg}`, time: nowTime, status: 'failed' }
      ]
    });
    addNotification('Order Error', errorMsg, 'error');
    return { success: false, message: errorMsg };
  }
};

// 12. REAL ORDER CANCEL
export const cancelRealOrder = async (orderId: string) => {
  if (store.paperTradeMode) { cancelOrder(orderId); return; }
  try {
    const res = await fetch(`${SIDECAR}/api/kotak/order/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      addNotification('Order Cancelled', `Order ${orderId} cancelled`, 'info', 'orders');
      setTimeout(() => syncBrokerData(true), 700);
    } else {
      const d = await res.json();
      addNotification('Cancel Failed', d.detail || 'Could not cancel order', 'error');
    }
  } catch (e: any) {
    addNotification('Cancel Error', e.message, 'error');
  }
};

// 13. REAL ORDER MODIFY
export const modifyRealOrder = async (params: {
  orderId: string;
  qty: number;
  price: number;
  trigger?: number;
  orderType: string;
  validity: string;
  tradingSymbol: string;
  exchangeSegment: string;
  product: string;
  transactionType: string;
}) => {
  try {
    const res = await fetch(`${SIDECAR}/api/kotak/order/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: params.orderId,
        quantity: params.qty,
        price: params.price,
        trigger_price: params.trigger || 0,
        order_type: params.orderType,
        validity: params.validity,
        trading_symbol: params.tradingSymbol,
        exchange_segment: params.exchangeSegment,
        product: params.product,
        transaction_type: params.transactionType,
      }),
    });
    if (res.ok) {
      addNotification('Order Modified', `Order updated successfully`, 'success', 'orders');
      setTimeout(() => syncBrokerData(true), 700);
    } else {
      const d = await res.json();
      addNotification('Modify Failed', d.detail || 'Could not modify', 'error');
    }
  } catch (e: any) {
    addNotification('Modify Error', e.message, 'error');
  }
};

// 14. SQUARE OFF (real or paper)
export const squareOffRealPosition = async (pos: Position) => {
  const side: 'Buy' | 'Sell' = pos.qty > 0 ? 'Sell' : 'Buy';
  const result = await placeRealOrder({
    inst: pos.inst,
    side,
    type: 'Market',
    qty: Math.abs(pos.qty),
    price: 0,
    prod: pos.prod as 'MIS' | 'NRML' | 'CNC',
    exchange: pos.exchange,
  });
  return result;
};

// 15. HISTORICAL CANDLES
export const fetchCandles = async (symbol: string, interval: string): Promise<Candle[]> => {
  const cacheKey = `${symbol}::${interval}`;
  const cached = store.candleCache[cacheKey];
  if (cached && cached.length > 0) return cached;

  try {
    const res = await fetch(`${SIDECAR}/api/kotak/historical?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
    if (res.ok) {
      const raw: any[] = await res.json();
      const candles: Candle[] = raw.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        isGreen: c.close >= c.open,
      }));
      if (candles.length > 0) {
        setStore('candleCache', cacheKey, candles);
        return candles;
      }
    }
  } catch (e) {
    console.error('fetchCandles error:', e);
  }
  return [];
};

// 16. INSTRUMENT SEARCH
export const searchInstruments = async (query: string): Promise<any[]> => {
  try {
    const res = await fetch(`${SIDECAR}/api/kotak/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const results = await res.json();
      setStore('instrumentSearch', results);
      return results;
    }
  } catch { /* ignore */ }
  return [];
};

// 17. LOCAL ORDER ACTIONS (paper trade / alert simulation)
export const placeOrder = (orderParams: Omit<Order, 'id' | 'time' | 'status'>) => {
  const id = 'local_' + Math.random().toString(36).substring(2, 9);
  const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
  
  const priceVal = orderParams.type === 'Market' ? (store.symbols[orderParams.inst]?.price || orderParams.price) : orderParams.price;
  const totalCost = orderParams.qty * priceVal;
  
  if (orderParams.side === 'Buy' && totalCost > store.margins.available && store.margins.available > 0) {
    const rejectedOrder: Order = {
      ...orderParams,
      id,
      time,
      status: 'rejected',
      failReason: 'Insufficient available margin',
      logs: [
        { title: 'Order Initiated', desc: `Requesting ${orderParams.side} ${orderParams.qty} qty (Paper)`, time, status: 'completed' },
        { title: 'Order Rejected', desc: `Error: Insufficient available margin (Required: â‚¹${totalCost.toFixed(2)}, Available: â‚¹${store.margins.available.toFixed(2)})`, time, status: 'failed' }
      ]
    };
    setStore('orders', (o) => [rejectedOrder, ...o]);
    addNotification('Order Rejected', 'Insufficient available margin.', 'error', 'orders');
    return false;
  }

  const newOrder: Order = {
    ...orderParams,
    id,
    time,
    status: orderParams.type === 'Market' ? 'executed' : 'open',
    logs: [
      { title: 'Order Placed', desc: `Paper order submitted at â‚¹${priceVal}`, time, status: 'completed' },
      { 
        title: orderParams.type === 'Market' ? 'Executed' : 'Open', 
        desc: orderParams.type === 'Market' ? 'Filled instantly at market price' : `Waiting to trigger at limit â‚¹${orderParams.price}`, 
        time, 
        status: 'completed' 
      }
    ]
  };

  setStore('orders', (o) => [newOrder, ...o]);
  if (newOrder.type === 'Market') {
    executeOrder(id, priceVal);
  } else {
    addNotification('Order Placed', `Placed ${newOrder.side} ${newOrder.type} for ${newOrder.qty} ${newOrder.inst}`, 'info', 'orders');
  }
  return true;
};

const executeOrder = (orderId: string, fillPrice: number) => {
  const orderIdx = store.orders.findIndex(o => o.id === orderId);
  if (orderIdx === -1) return;
  const order = store.orders[orderIdx];
  setStore('orders', (o) => o.id === orderId, { status: 'executed', price: fillPrice });
  const posIdx = store.positions.findIndex(p => p.inst === order.inst);
  const orderQtySigned = order.side === 'Buy' ? order.qty : -order.qty;
  if (posIdx === -1) {
    setStore('positions', (p) => [...p, { inst: order.inst, qty: orderQtySigned, avg: fillPrice, ltp: fillPrice, pnl: 0, pct: 0, prod: order.prod as any, up: true }]);
  } else {
    const currentPos = store.positions[posIdx];
    const newQty = currentPos.qty + orderQtySigned;
    if (newQty === 0) {
      setStore('positions', (p) => p.filter(pos => pos.inst !== order.inst));
    } else {
      let newAvg = currentPos.avg;
      if (Math.sign(currentPos.qty) === Math.sign(orderQtySigned)) {
        const totalCost = (currentPos.avg * Math.abs(currentPos.qty)) + (fillPrice * order.qty);
        newAvg = totalCost / Math.abs(newQty);
      }
      setStore('positions', (p) => p.inst === order.inst, { qty: newQty, avg: newAvg, ltp: fillPrice });
    }
  }
  addNotification('Order Executed âœ“', `Filled ${order.side} ${order.qty} ${order.inst} @ â‚¹${fillPrice.toLocaleString('en-IN')}`, 'success', 'positions');
};

export const cancelOrder = (orderId: string) => {
  const order = store.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'open') return;
  setStore('orders', (o) => o.id === orderId, 'status', 'cancelled');
  addNotification('Order Cancelled', `Cancelled ${order.side} ${order.qty} ${order.inst}`, 'info', 'orders');
};

export const cancelAllOrders = () => {
  let count = 0;
  store.orders.forEach(o => { if (o.status === 'open') { cancelOrder(o.id); count++; } });
  if (count > 0) addNotification('All Cancelled', `Cancelled ${count} open orders`, 'warning', 'orders');
};

export const closePosition = async (symbol: string) => {
  const pos = store.positions.find(p => p.inst === symbol);
  if (!pos) return;
  await squareOffRealPosition(pos);
};

// 18. ALERTS
export const createPriceAlert = (inst: string, cond: Alert['cond'], val: number) => {
  const id = Math.random().toString(36).substring(2, 9);
  setStore('alerts', (a) => [...a, { id, inst, cond, val, status: 'active' } as Alert]);
  addNotification('Alert Created', `Alert set for ${inst} when ${cond.toLowerCase()} â‚¹${val}`, 'success', 'alerts');
};

export const deletePriceAlert = (id: string) => {
  setStore('alerts', (a) => a.filter(al => al.id !== id));
};

export const toggleAlertStatus = (id: string) => {
  const alert = store.alerts.find(al => al.id === id);
  if (alert) {
    const newStatus = alert.status === 'active' ? 'paused' : 'active';
    setStore('alerts', (a) => a.id === id, 'status', newStatus);
  }
};

// 19. WATCHLIST
export const addWatchlistItem = (symbol: string) => {
  const clean = symbol.trim().toUpperCase();
  if (!clean || store.watchlist.includes(clean)) {
    addNotification('Duplicate', `${clean} already in watchlist`, 'warning');
    return;
  }
  if (!store.symbols[clean]) {
    setStore('symbols', clean, { name: clean, price: 0, change: 0, pct: 0, up: true, type: 'Equity' });
  }
  setStore('watchlist', (w) => [...w, clean]);
  addNotification('Added', `${clean} added to watchlist`, 'success', 'watchlist');
};

export const removeWatchlistItem = (symbol: string) => {
  setStore('watchlist', (w) => w.filter(item => item !== symbol));
};

// 20. BACKTEST
export const runStrategyBacktest = (name: string, _template: string) => {
  if (store.activeBacktest.status === 'running') return;
  setStore('activeBacktest', { status: 'running', progress: 0, metrics: { winRate: 0, profitFactor: 0, drawdown: 0, sharpe: 0, trades: 0 }, curve: [] });
  addNotification('Backtest Started', `Running "${name}"...`, 'info', 'strategy');
  navigateToTab('strategy');
  let prog = 0;
  const interval = setInterval(() => {
    prog += 10;
    setStore('activeBacktest', 'progress', prog);
    if (prog >= 100) {
      clearInterval(interval);
      const winRate = 58.4 + Math.random() * 8.5;
      const profitFactor = 1.85 + Math.random() * 0.45;
      const drawdown = 4.2 + Math.random() * 2.8;
      const sharpe = 2.1 + Math.random() * 0.8;
      const trades = 120 + Math.floor(Math.random() * 45);
      const curve: number[] = [];
      let balance = 100000;
      for (let i = 0; i < 50; i++) { balance += 1200 + (i * 45) + (Math.random() - 0.42) * 4000; curve.push(Math.round(balance)); }
      setStore('activeBacktest', { status: 'done', progress: 100, metrics: { winRate, profitFactor, drawdown, sharpe, trades }, curve });
      addNotification('Backtest Complete!', `"${name}" â€” Win Rate: ${winRate.toFixed(1)}%`, 'success', 'strategy');
    }
  }, 300);
};

export { store };
