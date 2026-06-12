import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, squareOffRealPosition } from '../../store/tradingStore';
import { OrderModal } from '../../components/OrderModal';
import './positions.css';

export const PositionsPage: Component = () => {
  const [activeTab, setActiveTab] = createSignal('open');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showOrderModal, setShowOrderModal] = createSignal(false);
  const [orderModalSym, setOrderModalSym] = createSignal('');
  const [orderModalSide, setOrderModalSide] = createSignal<'Buy' | 'Sell'>('Buy');
  const [squaringOff, setSquaringOff] = createSignal<string | null>(null);
  
  // Track selected position for the dynamic right panel
  const [selectedKey, setSelectedKey] = createSignal<string | null>(null);
  const selectedPosition = () => {
    const key = selectedKey();
    if (!key) return null;
    return getPositions().find(p => p.inst === key) || null;
  };

  const openAddPosition = (inst: string, side: 'Buy' | 'Sell') => {
    setOrderModalSym(inst);
    setOrderModalSide(side);
    setShowOrderModal(true);
  };

  const handleSquareOff = async (pos: any) => {
    setSquaringOff(pos.inst);
    await squareOffRealPosition(pos);
    setSquaringOff(null);
  };



  // Canvas refs for charts
  let trendCanvasRef!: HTMLCanvasElement;
  let trendContainerRef!: HTMLDivElement;
  let summaryCanvasRef!: HTMLCanvasElement;

  const getPositions = () => store.positions;

  const filteredPositions = () => {
    let list = getPositions();

    // Tab filter
    if (activeTab() === 'open') {
      list = list.filter(p => p.qty !== 0);
    } else if (activeTab() === 'closed') {
      list = list.filter(p => p.qty === 0);
    }

    // Search filter
    const query = searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(p => p.inst.toLowerCase().includes(query));
  };

  // Summary Metrics calculations
  const summaryMetrics = () => {
    const list = getPositions();
    const longPos = list.filter(p => p.qty > 0);
    const shortPos = list.filter(p => p.qty < 0);

    const longCount = longPos.length;
    const longVal = longPos.reduce((sum, p) => sum + (p.ltp * p.qty), 0);

    const shortCount = shortPos.length;
    const shortVal = shortPos.reduce((sum, p) => sum + (p.ltp * Math.abs(p.qty)), 0);

    const netExposure = longVal - shortVal;
    const total = longVal + shortVal;

    return {
      longCount,
      longVal,
      shortCount,
      shortVal,
      netExposure,
      total
    };
  };

  const drawTrendChart = () => {
    if (!trendCanvasRef || !trendContainerRef) return;
    const ctx = trendCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = trendContainerRef.clientWidth;
    const height = trendContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    trendCanvasRef.width = width * dpi;
    trendCanvasRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = store.settings.theme === 'dark';
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = isDark ? '#1f1f23' : '#f3f4f6';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Bezier line path matching the screenshot
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    const points = [15, 30, 25, 45, 60, 48, 40, 65, 80, 75, 95, 85, 105, 120, 115, 135];
    const step = width / (points.length - 1);
    
    ctx.moveTo(0, height - points[0]);
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = step * i;
      const y1 = height - points[i];
      const x2 = step * (i + 1);
      const y2 = height - points[i + 1];
      const xc = (x1 + x2) / 2;
      const yc = (y1 + y2) / 2;
      ctx.quadraticCurveTo(x1, y1, xc, yc);
    }
    ctx.lineTo(width, height - points[points.length - 1]);
    ctx.stroke();
 
    // Area Gradient Fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.06)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.fillStyle = grad;
    
    // Complete the closed area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Draw little circle points at peaks
    ctx.fillStyle = '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const peakIndices = [4, 8, 13, 15]; // peak index points
    peakIndices.forEach(idx => {
      const px = step * idx;
      const py = height - points[idx];
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw time labels at the bottom
    ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
    ctx.font = '9px var(--sys-font-body)';
    ctx.textAlign = 'center';
    const labels = ['09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30'];
    const labelStep = width / (labels.length - 1);
    labels.forEach((lbl, idx) => {
      // Draw every 2nd label to avoid overlapping
      if (idx % 2 === 0) {
        ctx.fillText(lbl, labelStep * idx, height - 4);
      }
    });
  };

  const drawSummaryDonut = () => {
    if (!summaryCanvasRef) return;
    const ctx = summaryCanvasRef.getContext('2d');
    if (!ctx) return;

    const size = 95;
    const dpi = window.devicePixelRatio || 1;
    summaryCanvasRef.width = size * dpi;
    summaryCanvasRef.height = size * dpi;
    ctx.scale(dpi, dpi);

    const center = size / 2;
    const radius = 34;
    const thickness = 9;

    const isDark = store.settings.theme === 'dark';
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const metrics = summaryMetrics();
    const total = metrics.total;

    // Default mock slices if total is 0
    let longRatio = 0.75;
    let shortRatio = 0.25;

    if (total > 0) {
      longRatio = metrics.longVal / total;
      shortRatio = metrics.shortVal / total;
    }

    const angles = [longRatio * Math.PI * 2, shortRatio * Math.PI * 2];
    const colors = ['#3b82f6', '#f43f5e'];

    let startAngle = -Math.PI / 2;
    for (let i = 0; i < angles.length; i++) {
      if (angles[i] <= 0) continue;
      ctx.beginPath();
      ctx.arc(center, center, radius, startAngle, startAngle + angles[i]);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.stroke();
      startAngle += angles[i];
    }
  };

  const handleResize = () => {
    drawTrendChart();
    drawSummaryDonut();
  };

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  createEffect(() => {
    store.settings.theme;
    store.positions.length;
    // Re-draw on state triggers
    setTimeout(handleResize, 100);
  });

  // Derived formats
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
    return 24350.75; // exact value from user's screen
  };

  const totalPnLPct = () => {
    if (isLive()) {
      const margin = store.margins.available + store.margins.used;
      return margin > 0 ? (totalPnL() / margin) * 100 : 0;
    }
    return 1.42;
  };

  const dayPnL = () => {
    if (isLive()) {
      return totalPnL();
    }
    return 18270.50; // exact value from user's screen
  };

  const dayPnLPct = () => {
    if (isLive()) {
      return totalPnLPct();
    }
    return 1.08; // exact value from user's screen
  };

  const marginUsedVal = () => {
    if (isLive()) {
      return store.margins.used;
    }
    return 171450.00;
  };

  const marginAvailableVal = () => {
    if (isLive()) {
      return store.margins.available;
    }
    return 228350.50;
  };

  const totalPositionsPnL = () => filteredPositions().reduce((acc, p) => acc + p.pnl, 0);

  return (
    <div class="pos-split-layout">
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        defaultSymbol={orderModalSym()}
        defaultSide={orderModalSide()}
      />
      {/* Title Header */}
      <div class="pos-title-header">
        <div class="pos-title-left">
          <h1 class="pos-title-text">Positions</h1>
          <p class="pos-sub-text">Track your live positions and overall exposure</p>
        </div>
        <div class="pos-header-actions-right">
          <Show when={store.paperTradeMode}>
            <span style={{ background: 'var(--theme-color-neutral-bg)', color: 'var(--theme-color-neutral)', padding: '4px 10px', 'border-radius': '20px', 'font-size': '11px', 'font-weight': '700' }}>📝 PAPER</span>
          </Show>
          <div class="pos-tab-bar">
            <button class={`pos-tab-btn ${activeTab() === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
            <button class={`pos-tab-btn ${activeTab() === 'open' ? 'active' : ''}`} onClick={() => setActiveTab('open')}>Open</button>
            <button class={`pos-tab-btn ${activeTab() === 'closed' ? 'active' : ''}`} onClick={() => setActiveTab('closed')}>Closed</button>
          </div>
          <button
            onClick={() => openAddPosition('NIFTY 50', 'Buy')}
            style={{ background: 'var(--theme-color-neutral)', color: '#fff', padding: '7px 14px', 'border-radius': '6px', 'font-weight': '700', 'font-size': '11px' }}
          >+ Add Position</button>
          <button class="pos-download-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
              <path d="M12 17V3M12 17L7 12M12 17L17 12M21 21H3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Row 1) */}
      <div class="pos-kpis-bar">
        {/* Card 1: Net P&L */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Net P&L</span>
          <span class={`kpi-val font-semibold ${totalPnL() >= 0 ? 'up' : 'down'}`}>
            {totalPnL() >= 0 ? '+' : ''}{formatINR(totalPnL())}
          </span>
          <div class="kpi-card-footer">
            <span class={`kpi-sub-lbl ${totalPnL() >= 0 ? 'up' : 'down'}`}>
              {totalPnL() >= 0 ? '+' : ''}{totalPnLPct().toFixed(2)}%
            </span>
            <div class="kpi-sparkline">
              <svg width="45" height="14" viewBox="0 0 45 14">
                <path d="M0,12 Q10,2 20,8 T45,1" fill="none" stroke="var(--theme-color-up)" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Day's P&L */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Day's P&L</span>
          <span class={`kpi-val font-semibold ${dayPnL() >= 0 ? 'up' : 'down'}`}>
            {dayPnL() >= 0 ? '+' : ''}{formatINR(dayPnL())}
          </span>
          <div class="kpi-card-footer">
            <span class={`kpi-sub-lbl ${dayPnL() >= 0 ? 'up' : 'down'}`}>
              {dayPnL() >= 0 ? '+' : ''}{dayPnLPct().toFixed(2)}%
            </span>
            <div class="kpi-sparkline">
              <svg width="45" height="14" viewBox="0 0 45 14">
                <path d="M0,10 Q12,1 25,9 T45,2" fill="none" stroke="var(--theme-color-up)" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Unrealized P&L */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Unrealized P&L</span>
          <span class={`kpi-val font-semibold ${totalPnL() >= 0 ? 'up' : 'down'}`}>
            {totalPnL() >= 0 ? '+' : ''}{formatINR(totalPnL())}
          </span>
          <span class={`kpi-sub-lbl ${totalPnL() >= 0 ? 'up' : 'down'}`}>
            {totalPnL() >= 0 ? '+' : ''}{totalPnLPct().toFixed(2)}%
          </span>
        </div>

        {/* Card 4: Realized P&L */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Realized P&L</span>
          <span class="kpi-val font-semibold up">+₹5,680.25</span>
        </div>

        {/* Card 5: Total Margin Used */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Total Margin Used</span>
          <span class="kpi-val font-semibold">{formatINR(marginUsedVal())}</span>
        </div>

        {/* Card 6: Available Margin */}
        <div class="pos-kpi-cell">
          <span class="kpi-lbl">Available Margin</span>
          <span class="kpi-val font-semibold">{formatINR(marginAvailableVal())}</span>
        </div>
      </div>

      {/* Main Grid Area Split */}
      <div class={`pos-split-body ${selectedKey() ? 'show-panel' : 'hide-panel'}`}>
        {/* Left Column (Table & Trend Chart) */}
        <div class="pos-left-col">
          <div class="pos-panel-main">
            {/* Filter table header */}
            <div class="pos-table-filter-header">
              <span class="pos-table-title">Open Positions ({filteredPositions().length})</span>
              <div class="pos-search-wrapper">
                <div class="pos-search-box">
                  <svg class="search-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21L16.65 16.65"/>
                  </svg>
                  <input
                    type="text"
                    class="pos-search-input"
                    placeholder="Search position"
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  />
                  <Show when={searchQuery().length > 0}>
                    <button class="clear-search-btn" onClick={() => setSearchQuery('')}>&times;</button>
                  </Show>
                </div>
                <button class="pos-table-filter-btn" title="Filters">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M4 6H20M4 12H14M4 18H9" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Positions Table */}
            <div class="pos-table-wrapper">
              <table class="pos-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Type</th>
                    <th>Qty / Lot</th>
                    <th>Avg. Price</th>
                    <th>LTP</th>
                    <th>Unrealized P&L</th>
                    <th>P&L %</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredPositions()} fallback={
                    <tr>
                      <td colspan="8" class="no-positions-lbl">No open positions found.</td>
                    </tr>
                  }>
                    {(pos) => {
                      const absoluteQty = Math.abs(pos.qty);
                      const isSell = pos.qty < 0;
                      
                      // Resolve change of underlying symbol
                      const sym = store.symbols[pos.inst];
                      const changeVal = sym ? sym.change : (pos.ltp - pos.avg);
                      
                      const isSelected = () => selectedKey() === pos.inst;
                      return (
                        <tr
                          class={isSelected() ? 'active-row' : ''}
                          onClick={() => setSelectedKey(pos.inst)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div class="pos-inst-box">
                              <span class="pos-inst-name font-bold">{pos.inst}</span>
                              <span class="pos-inst-sub">{pos.prod || 'Normal'}</span>
                            </div>
                          </td>
                          <td>
                            <span class={`side-badge-new ${isSell ? 'sell' : 'buy'}`}>
                              {isSell ? 'SELL' : 'BUY'}
                            </span>
                          </td>
                          <td class="font-mono">
                            <span class="pos-qty-main">{pos.qty}</span>
                            <span class="pos-lot-lbl"> ({Math.ceil(absoluteQty / 75)} Lot)</span>
                          </td>
                          <td class="font-mono">₹{pos.avg.toFixed(2)}</td>
                          <td class="font-mono">
                            <div class="pos-ltp-row">
                              <span class="pos-ltp-val">₹{pos.ltp.toFixed(2)}</span>
                              <span class={`pos-tick-dot ${changeVal >= 0 ? 'up' : 'down'}`}></span>
                            </div>
                            <span class={`pos-ltp-change ${changeVal >= 0 ? 'up' : 'down'}`}>
                              {changeVal >= 0 ? '+' : ''}{changeVal.toFixed(2)}
                            </span>
                          </td>
                          <td class={`font-mono ${pos.pnl >= 0 ? 'up' : 'down'} font-semibold`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td class={`font-mono ${pos.pnl >= 0 ? 'up' : 'down'} font-semibold`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pct.toFixed(2)}%
                          </td>
                          <td>
                            <div class="pos-act-cell">
                              <button
                                class="exit-pos-btn"
                                title="Square Off Position"
                                disabled={squaringOff() === pos.inst}
                                onClick={(e) => { e.stopPropagation(); handleSquareOff(pos); }}
                                style={{ opacity: squaringOff() === pos.inst ? 0.5 : 1 }}
                              >
                                {squaringOff() === pos.inst ? '...' : 'Exit'}
                              </button>
                              <button
                                title="Add to position"
                                onClick={(e) => { e.stopPropagation(); openAddPosition(pos.inst, pos.qty > 0 ? 'Buy' : 'Sell'); }}
                                style={{ background: 'var(--theme-color-neutral-bg)', color: 'var(--theme-color-neutral)', border: '1px solid var(--theme-color-neutral)', padding: '4px 8px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '700' }}
                              >+Add</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                  {/* Totals row */}
                  <Show when={filteredPositions().length > 0}>
                    <tr class="pos-totals-row">
                      <td colspan="5" class="font-bold">Total</td>
                      <td class={`font-mono font-bold ${totalPositionsPnL() >= 0 ? 'up' : 'down'}`}>
                        {totalPositionsPnL() >= 0 ? '+' : ''}{totalPositionsPnL().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td class={`font-mono font-bold ${totalPositionsPnL() >= 0 ? 'up' : 'down'}`}>
                        {totalPositionsPnL() >= 0 ? '+' : ''}{totalPnLPct().toFixed(2)}%
                      </td>
                      <td></td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            </div>
          </div>

          {/* Positions Trend Panel */}
          <div class="pos-panel-main">
            <div class="pos-table-filter-header">
              <span class="pos-table-title">Positions Trend</span>
              <div class="trend-tabs">
                <For each={['1D', '5D', '1M', '6M', 'YTD']}>
                  {(t) => (
                    <button class={`trend-tab-btn ${t === '1D' ? 'active' : ''}`}>{t}</button>
                  )}
                </For>
              </div>
            </div>
            <div class="trend-chart-wrapper" style={{ position: "relative" }}>
              <div class="trend-chart-container" ref={trendContainerRef}>
                <canvas ref={trendCanvasRef} class="trend-canvas"></canvas>
              </div>
              
              {/* Floating Tooltip Indicator from screenshot */}
              <div class="trend-floating-tooltip">
                <span class="tooltip-title">+{formatINR(totalPnL())}</span>
                <span class="tooltip-time">09:47 AM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div class="pos-right-col">
          <Show when={selectedPosition()}>
            {(pos) => {
              // Generate pseudo-random sparkline path for selected position
              const getSelectedChartPath = (instName: string) => {
                let hash = 0;
                for (let i = 0; i < instName.length; i++) {
                  hash = instName.charCodeAt(i) + ((hash << 5) - hash);
                }
                const points = [];
                const step = 220 / 19;
                for (let i = 0; i < 20; i++) {
                  const val = Math.abs(Math.sin(hash + i) * 30);
                  points.push(70 - val);
                }
                let path = `M 0,${points[0]}`;
                for (let i = 0; i < points.length - 1; i++) {
                  const x1 = step * i;
                  const y1 = points[i];
                  const x2 = step * (i + 1);
                  const y2 = points[i + 1];
                  const xc = (x1 + x2) / 2;
                  const yc = (y1 + y2) / 2;
                  path += ` Q ${x1},${y1} ${xc},${yc}`;
                }
                path += ` L 220,${points[points.length - 1]}`;
                return path;
              };

              // Retrieve matching symbol info if available
              const sym = () => store.symbols[pos().inst];
              const price = () => sym()?.price || pos().ltp;
              const change = () => sym()?.change || (pos().ltp - pos().avg);
              const pct = () => sym()?.pct || pos().pct;
              const up = () => sym() ? (sym().up ?? true) : (pos().pnl >= 0);
              const value = () => pos().ltp * Math.abs(pos().qty);

              return (
                <div class="pos-details-panel">
                  {/* Header Row */}
                  <div class="detail-header-row">
                    <div class="detail-title-box">
                      <h2 class="detail-title-main">{pos().inst}</h2>
                      <span class="detail-exchange-lbl">{pos().prod || 'MIS'} &bull; {pos().qty >= 0 ? 'BUY' : 'SELL'}</span>
                    </div>
                    <div class="detail-header-actions">
                      <button class="detail-close-btn" onClick={() => setSelectedKey(null)}>&times;</button>
                    </div>
                  </div>

                  {/* Price Summary Row */}
                  <div class="detail-price-row">
                    <span class="detail-ltp-val">₹{price().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span class={`detail-change-badge ${up() ? 'up' : 'down'}`}>
                      {change() >= 0 ? '+' : ''}{change().toFixed(2)} ({pct() >= 0 ? '+' : ''}{pct().toFixed(2)}%)
                    </span>
                  </div>

                  <div class="detail-market-state">
                    <span class="state-dot live"></span>
                    <span class="state-text">Live Position P&amp;L</span>
                    <span class={`font-mono font-bold ${pos().pnl >= 0 ? 'up' : 'down'}`} style={{ 'margin-left': 'auto', 'font-size': '12px' }}>
                      {pos().pnl >= 0 ? '+' : ''}{pos().pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Bid/Ask Quotes */}
                  <div class="bid-ask-box">
                    <div class="quote-side buy">
                      <div class="quote-header">
                        <span>Bid</span>
                        <span class="font-mono">₹{(price() - 0.05).toFixed(2)}</span>
                      </div>
                      <div class="quote-bar-wrapper">
                        <div class="quote-bar" style={{ width: "60%" }}></div>
                      </div>
                    </div>
                    <div class="quote-side sell">
                      <div class="quote-header">
                        <span>Ask</span>
                        <span class="font-mono">₹{(price() + 0.05).toFixed(2)}</span>
                      </div>
                      <div class="quote-bar-wrapper">
                        <div class="quote-bar" style={{ width: "40%" }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Position Details List */}
                  <div class="detail-metrics-grid">
                    <div class="metric-card">
                      <span class="metric-lbl">Avg. Cost</span>
                      <span class="metric-val font-mono">₹{pos().avg.toFixed(2)}</span>
                    </div>
                    <div class="metric-card">
                      <span class="metric-lbl">LTP</span>
                      <span class="metric-val font-mono">₹{pos().ltp.toFixed(2)}</span>
                    </div>
                    <div class="metric-card">
                      <span class="metric-lbl">Quantity</span>
                      <span class="metric-val font-mono">{pos().qty}</span>
                    </div>
                    <div class="metric-card">
                      <span class="metric-lbl">Value</span>
                      <span class="metric-val font-mono">₹{value().toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="metric-card">
                      <span class="metric-lbl">Realized P&amp;L</span>
                      <span class="metric-val font-mono">₹0.00</span>
                    </div>
                    <div class="metric-card">
                      <span class="metric-lbl">Product</span>
                      <span class="metric-val">{pos().prod}</span>
                    </div>
                  </div>

                  {/* Mini Chart */}
                  <div class="detail-chart-wrapper">
                    <div class="detail-svg-chart-container" style={{ height: "90px" }}>
                      <svg width="220" height="90" viewBox="0 0 220 90" preserveAspectRatio="none" class="detail-sparkline-svg">
                        <defs>
                          <linearGradient id="posAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color={up() ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)"} />
                            <stop offset="100%" stop-color={up() ? "rgba(16, 185, 129, 0.0)" : "rgba(244, 63, 94, 0.0)"} />
                          </linearGradient>
                        </defs>
                        
                        <line x1="0" y1="22" x2="220" y2="22" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />
                        <line x1="0" y1="45" x2="220" y2="45" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />
                        <line x1="0" y1="67" x2="220" y2="67" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />

                        <path d={`${getSelectedChartPath(pos().inst)} L 220,90 L 0,90 Z`} fill="url(#posAreaGrad)" />
                        <path d={getSelectedChartPath(pos().inst)} fill="none" stroke={up() ? "var(--theme-color-up)" : "var(--theme-color-down)"} stroke-width="1.8" />
                      </svg>
                    </div>
                  </div>

                  {/* Greek Risk Stats specific to position */}
                  <div class="greeks-box" style={{ background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border-light)', 'border-radius': '8px', padding: '10px' }}>
                    <span style={{ 'font-size': '11px', 'font-weight': '700', 'margin-bottom': '6px', display: 'block' }}>Risk &amp; Greeks</span>
                    <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '8px', 'font-size': '10px' }}>
                      <div style={{ display: 'flex', 'justify-content': 'space-between' }}><span style={{ color: 'var(--theme-text-muted)' }}>Delta</span><span class="font-mono font-semibold">+0.18</span></div>
                      <div style={{ display: 'flex', 'justify-content': 'space-between' }}><span style={{ color: 'var(--theme-text-muted)' }}>Gamma</span><span class="font-mono font-semibold">+0.02</span></div>
                      <div style={{ display: 'flex', 'justify-content': 'space-between' }}><span style={{ color: 'var(--theme-text-muted)' }}>Theta</span><span class="font-mono font-semibold">-450.20</span></div>
                      <div style={{ display: 'flex', 'justify-content': 'space-between' }}><span style={{ color: 'var(--theme-text-muted)' }}>Vega</span><span class="font-mono font-semibold">+680.50</span></div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div class="detail-order-actions">
                    <button class="order-btn buy" onClick={() => openAddPosition(pos().inst, 'Buy')}>Add Qty</button>
                    <button class="order-btn sell" onClick={() => handleSquareOff(pos())}>Square Off</button>
                  </div>

                  <div class="actions-pos-list" style={{ 'margin-top': '4px' }}>
                    <button class="pos-act-btn hedge" onClick={() => openAddPosition(pos().inst, 'Buy')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px; display: inline-block; vertical-align: middle;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Add Hedge
                    </button>
                    <button class="pos-act-btn convert">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px; display: inline-block; vertical-align: middle;">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                      </svg>
                      P&amp;L Analysis
                    </button>
                  </div>
                </div>
              );
            }}
          </Show>
        </div>
      </div>
    </div>
  );
};
