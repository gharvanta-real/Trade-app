import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { store, addWatchlistItem, removeWatchlistItem } from '../../store/tradingStore';
import { OrderModal } from '../../components/OrderModal';
import './watchlist.css';

export const WatchlistPage: Component = () => {
  const [subTab, setSubTab] = createSignal('My Watchlist');
  const [activeFilter, setActiveFilter] = createSignal('All');
  const [query, setQuery] = createSignal('');
  
  // Track selected symbol key for the right-hand details panel
  const [selectedKey, setSelectedKey] = createSignal('NIFTY 50');
  const [chartInterval, setChartInterval] = createSignal('1D');
  const [isAutoRefresh, setIsAutoRefresh] = createSignal(true);

  const [showOrderModal, setShowOrderModal] = createSignal(false);
  const [orderModalSym, setOrderModalSym] = createSignal('');
  const [orderModalSide, setOrderModalSide] = createSignal<'Buy' | 'Sell'>('Buy');

  // Time clock for footer last updated
  const [lastUpdatedTime, setLastUpdatedTime] = createSignal(new Date().toLocaleTimeString('en-US', { hour12: false }));
  createEffect(() => {
    const t = setInterval(() => {
      if (isAutoRefresh()) {
        setLastUpdatedTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
      }
    }, 5000);
    onCleanup(() => clearInterval(t));
  });

  // Fetch all watchlist items from store
  const allItems = () => store.watchlist.map(key => {
    const sym = store.symbols[key];
    return {
      key,
      name: sym?.name || key,
      price: sym?.price || 0,
      change: sym?.change || 0,
      pct: sym?.pct || 0,
      up: sym?.up ?? true,
      type: sym?.type || 'Stock',
      volume: sym?.volume || '--',
      signal: sym?.signal || 'Neutral',
      open: sym?.open || 0,
      high: sym?.high || 0,
      low: sym?.low || 0,
      prevClose: sym?.prevClose || 0,
      oi: sym?.oi || '--'
    };
  });

  // Filter watchlist list
  const filteredItems = () => {
    let list = allItems();
    
    // Sub-tab filters
    if (subTab() === 'Indices') {
      list = list.filter(item => item.type === 'Index');
    } else if (subTab() === 'Options') {
      list = list.filter(item => item.type?.includes('Option'));
    } else if (subTab() === 'Stocks') {
      list = list.filter(item => item.type === 'Stock');
    }

    // Pill filters
    const filter = activeFilter();
    if (filter === 'Indices') {
      list = list.filter(item => item.type === 'Index');
    } else if (filter === 'Options') {
      list = list.filter(item => item.type?.includes('Option'));
    } else if (filter === 'Stocks') {
      list = list.filter(item => item.type === 'Stock');
    }

    // Search query filter
    const q = query().toLowerCase().trim();
    if (!q) return list;
    return list.filter(item => item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q));
  };

  const selectedItem = () => {
    const key = selectedKey();
    const sym = store.symbols[key];
    if (!sym) return allItems()[0] || null;
    return {
      key,
      name: sym.name || key,
      price: sym.price || 0,
      change: sym.change || 0,
      pct: sym.pct || 0,
      up: sym.up ?? true,
      type: sym.type || 'Stock',
      volume: sym.volume || '--',
      signal: sym.signal || 'Neutral',
      open: sym.open || 0,
      high: sym.high || 0,
      low: sym.low || 0,
      prevClose: sym.prevClose || 0,
      oi: sym.oi || '--'
    };
  };

  const handleAdd = () => {
    const q = query().trim();
    if (q) {
      addWatchlistItem(q);
      setQuery('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleTrade = (side: 'Buy' | 'Sell') => {
    const item = selectedItem();
    if (!item) return;
    setOrderModalSym(item.key);
    setOrderModalSide(side);
    setShowOrderModal(true);
  };

  // Generate dynamic SVG sparkline path
  const getSparklinePath = (item: any) => {
    // Generate a pseudo-random wave based on symbol name hash
    let hash = 0;
    for (let i = 0; i < item.key.length; i++) {
      hash = item.key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const points = [];
    const isUp = item.up;
    for (let i = 0; i < 8; i++) {
      const val = Math.abs(Math.sin(hash + i) * 12);
      points.push(isUp ? (16 - val) : (4 + val));
    }
    return `M 0,${points[0]} Q 5,${points[1]} 10,${points[2]} T 20,${points[3]} T 30,${points[4]} T 40,${points[5]} T 50,${points[6]} T 60,${points[7]}`;
  };

  // Generate detailed selected chart SVG path
  const getSelectedChartPath = (item: any) => {
    if (!item) return '';
    let hash = 0;
    for (let i = 0; i < item.key.length; i++) {
      hash = item.key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const points = [];
    const step = 220 / 19;
    const isUp = item.up;
    for (let i = 0; i < 20; i++) {
      const val = Math.abs(Math.sin(hash + i) * 60);
      points.push(isUp ? (120 - val) : (20 + val));
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

  // Return dynamic AI analysis text
  const getAIInsight = (item: any) => {
    if (!item) return '';
    if (item.signal.includes('Bullish')) {
      return `Strong call buying seen at ${item.name} strike. Price holding above VWAP with rising volume. Momentum likely to continue in the short term.`;
    } else if (item.signal.includes('Bearish')) {
      return `Sellers dominating at ${item.name}. Volume profiles show heavy distribution at highs. Expect further downward pressure.`;
    }
    return `Consolidation pattern detected for ${item.name}. Light volume and tight trading range. Wait for breakout before taking positions.`;
  };

  // Star state tracking (mock toggle)
  const [starredItems, setStarredItems] = createSignal<Record<string, boolean>>({
    'NIFTY 50': true,
    'BANKNIFTY': true,
    'FINNIFTY': true,
    'NIFTY 23 May 24 22500 CE': true
  });
  const toggleStar = (key: string, e: Event) => {
    e.stopPropagation();
    setStarredItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div class="wl-split-layout">
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        defaultSymbol={orderModalSym()}
        defaultSide={orderModalSide()}
      />
      {/* Left Column (Table & Filters) */}
      <div class="wl-left-col">
        {/* Watchlist Main Header */}
        <div class="wl-header-bar">
          <div class="wl-title-box">
            <h1 class="wl-title-text">
              Watchlist
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="wl-star-title-icon">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </h1>
            <p class="wl-subtitle-text">Track your favorite indices, options, futures, and stocks in real time</p>
          </div>
        </div>

        {/* Sub-tabs Row */}
        <div class="wl-subtabs-row">
          <div class="wl-subtabs-left">
            <For each={['My Watchlist', 'Indices', 'Options', 'Futures', 'Stocks', 'Movers']}>
              {(tab) => (
                <button
                  class={`wl-subtab-btn ${subTab() === tab ? 'active' : ''}`}
                  onClick={() => setSubTab(tab)}
                >
                  {tab}
                </button>
              )}
            </For>
          </div>
          <div class="wl-subtabs-right">
            <button class="wl-action-pill">+ Create List</button>
            <button class="wl-action-pill">Import Symbols</button>
            <button class="wl-action-icon-btn">⚙</button>
            <button class="wl-action-icon-btn active">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button class="wl-action-icon-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Pills and Search Row */}
        <div class="wl-filter-pills-row">
          <div class="wl-pills-left">
            <div class="wl-search-box">
              <input
                type="text"
                placeholder="Search & add symbol"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
              <svg class="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21L16.65 16.65"/>
              </svg>
            </div>
            
            <For each={['All', 'Indices', 'Options', 'Stocks']}>
              {(filterName) => {
                const count = filterName === 'All' ? allItems().length : allItems().filter(i => filterName === 'Options' ? i.type.includes('Option') : i.type === filterName).length;
                return (
                  <button
                    class={`wl-pill-btn ${activeFilter() === filterName ? 'active' : ''}`}
                    onClick={() => setActiveFilter(filterName)}
                  >
                    {filterName} ({count})
                  </button>
                );
              }}
            </For>
          </div>
          <div class="wl-pills-right">
            <button class="wl-pill-action">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;">
                <path d="M4 6H20M4 12H14M4 18H9"/>
              </svg>
              Filters
            </button>
            <button class="wl-pill-action">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;">
                <path d="M11 5L6 10M6 10L1 5M6 10V22M13 19L18 14M18 14L23 19M18 14V2"/>
              </svg>
              Sort
            </button>
          </div>
        </div>

        {/* Watchlist Table list */}
        <div class="wl-table-wrapper">
          <table class="wl-table">
            <thead>
              <tr>
                <th style={{ width: "30px" }}></th>
                <th>Symbol</th>
                <th>Type</th>
                <th class="num-col">LTP</th>
                <th class="num-col">Change</th>
                <th class="num-col">Change %</th>
                <th class="num-col">Volume / OI</th>
                <th>Signal</th>
                <th style={{ width: "65px", "text-align": "center" }}>Trend</th>
                <th style={{ width: "65px", "text-align": "center" }}>Intraday</th>
                <th style={{ width: "35px" }}></th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredItems()} fallback={
                <tr>
                  <td colspan="11" class="no-watchlist-lbl">No symbols found in watchlist.</td>
                </tr>
              }>
                {(item) => {
                  const isStarred = () => starredItems()[item.key] || false;
                  const isSelected = () => selectedKey() === item.key;
                  
                  return (
                    <tr 
                      class={`wl-row ${isSelected() ? 'selected' : ''}`}
                      onClick={() => setSelectedKey(item.key)}
                    >
                      <td class="star-cell">
                        <button class={`star-btn ${isStarred() ? 'active' : ''}`} onClick={(e) => toggleStar(item.key, e)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={isStarred() ? "var(--sys-color-blue-500)" : "none"} stroke={isStarred() ? "var(--sys-color-blue-500)" : "currentColor"} stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                      </td>
                      <td>
                        <div class="symbol-name-box">
                          <span class="symbol-name-main font-bold">{item.name}</span>
                          <span class="symbol-exchange">NSE INDEX</span>
                        </div>
                      </td>
                      <td>
                        <span class="symbol-type-lbl">{item.type}</span>
                      </td>
                      <td class="num-col font-mono font-bold">
                        ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td class={`num-col font-mono ${item.up ? 'up' : 'down'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                      </td>
                      <td class={`num-col font-mono ${item.up ? 'up' : 'down'}`}>
                        {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
                      </td>
                      <td class="num-col font-mono text-muted">
                        {item.volume}
                      </td>
                      <td>
                        <span class={`signal-badge ${item.signal.toLowerCase().replace(' ', '-')}`}>
                          <span class="signal-dot"></span>
                          {item.signal}
                        </span>
                      </td>
                      <td style={{ "text-align": "center" }}>
                        <svg width="55" height="15" class="table-spark-svg">
                          <path d={getSparklinePath(item)} fill="none" stroke={item.up ? "var(--theme-color-up)" : "var(--theme-color-down)"} stroke-width="1.3" stroke-linecap="round" />
                        </svg>
                      </td>
                      <td style={{ "text-align": "center" }}>
                        <svg width="55" height="15" class="table-spark-svg">
                          <path d={getSparklinePath(item)} fill="none" stroke={item.up ? "var(--theme-color-up)" : "var(--theme-color-down)"} stroke-width="1.3" stroke-linecap="round" />
                        </svg>
                      </td>
                      <td>
                        <button class="wl-row-action-btn" onClick={(e) => { e.stopPropagation(); removeWatchlistItem(item.key); }} title="Remove symbol">
                          &times;
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>

        {/* Footer controls bar */}
        <div class="wl-footer-bar">
          <span class="wl-pagination-lbl">Showing 1 to {filteredItems().length} of {filteredItems().length} items</span>
          <div class="wl-footer-controls-center">
            <span class="wl-refresh-lbl">
              <span class={`wl-refresh-dot ${isAutoRefresh() ? 'on' : 'off'}`}></span>
              Auto-refresh
            </span>
            <button 
              class={`wl-refresh-toggle-btn ${isAutoRefresh() ? 'on' : ''}`}
              onClick={() => setIsAutoRefresh(!isAutoRefresh())}
            >
              <span class="toggle-slider"></span>
            </button>
            <span class="wl-toggle-state-text">{isAutoRefresh() ? 'On' : 'Off'}</span>
          </div>
          <span class="wl-last-updated-clock">
            Last updated: {lastUpdatedTime()}
            <svg class="refresh-icon-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 5px; vertical-align: middle; display: inline-block;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/>
            </svg>
          </span>
        </div>
      </div>

      {/* Right Column (Details Panel) */}
      <div class="wl-right-col">
        <Show when={selectedItem()} fallback={
          <div class="panel wl-details-panel empty">
            <p>Select a symbol to view key stats and chart</p>
          </div>
        }>
          {(item) => (
            <div class="panel wl-details-panel">
              {/* Detail Header */}
              <div class="detail-header-row">
                <div class="detail-title-box">
                  <h2 class="detail-title-main">{item().name}</h2>
                  <span class="detail-exchange-lbl">NFO &bull; {item().type}</span>
                </div>
                <div class="detail-header-actions">
                  <button class="detail-star-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                  <button class="detail-close-btn" onClick={() => setSelectedKey('')}>&times;</button>
                </div>
              </div>

              {/* Price Row */}
              <div class="detail-price-row">
                <span class="detail-ltp-val">₹{item().price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span class={`detail-change-badge ${item().up ? 'up' : 'down'}`}>
                  {item().change >= 0 ? '+' : ''}{item().change.toFixed(2)} ({item().pct >= 0 ? '+' : ''}{item().pct.toFixed(2)}%)
                </span>
              </div>
              <div class="detail-market-state">
                <span class="state-dot live"></span>
                <span class="state-text">Market Open</span>
                <span class="state-time">&bull; {lastUpdatedTime()}</span>
              </div>

              {/* Bid Ask Quotes Box */}
              <div class="bid-ask-box">
                <div class="quote-side buy">
                  <div class="quote-header">
                    <span>Bid (Qty: 75)</span>
                    <span class="font-mono">₹{(item().price - 0.15).toFixed(2)}</span>
                  </div>
                  <div class="quote-bar-wrapper">
                    <div class="quote-bar" style={{ width: "65%" }}></div>
                  </div>
                </div>
                <div class="quote-side sell">
                  <div class="quote-header">
                    <span>Ask (Qty: 75)</span>
                    <span class="font-mono">₹{(item().price + 0.05).toFixed(2)}</span>
                  </div>
                  <div class="quote-bar-wrapper">
                    <div class="quote-bar" style={{ width: "35%" }}></div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div class="detail-metrics-grid">
                <div class="metric-card">
                  <span class="metric-lbl">Open</span>
                  <span class="metric-val font-mono">₹{item().open.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-lbl">Prev. Close</span>
                  <span class="metric-val font-mono">₹{item().prevClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-lbl">High</span>
                  <span class="metric-val font-mono">₹{item().high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-lbl">Volume</span>
                  <span class="metric-val font-mono">{item().volume}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-lbl">Low</span>
                  <span class="metric-val font-mono">₹{item().low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="metric-card">
                  <span class="metric-lbl">OI</span>
                  <span class="metric-val font-mono">{item().oi}</span>
                </div>
              </div>

              {/* Interactive Area Chart wrapper */}
              <div class="detail-chart-wrapper">
                <div class="detail-chart-tabs">
                  <For each={['1D', '1W', '1M', '3M', '1Y']}>
                    {(interval) => (
                      <button 
                        class={`chart-tab-btn ${chartInterval() === interval ? 'active' : ''}`}
                        onClick={() => setChartInterval(interval)}
                      >
                        {interval}
                      </button>
                    )}
                  </For>
                </div>
                
                {/* SVG Area Chart Graphic */}
                <div class="detail-svg-chart-container">
                  <svg width="220" height="120" viewBox="0 0 220 120" preserveAspectRatio="none" class="detail-sparkline-svg">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color={item().up ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)"} />
                        <stop offset="100%" stop-color={item().up ? "rgba(16, 185, 129, 0.0)" : "rgba(244, 63, 94, 0.0)"} />
                      </linearGradient>
                    </defs>
                    
                    {/* Horizontal grid guide lines */}
                    <line x1="0" y1="30" x2="220" y2="30" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />
                    <line x1="0" y1="60" x2="220" y2="60" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />
                    <line x1="0" y1="90" x2="220" y2="90" stroke="var(--theme-border-light)" stroke-width="0.7" stroke-dasharray="3,3" />

                    {/* Gradient fill */}
                    <path d={`${getSelectedChartPath(item())} L 220,120 L 0,120 Z`} fill="url(#areaGrad)" />
                    
                    {/* Line path */}
                    <path d={getSelectedChartPath(item())} fill="none" stroke={item().up ? "var(--theme-color-up)" : "var(--theme-color-down)"} stroke-width="1.8" />
                  </svg>
                  
                  {/* Chart X axis times */}
                  <div class="detail-chart-timeline-labels">
                    <span>09:15</span>
                    <span>11:00</span>
                    <span>12:30</span>
                    <span>14:00</span>
                    <span>15:15</span>
                  </div>
                </div>
              </div>

              {/* Order Entry Buttons */}
              <div class="detail-order-actions">
                <button class="order-btn buy" onClick={() => handleTrade('Buy')}>Buy</button>
                <button class="order-btn sell" onClick={() => handleTrade('Sell')}>Sell</button>
              </div>

              {/* Action shortcuts */}
              <div class="detail-shortcuts-row">
                <button class="shortcut-btn">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  Add Alert
                </button>
                <button class="shortcut-btn">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                  </svg>
                  Open Chart
                </button>
                <button class="shortcut-btn">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  Add to Basket
                </button>
                <button class="shortcut-btn more">
                  &bull;&bull;&bull;
                </button>
              </div>

              {/* AI Insight Container */}
              <div class="detail-ai-insight-box">
                <div class="ai-insight-header">
                  <div class="ai-insight-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="sparks-icon">
                      <path d="M12 3v18M3 12h18M12 3l3 3M12 21l-3-3M3 12l3 3M21 12l-3-3"/>
                    </svg>
                    AI Insight
                  </div>
                  <span class="ai-insight-tag">
                    {item().signal.includes('Bullish') ? 'Bullish Momentum' : item().signal.includes('Bearish') ? 'Bearish Momentum' : 'Neutral State'}
                  </span>
                </div>
                <p class="ai-insight-body">{getAIInsight(item())}</p>
                <a href="#" class="ai-insight-link">
                  View Full Analysis
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:3px; display:inline-block; vertical-align:middle;">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};
