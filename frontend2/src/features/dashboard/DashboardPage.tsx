import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, fetchCandles, navigateToTab } from '../../store/tradingStore';
import './dashboard.css';

interface DashboardPageProps {
  theme: () => 'dark' | 'light';
}

export const DashboardPage: Component<DashboardPageProps> = (props) => {
  const [activeChartTab, setActiveChartTab] = createSignal('NIFTY');
  const [activeWatchlistTab, setActiveWatchlistTab] = createSignal('watchlist');
  const [chartCandles, setChartCandles] = createSignal<any[]>([]);

  // Map tab name to actual symbol name
  const getSymbolForTab = (tab: string) => {
    if (tab === 'NIFTY') return 'NIFTY 50';
    if (tab === 'BANKNIFTY') return 'BANKNIFTY';
    if (tab === 'FINNIFTY') return 'FINNIFTY';
    return 'NIFTY 50';
  };

  const activeSymbolName = () => getSymbolForTab(activeChartTab());
  const activeSymbolPrice = () => store.symbols[activeSymbolName()]?.price || 0;
  const activeSymbolChange = () => store.symbols[activeSymbolName()]?.change || 0;
  const activeSymbolPct = () => store.symbols[activeSymbolName()]?.pct || 0;
  const activeSymbolUp = () => store.symbols[activeSymbolName()]?.up ?? true;

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

  // Dynamic Trend calculation
  const getTrendData = (symbolName: string, defaultPrice: number, defaultPct: number) => {
    const sym = store.symbols[symbolName];
    if (sym && sym.price > 0) {
      return {
        price: sym.price,
        pct: sym.pct,
        up: sym.pct >= 0
      };
    }
    return {
      price: defaultPrice,
      pct: defaultPct,
      up: defaultPct >= 0
    };
  };

  // Dynamic Options Chain calculation based on Nifty price
  const niftyPrice = () => store.symbols['NIFTY 50']?.price || 24200;
  const atmStrike = () => Math.round(niftyPrice() / 100) * 100;

  const totalPnLWeek = () => {
    if (isLive()) {
      return store.positions.reduce((sum, p) => sum + p.pnl, 0);
    }
    return 28645.30;
  };

  const totalPnLWeekPct = () => {
    if (isLive()) {
      const margin = store.margins.available + store.margins.used;
      return margin > 0 ? (totalPnLWeek() / margin) * 100 : 0;
    }
    return 3.92;
  };

  // Live vs Mock calculations
  const isLive = () => store.brokerConnected;

  const totalPnL = () => {
    if (isLive()) {
      return store.positions.reduce((sum, p) => sum + p.pnl, 0);
    }
    return 18325.45; // exact value from user's screen
  };

  const totalPnLPct = () => {
    if (isLive()) {
      const margin = store.margins.available + store.margins.used;
      return margin > 0 ? (totalPnL() / margin) * 100 : 0;
    }
    return 2.35;
  };

  const marginUsedVal = () => {
    if (isLive()) {
      return store.margins.used;
    }
    return 642000; // 6.42L
  };

  const marginAvailableVal = () => {
    if (isLive()) {
      return store.margins.available;
    }
    return 858000; // available margin for 42.7% used
  };

  const marginUsedPct = () => {
    const total = marginUsedVal() + marginAvailableVal();
    return total > 0 ? (marginUsedVal() / total) * 100 : 42.7;
  };

  const openPositionsCount = () => {
    if (isLive()) {
      return store.positions.length;
    }
    return 4;
  };

  const winningPositionsCount = () => {
    if (isLive()) {
      return store.positions.filter(p => p.pnl > 0).length;
    }
    return 2;
  };

  const losingPositionsCount = () => {
    if (isLive()) {
      return store.positions.filter(p => p.pnl < 0).length;
    }
    return 2;
  };

  // Canvas Refs for Charts
  let mainChartRef!: HTMLCanvasElement;
  let mainChartContainerRef!: HTMLDivElement;
  let perfChartRef!: HTMLCanvasElement;
  let perfChartContainerRef!: HTMLDivElement;
  let breadthCanvasRef!: HTMLCanvasElement;

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
    ctx.fillStyle = isDark ? '#161618' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = isDark ? '#232326' : '#f3f4f6';
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
      const gradientStart = isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
      const gradientEnd = isUp ? 'rgba(16, 185, 129, 0.0)' : 'rgba(244, 63, 94, 0.0)';

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
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
      // Fallback: Mock chart line
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const points = [150, 165, 140, 155, 175, 185, 170, 195, 210, 205, 220, 215, 235, 250];
      const step = width / (points.length - 1);
      ctx.moveTo(0, height - points[0]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(step * i, height - points[i]);
      }
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = grad;
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawWeeklyPerformance = () => {
    if (!perfChartRef || !perfChartContainerRef) return;
    const ctx = perfChartRef.getContext('2d');
    if (!ctx) return;

    const width = perfChartContainerRef.clientWidth;
    const height = perfChartContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    perfChartRef.width = width * dpi;
    perfChartRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = props.theme() === 'dark';
    ctx.fillStyle = isDark ? '#161618' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const points = [40, 60, 50, 80, 100, 90, 130];
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
  };

  const drawMarketBreadthDonut = () => {
    if (!breadthCanvasRef) return;
    const ctx = breadthCanvasRef.getContext('2d');
    if (!ctx) return;

    const size = 110;
    const dpi = window.devicePixelRatio || 1;
    breadthCanvasRef.width = size * dpi;
    breadthCanvasRef.height = size * dpi;
    ctx.scale(dpi, dpi);

    const center = size / 2;
    const radius = 42;
    const thickness = 11;

    // Clear
    const isDark = props.theme() === 'dark';
    ctx.fillStyle = isDark ? '#161618' : '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Advancing (63%), Declining (32%), Unchanged (5%)
    const angles = [0.63 * Math.PI * 2, 0.32 * Math.PI * 2, 0.05 * Math.PI * 2];
    const colors = ['#10b981', '#f43f5e', '#6b7280'];

    let startAngle = -Math.PI / 2;
    for (let i = 0; i < angles.length; i++) {
      ctx.beginPath();
      ctx.arc(center, center, radius, startAngle, startAngle + angles[i]);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = thickness;
      ctx.stroke();
      startAngle += angles[i];
    }
  };

  const handleResize = () => {
    drawMainChart();
    drawWeeklyPerformance();
    drawMarketBreadthDonut();
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
    handleResize();
  });

  // Watchlist Items
  const watchlistItems = () => {
    return store.watchlist.slice(0, 7).map(key => {
      const sym = store.symbols[key];
      const price = sym ? sym.price : 0;
      const pct = sym ? sym.pct : 0;
      return {
        name: key,
        price: '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        color: pct >= 0 ? 'var(--theme-color-up)' : 'var(--theme-color-down)'
      };
    });
  };

  // Positions Data
  const getPositions = () => {
    if (isLive()) {
      return store.positions;
    }
    // Mock Positions matching screenshot
    return [
      { inst: 'NIFTY 23 MAY 22500 CE', prod: 'NRML', qty: 75, avg: 229.15, ltp: 279.80, pnl: 3799.50, pct: 22.10 },
      { inst: 'BANKNIFTY 23 MAY 48500 CE', prod: 'NRML', qty: 25, avg: 312.40, ltp: 356.70, pnl: 1107.50, pct: 14.17 },
      { inst: 'NIFTY 23 MAY 22500 PE', prod: 'NRML', qty: -50, avg: 134.25, ltp: 128.60, pnl: 282.50, pct: 4.21 },
      { inst: 'FINNIFTY 23 MAY 21700 CE', prod: 'NRML', qty: 80, avg: 162.80, ltp: 158.10, pnl: -235.00, pct: -2.88 },
    ];
  };

  return (
    <div class="db-grid-container">
      {/* 6 KPI Cards Row */}
      <div class="db-kpi-bar">
        {/* Card 1: Total P&L */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>Total P&L (Today)</span>
            <span class={`pnl-badge-arrow ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '▲' : '▼'}
            </span>
          </div>
          <div class="kpi-card-body-new">
            <span class={`kpi-main-val ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '+' : ''}{formatINR(totalPnL())}
            </span>
            <span class={`kpi-sub-label ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '+' : ''}{totalPnLPct().toFixed(2)}%
            </span>
          </div>
          <div class="kpi-mini-chart-placeholder green-sparkline"></div>
        </div>

        {/* Card 2: Win Rate */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>Win Rate</span>
          </div>
          <div class="kpi-card-body-flex">
            <div class="kpi-card-body-new">
              <span class="kpi-main-val">64.7%</span>
              <span class="kpi-sub-label up">+3.8% vs yesterday</span>
            </div>
            <div class="kpi-circle-progress">
              <svg width="42" height="42" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="16" fill="transparent" stroke="var(--theme-border-light)" stroke-width="4"></circle>
                <circle cx="21" cy="21" r="16" fill="transparent" stroke="var(--theme-color-ai)" stroke-width="4" stroke-dasharray="100" stroke-dashoffset="35.3"></circle>
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Margin Used */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>Margin Used</span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">
              {isLive() ? formatINR(marginUsedVal()) : '₹ 6.42L'}
            </span>
            <span class="kpi-sub-label">
              {marginUsedPct().toFixed(1)}% of available
            </span>
            <div class="kpi-progress-bar-container">
              <div class="kpi-progress-bar" style={{ width: `${marginUsedPct()}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Open Positions */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>Open Positions</span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">{openPositionsCount()}</span>
            <span class="kpi-sub-label">
              <span class="up">{winningPositionsCount()} Winning</span> · <span class="down">{losingPositionsCount()} Losing</span>
            </span>
          </div>
        </div>

        {/* Card 5: AI Confidence */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>AI Confidence</span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">78%</span>
            <span class="kpi-sub-label ai font-semibold">Bullish Sentiment</span>
          </div>
        </div>

        {/* Card 6: Today's Trades */}
        <div class="kpi-cell">
          <div class="kpi-card-header">
            <span>Today's Trades</span>
          </div>
          <div class="kpi-card-body-new">
            <span class="kpi-main-val">{isLive() ? store.orders.length : '18'}</span>
            <span class="kpi-sub-label">
              <span class="up">{isLive() ? store.orders.filter(o => o.status === 'executed').length : '12'} Wins</span> · <span class="down">{isLive() ? store.orders.filter(o => o.status === 'cancelled').length : '6'} Losses</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div class="db-columns-layout">
        {/* Column 1 (Left) */}
        <div class="db-col col-1">
          {/* Market Overview Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <div class="panel-header-left">
                <span class="panel-title-new">Market Overview</span>
                <div class="chart-tab-bar">
                  <For each={['NIFTY', 'BANKNIFTY', 'FINNIFTY']}>
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
                  {activeSymbolPrice().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span class={`chart-index-pct ${activeSymbolUp() ? 'up' : 'down'}`}>
                  {activeSymbolChange() >= 0 ? '+' : ''}{activeSymbolChange().toFixed(2)} ({activeSymbolChange() >= 0 ? '+' : ''}{activeSymbolPct().toFixed(2)}%)
                </span>
              </div>
            </div>
            <div class="main-chart-wrapper" ref={mainChartContainerRef}>
              <canvas ref={mainChartRef} class="main-canvas"></canvas>
            </div>
            <div class="chart-stats-bar">
              <div class="stat-item">
                <span class="stat-lbl">Advance / Decline</span>
                <span class="stat-val font-semibold">1,623 / 812</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">High / Low</span>
                <span class="stat-val font-mono">23,080.20 / 22,760.35</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Volatility (VIX)</span>
                <span class="stat-val down font-mono">13.42 -1.23%</span>
              </div>
              <div class="stat-item">
                <span class="stat-lbl">Market Breadth</span>
                <span class="stat-val font-semibold">66%</span>
              </div>
            </div>
          </div>

          {/* AI Insights Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">AI Insights / Trade Coach</span>
              <span class="ai-badge">Bullish Regime</span>
            </div>
            <div class="ai-insights-body">
              <div class="ai-levels-row">
                <div class="ai-level-box">
                  <span class="ai-lvl-lbl">Key Resistance</span>
                  <span class="ai-lvl-val font-mono">23,080 / 23,250</span>
                </div>
                <div class="ai-level-box">
                  <span class="ai-lvl-lbl">Key Support</span>
                  <span class="ai-lvl-val font-mono">22,760 / 22,550</span>
                </div>
              </div>
              <div class="ai-coach-sections">
                <div class="coach-sec">
                  <span class="sec-title">Suggested Focus</span>
                  <p class="sec-text">Buy on Dips in Index Options · Momentum in Banking & Financials · Watch 23,000 for breakout confirmation</p>
                </div>
                <div class="coach-sec">
                  <span class="sec-title warning">Warnings</span>
                  <p class="sec-text">Global cues mixed - Track US Futures · Nifty near resistance - Watch price action · Avoid over-leveraging</p>
                </div>
              </div>
              <div class="ai-confidence-footer">
                <span class="conf-title">AI Confidence: 78%</span>
                <div class="conf-bar-container">
                  <div class="conf-bar" style={{ width: '78%' }}></div>
                </div>
                <button class="conf-btn">View Full Analysis</button>
              </div>
            </div>
          </div>

          {/* Option Chain Snapshot */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Options Chain Snapshot (NIFTY 23 MAY)</span>
              <button class="view-all-btn" onClick={() => navigateToTab('option-chain')}>View Option Chain</button>
            </div>
            <div class="option-chain-wrapper">
              <table class="option-chain-table">
                <thead>
                  <tr>
                    <th>Calls OI (L)</th>
                    <th>LTP</th>
                    <th>Strike</th>
                    <th>LTP</th>
                    <th>Puts OI (L)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>21.8</td>
                    <td class="up">{(niftyPrice() - (atmStrike() - 100) + 15).toFixed(2)}</td>
                    <td class="strike">{atmStrike() - 100}</td>
                    <td class="down">{(45.20).toFixed(2)}</td>
                    <td>28.3</td>
                  </tr>
                  <tr>
                    <td>26.3</td>
                    <td class="up">{(85.50).toFixed(2)}</td>
                    <td class="strike">{atmStrike()}</td>
                    <td class="down">{(80.10).toFixed(2)}</td>
                    <td>42.1</td>
                  </tr>
                  <tr>
                    <td>19.6</td>
                    <td class="up">{(32.40).toFixed(2)}</td>
                    <td class="strike">{atmStrike() + 100}</td>
                    <td class="down">{((atmStrike() + 100) - niftyPrice() + 15).toFixed(2)}</td>
                    <td>29.7</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Column 2 (Middle) */}
        <div class="db-col col-2">
          {/* Market Trend Sparklines */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Market Trend (Intraday)</span>
            </div>
            <div class="trends-list">
              <div class="trend-row">
                <div class="trend-row-lbl">
                  <span class="trend-name">NIFTY 50</span>
                  <span class="trend-price">{getTrendData('NIFTY 50', 22957.30, 0.62).price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <span class={`trend-pct ${getTrendData('NIFTY 50', 22957.30, 0.62).up ? 'up' : 'down'}`}>
                  {getTrendData('NIFTY 50', 22957.30, 0.62).pct >= 0 ? '+' : ''}{getTrendData('NIFTY 50', 22957.30, 0.62).pct.toFixed(2)}%
                </span>
                <div class={`trend-sparkline ${getTrendData('NIFTY 50', 22957.30, 0.62).up ? 'green' : 'red'}`}></div>
              </div>
              <div class="trend-row">
                <div class="trend-row-lbl">
                  <span class="trend-name">BANKNIFTY</span>
                  <span class="trend-price">{getTrendData('BANKNIFTY', 48353.45, 0.71).price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <span class={`trend-pct ${getTrendData('BANKNIFTY', 48353.45, 0.71).up ? 'up' : 'down'}`}>
                  {getTrendData('BANKNIFTY', 48353.45, 0.71).pct >= 0 ? '+' : ''}{getTrendData('BANKNIFTY', 48353.45, 0.71).pct.toFixed(2)}%
                </span>
                <div class={`trend-sparkline ${getTrendData('BANKNIFTY', 48353.45, 0.71).up ? 'green' : 'red'}`}></div>
              </div>
              <div class="trend-row">
                <div class="trend-row-lbl">
                  <span class="trend-name">FINNIFTY</span>
                  <span class="trend-price">{getTrendData('FINNIFTY', 21675.55, 0.44).price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <span class={`trend-pct ${getTrendData('FINNIFTY', 21675.55, 0.44).up ? 'up' : 'down'}`}>
                  {getTrendData('FINNIFTY', 21675.55, 0.44).pct >= 0 ? '+' : ''}{getTrendData('FINNIFTY', 21675.55, 0.44).pct.toFixed(2)}%
                </span>
                <div class={`trend-sparkline ${getTrendData('FINNIFTY', 21675.55, 0.44).up ? 'green' : 'red'}`}></div>
              </div>
              <div class="trend-row">
                <div class="trend-row-lbl">
                  <span class="trend-name">MIDCAP 100</span>
                  <span class="trend-price">{getTrendData('MIDCAP 100', 15409.15, 0.21).price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <span class={`trend-pct ${getTrendData('MIDCAP 100', 15409.15, 0.21).up ? 'up' : 'down'}`}>
                  {getTrendData('MIDCAP 100', 15409.15, 0.21).pct >= 0 ? '+' : ''}{getTrendData('MIDCAP 100', 15409.15, 0.21).pct.toFixed(2)}%
                </span>
                <div class={`trend-sparkline ${getTrendData('MIDCAP 100', 15409.15, 0.21).up ? 'green' : 'red'}`}></div>
              </div>
            </div>
          </div>

          {/* Performance Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Performance (This Week)</span>
            </div>
            <div class="perf-metric-summary">
              <span class="perf-title">Total P&L</span>
              <span class={`perf-val ${totalPnLWeek() >= 0 ? 'up' : 'down'}`}>
                {totalPnLWeek() >= 0 ? '+' : ''}{formatINR(totalPnLWeek())} ({totalPnLWeek() >= 0 ? '+' : ''}{totalPnLWeekPct().toFixed(2)}%)
              </span>
            </div>
            <div class="perf-chart-wrapper" ref={perfChartContainerRef}>
              <canvas ref={perfChartRef} class="perf-canvas"></canvas>
            </div>
            <div class="perf-metrics-grid">
              <div class="perf-metric-box">
                <span class="perf-box-lbl">Best Trade</span>
                <span class="perf-box-val up">+₹6,820.00</span>
              </div>
              <div class="perf-metric-box">
                <span class="perf-box-lbl">Worst Trade</span>
                <span class="perf-box-val down">-₹2,150.00</span>
              </div>
              <div class="perf-metric-box">
                <span class="perf-box-lbl">Profit Factor</span>
                <span class="perf-box-val font-semibold">2.18</span>
              </div>
              <div class="perf-metric-box">
                <span class="perf-box-lbl">Max Drawdown</span>
                <span class="perf-box-val down">-₹3,120.50</span>
              </div>
            </div>
          </div>

          {/* Market Breadth Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Market Breadth</span>
            </div>
            <div class="breadth-body">
              <canvas ref={breadthCanvasRef} class="breadth-canvas"></canvas>
              <div class="breadth-legend">
                <div class="legend-row">
                  <span class="legend-dot green"></span>
                  <span class="legend-lbl">Advancing</span>
                  <span class="legend-val up font-semibold">1,623 (63%)</span>
                </div>
                <div class="legend-row">
                  <span class="legend-dot red"></span>
                  <span class="legend-lbl">Declining</span>
                  <span class="legend-val down font-semibold">812 (32%)</span>
                </div>
                <div class="legend-row">
                  <span class="legend-dot gray"></span>
                  <span class="legend-lbl">Unchanged</span>
                  <span class="legend-val font-semibold">125 (5%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3 (Right) */}
        <div class="db-col col-3">
          {/* Watchlist / Movers Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <div class="panel-header-left">
                <div class="watchlist-tab-bar">
                  <button
                    class={`wl-tab-btn ${activeWatchlistTab() === 'watchlist' ? 'active' : ''}`}
                    onClick={() => setActiveWatchlistTab('watchlist')}
                  >
                    My Watchlist
                  </button>
                  <button
                    class={`wl-tab-btn ${activeWatchlistTab() === 'gainers' ? 'active' : ''}`}
                    onClick={() => setActiveWatchlistTab('gainers')}
                  >
                    Top Gainers
                  </button>
                </div>
              </div>
              <button class="view-all-btn">View All</button>
            </div>
            <div class="watchlist-items-list">
              <For each={watchlistItems()}>
                {(item) => (
                  <div class="wl-item-row">
                    <span class="wl-symbol-lbl">{item.name}</span>
                    <div class="wl-item-right">
                      <span class="wl-price-lbl font-mono">{item.price}</span>
                      <span class="wl-change-lbl font-mono" style={{ color: item.color }}>{item.change}</span>
                      <span class="wl-mini-trend-spark"></span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Positions Table Panel - LIVE DATA CONNECTED */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Positions ({getPositions().length})</span>
              <button class="view-all-btn">View All</button>
            </div>
            <div class="positions-list-wrapper">
              <table class="positions-list-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Avg</th>
                    <th>LTP</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={getPositions()} fallback={
                    <tr>
                      <td colspan="6" class="no-positions-lbl">No open positions in Kotak Neo</td>
                    </tr>
                  }>
                    {(pos) => (
                      <tr>
                        <td class="font-bold">{pos.inst}</td>
                        <td><span class="prod-badge">{pos.prod}</span></td>
                        <td class="font-mono">{pos.qty}</td>
                        <td class="font-mono">{pos.avg.toFixed(2)}</td>
                        <td class="font-mono">{pos.ltp.toFixed(2)}</td>
                        <td class={`font-mono ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <Show when={getPositions().length > 0}>
                <div class="positions-total-bar">
                  <span>Total P&L</span>
                  <span class={`total-pnl-val font-semibold ${totalPnL() >= 0 ? 'up' : 'down'}`}>
                    {totalPnL() >= 0 ? '+' : ''}{formatINR(totalPnL())} (+{totalPnLPct().toFixed(2)}%)
                  </span>
                </div>
              </Show>
            </div>
          </div>

          {/* Alerts & Events / Upcoming */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Alerts & Events</span>
            </div>
            <div class="alerts-list-body">
              <div class="alert-event-item">
                <span class="alert-icon">⚠️</span>
                <div class="alert-item-body">
                  <p class="alert-text font-semibold">NIFTY 23 MAY 22500 CE is above VWAP</p>
                  <span class="alert-time">09:32 AM</span>
                </div>
              </div>
              <div class="alert-event-item">
                <span class="alert-icon">⚠️</span>
                <div class="alert-item-body">
                  <p class="alert-text font-semibold">Bank Nifty near resistance 48,500</p>
                  <span class="alert-time">09:28 AM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div class="db-panel-cell">
            <div class="panel-header-new">
              <span class="panel-title-new">Quick Actions</span>
            </div>
            <div class="actions-grid-new">
              <button class="action-btn-new" onClick={() => navigateToTab('orders')}>New Order</button>
              <button class="action-btn-new" onClick={() => navigateToTab('orders')}>Basket Order</button>
              <button class="action-btn-new" onClick={() => navigateToTab('strategy')}>Strategy Builder</button>
              <button class="action-btn-new" onClick={() => navigateToTab('option-chain')}>Option Chain</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
