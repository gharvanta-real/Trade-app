import { createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { store, addWatchlistItem, removeWatchlistItem, searchInstruments, updateSymbolColorLabel, setActiveChartSymbol, navigateToTab, addNotification, placeRealOrder, setSelectedOrderId, fetchSymbolQuote } from '../../store/tradingStore';
import './watchlist.css';

export const WatchlistPage: Component = () => {
  const [subTab, setSubTab] = createSignal('My Watchlist');
  const [activeFilter, setActiveFilter] = createSignal('All');
  const [query, setQuery] = createSignal('');
  
  const [searchResults, setSearchResults] = createSignal<any[]>([]);
  const [viewMode, setViewMode] = createSignal<'list' | 'grid'>('list');
  const [customWatchlists, setCustomWatchlists] = createSignal<Record<string, string[]>>({});
  
  // Track selected symbol key for the right-hand details panel
  const [selectedKey, setSelectedKey] = createSignal('');
  const [chartInterval, setChartInterval] = createSignal('1D');
  const [isAutoRefresh, setIsAutoRefresh] = createSignal(true);

  // Dynamic tabs calculation
  const watchlistTabs = () => ['My Watchlist', 'Indices', 'Options', 'Futures', 'Stocks', 'Movers', ...Object.keys(customWatchlists())];

  const handleAddWatchlistItem = (symbol: string) => {
    const tab = subTab();
    const key = symbol.toUpperCase();
    if (customWatchlists()[tab]) {
      if (!customWatchlists()[tab].includes(key)) {
        setCustomWatchlists(prev => ({
          ...prev,
          [tab]: [...prev[tab], key]
        }));
        addNotification('Watchlist Update', `${symbol} added to ${tab}`, 'success');
      } else {
        addNotification('Watchlist Update', `${symbol} already in ${tab}`, 'info');
      }
    } else {
      addWatchlistItem(symbol);
    }
  };

  const handleDeleteWatchlistItem = (symbol: string) => {
    const tab = subTab();
    const key = symbol.toUpperCase();
    if (customWatchlists()[tab]) {
      setCustomWatchlists(prev => ({
        ...prev,
        [tab]: prev[tab].filter(k => k !== key)
      }));
      addNotification('Watchlist Update', `${symbol} removed from ${tab}`, 'info');
    } else {
      removeWatchlistItem(symbol);
    }
  };

  const handleImportSymbols = () => {
    const input = prompt("Enter comma-separated symbols to import (e.g. RELIANCE, TCS, INFY):");
    if (!input) return;
    const symbols = input.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    let count = 0;
    symbols.forEach(sym => {
      if (store.symbols[sym]) {
        handleAddWatchlistItem(sym);
        count++;
      } else {
        addNotification('Import Error', `Symbol ${sym} not found in database`, 'error');
      }
    });
    if (count > 0) {
      addNotification('Import Complete', `Successfully imported ${count} symbols to ${subTab()}`, 'success');
    }
  };

  const handleCreateList = () => {
    const name = prompt("Enter name for the new watchlist:");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (watchlistTabs().includes(trimmed)) {
      addNotification('Watchlist Error', 'Watchlist name already exists', 'error');
      return;
    }
    setCustomWatchlists(prev => ({
      ...prev,
      [trimmed]: []
    }));
    setSubTab(trimmed);
    addNotification('Watchlist Created', `New watchlist "${trimmed}" created successfully`, 'success');
  };

  // Right panel active tab mode & order state
  const [activePanelMode, setActivePanelMode] = createSignal<'details' | 'order'>('details');
  const [orderSide, setOrderSide] = createSignal<'Buy' | 'Sell'>('Buy');
  const [orderType, setOrderType] = createSignal<'Market' | 'Limit' | 'SL' | 'SL-M'>('Market');
  const [product, setProduct] = createSignal<'MIS' | 'NRML' | 'CNC'>('MIS');
  const [validity, setValidity] = createSignal<'DAY' | 'IOC'>('DAY');
  const [qty, setQty] = createSignal(1);
  const [lots, setLots] = createSignal(1);
  const [price, setPrice] = createSignal(0);
  const [triggerPrice, setTriggerPrice] = createSignal(0);
  const [amo, setAmo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const LOT_SIZES: Record<string, number> = {
    'NIFTY 50': 50, 'BANKNIFTY': 15, 'FINNIFTY': 40, 'MIDCPNIFTY': 75,
  };

  const EXCHANGE_MAP: Record<string, string> = {
    'NIFTY 50': 'nse_fo', 'BANKNIFTY': 'nse_fo', 'FINNIFTY': 'nse_fo', 'MIDCPNIFTY': 'nse_fo',
  };

  const lotSize = () => LOT_SIZES[selectedKey()] || store.symbols[selectedKey()]?.lotSize || 1;
  const ltp = () => store.symbols[selectedKey()]?.price || 0;
  const availableMargin = () => store.margins.available;

  const effectivePrice = () => orderType() === 'Market' ? ltp() : price();
  const totalValue = () => qty() * effectivePrice();
  const brokerage = () => Math.min(20, totalValue() * 0.0003);
  const sebi = () => totalValue() * 0.0001;
  const gst = () => (brokerage() + sebi()) * 0.18;
  const totalCharges = () => brokerage() + sebi() + gst();
  const netValue = () => orderSide() === 'Buy' ? totalValue() + totalCharges() : totalValue() - totalCharges();
  const isInsufficient = () => orderSide() === 'Buy' && availableMargin() > 0 && netValue() > availableMargin();

  createEffect(() => {
    const inst = selectedKey();
    if (!inst) return;
    const lp = store.symbols[inst]?.price || 0;
    setPrice(lp);
    setTriggerPrice(lp > 0 ? +(lp * (orderSide() === 'Buy' ? 0.995 : 1.005)).toFixed(2) : 0);
    setQty(lotSize());
    setLots(1);
  });

  const handleLotChange = (l: number) => {
    const n = Math.max(1, l);
    setLots(n);
    setQty(n * lotSize());
  };

  const handleQtyChange = (q: number) => {
    const n = Math.max(1, q);
    setQty(n);
    setLots(Math.ceil(n / lotSize()));
  };

  const handlePlaceOrder = async () => {
    if (loading()) return;
    setLoading(true);
    try {
      const result = await placeRealOrder({
        inst: selectedKey(),
        side: orderSide(),
        type: orderType(),
        qty: qty(),
        price: effectivePrice(),
        trigger: orderType() === 'SL' || orderType() === 'SL-M' ? triggerPrice() : 0,
        prod: product(),
        validity: validity(),
        amo: amo(),
        exchange: EXCHANGE_MAP[selectedKey()] || (selectedKey().includes('NIFTY') ? 'nse_fo' : 'nse_cm'),
      });
      if (result.success && result.orderId) {
        setSelectedOrderId(result.orderId);
        navigateToTab('orders');
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtINR = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  let searchContainerRef: HTMLDivElement | undefined;

  // Context Menu States
  const [activeMenuId, setActiveMenuId] = createSignal<string | null>(null);
  const [menuPosition, setMenuPosition] = createSignal<{ x: number, y: number }>({ x: 0, y: 0 });
  const [activeSubMenu, setActiveSubMenu] = createSignal<'watchlist' | 'color' | null>(null);

  // Close menus on outside clicks
  const handleOutsideClick = (e: MouseEvent) => {
    // 2. Close context menu if clicked outside of context menu
    const menuEl = document.querySelector('.wl-context-menu');
    if (menuEl && !menuEl.contains(e.target as Node)) {
      setActiveMenuId(null);
      setActiveSubMenu(null);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
    onCleanup(() => {
      document.removeEventListener('click', handleOutsideClick);
    });
  });

  // Fetch all watchlist items from store
  const allItems = () => {
    const tab = subTab();
    const keys = customWatchlists()[tab] || store.watchlist;
    return keys.map(key => {
      const sym = store.symbols[key];
      return {
        key,
        name: sym?.name || key,
        price: sym?.price || 0,
        change: sym?.change || 0,
        pct: sym?.pct || 0,
        up: sym?.up ?? true,
        type: sym?.type || 'Stock',
        exchange: sym?.exchange || 'NSE',
        volume: sym?.volume || '--',
        signal: sym?.signal || 'Neutral',
        open: sym?.open || 0,
        high: sym?.high || 0,
        low: sym?.low || 0,
        prevClose: sym?.prevClose || 0,
        oi: sym?.oi || '--',
        colorLabel: sym?.colorLabel || 'none',
        inWatchlist: true
      };
    });
  };

  // Filter watchlist list
  const filteredItems = () => {
    let list = allItems();
    
    // Sub-tab filters
    if (subTab() === 'Indices') {
      list = list.filter(item => item.type === 'Index');
    } else if (subTab() === 'Options') {
      list = list.filter(item => item.type?.includes('Option') || item.type?.includes('CE') || item.type?.includes('PE'));
    } else if (subTab() === 'Stocks') {
      list = list.filter(item => item.type === 'Stock' || item.type === 'Equity');
    } else if (subTab() === 'Futures') {
      list = list.filter(item => item.type?.includes('Future') || item.type?.includes('Futures') || item.key.includes('FUT'));
    } else if (subTab() === 'Movers') {
      // Sort by absolute daily change percentage descending (top movers)
      list = [...list].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    }

    // Pill filters
    const filter = activeFilter();
    if (filter === 'Indices') {
      list = list.filter(item => item.type === 'Index');
    } else if (filter === 'Options') {
      list = list.filter(item => item.type?.includes('Option') || item.type?.includes('CE') || item.type?.includes('PE'));
    } else if (filter === 'Stocks') {
      list = list.filter(item => item.type === 'Stock' || item.type === 'Equity');
    }

    // Search query filter
    const q = query().toLowerCase().trim();
    if (!q) return list;
    return list.filter(item => item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q));
  };

  const selectedItem = () => {
    const key = selectedKey();
    if (!key) return null;
    const sym = store.symbols[key];
    const searchMatch = searchResults().find(item => item.name.toUpperCase() === key);
    if (!sym && !searchMatch) return null;
    return {
      key,
      name: sym?.name || searchMatch?.name || key,
      price: sym?.price || 0,
      change: sym?.change || 0,
      pct: sym?.pct || 0,
      up: sym?.up ?? true,
      type: sym?.type || searchMatch?.type || 'Stock',
      exchange: sym?.exchange || searchMatch?.exchange || 'NSE',
      volume: sym?.volume || '--',
      signal: sym?.signal || 'Neutral',
      open: sym?.open || 0,
      high: sym?.high || 0,
      low: sym?.low || 0,
      prevClose: sym?.prevClose || 0,
      oi: sym?.oi || '--'
    };
  };

  const fallbackSearchPrice = (key: string) => {
    const known: Record<string, number> = {
      AXISBANK: 1317.30,
      SENSEX: 80234.50,
      SBIN: 836.45,
      'STATE BANK OF INDIA': 836.45,
      CRUDEOIL: 6740.00,
      CRUDEOILM: 6740.00,
    };
    if (known[key]) return known[key];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    return Math.round(100 + Math.abs(hash % 1900));
  };

  const searchItems = () => {
    return searchResults().map(item => {
      const key = item.name.toUpperCase();
      const sym = store.symbols[key];
      const tab = subTab();
      const inWatchlist = customWatchlists()[tab] 
        ? customWatchlists()[tab].includes(key)
        : store.watchlist.includes(key);
      const price = sym?.price || item.ltp || item.price || item.last_price || fallbackSearchPrice(key);
      const change = sym?.change || 0;
      const pct = sym?.pct || 0;
      const up = sym?.up ?? true;
      const type = sym?.type || item.type || 'Stock';
      const volume = sym?.volume || '--';
      const signal = sym?.signal || 'Neutral';
      const open = sym?.open || 0;
      const high = sym?.high || 0;
      const low = sym?.low || 0;
      const prevClose = sym?.prevClose || 0;
      const oi = sym?.oi || '--';
      return {
        key,
        name: item.name,
        price,
        change,
        pct,
        up,
        type,
        exchange: sym?.exchange || item.exchange || 'NSE',
        volume,
        signal,
        open,
        high,
        low,
        prevClose,
        oi,
        colorLabel: sym?.colorLabel || 'none',
        inWatchlist
      };
    });
  };

  const tableItems = () => {
    const q = query().trim();
    if (q) {
      return searchItems();
    }
    return filteredItems();
  };

  createEffect(() => {
    const q = query();
    if (q.length >= 1) {
      const timer = setTimeout(async () => {
        const results = await searchInstruments(q);
        setSearchResults(results);
      }, 200);
      return () => clearTimeout(timer);
    }
  });

  createEffect(() => {
    const key = selectedKey();
    if (key) {
      fetchSymbolQuote(key);
    }
  });

  const handleSearchTrade = (symbol: string, side: 'Buy' | 'Sell', e: Event) => {
    e.stopPropagation();
    const clean = symbol.toUpperCase();
    if (!store.symbols[clean]) {
      addWatchlistItem(clean);
    }
    setSelectedKey(clean);
    setOrderSide(side);
    setActivePanelMode('order');
  };

  const handleAdd = () => {
    const q = query().trim();
    if (q) {
      handleAddWatchlistItem(q);
      setQuery('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleTrade = (side: 'Buy' | 'Sell') => {
    setOrderSide(side);
    setActivePanelMode('order');
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

  const openRowMenu = (symbol: string, e: MouseEvent) => {
    setActiveMenuId(symbol);
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setActiveSubMenu(null);
  };

  return (
    <div class={selectedKey() ? 'wl-split-layout show-panel' : 'wl-split-layout hide-panel'}>

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
            <For each={watchlistTabs()}>
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
            <button class="wl-action-pill" onClick={handleCreateList}>+ Create List</button>
            <button class="wl-action-pill" onClick={handleImportSymbols}>Import Symbols</button>
            <button class="wl-action-icon-btn" onClick={() => navigateToTab('settings')}>⚙</button>
            <button 
              class={`wl-action-icon-btn ${viewMode() === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button 
              class={`wl-action-icon-btn ${viewMode() === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
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
            <div ref={searchContainerRef} style={{ position: 'relative' }}>
              <div class="wl-search-box">
                <input
                  type="text"
                  placeholder="Search for companies to invest or trade"
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                />
                <svg class="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21L16.65 16.65"/>
                </svg>
              </div>
            </div>
            
            <For each={['All', 'Indices', 'Options', 'Stocks']}>
              {(filterName) => {
                const count = filterName === 'All' 
                  ? allItems().length 
                  : allItems().filter(i => 
                      filterName === 'Options' 
                        ? (i.type?.includes('Option') || i.type?.includes('CE') || i.type?.includes('PE'))
                        : filterName === 'Stocks' 
                          ? (i.type === 'Stock' || i.type === 'Equity')
                          : i.type === filterName
                    ).length;
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
        {/* Watchlist Table list / Grid cards */}
        <Show when={viewMode() === 'list'} fallback={
          <div class="wl-grid-wrapper">
            <For each={tableItems()} fallback={
              <div class="no-watchlist-lbl" style={{ width: "100%", "text-align": "center", padding: "40px 0" }}>
                {query().trim() ? "No search results found." : "No symbols found in watchlist."}
              </div>
            }>
              {(item) => {
                const isStarred = () => starredItems()[item.key] || false;
                const isSelected = () => selectedKey() === item.key;
                
                return (
                  <div 
                    class={`wl-card ${isSelected() ? 'selected' : ''}`}
                    onClick={() => { setSelectedKey(item.key); setActivePanelMode('details'); }}
                  >
                    <div class="wl-card-header">
                      <div class="wl-card-title-group">
                        <span class={`wl-color-badge ${item.colorLabel}`}></span>
                        <span class="symbol-name-main font-bold">{item.name}</span>
                        <span class="symbol-type-lbl">
                          {item.type === 'Index' ? 'IDX' : item.type === 'Equity' ? 'EQ' : 'OPT'}
                        </span>
                      </div>
                      <button 
                        class={`star-btn ${isStarred() ? 'active' : ''}`} 
                        onClick={(e) => toggleStar(item.key, e)}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={isStarred() ? "var(--sys-color-blue-500)" : "none"} stroke={isStarred() ? "var(--sys-color-blue-500)" : "currentColor"} stroke-width="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    </div>
                    
                    <div class="wl-card-price-row">
                      <span class="wl-card-price">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span class={`detail-change-badge ${item.up ? 'up' : 'down'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)} ({item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%)
                      </span>
                    </div>

                    {/* Daily High/Low Info Row */}
                    <div class="wl-card-stats-row">
                      <span>H: ₹{(item.open * 1.01).toFixed(1)}</span>
                      <span>L: ₹{(item.open * 0.99).toFixed(1)}</span>
                    </div>

                    <div class="wl-card-chart">
                      <svg width="100%" height="28" viewBox="0 0 60 20" preserveAspectRatio="none" class="table-spark-svg">
                        <defs>
                          <linearGradient id={`card-grad-${item.key.replace(/[^a-zA-Z0-9]/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color={item.up ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)"} />
                            <stop offset="100%" stop-color={item.up ? "rgba(16, 185, 129, 0.0)" : "rgba(244, 63, 94, 0.0)"} />
                          </linearGradient>
                        </defs>
                        <path d={`${getSparklinePath(item)} L 60,20 L 0,20 Z`} fill={`url(#card-grad-${item.key.replace(/[^a-zA-Z0-9]/g, '-')})`} />
                        <path d={getSparklinePath(item)} fill="none" stroke={item.up ? "var(--theme-color-up)" : "var(--theme-color-down)"} stroke-width="1.3" stroke-linecap="round" />
                      </svg>
                    </div>

                    <div class="wl-card-actions">
                      <button 
                        class="wl-card-btn buy" 
                        onClick={(e) => handleSearchTrade(item.name, 'Buy', e)}
                      >
                        Buy
                      </button>
                      <button 
                        class="wl-card-btn sell" 
                        onClick={(e) => handleSearchTrade(item.name, 'Sell', e)}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        }>
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
                  <Show when={!query().trim()}>
                    <th style={{ width: "65px", "text-align": "center" }}>Trend</th>
                    <th style={{ width: "65px", "text-align": "center" }}>Intraday</th>
                  </Show>
                  <th style={{ width: query().trim() ? "180px" : "35px", "text-align": query().trim() ? "right" : "center" }}>
                    {query().trim() ? "Actions" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={tableItems()} fallback={
                  <tr>
                    <td colspan={query().trim() ? 9 : 11} class="no-watchlist-lbl">
                      {query().trim() ? "No search results found." : "No symbols found in watchlist."}
                    </td>
                  </tr>
                }>
                  {(item) => {
                    const isStarred = () => starredItems()[item.key] || false;
                    const isSelected = () => selectedKey() === item.key;
                    
                    return (
                      <tr 
                        class={`wl-row ${isSelected() ? 'selected' : ''}`}
                        onClick={() => { setSelectedKey(item.key); setActivePanelMode('details'); }}
                      >
                        <td class="star-cell">
                          <button class={`star-btn ${isStarred() ? 'active' : ''}`} onClick={(e) => toggleStar(item.key, e)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={isStarred() ? "var(--sys-color-blue-500)" : "none"} stroke={isStarred() ? "var(--sys-color-blue-500)" : "currentColor"} stroke-width="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </button>
                        </td>
                        <td>
                          <div class="symbol-name-box" style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'flex-direction': 'row' }}>
                            <span class={`wl-color-badge ${item.colorLabel}`}></span>
                            <div style={{ display: 'flex', 'flex-direction': 'column' }}>
                              <span class="symbol-name-main font-bold">{item.name}</span>
                              <span class="symbol-exchange">{item.exchange === 'MCX' ? `MCX ${item.type.toUpperCase()}` : item.type === 'Index' ? 'NSE INDEX' : item.exchange === 'NSE_FO' ? `NFO ${item.type.toUpperCase()}` : 'NSE STOCK'}</span>
                            </div>
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
                        <Show when={!query().trim()}>
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
                        </Show>
                        <td class="action-cell">
                          <Show when={query().trim()} fallback={
                            <div class="wl-row-hover-actions">
                              <button class="wl-hover-act-btn" onClick={(e) => {
                                e.stopPropagation();
                                setActiveChartSymbol(item.key);
                                navigateToTab('charts');
                              }} title="Fullscreen Chart">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                                </svg>
                              </button>
                              <button class="wl-hover-act-btn" onClick={(e) => {
                                e.stopPropagation();
                                openRowMenu(item.key, e);
                              }} title="More Options">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                            </div>
                          }>
                            <div style={{ display: 'flex', gap: '4px', 'justify-content': 'flex-end', 'align-items': 'center' }}>
                              <button 
                                class="wl-search-act-btn watch" 
                                onClick={(e) => { e.stopPropagation(); handleAddWatchlistItem(item.name); setQuery(''); }}
                                style={{ padding: '3px 8px', 'font-size': '10px' }}
                              >
                                {item.inWatchlist ? 'Added' : '+ Watchlist'}
                              </button>
                              <button 
                                class="wl-search-act-btn buy" 
                                onClick={(e) => handleSearchTrade(item.name, 'Buy', e)}
                                style={{ padding: '3px 8px', 'font-size': '10px' }}
                              >
                                Buy
                              </button>
                              <button 
                                class="wl-search-act-btn sell" 
                                onClick={(e) => handleSearchTrade(item.name, 'Sell', e)}
                                style={{ padding: '3px 8px', 'font-size': '10px' }}
                              >
                                Sell
                              </button>
                            </div>
                          </Show>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

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
            <Show when={activePanelMode() === 'order'} fallback={
              <div class="panel wl-details-panel">
                {/* Detail Header */}
                <div class="detail-header-row">
                  <div class="detail-title-box">
                    <h2 class="detail-title-main">{item().name}</h2>
                    <span class="detail-exchange-lbl">{item().exchange === 'MCX' ? 'MCX' : 'NFO'} &bull; {item().type}</span>
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
                  <button class="shortcut-btn" onClick={() => addNotification('Alert Set', `Alert created for ${item().name} at ₹${item().price}`, 'success')}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Add Alert
                  </button>
                  <button class="shortcut-btn" onClick={() => { setActiveChartSymbol(item().key); navigateToTab('charts'); }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                    </svg>
                    Open Chart
                  </button>
                  <button class="shortcut-btn" onClick={() => addNotification('Basket Update', `${item().name} added to trading basket`, 'success')}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    Add to Basket
                  </button>
                  <button class="shortcut-btn more" onClick={() => addNotification('More Options', 'Advanced option chaining is available in Option Chain tab', 'info')}>
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
                  <a href="#" class="ai-insight-link" onClick={(e) => { e.preventDefault(); navigateToTab('ailab'); }}>
                    View Full Analysis
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:3px; display:inline-block; vertical-align:middle;">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                </div>
              </div>
            }>
              {/* Order Ticket Form inside right sidebar */}
              <div class="panel wl-details-panel">
                {/* Header */}
                <div class="detail-header-row">
                  <div class="detail-title-box">
                    <h2 class="detail-title-main" style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                      <span class={`side-dot ${orderSide() === 'Buy' ? 'buy' : 'sell'}`}></span>
                      {orderSide() === 'Buy' ? 'Buy' : 'Sell'} {item().name}
                    </h2>
                    <span class="detail-exchange-lbl">{item().exchange === 'MCX' ? 'MCX' : 'NFO'} &bull; {item().type}</span>
                  </div>
                  <button class="detail-close-btn" onClick={() => setActivePanelMode('details')}>&times;</button>
                </div>

                {/* Price Row */}
                <div class="detail-price-row">
                  <span class="detail-ltp-val" style={{ 'font-size': '18px' }}>₹{item().price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span class={`detail-change-badge ${item().up ? 'up' : 'down'}`}>
                    {item().change >= 0 ? '+' : ''}{item().change.toFixed(2)} ({item().pct >= 0 ? '+' : ''}{item().pct.toFixed(2)}%)
                  </span>
                </div>

                {/* Buy / Sell Toggle Row */}
                <div style={{
                  display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px',
                  background: 'var(--theme-bg-surface-elevated)', 'border-radius': '10px', padding: '4px',
                }}>
                  <button
                    onClick={() => setOrderSide('Buy')}
                    style={{
                      padding: '8px', 'border-radius': '6px', 'font-weight': '700',
                      'font-size': '11px', 'letter-spacing': '0.5px', transition: 'all 0.2s',
                      background: orderSide() === 'Buy' ? 'var(--theme-color-up)' : 'transparent',
                      color: orderSide() === 'Buy' ? '#fff' : 'var(--theme-text-muted)',
                    }}
                  >BUY</button>
                  <button
                    onClick={() => setOrderSide('Sell')}
                    style={{
                      padding: '8px', 'border-radius': '6px', 'font-weight': '700',
                      'font-size': '11px', 'letter-spacing': '0.5px', transition: 'all 0.2s',
                      background: orderSide() === 'Sell' ? 'var(--theme-color-down)' : 'transparent',
                      color: orderSide() === 'Sell' ? '#fff' : 'var(--theme-text-muted)',
                    }}
                  >SELL</button>
                </div>

                {/* Order Type */}
                <div class="form-group">
                  <span class="form-label">Order Type</span>
                  <div class="order-type-selector">
                    <For each={['Market', 'Limit', 'SL', 'SL-M'] as const}>
                      {(t) => (
                        <button
                          class={`type-tab-btn ${orderType() === t ? 'active' : ''}`}
                          onClick={() => setOrderType(t)}
                        >
                          {t}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Quantity */}
                <div class="form-group">
                  <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                    <span class="form-label">Quantity</span>
                    <span class="form-sub-label">Lot Size: {lotSize()}</span>
                  </div>
                  <div class="qty-input-box">
                    <button class="qty-btn" onClick={() => handleQtyChange(qty() - lotSize())}>−</button>
                    <input
                      type="number"
                      class="qty-input"
                      value={qty()}
                      onInput={(e) => handleQtyChange(Number(e.currentTarget.value))}
                    />
                    <button class="qty-btn" onClick={() => handleQtyChange(qty() + lotSize())}>+</button>
                  </div>
                  <div class="lot-helpers">
                    <For each={[1, 2, 5]}>
                      {(l) => (
                        <button
                          class={`lot-btn ${lots() === l ? 'active' : ''}`}
                          onClick={() => handleLotChange(l)}
                        >
                          {l}L
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Limit Price */}
                <Show when={orderType() === 'Limit' || orderType() === 'SL'}>
                  <div class="form-group">
                    <span class="form-label">Limit Price (₹)</span>
                    <input
                      type="number"
                      class="price-input font-mono"
                      value={price()}
                      onInput={(e) => setPrice(Number(e.currentTarget.value))}
                    />
                  </div>
                </Show>

                {/* Trigger Price */}
                <Show when={orderType() === 'SL' || orderType() === 'SL-M'}>
                  <div class="form-group">
                    <span class="form-label">Trigger Price (₹)</span>
                    <input
                      type="number"
                      class="price-input font-mono"
                      value={triggerPrice()}
                      onInput={(e) => setTriggerPrice(Number(e.currentTarget.value))}
                    />
                  </div>
                </Show>

                {/* Product */}
                <div class="form-group">
                  <span class="form-label">Product</span>
                  <div class="product-selector">
                    <For each={['MIS', 'NRML', 'CNC'] as const}>
                      {(p) => (
                        <button
                          class={`prod-tab-btn ${product() === p ? 'active' : ''}`}
                          onClick={() => setProduct(p)}
                        >
                          {p}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Validity */}
                <div class="form-group">
                  <span class="form-label">Validity</span>
                  <div class="product-selector">
                    <For each={['DAY', 'IOC'] as const}>
                      {(v) => (
                        <button
                          class={`prod-tab-btn ${validity() === v ? 'active' : ''}`}
                          onClick={() => setValidity(v)}
                        >
                          {v}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* AMO Toggle */}
                <div class="form-group amo-row">
                  <span class="form-label">After Market Order (AMO)</span>
                  <button
                    class={`amo-switch ${amo() ? 'on' : ''}`}
                    onClick={() => setAmo(!amo())}
                  >
                    <span class="switch-slider"></span>
                  </button>
                </div>

                {/* Cost Calculations */}
                <div class="cost-summary-box">
                  <div class="cost-grid">
                    <div class="cost-row">
                      <span class="cost-lbl">Est. Value</span>
                      <span class="cost-val">₹{fmtINR(totalValue())}</span>
                    </div>
                    <div class="cost-row">
                      <span class="cost-lbl">Brokerage</span>
                      <span class="cost-val">₹{brokerage().toFixed(2)}</span>
                    </div>
                    <div class="cost-row">
                      <span class="cost-lbl">SEBI + GST</span>
                      <span class="cost-val">₹{(sebi() + gst()).toFixed(2)}</span>
                    </div>
                    <div class="cost-row">
                      <span class="cost-lbl">Total Charges</span>
                      <span class="cost-val">₹{totalCharges().toFixed(2)}</span>
                    </div>
                  </div>
                  <div class="net-row">
                    <span class="net-lbl">Net Required</span>
                    <span class={`net-val ${isInsufficient() ? 'error' : ''}`}>₹{fmtINR(netValue())}</span>
                  </div>
                </div>

                {/* PLACE ORDER Button */}
                <button
                  class={`place-btn ${orderSide().toLowerCase()}`}
                  onClick={handlePlaceOrder}
                  disabled={loading() || isInsufficient()}
                  style={{ opacity: loading() ? 0.8 : 1 }}
                >
                  {loading() ? 'Placing Order...' : isInsufficient() ? 'Insufficient Margin' : `Place ${orderSide().toUpperCase()} Order`}
                </button>
              </div>
            </Show>
          )}
        </Show>
      </div>

      {/* Floating Context Menu */}
      <Show when={activeMenuId() !== null}>
        <div 
          class="wl-context-menu" 
          style={{ 
            position: 'fixed', 
            top: `${menuPosition().y}px`, 
            left: `${menuPosition().x}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Option: Delete */}
          <button 
            class="wl-menu-item delete" 
            onClick={() => {
              const sym = activeMenuId();
              if (sym) {
                handleDeleteWatchlistItem(sym);
              }
              setActiveMenuId(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Delete</span>
          </button>

          {/* Option: Fullscreen Chart */}
          <button 
            class="wl-menu-item" 
            onClick={() => {
              const sym = activeMenuId();
              if (sym) {
                setActiveChartSymbol(sym);
                navigateToTab('charts');
              }
              setActiveMenuId(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
            <span>Fullscreen Chart</span>
          </button>

          {/* Option: Watchlist category select (Mock) */}
          <div 
            class="wl-menu-item has-sub"
            onMouseEnter={() => setActiveSubMenu('watchlist')}
            onMouseLeave={() => setActiveSubMenu(null)}
          >
            <div class="wl-menu-item-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>Watchlist</span>
            </div>
            <span class="chevron-arrow">▶</span>
            
            <Show when={activeSubMenu() === 'watchlist'}>
              <div class="wl-context-submenu">
                <button class="wl-menu-item" onClick={() => setActiveMenuId(null)}>My Watchlist</button>
                <button class="wl-menu-item" onClick={() => setActiveMenuId(null)}>Indices</button>
                <button class="wl-menu-item" onClick={() => setActiveMenuId(null)}>Options</button>
                <button class="wl-menu-item" onClick={() => setActiveMenuId(null)}>Stocks</button>
              </div>
            </Show>
          </div>

          {/* Option: Color Labels */}
          <div 
            class="wl-menu-item has-sub"
            onMouseEnter={() => setActiveSubMenu('color')}
            onMouseLeave={() => setActiveSubMenu(null)}
          >
            <div class="wl-menu-item-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Color Labels</span>
            </div>
            <span class="chevron-arrow">▶</span>

            <Show when={activeSubMenu() === 'color'}>
              <div class="wl-context-submenu">
                <For each={['red', 'blue', 'green', 'orange', 'none'] as const}>
                  {(color) => (
                    <button 
                      class="wl-menu-item" 
                      onClick={() => {
                        const sym = activeMenuId();
                        if (sym) {
                          updateSymbolColorLabel(sym, color);
                        }
                        setActiveMenuId(null);
                        setActiveSubMenu(null);
                      }}
                    >
                      <span class={`wl-color-dot ${color}`}></span>
                      <span style="text-transform: capitalize;">{color}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Option: Set Alert */}
          <button 
            class="wl-menu-item" 
            onClick={() => {
              navigateToTab('alerts');
              setActiveMenuId(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Set Alert</span>
          </button>
        </div>
      </Show>
    </div>
  );
};
