import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { HugeIcon } from '../../components/HugeIcon';
import { 
  Search01Icon, 
  Add01Icon, 
  Delete01Icon, 
  EyeIcon, 
  LockIcon, 
  Cursor01Icon, 
  PenToolIcon, 
  RulerIcon
} from '@hugeicons/core-free-icons';
import { store, placeOrder, closePosition, addWatchlistItem, addNotification, placeRealOrder } from '../../store/tradingStore';
import './workspace.css';

const SIDECAR = 'http://localhost:8001/api/kotak';

interface MiniChainRow { strike: number; call: { ltp: number; oi: number; iv: number }; put: { ltp: number; oi: number; iv: number }; isAtm: boolean; }

interface WorkspaceProps {
  theme: () => 'dark' | 'light';
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  isGreen: boolean;
}

export const Workspace: Component<WorkspaceProps> = (props) => {
  // 1. STATE MANAGEMENT
  const [activeWatchlistTab, setActiveWatchlistTab] = createSignal('Index');
  const [activeWlPanel, setActiveWlPanel] = createSignal<'WL1'|'WL2'>('WL1');
  const [wl2Items, setWl2Items] = createSignal<string[]>(['HDFCBANK', 'RELIANCE', 'INFY', 'TCS', 'AXISBANK']);
  const [wl2Search, setWl2Search] = createSignal('');
  const [activeOrderMode, setActiveOrderMode] = createSignal('Buy');
  const [orderType, setOrderType] = createSignal('Market');
  const [productType, setProductType] = createSignal('MIS');
  const [qty, setQty] = createSignal(0.1);
  const [priceInput, setPriceInput] = createSignal(68000.00);
  const [triggerPrice, setTriggerPrice] = createSignal(67800.00);
  const [activeSymbol, setActiveSymbol] = createSignal('BTCUSDT');
  const [activeChartTab, setActiveChartTab] = createSignal('Chart 1');
  const [searchQuery, setSearchQuery] = createSignal('');

  // ── Option Chain mini-panel state ──────────────────────────────────────
  const [showOcPanel, setShowOcPanel] = createSignal(false);
  const [ocSymbol, setOcSymbol] = createSignal('');
  const [ocExpiry, setOcExpiry] = createSignal('');
  const [ocExpiries, setOcExpiries] = createSignal<string[]>([]);
  const [ocRows, setOcRows] = createSignal<MiniChainRow[]>([]);
  const [ocSpot, setOcSpot] = createSignal(0);
  const [ocAtm, setOcAtm] = createSignal(0);
  const [ocLot, setOcLot] = createSignal(50);
  const [ocLoading, setOcLoading] = createSignal(false);

  async function openOcPanel(sym: string) {
    const cleanSym = sym.replace(/USDT$/, '').toUpperCase();
    setOcSymbol(cleanSym);
    setShowOcPanel(true);
    setOcLoading(true);
    setOcRows([]);
    try {
      // 1. Load expiries
      const exRes = await fetch(`${SIDECAR}/option-chain/expiries?underlying=${encodeURIComponent(cleanSym)}`);
      const exList: string[] = await exRes.json();
      setOcExpiries(exList);
      const exp = exList[0] || nearestThursday();
      setOcExpiry(exp);
      // 2. Load chain
      const spotVal = store.symbols[sym]?.price || 0;
      const cRes = await fetch(`${SIDECAR}/option-chain/chain?underlying=${encodeURIComponent(cleanSym)}&expiry=${encodeURIComponent(exp)}&spot=${spotVal}`);
      const cData = await cRes.json();
      setOcRows(cData.rows || []);
      setOcSpot(cData.spot || 0);
      setOcAtm(cData.atm || 0);
      setOcLot(cData.lotSize || 50);
    } catch { /* offline — show empty state */ }
    finally { setOcLoading(false); }
  }

  async function switchOcExpiry(exp: string) {
    setOcExpiry(exp);
    setOcLoading(true);
    try {
      const cRes = await fetch(`${SIDECAR}/option-chain/chain?underlying=${encodeURIComponent(ocSymbol())}&expiry=${encodeURIComponent(exp)}&spot=${ocSpot()}`);
      const cData = await cRes.json();
      setOcRows(cData.rows || []);
      setOcAtm(cData.atm || 0);
    } catch { }
    finally { setOcLoading(false); }
  }

  function nearestThursday(): string {
    const d = new Date();
    const days = (4 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }
  
  // Auto-adjust parameters when selected active symbol changes
  createEffect(() => {
    const sym = activeSymbol();
    const currentPrice = store.symbols[sym]?.price || 100;
    setPriceInput(currentPrice);
    setTriggerPrice(currentPrice - (sym === 'BTCUSDT' ? 100 : sym === 'ETHUSDT' ? 10 : 1));
    if (sym === 'BTCUSDT') {
      setQty(0.05);
    } else if (sym === 'ETHUSDT') {
      setQty(0.5);
    } else if (sym === 'SOLUSDT') {
      setQty(5);
    } else {
      setQty(10);
    }
  });

  // Watchlist Items
  const watchlistItems = () => {
    return store.watchlist
      .map(key => ({ key, ...store.symbols[key] }))
      .filter(item => {
        const q = searchQuery().toLowerCase();
        const matchSearch = item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q);
        if (!matchSearch) return false;
        
        if (activeWatchlistTab() === 'Index') {
          return item.key === 'BTCUSDT' || item.key === 'ETHUSDT';
        } else if (activeWatchlistTab() === 'Stocks') {
          return item.key === 'SOLUSDT' || item.key === 'BNBUSDT';
        } else {
          return item.key !== 'BTCUSDT' && item.key !== 'ETHUSDT' && item.key !== 'SOLUSDT' && item.key !== 'BNBUSDT';
        }
      });
  };

  // Positions Items
  const activePositions = () => store.positions;

  // Market Depth Items (Ticking dynamically around current symbol price)
  const bids = () => {
    const p = store.symbols[activeSymbol()]?.price || 100;
    const tick = p * 0.0002; // 0.02% increments
    return [
      { price: p - tick * 1, qty: Math.round(50 + Math.random() * 400), orders: Math.floor(1 + Math.random() * 4) },
      { price: p - tick * 2, qty: Math.round(80 + Math.random() * 500), orders: Math.floor(1 + Math.random() * 5) },
      { price: p - tick * 3, qty: Math.round(120 + Math.random() * 600), orders: Math.floor(1 + Math.random() * 6) },
      { price: p - tick * 4, qty: Math.round(90 + Math.random() * 450), orders: Math.floor(1 + Math.random() * 4) },
      { price: p - tick * 5, qty: Math.round(40 + Math.random() * 300), orders: Math.floor(1 + Math.random() * 3) },
    ];
  };

  const asks = () => {
    const p = store.symbols[activeSymbol()]?.price || 100;
    const tick = p * 0.0002;
    return [
      { price: p + tick * 1, qty: Math.round(45 + Math.random() * 410), orders: Math.floor(1 + Math.random() * 4) },
      { price: p + tick * 2, qty: Math.round(90 + Math.random() * 510), orders: Math.floor(1 + Math.random() * 5) },
      { price: p + tick * 3, qty: Math.round(110 + Math.random() * 620), orders: Math.floor(1 + Math.random() * 6) },
      { price: p + tick * 4, qty: Math.round(85 + Math.random() * 440), orders: Math.floor(1 + Math.random() * 4) },
      { price: p + tick * 5, qty: Math.round(55 + Math.random() * 290), orders: Math.floor(1 + Math.random() * 3) },
    ];
  };

  const totalBidsQty = () => bids().reduce((acc, b) => acc + b.qty, 0);
  const totalAsksQty = () => asks().reduce((acc, a) => acc + a.qty, 0);

  // Generate deterministic mock historical candles with the last one tied to the store price
  const generateCandles = (count: number): Candle[] => {
    const sym = activeSymbol();
    const currentPrice = store.symbols[sym]?.price || 100;
    const candles: Candle[] = [];
    
    let seed = 0;
    for (let i = 0; i < sym.length; i++) {
      seed = sym.charCodeAt(i) + ((seed << 5) - seed);
    }

    const pseudoRandom = (offset: number) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    let lastClose = currentPrice;
    const volatility = currentPrice * 0.0035;

    for (let i = count - 1; i >= 0; i--) {
      const rand1 = pseudoRandom(i * 3);
      const rand2 = pseudoRandom(i * 3 + 1);
      const rand3 = pseudoRandom(i * 3 + 2);

      const change = (rand1 - 0.48) * volatility;
      const open = lastClose - change;
      const close = lastClose;
      const high = Math.max(open, close) + rand2 * (volatility * 0.3);
      const low = Math.min(open, close) - rand3 * (volatility * 0.3);

      candles.unshift({
        open,
        high,
        low,
        close,
        isGreen: close >= open
      });
      lastClose = open;
    }

    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = currentPrice;
      last.high = Math.max(last.open, currentPrice, last.high);
      last.low = Math.min(last.open, currentPrice, last.low);
      last.isGreen = last.close >= last.open;
    }

    return candles;
  };

  // 2. CANVAS CHART GENERATOR
  const [candles, setCandles] = createSignal<Candle[]>([]);
  let canvasRef!: HTMLCanvasElement;
  let canvasContainerRef!: HTMLDivElement;
  let animationFrameId: number;

  const drawChart = () => {
    if (!canvasRef || !canvasContainerRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const width = canvasContainerRef.clientWidth;
    const height = canvasContainerRef.clientHeight;
    
    const dpi = window.devicePixelRatio || 1;
    canvasRef.width = width * dpi;
    canvasRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = props.theme() === 'dark';
    const colorBg = isDark ? '#161618' : '#ffffff';
    const colorGrid = isDark ? '#1e1e21' : '#f3f4f6';
    const colorText = isDark ? '#71717a' : '#9ca3af';
    const colorBorder = isDark ? '#27272a' : '#e4e4e7';
    
    const colorGreen = '#10b981';
    const colorRed = '#f43f5e';
    const colorVwap = '#f59e0b';
    const colorSuperTrend = '#3b82f6';

    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, width, height);

    const paddingRight = 60;
    const paddingBottom = 24;
    const plotWidth = width - paddingRight;
    const plotHeight = height - paddingBottom;

    const candlesList = candles();
    if (candlesList.length === 0) return;

    const prices = candlesList.flatMap(c => [c.low, c.high]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Draw Gridlines
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    
    const yGridCount = 5;
    for (let i = 0; i <= yGridCount; i++) {
      const y = (plotHeight / yGridCount) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = colorText;
      ctx.font = '9px JetBrains Mono';
      const priceVal = maxPrice - (priceRange / yGridCount) * i;
      ctx.fillText(priceVal.toLocaleString('en-US', { minimumFractionDigits: 2 }), plotWidth + 6, y + 3);
    }

    const xGridCount = 7;
    const candleSpacing = plotWidth / candlesList.length;
    for (let i = 0; i < xGridCount; i++) {
      const idx = Math.floor((candlesList.length / xGridCount) * i);
      const x = candleSpacing * idx + candleSpacing / 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotHeight);
      ctx.stroke();

      ctx.fillStyle = colorText;
      ctx.font = '9px Inter';
      ctx.textAlign = 'center';
      const timeVal = `22:${30 + i * 2}`;
      ctx.fillText(timeVal, x, plotHeight + 14);
    }

    ctx.strokeStyle = colorBorder;
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, plotHeight);
    ctx.lineTo(0, plotHeight);
    ctx.stroke();

    const valToY = (val: number) => {
      return plotHeight - ((val - minPrice) / priceRange) * (plotHeight - 30) - 15;
    };

    // Draw Candles
    const candleWidth = candleSpacing * 0.7;
    candlesList.forEach((c, i) => {
      const x = candleSpacing * i + (candleSpacing - candleWidth) / 2;
      const yOpen = valToY(c.open);
      const yClose = valToY(c.close);
      const yHigh = valToY(c.high);
      const yLow = valToY(c.low);

      ctx.strokeStyle = c.isGreen ? colorGreen : colorRed;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, yHigh);
      ctx.lineTo(x + candleWidth / 2, yLow);
      ctx.stroke();

      ctx.fillStyle = c.isGreen ? colorGreen : colorRed;
      ctx.fillRect(x, Math.min(yOpen, yClose), candleWidth, Math.max(Math.abs(yClose - yOpen), 1.5));
    });

    // VWAP Line (procedural overlay)
    ctx.strokeStyle = colorVwap;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    candlesList.forEach((c, i) => {
      const x = candleSpacing * i + candleSpacing / 2;
      const vwapVal = (c.open + c.close + c.high + c.low) / 4;
      const y = valToY(vwapVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // AI SuperTrend
    ctx.strokeStyle = colorSuperTrend;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    candlesList.forEach((c, i) => {
      const x = candleSpacing * i + candleSpacing / 2;
      const supertrendVal = c.low - (maxPrice - minPrice) * 0.15;
      const y = valToY(supertrendVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const handleResize = () => {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(drawChart);
  };

  onMount(() => {
    drawChart();
    window.addEventListener('resize', handleResize);
    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    });
  });

  // Reset base candles when activeSymbol changes
  createEffect(() => {
    activeSymbol();
    setCandles(generateCandles(45));
  });

  // Update last candle in real-time on live price ticks
  createEffect(() => {
    const sym = activeSymbol();
    const livePrice = store.symbols[sym]?.price;
    if (!livePrice || livePrice === 0) return;

    const list = candles();
    if (list.length === 0) return;

    const last = list[list.length - 1];
    if (last.close !== livePrice || livePrice > last.high || livePrice < last.low) {
      const updated = [...list];
      const newLast = { ...last };
      newLast.close = livePrice;
      newLast.high = Math.max(newLast.high, livePrice);
      newLast.low = Math.min(newLast.low, livePrice);
      newLast.isGreen = newLast.close >= newLast.open;
      updated[updated.length - 1] = newLast;
      setCandles(updated);
    }
  });

  // Redraw when theme, symbol, or candle list changes
  createEffect(() => {
    props.theme();
    activeSymbol();
    candles();
    handleResize();
  });

  const handlePlaceOrder = (mode?: string) => {
    const sym = activeSymbol();
    const currentPrice = store.symbols[sym]?.price || 100;
    const finalMode = mode || activeOrderMode();
    const finalPrice = orderType() === 'Market' ? currentPrice : priceInput();

    placeOrder({
      inst: sym,
      type: orderType() as any,
      side: finalMode as any,
      qty: qty(),
      price: finalPrice,
      trigger: orderType() === 'SL' || orderType() === 'SL-M' ? triggerPrice() : 0,
      prod: productType() as any
    });
  };

  const handleAddWatchlist = () => {
    const query = prompt('Enter cryptocurrency symbol (e.g., BNBUSDT):');
    if (query) {
      addWatchlistItem(query);
    }
  };

  return (
    <div class="workspace-grid" style={{ height: "100%", overflow: "hidden", position: "relative" }}>
      {/* ── Option Chain Mini-Panel (slide-in from right) ────────────────── */}
      <Show when={showOcPanel()}>
        <div class="oc-mini-overlay" onClick={() => setShowOcPanel(false)} />
        <div class="oc-mini-panel">
          {/* Header */}
          <div class="oc-mini-header">
            <div>
              <span class="oc-mini-title">{ocSymbol()} Option Chain</span>
              <span class="oc-mini-spot">Spot ₹{ocSpot().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <Show when={ocAtm() > 0}>
                <span class="oc-mini-spot">ATM {ocAtm().toLocaleString('en-IN')}</span>
              </Show>
            </div>
            <button class="oc-mini-close" onClick={() => setShowOcPanel(false)}>✕</button>
          </div>

          {/* Expiry selector */}
          <div class="oc-mini-toolbar">
            <span class="oc-mini-label">Expiry</span>
            <select class="oc-mini-select" value={ocExpiry()} onChange={e => switchOcExpiry(e.currentTarget.value)}>
              <For each={ocExpiries()}>{ex => <option value={ex}>{ex}</option>}</For>
            </select>
            <span class="oc-mini-lot">Lot: {ocLot()}</span>
            <a href="#/optionchain" class="oc-mini-fulllink" onClick={() => setShowOcPanel(false)}>Full OC →</a>
          </div>

          {/* Chain table */}
          <div class="oc-mini-body">
            <Show when={ocLoading()}>
              <div class="oc-mini-loading"><div class="oc-mini-spinner" />Loading…</div>
            </Show>
            <Show when={!ocLoading() && ocRows().length > 0}>
              <table class="oc-mini-table">
                <thead>
                  <tr>
                    <th>CE LTP</th><th>CE OI</th>
                    <th class="oc-mini-strike-col">Strike</th>
                    <th>PE OI</th><th>PE LTP</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={ocRows().slice(5, 16)}>
                    {row => (
                      <tr class={row.isAtm ? 'oc-mini-atm' : ''}>
                        <td class="up">{row.call.ltp.toFixed(1)}</td>
                        <td class="muted">{(row.call.oi/1000).toFixed(0)}K</td>
                        <td class="oc-mini-strike-col">
                          {row.strike.toLocaleString('en-IN')}
                          <Show when={row.isAtm}><span class="oc-mini-atm-tag">ATM</span></Show>
                        </td>
                        <td class="muted">{(row.put.oi/1000).toFixed(0)}K</td>
                        <td class="down">{row.put.ltp.toFixed(1)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
            <Show when={!ocLoading() && ocRows().length === 0}>
              <p class="oc-mini-empty">No data. Ensure backend is connected.</p>
            </Show>
          </div>

          {/* Quick actions */}
          <div class="oc-mini-actions">
            <Show when={ocRows().find(r => r.isAtm)}>
              <button class="oc-mini-action-btn buy" onClick={async () => {
                const atmRow = ocRows().find(r => r.isAtm);
                if (!atmRow) return;
                const r = await placeRealOrder({ inst: `${ocSymbol()} ${ocExpiry()} ${atmRow.strike} CE`, side: 'Buy', type: 'Market', qty: ocLot(), price: atmRow.call.ltp, prod: 'NRML', exchange: 'nse_fo' });
                addNotification(r.success ? 'Bought ATM CE' : 'Order Failed', r.message, r.success ? 'success' : 'error', 'orders');
              }}>Buy ATM CE</button>
              <button class="oc-mini-action-btn sell" onClick={async () => {
                const atmRow = ocRows().find(r => r.isAtm);
                if (!atmRow) return;
                const r = await placeRealOrder({ inst: `${ocSymbol()} ${ocExpiry()} ${atmRow.strike} PE`, side: 'Sell', type: 'Market', qty: ocLot(), price: atmRow.put.ltp, prod: 'NRML', exchange: 'nse_fo' });
                addNotification(r.success ? 'Sold ATM PE' : 'Order Failed', r.message, r.success ? 'success' : 'error', 'orders');
              }}>Sell ATM PE</button>
            </Show>
          </div>
        </div>
      </Show>

      {/* 1. LEFT COLUMN: WATCHLIST */}
      <div class="panel watchlist-panel" style={{ display: "flex", "flex-direction": "column" }}>
        {/* WL1 / WL2 switcher */}
        <div class="wl-panel-switcher">
          <button class={`wl-panel-tab ${activeWlPanel() === 'WL1' ? 'active' : ''}`} onClick={() => setActiveWlPanel('WL1')}>Watchlist 1</button>
          <button class={`wl-panel-tab ${activeWlPanel() === 'WL2' ? 'active' : ''}`} onClick={() => setActiveWlPanel('WL2')}>Watchlist 2</button>
        </div>

        {/* ── WATCHLIST 1 ── */}
        <Show when={activeWlPanel() === 'WL1'}>
          <div class="search-container">
            <div class="search-input-wrapper">
              <HugeIcon icon={Search01Icon} size={12} class="search-icon" />
              <input type="text" placeholder="Search Watchlist..." value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)} />
            </div>
          </div>
          <div class="watchlist-tabs">
            <For each={['Index', 'Stocks', 'Options']}>
              {(tab) => (
                <button class={`wl-tab ${activeWatchlistTab() === tab ? 'active' : ''}`} onClick={() => setActiveWatchlistTab(tab)}>
                  {tab === 'Index' ? 'Crypto' : tab === 'Stocks' ? 'DeFi' : 'Altcoins'}
                </button>
              )}
            </For>
          </div>
          <div class="watchlist-items" style={{ flex: 1, overflow: "auto" }}>
            <For each={watchlistItems()}>
              {(item) => (
                <div class={`wl-item ${activeSymbol() === item.key ? 'active' : ''}`} onClick={() => setActiveSymbol(item.key)}>
                  <div class="wl-item-left">
                    <span class="wl-item-name">{item.name}</span>
                    <span class="wl-item-desc">BINANCE LIVE</span>
                  </div>
                  <div class="wl-item-right" style={{ "text-align": "right" }}>
                    <span class="wl-item-price" style={{ "font-family": "var(--sys-font-mono)" }}>${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span class={`wl-item-change ${item.up ? 'up' : 'down'}`} style={{ "font-family": "var(--sys-font-mono)" }}>{item.up ? '+' : ''}{item.pct.toFixed(2)}%</span>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="wl-page-action-bar" style={{ padding: "var(--sys-space-2) var(--sys-space-3)" }}>
            <button class="wl-add-btn" onClick={handleAddWatchlist} style={{ width: "100%", "justify-content": "center" }}>
              <HugeIcon icon={Add01Icon} size={12} /><span>Add Symbol</span>
            </button>
          </div>
        </Show>

        {/* ── WATCHLIST 2 ── */}
        <Show when={activeWlPanel() === 'WL2'}>
          <div class="search-container">
            <div class="search-input-wrapper">
              <HugeIcon icon={Search01Icon} size={12} class="search-icon" />
              <input type="text" placeholder="Search WL2..." value={wl2Search()} onInput={e => setWl2Search(e.currentTarget.value)} />
            </div>
          </div>
          <div class="watchlist-items" style={{ flex: 1, overflow: "auto" }}>
            <For each={wl2Items().filter(k => k.toLowerCase().includes(wl2Search().toLowerCase()))}>
              {(key) => {
                const sym = store.symbols[key];
                return (
                  <div class={`wl-item ${activeSymbol() === key ? 'active' : ''}`} onClick={() => setActiveSymbol(key)}>
                    <div class="wl-item-left">
                      <span class="wl-item-name">{sym?.name || key}</span>
                      <span class="wl-item-desc wl2-badge">WL2 • NSE</span>
                    </div>
                    <div class="wl-item-right" style={{ "text-align": "right" }}>
                      <Show when={sym}>
                        <span class="wl-item-price" style={{ "font-family": "var(--sys-font-mono)" }}>₹{(sym?.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span class={`wl-item-change ${sym?.up ? 'up' : 'down'}`} style={{ "font-family": "var(--sys-font-mono)" }}>{sym?.up ? '+' : ''}{(sym?.pct || 0).toFixed(2)}%</span>
                      </Show>
                      <Show when={!sym}><span class="wl-item-change">—</span></Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="wl-page-action-bar" style={{ padding: "var(--sys-space-2) var(--sys-space-3)" }}>
            <button class="wl-add-btn" onClick={() => {
              const q = prompt('Add symbol to Watchlist 2 (e.g. SBIN):');
              if (q) setWl2Items(w => [...w, q.toUpperCase()]);
            }} style={{ width: "100%", "justify-content": "center" }}>
              <HugeIcon icon={Add01Icon} size={12} /><span>Add to WL2</span>
            </button>
          </div>
        </Show>
      </div>

      {/* 2. CENTER COLUMN: CHART & POSITIONS */}
      <div class="center-workspace" style={{ display: "flex", "flex-direction": "column", "min-width": "0" }}>
        {/* Top Chart Section */}
        <div class="panel chart-panel" style={{ flex: 1.3, display: "flex", "flex-direction": "column", "min-height": "0" }}>
          <div class="chart-tabs-bar">
            <For each={['Chart 1', 'Chart 2', 'Chart 3']}>
              {(tab) => (
                <div 
                  class={`chart-tab ${activeChartTab() === tab ? 'active' : ''}`}
                  onClick={() => setActiveChartTab(tab)}
                >
                  {tab} ({activeSymbol()})
                </div>
              )}
            </For>
          </div>

          <div class="chart-work-area" style={{ flex: 1, display: "flex", position: "relative" }}>
            {/* Drawing Tools Toolbar */}
            <div class="chart-draw-toolbar">
              <button class="draw-tool-btn active" title="Crosshair"><HugeIcon icon={Cursor01Icon} size={14} /></button>
              <button class="draw-tool-btn" title="Trendline"><HugeIcon icon={PenToolIcon} size={14} /></button>
              <button class="draw-tool-btn" title="Ruler"><HugeIcon icon={RulerIcon} size={14} /></button>
              <button class="draw-tool-btn" title="Show/Hide"><HugeIcon icon={EyeIcon} size={14} /></button>
              <button class="draw-tool-btn" title="Lock drawings"><HugeIcon icon={LockIcon} size={14} /></button>
              <button class="draw-tool-btn" title="Delete drawing"><HugeIcon icon={Delete01Icon} size={14} /></button>
            </div>

            {/* Main Canvas Viewport */}
            <div class="chart-viewport-wrapper" ref={canvasContainerRef} style={{ flex: 1, position: "relative" }}>
              <canvas class="chart-canvas" ref={canvasRef} style={{ width: "100%", height: "100%" }}></canvas>
              
              {/* OHLD Data overlay */}
              <div class="chart-overlay-info">
                <div class="chart-info-header">
                  <span class="chart-info-name" style={{ "font-family": "var(--sys-font-display)", "font-weight": "bold" }}>
                    {store.symbols[activeSymbol()]?.name || activeSymbol()}
                  </span>
                  <span class="chart-info-ohlc" style={{ "font-family": "var(--sys-font-mono)" }}>
                    <span>Price: <span class="ohlc-val">${(store.symbols[activeSymbol()]?.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></span>
                    <span class={`ohlc-change ${store.symbols[activeSymbol()]?.up ? 'up' : 'down'}`}>
                      {store.symbols[activeSymbol()]?.change >= 0 ? '+' : ''}{store.symbols[activeSymbol()]?.change?.toFixed(2)} ({store.symbols[activeSymbol()]?.pct?.toFixed(2)}%)
                    </span>
                  </span>
                </div>
                <div class="chart-indicator-legends">
                  <div class="legend-item">
                    <span class="legend-dot" style={{ "background-color": "var(--theme-color-ai)" }}></span>
                    <span>AI SuperTrend 10 3</span>
                    <span class="legend-val font-mono">${((store.symbols[activeSymbol()]?.price || 0) * 0.985).toFixed(2)}</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-dot" style={{ "background-color": "#f59e0b" }}></span>
                    <span>VWAP</span>
                    <span class="legend-val font-mono">${((store.symbols[activeSymbol()]?.price || 0) * 0.999).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Floating Quick Action Overlay */}
              <div class="chart-float-actions">
                <button class="float-action-btn oc-btn" title="Open Option Chain for this symbol" onClick={() => openOcPanel(activeSymbol())}>
                  OC
                </button>
                <button class="float-action-btn sell" onClick={() => handlePlaceOrder('Sell')}>
                  SELL
                </button>
                <input type="number" class="float-qty-input font-mono" style={{ width: "60px", padding: "0 4px" }} value={qty()} onInput={(e) => setQty(Number(e.currentTarget.value))} />
                <button class="float-action-btn buy" onClick={() => handlePlaceOrder('Buy')}>
                  BUY
                </button>
              </div>

              {/* OC quick-access button in chart top-right corner */}
              <div class="chart-oc-corner-btn">
                <button onClick={() => openOcPanel(activeSymbol())}>
                  📊 Option Chain
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Positions Panel */}
        <div class="panel positions-panel" style={{ flex: 0.8, display: "flex", "flex-direction": "column", "min-height": "0" }}>
          <div class="table-tabs">
            <div class="table-tab active">Active Positions ({store.positions.length})</div>
            <div class="table-tab" style={{ cursor: "default" }}>Margin Used: ${store.margins.used.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            <div class="table-tab" style={{ cursor: "default" }}>Margin Available: ${store.margins.available.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div class="table-wrapper" style={{ flex: 1, overflow: "auto" }}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Product</th>
                  <th style={{ "text-align": "right" }}>Qty</th>
                  <th style={{ "text-align": "right" }}>Avg Price</th>
                  <th style={{ "text-align": "right" }}>LTP</th>
                  <th style={{ "text-align": "right" }}>PnL</th>
                  <th style={{ "text-align": "right" }}>PnL %</th>
                  <th style={{ "text-align": "right", width: "80px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <Show when={activePositions().length === 0}>
                  <tr>
                    <td colspan="8" style={{ "text-align": "center", color: "var(--theme-text-muted)", padding: "var(--sys-space-4)" }}>
                      No active positions open. Place a BUY/SELL order.
                    </td>
                  </tr>
                </Show>
                <For each={activePositions()}>
                  {(pos) => (
                    <tr>
                      <td class="font-mono" style={{ "font-weight": "600" }}>{store.symbols[pos.inst]?.name || pos.inst}</td>
                      <td>
                        <span class={`badge ${pos.prod.toLowerCase()}`} style={{ background: "var(--theme-bg-active)", padding: "2px 4px", "border-radius": "3px" }}>{pos.prod}</span>
                      </td>
                      <td class="font-mono" style={{ "text-align": "right" }}>{pos.qty}</td>
                      <td class="font-mono" style={{ "text-align": "right" }}>${pos.avg.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td class="font-mono" style={{ "text-align": "right" }}>${pos.ltp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td class={`font-mono pnl-text ${pos.up ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td class={`font-mono pnl-text ${pos.up ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                        {pos.pct >= 0 ? '+' : ''}{pos.pct.toFixed(2)}%
                      </td>
                      <td style={{ "text-align": "right" }}>
                        <button 
                          class="draw-tool-btn" 
                          style={{ border: "1px solid var(--theme-border)", background: "var(--theme-color-down-bg)", color: "var(--theme-color-down)", padding: "2px 6px", cursor: "pointer", "border-radius": "var(--sys-radius-sm)", "font-size": "9px" }}
                          onClick={() => closePosition(pos.inst)}
                          title="Square Off Position"
                        >
                          EXIT
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            <span class="table-footer-label">Total Floating PnL:</span>
            <span class={`table-footer-val ${activePositions().reduce((acc, p) => acc + p.pnl, 0) >= 0 ? 'up' : 'down'}`} style={{ "font-family": "var(--sys-font-mono)", "font-weight": "bold" }}>
              {activePositions().reduce((acc, p) => acc + p.pnl, 0) >= 0 ? '+' : ''}${activePositions().reduce((acc, p) => acc + p.pnl, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. RIGHT COLUMN: ORDER ENTRY & AI INSIGHTS */}
      <div class="right-workspace" style={{ display: "flex", "flex-direction": "column" }}>
        {/* Order execution panel */}
        <div class="panel order-entry-panel" style={{ display: "flex", "flex-direction": "column" }}>
          <div class="order-tabs">
            <div 
              class={`order-tab ${activeOrderMode() === 'Buy' ? 'order-tab active active-buy' : ''}`}
              onClick={() => setActiveOrderMode('Buy')}
            >
              Buy
            </div>
            <div 
              class={`order-tab ${activeOrderMode() === 'Sell' ? 'order-tab active active-sell' : ''}`}
              onClick={() => setActiveOrderMode('Sell')}
            >
              Sell
            </div>
          </div>

          <div class="order-body" style={{ flex: 1, display: "flex", "flex-direction": "column", gap: "var(--sys-space-2)" }}>
            <div class="order-symbol-header">
              <span class="order-symbol-name" style={{ "font-family": "var(--sys-font-display)", "font-weight": "bold" }}>{store.symbols[activeSymbol()]?.name || activeSymbol()}</span>
              <span class={`order-symbol-price ${store.symbols[activeSymbol()]?.up ? 'up' : 'down'}`}>
                ${(store.symbols[activeSymbol()]?.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div class="order-types-grid">
              <For each={['Market', 'Limit', 'SL', 'SL-M']}>
                {(type) => (
                  <button 
                    class={`order-type-btn ${orderType() === type ? 'active' : ''}`}
                    onClick={() => setOrderType(type)}
                  >
                    {type}
                  </button>
                )}
              </For>
            </div>

            {/* Qty Input with lot stepper */}
            <div class="order-input-group">
              <div class="input-group-label">
                <span>Quantity</span>
              </div>
              <div class="input-stepper">
                <button class="stepper-btn minus" onClick={() => setQty(q => Math.max(0.01, Number((q - (activeSymbol() === 'BTCUSDT' ? 0.01 : activeSymbol() === 'ETHUSDT' ? 0.1 : 1.0)).toFixed(3))))}>-</button>
                <input 
                  type="number" 
                  step="any"
                  class="stepper-input font-mono" 
                  value={qty()} 
                  onInput={(e) => setQty(Math.max(0.001, Number(e.currentTarget.value)))}
                />
                <button class="stepper-btn plus" onClick={() => setQty(q => Number((q + (activeSymbol() === 'BTCUSDT' ? 0.01 : activeSymbol() === 'ETHUSDT' ? 0.1 : 1.0)).toFixed(3)))}>+</button>
              </div>
            </div>

            {/* Price Inputs if Limit/Stop */}
            <Show when={orderType() === 'Limit' || orderType() === 'SL'}>
              <div class="order-input-group">
                <div class="input-group-label">
                  <span>Price ($)</span>
                </div>
                <input 
                  type="number" 
                  class="modal-input font-mono" 
                  value={priceInput()} 
                  onInput={(e) => setPriceInput(Number(e.currentTarget.value))}
                />
              </div>
            </Show>

            <Show when={orderType() === 'SL' || orderType() === 'SL-M'}>
              <div class="order-input-group">
                <div class="input-group-label">
                  <span>Trigger Price ($)</span>
                </div>
                <input 
                  type="number" 
                  class="modal-input font-mono" 
                  value={triggerPrice()} 
                  onInput={(e) => setTriggerPrice(Number(e.currentTarget.value))}
                />
              </div>
            </Show>

            {/* Product selection */}
            <div class="order-product-grid">
              <For each={['MIS', 'NRML']}>
                {(product) => (
                  <button 
                    class={`order-product-btn ${productType() === product ? 'active' : ''}`}
                    onClick={() => setProductType(product)}
                  >
                    {product === 'MIS' ? 'Intraday (MIS)' : 'Overnight (NRML)'}
                  </button>
                )}
              </For>
            </div>

            {/* Order execution trigger button */}
            <button 
              class={`order-submit-btn ${activeOrderMode() === 'Buy' ? 'buy' : 'sell'}`}
              onClick={() => handlePlaceOrder()}
              style={{ "margin-top": "auto" }}
            >
              Place Quick {activeOrderMode()}
            </button>
          </div>
        </div>

        {/* Market Depth Table */}
        <div class="panel depth-panel" style={{ flex: 1, display: "flex", "flex-direction": "column", "min-height": "0" }}>
          <div class="panel-header">
            <span>Market Depth ({activeSymbol()})</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--sys-space-1)' }}>
            <table class="depth-table" style={{ "font-size": "10px" }}>
              <thead>
                <tr>
                  <th>Bid ($)</th>
                  <th style={{ "text-align": "right" }}>Qty</th>
                  <th>Ask ($)</th>
                  <th style={{ "text-align": "right" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                <For each={[0, 1, 2, 3, 4]}>
                  {(i) => (
                    <tr>
                      <td class="bid font-mono">{bids()[i]?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="vol font-mono" style={{ "text-align": "right" }}>{bids()[i]?.qty}</td>
                      <td class="ask font-mono">{asks()[i]?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="vol font-mono" style={{ "text-align": "right" }}>{asks()[i]?.qty}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <div class="depth-totals" style={{ padding: "var(--sys-space-1-5) var(--sys-space-3)", "font-size": "9px" }}>
            <span class="bid">Bid Vol: {totalBidsQty()}</span>
            <span class="ask">Ask Vol: {totalAsksQty()}</span>
          </div>
        </div>

        {/* AI Insights Card */}
        <div class="panel ai-insights-panel" style={{ padding: "var(--sys-space-3)" }}>
          <div class="panel-header" style={{ padding: "0 0 var(--sys-space-2) 0" }}>
            <span style={{ "font-family": "var(--sys-font-display)", "font-weight": "600" }}>AI Insights</span>
          </div>
          <div class="ai-body" style={{ padding: 0 }}>
            <div class="ai-stats-grid">
              <div class="ai-stat-card">
                <span class="ai-stat-label">Market Regime</span>
                <span class="ai-stat-val up" style={{ "font-size": "10px" }}>Bullish Momentum</span>
              </div>
              <div class="ai-stat-card">
                <span class="ai-stat-label">AI Confidence</span>
                <span class="ai-stat-val ai" style={{ "font-size": "10px" }}>82%</span>
              </div>
            </div>

            <div class="ai-recommendation-box" style={{ "margin-top": "var(--sys-space-2)" }}>
              <span class="ai-rec-title" style={{ "font-size": "10px", "font-weight": "bold" }}>AI Recommendation</span>
              <p class="ai-rec-text" style={{ "font-size": "9px", "margin-top": "var(--sys-space-1)" }}>
                <strong>Long bias for {activeSymbol()}.</strong> Momentum breakout triggered with clean volume support. Risk/Reward ratio is highly favorable above current price.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
