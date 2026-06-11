import { createSignal, onMount, onCleanup, createEffect, For, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import './reports.css';

interface ReportsPageProps {
  theme: () => 'dark' | 'light';
}

export const ReportsPage: Component<ReportsPageProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal('analysis');
  const [dateRange, setDateRange] = createSignal('1M');
  const [segment, setSegment] = createSignal('All');

  // Dynamic KPI Stats based on selected tab
  const statsForTab = () => {
    switch (activeTab()) {
      case 'analysis':
        return [
          { label: 'Net Realized PnL', val: '+₹12,458.75', highlight: 'up', desc: 'After charges' },
          { label: 'Total Trades', val: '126', highlight: 'neutral', desc: '82 Wins / 44 Losses' },
          { label: 'Win Rate', val: '65.08%', highlight: 'up', desc: 'Consistent performance' },
          { label: 'Profit Factor', val: '2.15', highlight: 'neutral', desc: 'Gross Profit / Gross Loss' },
        ];
      case 'pl':
        return [
          { label: 'Realized P&L', val: '+₹12,458.75', highlight: 'up', desc: 'Gross closed positions' },
          { label: 'Unrealized P&L', val: '+₹850.00', highlight: 'up', desc: 'Active open positions' },
          { label: 'Total Charges', val: '₹620.00', highlight: 'down', desc: 'Brokerage & taxes' },
          { label: 'Net Realized P&L', val: '+₹11,838.75', highlight: 'up', desc: 'Net gains' },
        ];
      case 'performance':
        return [
          { label: 'Profit Factor', val: '2.15', highlight: 'neutral', desc: 'Gross wins / Gross losses' },
          { label: 'Win Rate', val: '65.08%', highlight: 'up', desc: '82 Wins / 44 Losses' },
          { label: 'Max Drawdown', val: '-₹2,500.00', highlight: 'down', desc: 'Peak to trough decline' },
          { label: 'Sharpe Ratio', val: '2.85', highlight: 'up', desc: 'Risk-adjusted returns' },
        ];
      case 'tax':
        return [
          { label: 'Short Term Capital Gains', val: '+₹10,500.00', highlight: 'up', desc: 'Asset holding < 1 year' },
          { label: 'Long Term Capital Gains', val: '+₹1,958.75', highlight: 'up', desc: 'Asset holding > 1 year' },
          { label: 'Taxable P&L', val: '+₹12,458.75', highlight: 'up', desc: 'Subject to capital gains tax' },
          { label: 'Estimated Tax', val: '₹3,737.63', highlight: 'down', desc: 'Estimated STCG & LTCG liability' },
        ];
      case 'ledger':
        return [
          { label: 'Opening Balance', val: '₹1,12,560.65', highlight: 'neutral', desc: 'Beginning of period' },
          { label: 'Funds Added/Withdrawn', val: '+₹25,000.00', highlight: 'up', desc: 'Deposits net of withdrawals' },
          { label: 'Margin Blocked', val: '₹45,000.00', highlight: 'down', desc: 'Used for active positions' },
          { label: 'Closing Balance', val: '₹1,42,458.75', highlight: 'up', desc: 'Available balance' },
        ];
      default:
        return [];
    }
  };

  // Stable procedural data points for PnL Equity Curve
  const pnlData = [
    0, 250, 150, 480, 390, 720, 610, 950, 840, 1200, 
    1050, 1420, 1310, 1750, 1600, 2050, 1920, 2300, 2150, 2600,
    2400, 2950, 2750, 3300, 3150, 3750, 3550, 4200, 3950, 4600,
    4400, 5100, 4900, 5650, 5400, 6200, 5950, 6800, 6500, 7400,
    7100, 8100, 7800, 8900, 8600, 9800, 9500, 10800, 10400, 12458.75
  ];

  const mockTrades = [
    { date: '2026-06-10 14:25:02', inst: 'NIFTY 50 24200 CE', side: 'Buy', qty: 50, buyAvg: 120.45, sellAvg: 145.20, pnl: 1237.50, charges: 58.40, status: 'Closed' },
    { date: '2026-06-10 11:05:14', inst: 'BANKNIFTY 52100 PE', side: 'Sell', qty: 15, buyAvg: 230.15, sellAvg: 195.40, pnl: 521.25, charges: 42.10, status: 'Closed' },
    { date: '2026-06-09 15:12:35', inst: 'RELIANCE', side: 'Buy', qty: 25, buyAvg: 2950.00, sellAvg: 2985.45, pnl: 886.25, charges: 92.50, status: 'Closed' },
    { date: '2026-06-09 09:45:00', inst: 'INFY', side: 'Sell', qty: 50, buyAvg: 1630.00, sellAvg: 1618.50, pnl: 575.00, charges: 61.20, status: 'Closed' },
    { date: '2026-06-08 14:55:20', inst: 'HDFCBANK', side: 'Buy', qty: 100, buyAvg: 1742.00, sellAvg: 1756.30, pnl: 1430.00, charges: 112.80, status: 'Closed' },
    { date: '2026-06-08 10:30:10', inst: 'TCS', side: 'Buy', qty: 10, buyAvg: 4110.00, sellAvg: 4092.00, pnl: -180.00, charges: 45.30, status: 'Closed' },
    { date: '2026-06-05 13:14:02', inst: 'NIFTY 50 24100 PE', side: 'Buy', qty: 100, buyAvg: 85.00, sellAvg: 112.50, pnl: 2750.00, charges: 78.60, status: 'Closed' }
  ];

  const plSegmentData = [
    { segment: 'Equity FNO', realized: 7600.00, unrealized: 0.00, charges: 345.80, net: 7254.20 },
    { segment: 'Equity Delivery', realized: 3450.00, unrealized: 850.00, charges: 112.50, net: 4187.50 },
    { segment: 'Currency FNO', realized: 1408.75, unrealized: 0.00, charges: 51.20, net: 1357.55 },
    { segment: 'Commodity FNO', realized: 0.00, unrealized: 0.00, charges: 0.00, net: 0.00 }
  ];

  const perfStats = [
    { metric: 'Profit Factor', value: '2.15', desc: 'Gross profits divided by gross losses. A value above 2.0 is excellent.' },
    { metric: 'Win Rate', value: '65.08%', desc: 'Percentage of trades closed with a profit (82 Wins out of 126 trades).' },
    { metric: 'Avg Winning Trade', value: '+₹820.50', desc: 'Average amount gained on profitable trades.' },
    { metric: 'Avg Losing Trade', value: '-₹380.20', desc: 'Average amount lost on unprofitable trades.' },
    { metric: 'Max Drawdown', value: '-₹2,500.00', desc: 'The largest peak-to-trough drop in account equity during this period.' },
    { metric: 'Sharpe Ratio', value: '2.85', desc: 'Risk-adjusted return measure. Above 2.0 indicates superior risk-reward performance.' },
    { metric: 'Recovery Factor', value: '4.98', desc: 'Net Profit divided by Max Drawdown. Higher ratio shows faster recovery.' }
  ];

  const taxLogs = [
    { inst: 'NIFTY 50 24200 CE', action: 'BUY', qty: 50, days: 0, realized: 1237.50, taxType: 'STCG (Business)', rate: '30%', estTax: 371.25 },
    { inst: 'BANKNIFTY 52100 PE', action: 'SELL', qty: 15, days: 0, realized: 521.25, taxType: 'STCG (Business)', rate: '30%', estTax: 156.38 },
    { inst: 'RELIANCE', action: 'BUY', qty: 25, days: 0, realized: 886.25, taxType: 'STCG', rate: '20%', estTax: 177.25 },
    { inst: 'HDFCBANK', action: 'BUY', qty: 100, days: 0, realized: 1430.00, taxType: 'STCG', rate: '20%', estTax: 286.00 },
    { inst: 'INFY', action: 'SELL', qty: 50, days: 0, realized: 575.00, taxType: 'STCG', rate: '20%', estTax: 115.00 },
    { inst: 'TCS', action: 'BUY', qty: 10, days: 0, realized: -180.00, taxType: 'STCG', rate: '20%', estTax: 0.00 }
  ];

  const ledgerLogs = [
    { date: '2026-06-10 18:30:00', desc: 'P&L Realized NIFTY 50 24200 CE', ref: 'TXN-99882', debit: 0.00, credit: 1179.10, bal: 142458.75 },
    { date: '2026-06-10 18:30:00', desc: 'P&L Realized BANKNIFTY 52100 PE', ref: 'TXN-99854', debit: 0.00, credit: 479.15, bal: 141279.65 },
    { date: '2026-06-09 18:30:00', desc: 'P&L Realized RELIANCE', ref: 'TXN-99801', debit: 0.00, credit: 793.75, bal: 140800.50 },
    { date: '2026-06-08 18:30:00', desc: 'P&L Realized TCS', ref: 'TXN-99723', debit: 225.30, credit: 0.00, bal: 140006.75 },
    { date: '2026-06-05 18:30:00', desc: 'P&L Realized NIFTY 50 24100 PE', ref: 'TXN-99650', debit: 0.00, credit: 2671.40, bal: 140232.05 },
    { date: '2026-06-01 11:15:00', desc: 'Funds Pay-in HDFC Bank', ref: 'BANK-IN-77621', debit: 0.00, credit: 25000.00, bal: 137560.65 },
    { date: '2026-05-31 00:00:00', desc: 'Opening Balance', ref: 'OPB-2026-05', debit: 0.00, credit: 0.00, bal: 112560.65 }
  ];

  // References for charts
  let lineCanvasRef!: HTMLCanvasElement;
  let lineContainerRef!: HTMLDivElement;

  let pieCanvasRef!: HTMLCanvasElement;
  let pieContainerRef!: HTMLDivElement;

  let plCanvasRef!: HTMLCanvasElement;
  let plContainerRef!: HTMLDivElement;

  let perfCanvasRef!: HTMLCanvasElement;
  let perfContainerRef!: HTMLDivElement;

  let animationFrameId: number;

  const drawLineChart = () => {
    if (!lineCanvasRef || !lineContainerRef) return;
    const ctx = lineCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = lineContainerRef.clientWidth;
    const height = lineContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    
    // Prevent ResizeObserver layout loops by only resetting sizes if they actually changed
    const targetW = Math.floor(width * dpi);
    const targetH = Math.floor(height * dpi);
    if (lineCanvasRef.width !== targetW || lineCanvasRef.height !== targetH) {
      lineCanvasRef.width = targetW;
      lineCanvasRef.height = targetH;
    }
    
    ctx.scale(dpi, dpi);
    const isDark = props.theme() === 'dark';

    // Clear background
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = isDark ? '#1f1f23' : '#f3f4f6';
    ctx.lineWidth = 1;

    const plotWidth = width - 50;
    const plotHeight = height - 25;

    // Horizontal grid
    const yCount = 4;
    for (let i = 0; i <= yCount; i++) {
      const y = (plotHeight / yCount) * i + 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
      ctx.font = '9px JetBrains Mono';
      const label = Math.round(12458.75 - (15000 / yCount) * i);
      ctx.fillText(`${label >= 0 ? '+' : ''}₹${label.toLocaleString('en-IN')}`, plotWidth + 6, y + 3);
    }

    // Border line
    ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
    ctx.beginPath();
    ctx.moveTo(plotWidth, 10);
    ctx.lineTo(plotWidth, plotHeight + 10);
    ctx.lineTo(0, plotHeight + 10);
    ctx.stroke();

    // Draw Stable Equity Curve Line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const minVal = Math.min(...pnlData);
    const maxVal = Math.max(...pnlData);
    const range = maxVal - minVal || 1;

    pnlData.forEach((val, idx) => {
      const x = (plotWidth / (pnlData.length - 1)) * idx;
      const y = plotHeight - ((val - minVal) / range) * (plotHeight - 20) + 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Faint Area Fill under the curve
    const grad = ctx.createLinearGradient(0, 10, 0, plotHeight + 10);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.fillStyle = grad;
    ctx.lineTo(plotWidth, plotHeight + 10);
    ctx.lineTo(0, plotHeight + 10);
    ctx.closePath();
    ctx.fill();
  };

  const drawPieChart = () => {
    if (!pieCanvasRef || !pieContainerRef) return;
    const ctx = pieCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = pieContainerRef.clientWidth;
    const height = pieContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    
    // Prevent ResizeObserver layout loops by only resetting sizes if they actually changed
    const targetW = Math.floor(width * dpi);
    const targetH = Math.floor(height * dpi);
    if (pieCanvasRef.width !== targetW || pieCanvasRef.height !== targetH) {
      pieCanvasRef.width = targetW;
      pieCanvasRef.height = targetH;
    }
    
    ctx.scale(dpi, dpi);
    const isDark = props.theme() === 'dark';

    // Clear background
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw Pie/Donut
    const centerX = width / 2;
    const centerY = height / 2 - 5;
    const radius = Math.min(width, height) * 0.32;

    const winAngle = 2 * Math.PI * 0.6508;

    // Green win arc
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, winAngle - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Red loss arc
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, winAngle - Math.PI / 2, 2 * Math.PI - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Cutout center for donut style
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.65, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    // Center text
    ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
    ctx.font = '700 13px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('65.1%', centerX, centerY + 4);
  };

  const drawPlChart = () => {
    if (!plCanvasRef || !plContainerRef) return;
    const ctx = plCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = plContainerRef.clientWidth;
    const height = plContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;

    const targetW = Math.floor(width * dpi);
    const targetH = Math.floor(height * dpi);
    if (plCanvasRef.width !== targetW || plCanvasRef.height !== targetH) {
      plCanvasRef.width = targetW;
      plCanvasRef.height = targetH;
    }

    ctx.scale(dpi, dpi);
    const isDark = props.theme() === 'dark';

    // Clear background
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Segment data
    const segments = [
      { name: 'Equity FNO', val: 7600.00 },
      { name: 'Equity Delivery', val: 3450.00 },
      { name: 'Currency FNO', val: 1408.75 },
      { name: 'Commodity FNO', val: 0.00 }
    ];

    const maxVal = 8000;
    const chartLeft = 110;
    const chartWidth = width - chartLeft - 60;
    const barHeight = 16;
    const barGap = 12;
    const startY = 15;

    segments.forEach((seg, idx) => {
      const y = startY + idx * (barHeight + barGap);

      // Label text
      ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
      ctx.font = '600 10px Outfit';
      ctx.textAlign = 'left';
      ctx.fillText(seg.name, 10, y + barHeight / 2 + 3);

      // Background track
      ctx.fillStyle = isDark ? '#161618' : '#f4f4f5';
      ctx.beginPath();
      ctx.roundRect(chartLeft, y, chartWidth, barHeight, 3);
      ctx.fill();

      // Filled bar
      if (seg.val > 0) {
        const fillW = (seg.val / maxVal) * chartWidth;
        ctx.fillStyle = '#3b82f6'; // Premium Blue
        ctx.beginPath();
        ctx.roundRect(chartLeft, y, fillW, barHeight, 3);
        ctx.fill();

        // Value text next to the bar
        ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
        ctx.font = '700 9px JetBrains Mono';
        ctx.fillText(`+₹${seg.val.toLocaleString('en-IN')}`, chartLeft + fillW + 8, y + barHeight / 2 + 3);
      } else {
        // Zero value text
        ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
        ctx.font = '700 9px JetBrains Mono';
        ctx.fillText('₹0.00', chartLeft + 8, y + barHeight / 2 + 3);
      }
    });
  };

  const drawPerfChart = () => {
    if (!perfCanvasRef || !perfContainerRef) return;
    const ctx = perfCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = perfContainerRef.clientWidth;
    const height = perfContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;

    const targetW = Math.floor(width * dpi);
    const targetH = Math.floor(height * dpi);
    if (perfCanvasRef.width !== targetW || perfCanvasRef.height !== targetH) {
      perfCanvasRef.width = targetW;
      perfCanvasRef.height = targetH;
    }

    ctx.scale(dpi, dpi);
    const isDark = props.theme() === 'dark';

    // Clear background
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Performance Data (Daily P&L)
    const dailyPl = [
      { date: '05 Jun', val: 2671.40 },
      { date: '08 Jun', val: -180.00 },
      { date: '09 Jun', val: 1461.25 },
      { date: '10 Jun', val: 1758.75 },
      { date: '11 Jun', val: 6747.35 }
    ];

    const plotWidth = width - 40;
    const plotHeight = height - 40;
    const barWidth = 36;
    const barGap = (plotWidth - dailyPl.length * barWidth) / (dailyPl.length + 1);

    const maxVal = 7000;
    const minVal = -2000;
    const range = maxVal - minVal;

    // Calculate Y for baseline (value = 0)
    const baselineY = 15 + plotHeight - ((0 - minVal) / range) * plotHeight;

    // Draw horizontal zero line
    ctx.strokeStyle = isDark ? '#3f3f46' : '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, baselineY);
    ctx.lineTo(width - 10, baselineY);
    ctx.stroke();

    dailyPl.forEach((day, idx) => {
      const x = 15 + barGap + idx * (barWidth + barGap);
      const barHeightVal = (Math.abs(day.val) / range) * plotHeight;

      let y = baselineY;
      let drawH = barHeightVal;
      if (day.val >= 0) {
        y = baselineY - barHeightVal;
      } else {
        y = baselineY;
      }

      // Draw the bar
      ctx.fillStyle = day.val >= 0 ? '#10b981' : '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, drawH, 3);
      ctx.fill();

      // Draw date text
      ctx.fillStyle = isDark ? '#71717a' : '#71717a';
      ctx.font = '600 9px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(day.date, x + barWidth / 2, height - 10);

      // Draw P&L value text
      ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
      ctx.font = '700 9px JetBrains Mono';
      ctx.textAlign = 'center';
      const textY = day.val >= 0 ? y - 6 : y + drawH + 12;
      ctx.fillText(`${day.val >= 0 ? '+' : ''}${Math.round(day.val)}`, x + barWidth / 2, textY);
    });
  };

  const drawAllCharts = () => {
    drawLineChart();
    drawPieChart();
    drawPlChart();
    drawPerfChart();
  };

  const handleResize = () => {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(drawAllCharts);
  };

  onMount(() => {
    drawAllCharts();
    const observer1 = new ResizeObserver(handleResize);
    if (lineContainerRef) observer1.observe(lineContainerRef);
    if (pieContainerRef) observer1.observe(pieContainerRef);
    if (plContainerRef) observer1.observe(plContainerRef);
    if (perfContainerRef) observer1.observe(perfContainerRef);
    
    onCleanup(() => {
      observer1.disconnect();
      cancelAnimationFrame(animationFrameId);
    });
  });

  createEffect(() => {
    activeTab();
    props.theme();
    requestAnimationFrame(() => {
      handleResize();
    });
  });

  const fmtCurrency = (v: number) => {
    return (v >= 0 ? '+' : '') + '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div class="rep-page-layout">
      {/* Title & Filters Row */}
      <div class="rep-title-header">
        <div class="rep-title-box">
          <h1 class="rep-title-text">Reports & Analytics <span class="star-icon">☆</span></h1>
          <p class="rep-sub-text">Deep-dive trade reports, performance analysis, tax P&L audit logs and ledger audits.</p>
        </div>
        
        {/* Modern Filter bar */}
        <div class="rep-filters-row">
          <div class="rep-pills-group">
            <For each={['1W', '1M', '3M', 'All']}>
              {(range) => (
                <button 
                  class={`rep-filter-pill ${dateRange() === range ? 'active' : ''}`}
                  onClick={() => setDateRange(range)}
                >
                  {range}
                </button>
              )}
            </For>
          </div>

          <div class="rep-pills-group">
            <For each={['All', 'Equity', 'FNO']}>
              {(seg) => (
                <button 
                  class={`rep-filter-pill ${segment() === seg ? 'active' : ''}`}
                  onClick={() => setSegment(seg)}
                >
                  {seg}
                </button>
              )}
            </For>
          </div>
          
          <button class="rep-date-picker-box">
            📅 Custom Range
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div class="rep-tabs-row">
        <button class={`tab-btn-ord ${activeTab() === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>Trade Analysis</button>
        <button class={`tab-btn-ord ${activeTab() === 'pl' ? 'active' : ''}`} onClick={() => setActiveTab('pl')}>P&L Report</button>
        <button class={`tab-btn-ord ${activeTab() === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>Performance</button>
        <button class={`tab-btn-ord ${activeTab() === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>Tax P&L</button>
        <button class={`tab-btn-ord ${activeTab() === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>Ledger</button>
      </div>

      <div class="rep-body-scroller">
        {/* KPI Cards Row */}
        <div class="rep-kpis-grid">
          <For each={statsForTab()}>
            {(stat) => (
              <div class="rep-kpi-card">
                <span class="rep-kpi-label">{stat.label}</span>
                <span class={`rep-kpi-val ${stat.highlight === 'up' ? 'up' : stat.highlight === 'down' ? 'down' : ''}`}>{stat.val}</span>
                <span class="rep-kpi-desc">{stat.desc}</span>
              </div>
            )}
          </For>
        </div>

        {/* Charts Section */}
        {/* 1. Trade Analysis Tab Charts */}
        <div class="rep-charts-section" style={{ display: activeTab() === 'analysis' ? 'grid' : 'none' }}>
          {/* Equity Curve Card */}
          <div class="rep-chart-card-box">
            <div class="rep-card-header">
              <span class="rep-card-title">PnL Equity Curve (Cumulative)</span>
            </div>
            <div class="rep-canvas-container" ref={lineContainerRef}>
              <canvas class="rep-canvas-element" ref={lineCanvasRef}></canvas>
            </div>
          </div>

          {/* Win/Loss Ratio Card */}
          <div class="rep-chart-card-box">
            <div class="rep-card-header">
              <span class="rep-card-title">Win / Loss Ratio</span>
            </div>
            <div class="rep-canvas-container" ref={pieContainerRef}>
              <canvas class="rep-canvas-element" ref={pieCanvasRef}></canvas>
            </div>
            <div class="rep-chart-legends">
              <div class="legend-item">
                <span class="legend-dot green"></span>
                <span class="legend-text">Wins (82 trades)</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot red"></span>
                <span class="legend-text">Losses (44 trades)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. P&L Report Tab Chart */}
        <div class="rep-single-chart-section" style={{ display: activeTab() === 'pl' ? 'block' : 'none' }}>
          <div class="rep-chart-card-box" style={{ "min-height": "180px" }}>
            <div class="rep-card-header">
              <span class="rep-card-title">P&L Contribution by Trading Segment</span>
            </div>
            <div class="rep-canvas-container" ref={plContainerRef} style={{ "min-height": "100px" }}>
              <canvas class="rep-canvas-element" ref={plCanvasRef}></canvas>
            </div>
          </div>
        </div>

        {/* 3. Performance Tab Chart */}
        <div class="rep-single-chart-section" style={{ display: activeTab() === 'performance' ? 'block' : 'none' }}>
          <div class="rep-chart-card-box" style={{ "min-height": "220px" }}>
            <div class="rep-card-header">
              <span class="rep-card-title">Daily P&L Performance (Last 5 Trading Days)</span>
            </div>
            <div class="rep-canvas-container" ref={perfContainerRef} style={{ "min-height": "140px" }}>
              <canvas class="rep-canvas-element" ref={perfCanvasRef}></canvas>
            </div>
          </div>
        </div>

        {/* 4. Tax P&L Tab Chart (Progress bar) */}
        <div class="rep-single-chart-section" style={{ display: activeTab() === 'tax' ? 'block' : 'none' }}>
          <div class="rep-chart-card-box" style={{ "min-height": "110px", "justify-content": "center" }}>
            <div class="rep-card-header" style={{ "margin-bottom": "var(--sys-space-2)" }}>
              <span class="rep-card-title">Estimated Tax & Capital Gains Breakdown</span>
            </div>
            <div class="tax-breakdown-bar-container">
              <div class="tax-progress-bar">
                <div class="tax-bar-fill stcg" style={{ width: '70%', background: 'var(--theme-color-ai)' }}></div>
                <div class="tax-bar-fill ltcg" style={{ width: '15%', background: '#60a5fa' }}></div>
                <div class="tax-bar-fill charges" style={{ width: '15%', background: '#f43f5e' }}></div>
              </div>
              <div class="tax-progress-labels">
                <div class="tax-label-item">
                  <span class="legend-dot blue"></span>
                  <span>Short Term Gains (70%)</span>
                </div>
                <div class="tax-label-item">
                  <span class="legend-dot light-blue"></span>
                  <span>Long Term Gains (15%)</span>
                </div>
                <div class="tax-label-item">
                  <span class="legend-dot red"></span>
                  <span>Taxes & Charges (15%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Tables Section */}
        <div class="rep-table-section">
          <div class="rep-card-header" style={{ "border-bottom": "1px solid var(--theme-border-light)", "padding-bottom": "var(--sys-space-3)", "margin-bottom": "var(--sys-space-3)" }}>
            <span class="rep-card-title">
              {activeTab() === 'analysis' && 'Detailed Trade Audit Report'}
              {activeTab() === 'pl' && 'Segment-wise P&L Summary'}
              {activeTab() === 'performance' && 'Key Performance Statistics'}
              {activeTab() === 'tax' && 'Capital Gains & Tax Audit Log'}
              {activeTab() === 'ledger' && 'Account Ledger Statement'}
            </span>
          </div>

          <div class="rep-table-wrapper">
            <Switch>
              {/* 1. Trade Analysis Table */}
              <Match when={activeTab() === 'analysis'}>
                <table class="rep-data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Instrument</th>
                      <th>Action</th>
                      <th>Qty</th>
                      <th style={{ "text-align": "right" }}>Buy Avg</th>
                      <th style={{ "text-align": "right" }}>Sell Avg</th>
                      <th style={{ "text-align": "right" }}>Gross P&L</th>
                      <th style={{ "text-align": "right" }}>Charges</th>
                      <th style={{ "text-align": "right" }}>Net P&L</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={mockTrades}>
                      {(trade) => (
                        <tr>
                          <td class="font-mono">{trade.date}</td>
                          <td class="font-bold">{trade.inst}</td>
                          <td>
                            <span class={`side-badge ${trade.side.toLowerCase()}`}>
                              {trade.side.toUpperCase()}
                            </span>
                          </td>
                          <td class="font-mono">{trade.qty}</td>
                          <td class="font-mono" style={{ "text-align": "right" }}>₹{trade.buyAvg.toFixed(2)}</td>
                          <td class="font-mono" style={{ "text-align": "right" }}>₹{trade.sellAvg.toFixed(2)}</td>
                          <td class={`font-mono ${trade.pnl >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(trade.pnl)}
                          </td>
                          <td class="font-mono" style={{ "text-align": "right" }}>₹{trade.charges.toFixed(2)}</td>
                          <td class={`font-mono ${trade.pnl - trade.charges >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(trade.pnl - trade.charges)}
                          </td>
                          <td>
                            <span class="trade-status-tag">{trade.status}</span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>

              {/* 2. P&L Report Table */}
              <Match when={activeTab() === 'pl'}>
                <table class="rep-data-table">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th style={{ "text-align": "right" }}>Realized P&L</th>
                      <th style={{ "text-align": "right" }}>Unrealized P&L</th>
                      <th style={{ "text-align": "right" }}>Charges</th>
                      <th style={{ "text-align": "right" }}>Net P&L</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={plSegmentData}>
                      {(segData) => (
                        <tr>
                          <td class="font-bold">{segData.segment}</td>
                          <td class={`font-mono ${segData.realized >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(segData.realized)}
                          </td>
                          <td class={`font-mono ${segData.unrealized >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(segData.unrealized)}
                          </td>
                          <td class="font-mono" style={{ "text-align": "right" }}>₹{segData.charges.toFixed(2)}</td>
                          <td class={`font-mono ${segData.net >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(segData.net)}
                          </td>
                          <td>
                            <span class="trade-status-tag" style={{ background: segData.net >= 0 ? 'var(--theme-color-up-bg)' : 'var(--theme-color-down-bg)', color: segData.net >= 0 ? 'var(--theme-color-up)' : 'var(--theme-color-down)' }}>
                              {segData.net > 0 ? 'Profitable' : segData.net < 0 ? 'Loss' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>

              {/* 3. Performance Tab Table */}
              <Match when={activeTab() === 'performance'}>
                <table class="rep-data-table">
                  <thead>
                    <tr>
                      <th>Key Metric</th>
                      <th>Value</th>
                      <th>Performance Summary / Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={perfStats}>
                      {(stat) => (
                        <tr>
                          <td class="font-bold">{stat.metric}</td>
                          <td class="font-mono font-bold" style={{ color: 'var(--theme-color-ai)' }}>{stat.value}</td>
                          <td style={{ color: 'var(--theme-text-secondary)' }}>{stat.desc}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>

              {/* 4. Tax P&L Tab Table */}
              <Match when={activeTab() === 'tax'}>
                <table class="rep-data-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Action</th>
                      <th>Qty</th>
                      <th>Holding Days</th>
                      <th style={{ "text-align": "right" }}>Realized P&L</th>
                      <th>Tax Type</th>
                      <th>Rate</th>
                      <th style={{ "text-align": "right" }}>Est. Capital Gains Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={taxLogs}>
                      {(tax) => (
                        <tr>
                          <td class="font-bold">{tax.inst}</td>
                          <td>
                            <span class={`side-badge ${tax.action.toLowerCase()}`}>
                              {tax.action}
                            </span>
                          </td>
                          <td class="font-mono">{tax.qty}</td>
                          <td class="font-mono">{tax.days} days</td>
                          <td class={`font-mono ${tax.realized >= 0 ? 'up' : 'down'}`} style={{ "text-align": "right" }}>
                            {fmtCurrency(tax.realized)}
                          </td>
                          <td style={{ "font-size": "10px", "font-weight": "600" }}>{tax.taxType}</td>
                          <td class="font-mono">{tax.rate}</td>
                          <td class="font-mono font-semibold" style={{ "text-align": "right", color: tax.estTax > 0 ? 'var(--theme-color-down)' : 'var(--theme-text-muted)' }}>
                            ₹{tax.estTax.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>

              {/* 5. Ledger Statement Table */}
              <Match when={activeTab() === 'ledger'}>
                <table class="rep-data-table">
                  <thead>
                    <tr>
                      <th>Posting Date</th>
                      <th>Transaction Description</th>
                      <th>Ref Number</th>
                      <th style={{ "text-align": "right" }}>Debit (Dr)</th>
                      <th style={{ "text-align": "right" }}>Credit (Cr)</th>
                      <th style={{ "text-align": "right" }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={ledgerLogs}>
                      {(ledg) => (
                        <tr>
                          <td class="font-mono">{ledg.date}</td>
                          <td class="font-bold">{ledg.desc}</td>
                          <td class="font-mono">{ledg.ref}</td>
                          <td class="font-mono" style={{ "text-align": "right", color: ledg.debit > 0 ? 'var(--theme-color-down)' : 'inherit' }}>
                            {ledg.debit > 0 ? `₹${ledg.debit.toFixed(2)}` : '—'}
                          </td>
                          <td class="font-mono" style={{ "text-align": "right", color: ledg.credit > 0 ? 'var(--theme-color-up)' : 'inherit' }}>
                            {ledg.credit > 0 ? `₹${ledg.credit.toFixed(2)}` : '—'}
                          </td>
                          <td class="font-mono font-semibold" style={{ "text-align": "right" }}>
                            ₹{ledg.bal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </div>
  );
};

