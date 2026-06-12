import { createEffect, createSignal, For, Show, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { store, createPriceAlert, deletePriceAlert, toggleAlertStatus, addNotification } from '../../store/tradingStore';
import './alerts.css';

export const AlertsPage: Component = () => {
  // Navigation & Slicing signals
  const [activeSubTab, setActiveSubTab] = createSignal<'all' | 'active' | 'triggered' | 'paused' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [currentPage, setCurrentPage] = createSignal(1);
  const itemsPerPage = 8;
  const [showFilters, setShowFilters] = createSignal(false);
  const [typeFilter, setTypeFilter] = createSignal<'all' | 'price' | 'strategy' | 'volume'>('all');
  const [exchangeFilter, setExchangeFilter] = createSignal<'all' | 'NSE' | 'NFO'>('all');

  // Active dropdown state for actions menu
  const [openDropdownId, setOpenDropdownId] = createSignal<string | null>(null);

  // Form creation states
  const [selectedType, setSelectedType] = createSignal<'price' | 'strategy' | 'volume'>('price');
  const [instrumentSearch, setInstrumentSearch] = createSignal('');
  const [showInstrumentDropdown, setShowInstrumentDropdown] = createSignal(false);
  const [selectedSymbol, setSelectedSymbol] = createSignal('NIFTY 50');

  // Condition signals
  const [condField, setCondField] = createSignal('Last Price');
  const [condOperator, setCondOperator] = createSignal('Above');
  const [strategyCond, setStrategyCond] = createSignal('SMA (20) Crosses Above SMA (50)');
  const [volumeOperator, setVolumeOperator] = createSignal('Above');

  // Value, optional extras & notifications
  const [valueInput, setValueInput] = createSignal('22,850.00');
  const [triggerOnlyOnce, setTriggerOnlyOnce] = createSignal(true);
  const [setExpiry, setSetExpiry] = createSignal(false);
  const [expiryValue, setExpiryValue] = createSignal('2026-06-11T15:30');
  
  const [notifInApp, setNotifInApp] = createSignal(true);
  const [notifEmail, setNotifEmail] = createSignal(true);
  const [notifSMS, setNotifSMS] = createSignal(false);
  const [notifWebhook, setNotifWebhook] = createSignal(false);

  // Unified list of alerts (store price alerts + static mock strategy/volume/expired alerts)
  const [localAlerts, setLocalAlerts] = createSignal<any[]>([
    {
      id: 'mock-1',
      name: 'BANKNIFTY Support',
      type: 'price',
      inst: 'BANKNIFTY',
      exchange: 'NSE',
      cond: 'Last Price Below',
      val: '48,200.00',
      status: 'active',
      triggeredAt: '-',
      enabled: true
    },
    {
      id: 'mock-2',
      name: 'NIFTY 50 SMA Crossover',
      type: 'strategy',
      inst: 'NIFTY 50',
      exchange: 'NSE',
      cond: 'SMA (20) Crosses Above SMA (50)',
      val: '-',
      status: 'active',
      triggeredAt: '-',
      enabled: true
    },
    {
      id: 'mock-3',
      name: 'BANKNIFTY High Volume',
      type: 'volume',
      inst: 'BANKNIFTY',
      exchange: 'NSE',
      cond: 'Volume Above',
      val: '20,00,000',
      status: 'active',
      triggeredAt: '-',
      enabled: true
    },
    {
      id: 'mock-4',
      name: 'NIFTY 23 May 22500 PE',
      type: 'price',
      inst: 'NIFTY 23 May 24 22500 PE',
      exchange: 'NFO',
      cond: 'Last Price Below',
      val: '80.00',
      status: 'triggered',
      triggeredAt: 'Today, 09:15 AM',
      enabled: false
    },
    {
      id: 'mock-5',
      name: 'Reliance Resistance',
      type: 'price',
      inst: 'RELIANCE',
      exchange: 'NSE',
      cond: 'Last Price Above',
      val: '3,050.00',
      status: 'triggered',
      triggeredAt: 'Yesterday, 02:31 PM',
      enabled: false
    },
    {
      id: 'mock-6',
      name: 'NIFTY Opening Range Break',
      type: 'strategy',
      inst: 'NIFTY 50',
      exchange: 'NSE',
      cond: 'Opening Range Break (15m)',
      val: '-',
      status: 'paused',
      triggeredAt: '-',
      enabled: false
    },
    {
      id: 'mock-7',
      name: 'INFY Earnings Spike',
      type: 'price',
      inst: 'INFY',
      exchange: 'NSE',
      cond: 'Price Change % Above',
      val: '5.00%',
      status: 'expired',
      triggeredAt: '20 May 2024',
      enabled: false
    }
  ]);

  // Combine store.alerts (real reactive price alerts) and local alerts reactively
  const allAlerts = () => {
    const storeAlertsMapped = store.alerts.map((alert) => ({
      id: alert.id,
      name: `${alert.inst} ${alert.cond === 'Price Above' ? 'Breakout' : 'Support'}`,
      type: 'price',
      inst: alert.inst,
      exchange: alert.inst.includes('CE') || alert.inst.includes('PE') ? 'NFO' : 'NSE',
      cond: alert.cond === 'Price Above' ? 'Last Price Above' : 'Last Price Below',
      val: alert.val.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      status: alert.status,
      triggeredAt: alert.status === 'triggered' ? 'Today, 10:15 AM' : '-',
      enabled: alert.status === 'active'
    }));

    return [...storeAlertsMapped, ...localAlerts()];
  };

  // Close dropdowns on outside clicks
  onMount(() => {
    const closeAll = () => {
      setOpenDropdownId(null);
      setShowInstrumentDropdown(false);
    };
    window.addEventListener('click', closeAll);
    onCleanup(() => window.removeEventListener('click', closeAll));
  });

  // Filter lists based on active subtab & search queries
  const filteredAlerts = () => {
    const query = searchQuery().toLowerCase().trim();
    let list = allAlerts();

    // 1. Tab filter
    const tab = activeSubTab();
    if (tab !== 'all') {
      list = list.filter(a => a.status === tab);
    }

    if (typeFilter() !== 'all') {
      list = list.filter(a => a.type === typeFilter());
    }

    if (exchangeFilter() !== 'all') {
      list = list.filter(a => a.exchange === exchangeFilter());
    }

    // 2. Search query filter
    if (query) {
      list = list.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.inst.toLowerCase().includes(query) ||
        a.cond.toLowerCase().includes(query)
      );
    }

    return list;
  };

  // Pagination lists
  const slicedAlerts = () => {
    const start = (currentPage() - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAlerts().slice(start, end);
  };

  const totalPages = () => Math.max(1, Math.ceil(filteredAlerts().length / itemsPerPage));

  createEffect(() => {
    if (currentPage() > totalPages()) setCurrentPage(totalPages());
  });

  // Count metrics for subtab badges
  const countAll = () => allAlerts().length;
  const countActive = () => allAlerts().filter(a => a.status === 'active').length;
  const countTriggered = () => allAlerts().filter(a => a.status === 'triggered').length;
  const countPaused = () => allAlerts().filter(a => a.status === 'paused').length;
  const countExpired = () => allAlerts().filter(a => a.status === 'expired').length;

  // Toggle alert active state
  const handleToggle = (id: string) => {
    if (id.startsWith('mock-')) {
      setLocalAlerts(prev => prev.map(a => {
        if (a.id === id) {
          const newEnabled = !a.enabled;
          const newStatus = newEnabled ? 'active' : 'paused';
          addNotification('Alert Updated', `"${a.name}" is now ${newStatus}.`, 'info', 'alerts');
          return { ...a, enabled: newEnabled, status: newStatus };
        }
        return a;
      }));
    } else {
      toggleAlertStatus(id);
    }
  };

  // Delete alert
  const handleDelete = (id: string) => {
    if (id.startsWith('mock-')) {
      setLocalAlerts(prev => prev.filter(a => a.id !== id));
      addNotification('Alert Deleted', 'Price alert removed.', 'info', 'alerts');
    } else {
      deletePriceAlert(id);
    }
    setOpenDropdownId(null);
  };

  // Instrument selection search dropdown list
  const filteredSymbols = () => {
    const query = instrumentSearch().toLowerCase().trim();
    const list = Object.keys(store.symbols);
    if (!query) return list.slice(0, 5); // show top 5 defaults
    return list.filter(sym => sym.toLowerCase().includes(query)).slice(0, 5);
  };

  // Handle Form Submission / Alert Creation
  const handleCreateAlertSubmit = (e: Event) => {
    e.preventDefault();
    const type = selectedType();
    const inst = selectedSymbol();
    const exchange = inst.includes('CE') || inst.includes('PE') ? 'NFO' : 'NSE';
    const cleanVal = Number(valueInput().replace(/,/g, ''));

    if (!notifInApp() && !notifEmail() && !notifSMS() && !notifWebhook()) {
      addNotification('Alert Error', 'Select at least one notification channel.', 'warning', 'alerts');
      return;
    }

    if (type !== 'strategy' && (!Number.isFinite(cleanVal) || cleanVal <= 0)) {
      addNotification('Alert Error', 'Enter a valid alert value greater than zero.', 'error', 'alerts');
      return;
    }

    let alertName = '';
    let conditionText = '';

    if (type === 'price') {
      alertName = `${inst} Breakout ${valueInput()}`;
      conditionText = `${condField()} ${condOperator()}`;

      // Push real price alert to store
      const storeCond = condOperator() === 'Above' ? 'Price Above' : 'Price Below';
      createPriceAlert(inst, storeCond, cleanVal);
    } else {
      if (type === 'strategy') {
        alertName = `${inst} Strategy Alert`;
        conditionText = strategyCond();
      } else {
        alertName = `${inst} High Volume`;
        conditionText = `Volume ${volumeOperator()}`;
      }

      // Prepend to local mock alerts
      const newMockAlert = {
        id: `mock-${Math.random().toString(36).substring(2, 9)}`,
        name: alertName,
        type,
        inst,
        exchange,
        cond: conditionText,
        val: type === 'volume' ? valueInput() : '-',
        status: 'active',
        triggeredAt: '-',
        enabled: true
      };

      setLocalAlerts(prev => [newMockAlert, ...prev]);
      addNotification('Alert Created', `Set "${alertName}" alert successfully.`, 'success', 'alerts');
    }

    // Reset Search & value fields
    setInstrumentSearch('');
    // Dynamic value mapping based on symbol selection
    const symbolPrice = store.symbols[selectedSymbol()]?.price || 100;
    setValueInput(symbolPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
  };

  // Helper to switch type & populate default values
  const selectAlertType = (type: 'price' | 'strategy' | 'volume') => {
    setSelectedType(type);
    const symbolPrice = store.symbols[selectedSymbol()]?.price || 100;
    if (type === 'price') {
      setValueInput(symbolPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    } else if (type === 'volume') {
      setValueInput('20,00,000');
    } else {
      setValueInput('-');
    }
  };

  // Helper to change selected symbol and price
  const changeSelectedSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    const symbolPrice = store.symbols[sym]?.price || 100;
    if (selectedType() === 'price') {
      setValueInput(symbolPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setExchangeFilter('all');
    setActiveSubTab('all');
    setCurrentPage(1);
    setShowFilters(false);
  };

  return (
    <div class="alerts-split-layout">
      {/* ── Left Column: Alerts List ────────────────────────── */}
      <div class="alerts-left-col">
        {/* Title Header */}
        <div class="alerts-title-header">
          <h1 class="alerts-title-text">Alerts</h1>
          <p class="alerts-sub-text">Create, manage and track your price & strategy alerts</p>
        </div>

        {/* Sub-tabs & Search Filters Row */}
        <div class="alerts-sub-tabs-row">
          <div class="sub-tabs-left">
            <button 
              class={`alerts-tab-btn ${activeSubTab() === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('all'); setCurrentPage(1); }}
            >
              All Alerts <span class="alerts-tab-count">{countAll()}</span>
            </button>
            <button 
              class={`alerts-tab-btn ${activeSubTab() === 'active' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('active'); setCurrentPage(1); }}
            >
              Active <span class="alerts-tab-count">{countActive()}</span>
            </button>
            <button 
              class={`alerts-tab-btn ${activeSubTab() === 'triggered' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('triggered'); setCurrentPage(1); }}
            >
              Triggered <span class="alerts-tab-count">{countTriggered()}</span>
            </button>
            <button 
              class={`alerts-tab-btn ${activeSubTab() === 'paused' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('paused'); setCurrentPage(1); }}
            >
              Paused <span class="alerts-tab-count">{countPaused()}</span>
            </button>
            <button 
              class={`alerts-tab-btn ${activeSubTab() === 'expired' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('expired'); setCurrentPage(1); }}
            >
              Expired <span class="alerts-tab-count">{countExpired()}</span>
            </button>
          </div>

          <div class="sub-tabs-right">
            <div class="alerts-search-box">
              <span class="search-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input 
                type="text" 
                placeholder="Search alerts..." 
                value={searchQuery()}
                onInput={(e) => { setSearchQuery(e.currentTarget.value); setCurrentPage(1); }}
              />
            </div>
            <button class={`alerts-filter-btn ${showFilters() ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowFilters(prev => !prev); }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
            </button>
            <Show when={showFilters()}>
              <div class="alerts-filter-panel" onClick={(e) => e.stopPropagation()}>
                <label>
                  Type
                  <select value={typeFilter()} onChange={(e) => { setTypeFilter(e.currentTarget.value as 'all' | 'price' | 'strategy' | 'volume'); setCurrentPage(1); }}>
                    <option value="all">All types</option>
                    <option value="price">Price</option>
                    <option value="strategy">Strategy</option>
                    <option value="volume">Volume</option>
                  </select>
                </label>
                <label>
                  Exchange
                  <select value={exchangeFilter()} onChange={(e) => { setExchangeFilter(e.currentTarget.value as 'all' | 'NSE' | 'NFO'); setCurrentPage(1); }}>
                    <option value="all">All exchanges</option>
                    <option value="NSE">NSE</option>
                    <option value="NFO">NFO</option>
                  </select>
                </label>
                <button type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            </Show>
          </div>
        </div>

        {/* Table Wrapper Grid */}
        <div class="alerts-table-wrapper">
          <table class="alerts-table">
            <thead>
              <tr>
                <th style="width: 25%">Alert Name</th>
                <th style="width: 20%">Instrument</th>
                <th style="width: 20%">Condition</th>
                <th style="width: 12%">Value</th>
                <th style="width: 10%">Status</th>
                <th style="width: 13%">Triggered At</th>
                <th style="width: 10%; text-align: right; padding-right: var(--sys-space-4);">Actions</th>
              </tr>
            </thead>
            <tbody>
              <Show when={slicedAlerts().length === 0}>
                <tr>
                  <td colspan="7" style="text-align: center; color: var(--theme-text-muted); padding: var(--sys-space-8);">
                    No alerts found. Use the sidebar panel to configure new price or strategy alerts.
                  </td>
                </tr>
              </Show>
              <For each={slicedAlerts()}>
                {(alert) => (
                  <tr class="alerts-row">
                    <td>
                      <div class="alert-name-cell">
                        <div class={`alert-type-icon-wrapper ${alert.type}`}>
                          <Show when={alert.type === 'price'}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          </Show>
                          <Show when={alert.type === 'strategy'}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                          </Show>
                          <Show when={alert.type === 'volume'}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <line x1="18" y1="20" x2="18" y2="10" />
                              <line x1="12" y1="20" x2="12" y2="4" />
                              <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                          </Show>
                        </div>
                        <div class="alert-name-lbl-box">
                          <span class="alert-name-main">{alert.name}</span>
                          <span class="alert-name-sub">
                            {alert.type === 'price' ? 'Price Alert' : alert.type === 'strategy' ? 'Strategy Alert' : 'Volume Alert'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="alert-inst-box">
                        <span class="alert-inst-name">{alert.inst}</span>
                        <span class="alert-inst-exchange">{alert.exchange}</span>
                      </div>
                    </td>
                    <td>{alert.cond}</td>
                    <td class="font-mono">{alert.val}</td>
                    <td>
                      <span class={`alerts-status-pill ${alert.status}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td class="font-mono">{alert.triggeredAt}</td>
                    <td style="text-align: right; padding-right: var(--sys-space-4);">
                      <div class="alert-action-cell">
                        {/* Switch toggle */}
                        <div 
                          class={`alert-switch-toggle ${alert.enabled ? 'on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleToggle(alert.id); }}
                          title={alert.enabled ? 'Disable Alert' : 'Enable Alert'}
                        >
                          <div class="slider-thumb" />
                        </div>

                        {/* Dropdown Action Menu */}
                        <div class="alert-dot-menu-container" onClick={(e) => e.stopPropagation()}>
                          <button 
                            class="alert-dot-menu-btn"
                            onClick={() => setOpenDropdownId(openDropdownId() === alert.id ? null : alert.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>

                          <Show when={openDropdownId() === alert.id}>
                            <div class="alert-dropdown-menu">
                              <button 
                                class="alert-dropdown-item"
                                onClick={() => handleToggle(alert.id)}
                              >
                                {alert.enabled ? 'Pause Alert' : 'Resume Alert'}
                              </button>
                              <button 
                                class="alert-dropdown-item delete"
                                onClick={() => handleDelete(alert.id)}
                              >
                                Delete Alert
                              </button>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        {/* Footer Page Bar */}
        <div class="alerts-footer-bar">
          <span>
            Showing {filteredAlerts().length === 0 ? 0 : (currentPage() - 1) * itemsPerPage + 1} to {Math.min(currentPage() * itemsPerPage, filteredAlerts().length)} of {filteredAlerts().length} alerts
          </span>
          <div class="alerts-pagination-controls">
            <button 
              class="page-btn" 
              disabled={currentPage() === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              &lt;
            </button>
            <For each={Array.from({ length: totalPages() })}>
              {(_, i) => (
                <button 
                  class={`page-btn ${currentPage() === i() + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i() + 1)}
                >
                  {i() + 1}
                </button>
              )}
            </For>
            <button 
              class="page-btn" 
              disabled={currentPage() === totalPages()}
              onClick={() => setCurrentPage(prev => Math.min(totalPages(), prev + 1))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Column: Create New Alert Sidebar ────────────────── */}
      <div class="alerts-right-panel">
        <h2 class="sidebar-panel-title">Create New Alert</h2>

        {/* Section: Alert Type */}
        <div class="form-field-row">
          <span class="panel-section-lbl">Alert Type</span>
          <div class="alert-type-tabs">
            <button 
              class={`type-tab-btn ${selectedType() === 'price' ? 'active' : ''}`}
              onClick={() => selectAlertType('price')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Price
            </button>
            <button 
              class={`type-tab-btn ${selectedType() === 'strategy' ? 'active' : ''}`}
              onClick={() => selectAlertType('strategy')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Strategy
            </button>
            <button 
              class={`type-tab-btn ${selectedType() === 'volume' ? 'active' : ''}`}
              onClick={() => selectAlertType('volume')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Volume
            </button>
          </div>
        </div>

        {/* Section: Instrument selector */}
        <div class="form-field-row" onClick={(e) => e.stopPropagation()}>
          <span class="panel-section-lbl">Instrument</span>
          <div class="instrument-search-field">
            <span class="search-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Search instrument..." 
              value={instrumentSearch()}
              onInput={(e) => { setInstrumentSearch(e.currentTarget.value); setShowInstrumentDropdown(true); }}
              onFocus={() => setShowInstrumentDropdown(true)}
            />

            {/* Instrument Dropdown Results */}
            <Show when={showInstrumentDropdown()}>
              <div class="inst-search-results-dropdown">
                <For each={filteredSymbols()}>
                  {(sym) => (
                    <button 
                      class="inst-search-option"
                      onClick={() => { changeSelectedSymbol(sym); setShowInstrumentDropdown(false); }}
                    >
                      <span>{sym}</span>
                      <span style="font-size: 8px; opacity: 0.6;">
                        {sym.includes('CE') || sym.includes('PE') ? 'NFO' : 'NSE'}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Selected symbol box */}
          <div class="instrument-select-card">
            <span class="instrument-card-name">{selectedSymbol()}</span>
            <span class="instrument-card-exchange">
              {selectedSymbol().includes('CE') || selectedSymbol().includes('PE') ? 'NFO' : 'NSE'}
            </span>
          </div>
        </div>

        {/* Section: Dynamic Condition fields */}
        <div class="form-field-row">
          <span class="panel-section-lbl">Condition</span>
          
          <Show when={selectedType() === 'price'}>
            <div class="form-select-grid">
              <select class="panel-select" value={condField()} onChange={(e) => setCondField(e.currentTarget.value)}>
                <option value="Last Price">Last Price</option>
                <option value="Open">Open</option>
                <option value="High">High</option>
                <option value="Low">Low</option>
                <option value="Price Change %">Price Change %</option>
              </select>
              <select class="panel-select" value={condOperator()} onChange={(e) => setCondOperator(e.currentTarget.value)}>
                <option value="Above">Above</option>
                <option value="Below">Below</option>
              </select>
            </div>
          </Show>

          <Show when={selectedType() === 'strategy'}>
            <select class="panel-select" value={strategyCond()} onChange={(e) => setStrategyCond(e.currentTarget.value)}>
              <option value="SMA (20) Crosses Above SMA (50)">SMA (20) Crosses Above SMA (50)</option>
              <option value="RSI (14) Overbought (>70)">RSI (14) Overbought (&gt;70)</option>
              <option value="RSI (14) Oversold (<30)">RSI (14) Oversold (&lt;30)</option>
              <option value="Opening Range Break (15m)">Opening Range Break (15m)</option>
              <option value="MACD Bullish Crossover">MACD Bullish Crossover</option>
            </select>
          </Show>

          <Show when={selectedType() === 'volume'}>
            <select class="panel-select" value={volumeOperator()} onChange={(e) => setVolumeOperator(e.currentTarget.value)}>
              <option value="Above">Volume Above</option>
              <option value="Accumulation (1h)">Accumulation (1h)</option>
            </select>
          </Show>
        </div>

        {/* Section: Value Trigger */}
        <Show when={selectedType() !== 'strategy'}>
          <div class="form-field-row">
            <span class="panel-section-lbl">Value</span>
            <input 
              type="text" 
              class="panel-input font-mono" 
              value={valueInput()}
              onInput={(e) => setValueInput(e.currentTarget.value)}
            />
          </div>
        </Show>

        {/* Section: Extras checklist */}
        <div class="form-field-row">
          <span class="panel-section-lbl">Extras (Optional)</span>
          <div class="extras-checkbox-list">
            <label class="check-label-item">
              <input 
                type="checkbox" 
                checked={triggerOnlyOnce()} 
                onChange={(e) => setTriggerOnlyOnce(e.currentTarget.checked)}
              />
              <span>Trigger only once</span>
            </label>
            
            <label class="check-label-item">
              <input 
                type="checkbox" 
                checked={setExpiry()} 
                onChange={(e) => setSetExpiry(e.currentTarget.checked)}
              />
              <span>Set expiry</span>
            </label>

            <Show when={setExpiry()}>
              <div class="panel-date-picker">
                <input type="datetime-local" value={expiryValue()} onInput={(e) => setExpiryValue(e.currentTarget.value)} />
              </div>
            </Show>
          </div>
        </div>

        {/* Section: Notification channels */}
        <div class="form-field-row">
          <span class="panel-section-lbl">Notification</span>
          <div class="notif-checkbox-list">
            <label class="check-label-item">
              <input type="checkbox" checked={notifInApp()} onChange={(e) => setNotifInApp(e.currentTarget.checked)} />
              <span>In-app</span>
            </label>
            <label class="check-label-item">
              <input type="checkbox" checked={notifEmail()} onChange={(e) => setNotifEmail(e.currentTarget.checked)} />
              <span>Email</span>
            </label>
            <label class="check-label-item">
              <input type="checkbox" checked={notifSMS()} onChange={(e) => setNotifSMS(e.currentTarget.checked)} />
              <span>SMS</span>
            </label>
            <label class="check-label-item">
              <input type="checkbox" checked={notifWebhook()} onChange={(e) => setNotifWebhook(e.currentTarget.checked)} />
              <span>Webhook</span>
            </label>
          </div>
        </div>

        {/* Action Button submit */}
        <button class="btn-create-alert-submit" onClick={handleCreateAlertSubmit}>
          Create Alert
        </button>
      </div>
    </div>
  );
};
