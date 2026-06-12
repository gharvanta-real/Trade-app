import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, fetchCandles, navigateToTab } from '../../store/tradingStore';
import { OrderModal } from '../../components/OrderModal';
import { HugeIcon } from '../../components/HugeIcon';
import {
  NoteIcon,
  Briefcase01Icon,
  CpuIcon,
  ZapIcon
} from '@hugeicons/core-free-icons';
import './dashboard.css';

interface DashboardPageProps {
  theme: () => 'dark' | 'light';
}

export const DashboardPage: Component<DashboardPageProps> = (props) => {
  const [activeChartTab, setActiveChartTab] = createSignal('NIFTY');
  const [chartCandles, setChartCandles] = createSignal<any[]>([]);

  // Order modal states
  const [showOrderModal, setShowOrderModal] = createSignal(false);
  const [orderModalSym, setOrderModalSym] = createSignal('');
  const [orderModalSide, setOrderModalSide] = createSignal<'Buy' | 'Sell'>('Buy');

  const openOrder = (symbol: string, side: 'Buy' | 'Sell') => {
    setOrderModalSym(symbol);
    setOrderModalSide(side);
    setShowOrderModal(true);
  };

  // Map tab name to actual symbol name
  const getSymbolForTab = (tab: string) => {
    if (tab === 'NIFTY') return 'NIFTY 50';
    if (tab === 'BANKNIFTY') return 'BANKNIFTY';
    if (tab === 'FINNIFTY') return 'FINNIFTY';
    if (tab === 'MIDCPNIFTY') return 'MIDCPNIFTY';
    return 'NIFTY 50';
  };

  const activeSymbolName = () => getSymbolForTab(activeChartTab());
  const activeSymbolPrice = () => store.symbols[activeSymbolName()]?.price || 0;
  const activeSymbolChange = () => store.symbols[activeSymbolName()]?.change || 0;
  const activeSymbolPct = () => store.symbols[activeSymbolName()]?.pct || 0;
  const activeSymbolUp = () => store.symbols[activeSymbolName()]?.up ?? true;
  const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  createEffect(async () => {
    const tab = activeChartTab();
    const sym = getSymbolForTab(tab);
    const candles = await fetchCandles(sym, '5m');
    setChartCandles(candles);
  });

  // Format currencies
  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const isLive = () => store.brokerConnected;

  const totalPnL = () => {
    if (isLive()) {
      return store.positions.reduce((sum, p) => sum + p.pnl, 0);
    }
    return 18742.35; // exact value from user's screen
  };

  const totalPnLPct = () => {
    if (isLive()) {
      const margin = store.margins.available + store.margins.used;
      return margin > 0 ? (totalPnL() / margin) * 100 : 0;
    }
    return 1.53; // exact percentage from user's screen
  };

  const marginUsedVal = () => {
    if (isLive()) {
      return store.margins.used;
    }
    return 321450.75; // exact value from user's screen
  };

  const marginAvailableVal = () => {
    if (isLive()) {
      return store.margins.available;
    }
    return 1248530.45; // exact value from user's screen
  };

  const marginUsedPct = () => {
    const total = marginUsedVal() + marginAvailableVal();
    return total > 0 ? (marginUsedVal() / total) * 100 : 25.74; // exact percentage from user's screen
  };

  const openPositionsCount = () => {
    if (isLive()) {
      return store.positions.length;
    }
    return 3;
  };

  const winningPositionsCount = () => {
    if (isLive()) {
      return store.positions.filter(p => p.pnl > 0).length;
    }
    return 2;
  };

  const totalOrdersCount = () => {
    if (isLive()) {
      return store.orders.length;
    }
    return 12;
  };

  const executedOrdersCount = () => {
    if (isLive()) {
      return store.orders.filter(o => o.status === 'executed').length;
    }
    return 6;
  };

  // Canvas Refs for Charts
  let mainChartRef!: HTMLCanvasElement;
  let mainChartContainerRef!: HTMLDivElement;
  let pnlSparklineRef!: HTMLCanvasElement;

  const drawMainChart = () => {
    if (!mainChartRef || !mainChartContainerRef) return;
    const ctx = mainChartRef.getContext('2d');
    if (!ctx) return;

    const width = mainChartContainerRef.clientWidth;
    const height = mainChartContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    mainChartRef.width = width * dpi;
    mainChartRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = props.theme() === 'dark';
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = isDark ? '#1f1f23' : '#f3f4f6';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const candles = chartCandles();
    if (candles && candles.length > 0) {
      const closes = candles.map(c => c.close);
      const minClose = Math.min(...closes);
      const maxClose = Math.max(...closes);
      const range = maxClose - minClose || 1;

      const valToY = (val: number) => {
        return height - 25 - ((val - minClose) / range) * (height - 50);
      };

      const pointsCount = candles.length;
      const step = width / (pointsCount - 1 || 1);

      const isUp = closes[closes.length - 1] >= closes[0];
      const lineColor = isUp ? '#10b981' : '#f43f5e';
      const gradientStart = isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
      const gradientEnd = isUp ? 'rgba(16, 185, 129, 0.0)' : 'rgba(244, 63, 94, 0.0)';

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, valToY(closes[0]));
      for (let i = 1; i < pointsCount; i++) {
        ctx.lineTo(step * i, valToY(closes[i]));
      }
      ctx.stroke();

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, gradientStart);
      grad.addColorStop(1, gradientEnd);
      ctx.fillStyle = grad;
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    } else {
      // Fallback: Mock chart line matching a clean trend
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const points = [120, 135, 110, 130, 145, 165, 150, 180, 195, 190, 205, 200, 220, 215];
      const step = width / (points.length - 1);
      ctx.moveTo(0, height - points[0]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(step * i, height - points[i]);
      }
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = grad;
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawMiniSparkline = () => {
    if (!pnlSparklineRef) return;
    const ctx = pnlSparklineRef.getContext('2d');
    if (!ctx) return;
    const w = 70;
    const h = 18;
    const dpi = window.devicePixelRatio || 1;
    pnlSparklineRef.width = w * dpi;
    pnlSparklineRef.height = h * dpi;
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, w, h);

    const isUp = totalPnL() >= 0;
    ctx.strokeStyle = isUp ? 'var(--theme-color-up)' : 'var(--theme-color-down)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const points = isUp ? [3, 6, 4, 8, 7, 13, 11, 15] : [15, 11, 13, 7, 8, 4, 6, 3];
    const step = w / (points.length - 1);
    ctx.moveTo(0, h - points[0]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(step * i, h - points[i]);
    }
    ctx.stroke();
  };

  const handleResize = () => {
    drawMainChart();
    drawMiniSparkline();
  };

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  createEffect(() => {
    props.theme();
    chartCandles();
    store.symbols[activeSymbolName()]?.price;
    totalPnL();
    handleResize();
  });

  // Watchlist Items mapped to the grid structure
  const watchlistItems = () => {
    return store.watchlist.slice(0, 6).map(key => {
      const sym = store.symbols[key];
      const price = sym ? sym.price : 0;
      const pct = sym ? sym.pct : 0;
      const vol = sym ? sym.volume || '10.5M' : '10.5M';
      return {
        name: key,
        price: price,
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        pct: pct,
        volume: vol,
        up: pct >= 0,
        color: pct >= 0 ? 'var(--theme-color-up)' : 'var(--theme-color-down)'
      };
    });
  };

  // Positions Data mapped to screenshot columns
  const getPositions = () => {
    if (isLive()) {
      return store.positions.slice(0, 4).map(pos => ({
        inst: pos.inst,
        qty: pos.qty,
        pnl: pos.pnl,
        pct: pos.pct,
        up: pos.pnl >= 0,
        risk: pos.pnl >= 0 ? 'Low' : 'Medium'
      }));
    }
    return [
      { inst: 'NIFTY 23 MAY 24500 CE', qty: '75 Lots', pnl: 12450.00, pct: 18.45, up: true, risk: 'Low' },
      { inst: 'RELIANCE EQ', qty: '100', pnl: 4320.00, pct: 2.15, up: true, risk: 'Low' },
      { inst: 'TCS EQ', qty: '50', pnl: -1920.00, pct: -1.38, up: false, risk: 'Medium' },
    ];
  };

  // Recent Orders mapped to screenshot columns
  const getOrders = () => {
    if (isLive()) {
      return store.orders.slice(0, 5).map(o => ({
        time: o.time,
        inst: o.inst,
        side: o.side,
        status: o.status,
        qty: o.qty
      }));
    }
    return [
      { time: '09:29:15', inst: 'RELIANCE EQ', side: 'Buy', status: 'Executed', qty: 100 },
      { time: '09:28:47', inst: 'NIFTY 23 MAY 24500 CE', side: 'Sell', status: 'Executed', qty: 50 },
      { time: '09:27:33', inst: 'HDFCBANK EQ', side: 'Buy', status: 'Executed', qty: 50 },
      { time: '09:26:58', inst: 'TCS EQ', side: 'Sell', status: 'Pending', qty: 50 },
      { time: '09:25:41', inst: 'INFY EQ', side: 'Buy', status: 'Executed', qty: 25 },
    ];
  };

  // Breadth ADV / DEC percentages
  const advCount = 1642;
  const decCount = 1128;
  const advPercent = () => (advCount / (advCount + decCount)) * 100;

  return (
    <div class="db-grid-container">
      {/* 6 KPI Cards Row */}
      <div class="db-kpi-bar">
        {/* Card 1: Net P&L */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('positions')}>
          <div class="kpi-card-header">
            <span>Net P&L</span>
            <span class={`pnl-badge-arrow ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '▲' : '▼'}
            </span>
          </div>
          <div class="kpi-card-body-flex">
            <div class="kpi-card-body-new">
              <span class={`kpi-main-val ${totalPnL() >= 0 ? 'up' : 'down'}`}>
                {totalPnL() >= 0 ? '+' : ''}{formatINR(totalPnL())}
              </span>
              <span class={`kpi-sub-label ${totalPnL() >= 0 ? 'up' : 'down'}`}>
                {totalPnL() >= 0 ? '+' : ''}{totalPnLPct().toFixed(2)}% vs prev. close
              </span>
            </div>
            <div class="sparkline-wrapper">
              <canvas ref={pnlSparklineRef} class="mini-sparkline-canvas"></canvas>
            </div>
          </div>
        </div>

        {/* Card 2: Available Funds */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('profile')}>
          <div class="kpi-card-header">
            <span>Available Funds</span>
            <span class="kpi-header-icon"><HugeIcon icon={Briefcase01Icon} size={11} /></span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">{formatINR(marginAvailableVal())}</span>
            <span class="kpi-sub-label">Cash + Collateral</span>
          </div>
        </div>

        {/* Card 3: Margin Used */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('profile')}>
          <div class="kpi-card-header">
            <span>Margin Used</span>
            <span class="kpi-header-icon"><HugeIcon icon={NoteIcon} size={11} /></span>
          </div>
          <div class="kpi-card-body-flex">
            <div class="kpi-card-body-new" style={{ flex: 1 }}>
              <span class="kpi-main-val">{formatINR(marginUsedVal())}</span>
              <span class="kpi-sub-label">{marginUsedPct().toFixed(2)}% of available</span>
            </div>
            <div class="kpi-progress-circle-mini">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="transparent" stroke="var(--theme-border-light)" stroke-width="2.5"></circle>
                <circle cx="12" cy="12" r="9" fill="transparent" stroke="var(--theme-color-ai)" stroke-width="2.5" stroke-dasharray="56" stroke-dashoffset={56 - (56 * marginUsedPct()) / 100}></circle>
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Open Positions */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('positions')}>
          <div class="kpi-card-header">
            <span>Open Positions</span>
            <span class="kpi-header-icon"><HugeIcon icon={Briefcase01Icon} size={11} /></span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">{openPositionsCount()}</span>
            <span class="kpi-sub-label up font-semibold">{winningPositionsCount()} in Profit</span>
          </div>
        </div>

        {/* Card 5: Today's Orders */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('orders')}>
          <div class="kpi-card-header">
            <span>Today's Orders</span>
            <span class="kpi-header-icon"><HugeIcon icon={NoteIcon} size={11} /></span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">{totalOrdersCount()}</span>
            <span class="kpi-sub-label up font-semibold">{executedOrdersCount()} Executed</span>
          </div>
        </div>

        {/* Card 6: AI System Status */}
        <div class="kpi-cell clickable" onClick={() => navigateToTab('ailab')}>
          <div class="kpi-card-header">
            <span>AI System Status</span>
            <span class="kpi-header-icon"><HugeIcon icon={CpuIcon} size={11} /></span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val ai" style={{ color: "var(--theme-color-ai)" }}>Operational</span>
            <span class="kpi-sub-label">All Systems Normal</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div class="db-columns-layout">
        {/* Column 1 (Left - Market Snapshot & Watchlist) */}
        <div class="db-col col-1">
          {/* Market Snapshot Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <div class="panel-header-left">
                <span class="panel-title-new">Market Snapshot</span>
                <div class="chart-tab-bar">
                  <For each={['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']}>
                    {(tab) => (
                      <button
                        class={`chart-tab-btn ${activeChartTab() === tab ? 'active' : ''}`}
                        onClick={() => setActiveChartTab(tab)}
                      >
                        {tab}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <div class="chart-metrics-right">
                <span class="chart-index-price">
                  {activeSymbolPrice().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span class={`chart-index-pct ${activeSymbolUp() ? 'up' : 'down'}`}>
                  {activeSymbolChange() >= 0 ? '+' : ''}{activeSymbolChange().toFixed(2)} ({activeSymbolChange() >= 0 ? '+' : ''}{activeSymbolPct().toFixed(2)}%)
                </span>
              </div>
            </div>
            <div class="main-chart-wrapper" ref={mainChartContainerRef}>
              <canvas ref={mainChartRef} class="main-canvas"></canvas>
            </div>
            
            {/* Snapshot Bottom 4 Stats Grid */}
            <div class="chart-stats-bar">
              <div class="stat-item">
                <span class="stat-lbl">NIFTY 50</span>
                <span class="stat-val font-semibold font-mono">
                  {store.symbols['NIFTY 50']?.price.toLocaleString('en-IN') || '24,502.15'}
                  <span class={store.symbols['NIFTY 50']?.pct >= 0 ? 'up' : 'down'} style={{ "margin-left": "4px", "font-size": "9px" }}>
                    {signedPct(store.symbols['NIFTY 50']?.pct || 0)}
                  </span>
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">India VIX</span>
                <span class="stat-val font-semibold font-mono">
                  13.42
                  <span class="down" style={{ "margin-left": "4px", "font-size": "9px" }}>
                    -2.75%
                  </span>
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Market Breadth</span>
                <div style={{ display: "flex", "flex-direction": "column", gap: "2px", "margin-top": "2px" }}>
                  <div class="breadth-text-row">
                    <span class="up font-mono">ADV {advCount}</span>
                    <span class="down font-mono">DEC {decCount}</span>
                  </div>
                  <div class="breadth-line-bar">
                    <div class="breadth-adv-fill" style={{ width: `${advPercent()}%` }}></div>
                  </div>
                </div>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Top Sector</span>
                <span class="stat-val font-semibold font-mono">
                  NIFTY IT
                  <span class="up" style={{ "margin-left": "4px", "font-size": "9px" }}>
                    +1.35%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Watchlist Preview Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Watchlist Preview</span>
              <button class="view-all-btn" onClick={() => navigateToTab('watchlist')}>View All</button>
            </div>
            <div class="table-container-new">
              <table class="watchlist-table-new">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th class="text-right">LTP</th>
                    <th class="text-right">Change %</th>
                    <th class="text-right">Volume</th>
                    <th class="text-center" style={{ width: "85px" }}>Buy</th>
                    <th class="text-center" style={{ width: "85px" }}>Sell</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={watchlistItems()}>
                    {(item) => (
                      <tr>
                        <td class="font-bold">{item.name}</td>
                        <td class="font-mono text-right">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class={`font-mono text-right ${item.up ? 'up' : 'down'}`}>{item.change}</td>
                        <td class="font-mono text-right text-muted">{item.volume}</td>
                        <td class="text-center">
                          <button class="quick-trade-btn buy" onClick={() => openOrder(item.name, 'Buy')}>
                            ₹{(item.price - 0.05).toFixed(2)}
                          </button>
                        </td>
                        <td class="text-center">
                          <button class="quick-trade-btn sell" onClick={() => openOrder(item.name, 'Sell')}>
                            ₹{(item.price + 0.05).toFixed(2)}
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Column 2 (Right - Positions & Orders) */}
        <div class="db-col col-2">
          {/* Positions Preview Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Positions Preview</span>
              <button class="view-all-btn" onClick={() => navigateToTab('positions')}>View All</button>
            </div>
            <div class="table-container-new">
              <table class="positions-table-new">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">P&L</th>
                    <th class="text-center" style={{ width: "95px" }}>Risk Status</th>
                    <th class="text-center" style={{ width: "65px" }}>Exit</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={getPositions()} fallback={
                    <tr>
                      <td colspan="5" class="no-positions-lbl">No open positions.</td>
                    </tr>
                  }>
                    {(pos) => (
                      <tr>
                        <td class="font-bold">{pos.inst}</td>
                        <td class="font-mono text-right">{pos.qty}</td>
                        <td class={`font-mono text-right ${pos.up ? 'up' : 'down'}`}>
                          {pos.up ? '+' : ''}₹{pos.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span style={{ "display": "block", "font-size": "9px" }}>({pos.up ? '+' : ''}{pos.pct.toFixed(2)}%)</span>
                        </td>
                        <td class="text-center">
                          <span class={`risk-status-badge ${pos.risk.toLowerCase()}`}>
                            <span class="risk-dot"></span>
                            {pos.risk}
                          </span>
                        </td>
                        <td class="text-center">
                          <button class="exit-pos-btn" onClick={() => openOrder(pos.inst, parseInt(String(pos.qty)) > 0 ? 'Sell' : 'Buy')}>
                            Exit
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <Show when={getPositions().length > 0}>
                <div class="positions-bottom-link-bar">
                  <span class="view-all-footer-link" onClick={() => navigateToTab('positions')}>View All Positions →</span>
                </div>
              </Show>
            </div>
          </div>

          {/* Recent Orders Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Recent Orders</span>
              <button class="view-all-btn" onClick={() => navigateToTab('orders')}>View All</button>
            </div>
            <div class="table-container-new">
              <table class="orders-table-new">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Instrument</th>
                    <th class="text-center">Side</th>
                    <th class="text-center">Status</th>
                    <th class="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={getOrders()} fallback={
                    <tr>
                      <td colspan="5" class="no-positions-lbl">No recent orders.</td>
                    </tr>
                  }>
                    {(ord) => (
                      <tr>
                        <td class="font-mono text-muted">{ord.time}</td>
                        <td class="font-bold">{ord.inst}</td>
                        <td class="text-center">
                          <span class={`side-badge ${ord.side.toLowerCase()}`}>{ord.side.toUpperCase()}</span>
                        </td>
                        <td class="text-center">
                          <span class={`status-badge-new ${ord.status.toLowerCase()}`}>{ord.status}</span>
                        </td>
                        <td class="font-mono text-right">{ord.qty}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
          {/* AI Alert & System Status Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">AI Alert & System Status</span>
            </div>
            <div class="ai-alert-card-grid">
              {/* Row 1: Status Grid */}
              <div class="ai-alert-top-row">
                <div class="ai-alert-item-mini">
                  <span class="ai-lbl-mini">AI Mode</span>
                  <span class="ai-val-mini font-bold">
                    <span class="ai-pulse-dot"></span> Active
                  </span>
                </div>
                <div class="ai-alert-item-mini">
                  <span class="ai-lbl-mini">Data Health</span>
                  <span class="ai-val-mini font-bold text-up">✓ Good</span>
                </div>
                <div class="ai-alert-item-mini">
                  <span class="ai-lbl-mini">Strategy</span>
                  <span class="ai-val-mini font-semibold text-ai">
                    <span style={{ "margin-right": "4px" }}><HugeIcon icon={ZapIcon} size={10} /></span>
                    Momentum Pro
                  </span>
                </div>
                <div class="ai-alert-item-mini">
                  <span class="ai-lbl-mini">Risk Status</span>
                  <span class="ai-val-mini font-bold text-up">✓ Healthy</span>
                </div>
              </div>
              
              {/* Row 2: Last Decision */}
              <div class="ai-alert-bottom-row">
                <span class="ai-lbl-mini">Last Decision</span>
                <span class="ai-val-decision font-mono">
                  <span class="alert-highlight-icon">⚠️</span>
                  09:29:12 AM Increased NIFTY CE exposure
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay OrderModal popup */}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        defaultSymbol={orderModalSym()}
        defaultSide={orderModalSide()}
      />
    </div>
  );
};
