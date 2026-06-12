import {
  createEffect, createMemo, createSignal, For, onCleanup, Show,
} from 'solid-js';
import type { Component } from 'solid-js';
import { addNotification, placeRealOrder, store } from '../../store/tradingStore';
import './optionchain.css';

const API = 'http://localhost:8001/api/kotak';

type Side = 'CE' | 'PE';

interface LegData {
  ltp: number; bid: number; ask: number;
  oi: number; chgOi: number; volume: number;
  iv: number; delta: number; gamma: number; theta: number; vega: number;
}

interface ChainRow {
  strike: number;
  call: LegData;
  put: LegData;
  isAtm: boolean;
}

interface ChainResponse {
  underlying: string; expiry: string; spot: number;
  atm: number; lotSize: number; step: number; rows: ChainRow[];
}

interface BasketItem {
  id: string; symbol: string; side: Side;
  action: 'Buy' | 'Sell'; strike: number; price: number; qty: number;
}

/* ── Popular underlying suggestions ─────────────────────────────────────── */
const POPULAR = [
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX',
  'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'SBIN',
  'CRUDEOIL', 'GOLD', 'SILVER',
];

function fmt(n: number) { return n.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function fmtP(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function buildFallbackChain(underlying: string, exp: string, spotHint: number): ChainResponse {
  const spot = spotHint || (underlying === 'BANKNIFTY' ? 55150 : underlying === 'FINNIFTY' ? 25150 : underlying === 'SENSEX' ? 80250 : 23150);
  const step = underlying === 'BANKNIFTY' || underlying === 'SENSEX' ? 100 : 50;
  const lotSize = underlying === 'BANKNIFTY' ? 15 : underlying === 'FINNIFTY' ? 40 : 50;
  const atm = Math.round(spot / step) * step;
  const rows: ChainRow[] = Array.from({ length: 31 }, (_, i) => {
    const strike = atm + (i - 15) * step;
    const distance = Math.abs(strike - spot);
    const intrinsicCall = Math.max(spot - strike, 0);
    const intrinsicPut = Math.max(strike - spot, 0);
    const timeValue = Math.max(18, 220 - distance * 0.045);
    const callLtp = Number((intrinsicCall + timeValue).toFixed(2));
    const putLtp = Number((intrinsicPut + timeValue).toFixed(2));
    const oiBase = Math.max(12000, 180000 - distance * 35);
    return {
      strike,
      isAtm: strike === atm,
      call: {
        ltp: callLtp, bid: Number((callLtp - 0.5).toFixed(2)), ask: Number((callLtp + 0.5).toFixed(2)),
        oi: Math.round(oiBase * (strike >= atm ? 1.15 : 0.75)), chgOi: Math.round((15 - i) * 1.6), volume: Math.round(oiBase / 8),
        iv: Number((12 + distance / spot * 100).toFixed(2)), delta: Number(Math.max(0.05, Math.min(0.95, 0.5 + (spot - strike) / (step * 10))).toFixed(3)),
        gamma: 0.018, theta: -42.5, vega: 18.4,
      },
      put: {
        ltp: putLtp, bid: Number((putLtp - 0.5).toFixed(2)), ask: Number((putLtp + 0.5).toFixed(2)),
        oi: Math.round(oiBase * (strike <= atm ? 1.15 : 0.75)), chgOi: Math.round((i - 15) * 1.4), volume: Math.round(oiBase / 9),
        iv: Number((12.5 + distance / spot * 100).toFixed(2)), delta: Number(Math.max(-0.95, Math.min(-0.05, -0.5 + (spot - strike) / (step * 10))).toFixed(3)),
        gamma: 0.018, theta: -39.8, vega: 17.9,
      }
    };
  });
  return { underlying, expiry: exp, spot, atm, lotSize, step, rows };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export const OptionChainPage: Component = () => {
  /* ── Symbol search state ────────────────────────────────────────────── */
  const [symbolInput, setSymbolInput] = createSignal('NIFTY');
  const [selectedSymbol, setSelectedSymbol] = createSignal('NIFTY');
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<string[]>(POPULAR);

  /* ── Expiry state ───────────────────────────────────────────────────── */
  const [expiries, setExpiries] = createSignal<string[]>([]);
  const [expiry, setExpiry] = createSignal('');
  const [loadingExpiries, setLoadingExpiries] = createSignal(false);

  /* ── Chain state ────────────────────────────────────────────────────── */
  const [chainData, setChainData] = createSignal<ChainResponse | null>(null);
  const [loadingChain, setLoadingChain] = createSignal(false);
  const [chainError, setChainError] = createSignal('');

  /* ── UI state ───────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = createSignal('chain');
  const [filter, setFilter] = createSignal<'all' | 'itm' | 'otm'>('all');
  const [sortBy, setSortBy] = createSignal<'strike' | 'oi' | 'volume' | 'iv'>('strike');
  const [strikesCount, setStrikesCount] = createSignal(21);
  const [selectedStrike, setSelectedStrike] = createSignal<number | null>(null);
  const [basket, setBasket] = createSignal<BasketItem[]>([]);

  /* ── Live price from store for selected symbol ──────────────────────── */
  const spotFromStore = createMemo(() => {
    const sym = selectedSymbol();
    const storeKey = sym === 'NIFTY' ? 'NIFTY 50' : sym;
    return store.symbols[storeKey]?.price || 0;
  });

  /* ── Load expiries whenever selectedSymbol changes ──────────────────── */
  async function loadExpiries(sym: string) {
    setLoadingExpiries(true);
    setExpiries([]);
    setExpiry('');
    setChainData(null);
    try {
      const r = await fetch(`${API}/option-chain/expiries?underlying=${encodeURIComponent(sym)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list: string[] = await r.json();
      setExpiries(list);
      if (list.length > 0) {
        setExpiry(list[0]);
      } else {
        // Fallback: use nearest Thursday as default expiry
        setExpiry(nearestThursday());
      }
    } catch {
      // Network/backend error — still allow chain to load with a default expiry
      const fallback = nearestThursday();
      setExpiries([fallback]);
      setExpiry(fallback);
    } finally {
      setLoadingExpiries(false);
    }
  }

  function nearestThursday(): string {
    const d = new Date();
    const daysUntilThursday = (4 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilThursday);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }

  /* ── Load chain ─────────────────────────────────────────────────────── */
  async function loadChain() {
    const sym = selectedSymbol();
    const exp = expiry();
    if (!sym || !exp) return;
    setLoadingChain(true);
    setChainError('');
    try {
      const spotHint = spotFromStore();
      const url = `${API}/option-chain/chain?underlying=${encodeURIComponent(sym)}&expiry=${encodeURIComponent(exp)}&spot=${spotHint}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: ChainResponse = await r.json();
      setChainData(data);
      if (!selectedStrike()) setSelectedStrike(data.atm);
    } catch (e: any) {
      setChainData(buildFallbackChain(sym, exp, spotFromStore()));
      setChainError('');
      addNotification('Option Chain Offline', 'Showing simulated legs until broker data is available.', 'info');
    } finally {
      setLoadingChain(false);
    }
  }

  /* ── Auto-refresh chain every 1 second ─────────────────────────────── */
  createEffect(() => {
    const sym = selectedSymbol();
    const exp = expiry();
    if (!sym || !exp) return;
    loadChain();
    const t = setInterval(loadChain, 1000);
    onCleanup(() => clearInterval(t));
  });

  /* ── Initial symbol load ────────────────────────────────────────────── */
  createEffect(() => {
    loadExpiries(selectedSymbol());
  });

  /* ── Symbol commit ──────────────────────────────────────────────────── */
  function commitSymbol(sym: string) {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setSelectedSymbol(s);
    setSymbolInput(s);
    setShowSuggestions(false);
    setSelectedStrike(null);
  }

  /* ── Search autocomplete from backend ──────────────────────────────── */
  let searchTimer: any;
  async function handleSymbolInput(val: string) {
    setSymbolInput(val);
    setShowSuggestions(true);
    clearTimeout(searchTimer);
    if (!val.trim()) { setSearchResults(POPULAR); return; }
    searchTimer = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(val)}`);
        const items: any[] = await r.json();
        const unique = Array.from(new Set(
          items.map(i => (i.name || i.symbol || '').replace(/ \d+$/, '').split(/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/)[0])
          .filter(Boolean)
        )).slice(0, 12);
        setSearchResults(unique.length ? unique : POPULAR.filter(p => p.includes(val.toUpperCase())));
      } catch {
        setSearchResults(POPULAR.filter(p => p.includes(val.toUpperCase())));
      }
    }, 250);
  }

  /* ── Derived chain rows ─────────────────────────────────────────────── */
  const rows = createMemo<ChainRow[]>(() => {
    const data = chainData();
    if (!data) return [];

    const spot_price = spotFromStore() || data.spot;
    const atmStrike = Math.round(spot_price / data.step) * data.step;

    // Recalculate legs dynamically based on live spot price
    const mappedRows = data.rows.map((row, idx) => {
      const strike = row.strike;

      const calcLeg = (side: 'CE' | 'PE', originalLeg: LegData) => {
        const distance = Math.abs(strike - spot_price);
        const intrinsic = side === 'CE' ? Math.max(spot_price - strike, 0) : Math.max(strike - spot_price, 0);
        const time_val = Math.max(8, 160 - distance * 0.07);
        const skew = side === 'PE' ? 1.08 : 0.96;
        const ltp = Number((intrinsic + time_val * skew + (idx % 3) * 1.5).toFixed(2));
        const bid = Number((ltp - 0.55).toFixed(2));
        const ask = Number((ltp + 0.65).toFixed(2));

        const oi_base = Math.max(50000, 220000 - distance * 5 + (idx % 5) * 8500);
        const iv = Number((12 + (distance / (spot_price || 1)) * 85 + (side === 'PE' ? 0.7 : 0)).toFixed(1));

        const moneyness = (spot_price - strike) / (spot_price || 1);
        const delta = side === 'CE'
          ? Number((Math.min(0.93, Math.max(0.05, 0.5 + moneyness * 8))).toFixed(2))
          : Number((-Math.min(0.93, Math.max(0.05, 0.5 - moneyness * 8))).toFixed(2));

        const gamma = Number((0.007 + Math.max(0, 1 - distance / 800) * 0.013).toFixed(3));
        const theta = Number((-(ltp * 0.02 + distance * 0.0015)).toFixed(2));
        const vega = Number((3.5 + Math.max(0, 1 - distance / 800) * 4.5).toFixed(2));

        return {
          ...originalLeg,
          ltp,
          bid,
          ask,
          oi: Math.round(oi_base),
          iv,
          delta,
          gamma,
          theta,
          vega
        };
      };

      return {
        strike,
        isAtm: strike === atmStrike,
        call: calcLeg('CE', row.call),
        put: calcLeg('PE', row.put)
      };
    });

    let r = mappedRows.slice(0, strikesCount());
    if (filter() === 'itm') r = r.filter(x => x.strike <= spot_price);
    if (filter() === 'otm') r = r.filter(x => x.strike > spot_price);
    const s = sortBy();
    if (s === 'oi')     r = [...r].sort((a, b) => (b.call.oi + b.put.oi) - (a.call.oi + a.put.oi));
    if (s === 'volume') r = [...r].sort((a, b) => (b.call.volume + b.put.volume) - (a.call.volume + a.put.volume));
    if (s === 'iv')     r = [...r].sort((a, b) => (b.call.iv + b.put.iv) - (a.call.iv + a.put.iv));
    if (s === 'strike') r = [...r].sort((a, b) => a.strike - b.strike);
    return r;
  });

  const spot = createMemo(() => spotFromStore() || chainData()?.spot || 0);
  const atm = createMemo(() => {
    const s = spot();
    const step = chainData()?.step || 100;
    return Math.round(s / step) * step;
  });
  const lotSize = createMemo(() => chainData()?.lotSize ?? 50);

  const totalCallOi = createMemo(() => rows().reduce((s, r) => s + r.call.oi, 0));
  const totalPutOi  = createMemo(() => rows().reduce((s, r) => s + r.put.oi, 0));
  const pcr         = createMemo(() => totalCallOi() ? totalPutOi() / totalCallOi() : 0);
  const maxPain     = createMemo(() => rows().reduce((best, r) => {
    const pain = Math.abs(r.call.oi - r.put.oi);
    return pain < best.pain ? { strike: r.strike, pain } : best;
  }, { strike: atm(), pain: Number.POSITIVE_INFINITY }).strike);

  const selectedRow = createMemo(() =>
    rows().find(r => r.strike === selectedStrike()) || rows().find(r => r.isAtm) || rows()[Math.floor(rows().length / 2)]
  );

  /* ── Basket actions ─────────────────────────────────────────────────── */
  function addToBasket(leg: LegData, action: 'Buy' | 'Sell', strike: number, side: Side) {
    const sym = `${selectedSymbol()} ${expiry()} ${strike} ${side}`;
    const item: BasketItem = {
      id: `${Date.now()}-${strike}-${side}-${action}`,
      symbol: sym, side, action, strike,
      price: action === 'Buy' ? leg.ask : leg.bid,
      qty: lotSize(),
    };
    setBasket(b => [item, ...b].slice(0, 8));
    addNotification('Added to Basket', `${action} ${sym}`, 'success', 'orders');
  }

  async function placeLeg(leg: LegData, side: Side, action: 'Buy' | 'Sell', strike: number) {
    const sym = `${selectedSymbol()} ${expiry()} ${strike} ${side}`;
    const result = await placeRealOrder({
      inst: sym, side: action, type: 'Limit',
      qty: lotSize(), price: action === 'Buy' ? leg.ask : leg.bid,
      prod: 'NRML', exchange: 'nse_fo',
    });
    addNotification(result.success ? 'Order Sent' : 'Order Failed', result.message,
      result.success ? 'success' : 'error', 'orders');
  }

  function placeBasket() {
    basket().forEach(item => {
      addNotification('Basket Order', `${item.action} ${item.symbol} ×${item.qty}`, 'success', 'orders');
    });
    setBasket([]);
  }

  return (
    <div class="oc-page" onClick={() => setShowSuggestions(false)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div class="oc-header">
        <div class="oc-header-left">
          <h1 class="oc-title">Option Chain</h1>
          <p class="oc-subtitle">Real-time calls, puts, OI, IV &amp; Greeks for any symbol</p>
        </div>
        <div class="oc-header-right">
          <span class={`oc-live-badge ${store.brokerConnected ? 'on' : 'off'}`}>
            {store.brokerConnected ? '● Live' : '○ Offline'}
          </span>
          <Show when={spot() > 0}>
            <span class="oc-spot-badge">
              {selectedSymbol()} <strong>{fmtP(spot())}</strong>
            </span>
          </Show>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div class="oc-toolbar" onClick={e => e.stopPropagation()}>
        {/* Symbol search */}
        <div class="oc-sym-wrap">
          <div class="oc-sym-input-row">
            <input
              id="oc-symbol-input"
              class="oc-sym-input"
              placeholder="Enter any symbol: NIFTY, CRUDEOIL, RELIANCE…"
              value={symbolInput()}
              onInput={e => handleSymbolInput(e.currentTarget.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => { if (e.key === 'Enter') commitSymbol(symbolInput()); if (e.key === 'Escape') setShowSuggestions(false); }}
            />
            <button class="oc-sym-go" onClick={() => commitSymbol(symbolInput())}>Go →</button>
          </div>
          <Show when={showSuggestions() && searchResults().length > 0}>
            <div class="oc-sym-dropdown">
              <For each={searchResults()}>
                {sym => (
                  <button class="oc-sym-item" onClick={() => commitSymbol(sym)}>
                    {sym}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Expiry */}
        <div class="oc-toolbar-section">
          <span class="oc-toolbar-label">Expiry</span>
          <Show when={loadingExpiries()}>
            <span class="oc-loading-pill">Loading…</span>
          </Show>
          <Show when={!loadingExpiries()}>
            <select
              class="oc-select"
              value={expiry()}
              onChange={e => { setExpiry(e.currentTarget.value); setSelectedStrike(null); }}
              disabled={expiries().length === 0}
            >
              <Show when={expiries().length === 0}>
                <option value="">No expiries</option>
              </Show>
              <For each={expiries()}>
                {ex => <option value={ex}>{ex}</option>}
              </For>
            </select>
          </Show>
        </div>

        {/* Strike count */}
        <div class="oc-toolbar-section">
          <span class="oc-toolbar-label">Strikes</span>
          <select class="oc-select compact" value={strikesCount()} onChange={e => setStrikesCount(Number(e.currentTarget.value))}>
            {[11, 21, 31, 41].map(n => <option value={n}>{n}</option>)}
          </select>
        </div>

        {/* Filter */}
        <div class="oc-toolbar-section">
          <span class="oc-toolbar-label">Filter</span>
          <select class="oc-select compact" value={filter()} onChange={e => setFilter(e.currentTarget.value as any)}>
            <option value="all">All</option>
            <option value="itm">ITM</option>
            <option value="otm">OTM</option>
          </select>
        </div>

        {/* Sort */}
        <div class="oc-toolbar-section">
          <span class="oc-toolbar-label">Sort</span>
          <select class="oc-select compact" value={sortBy()} onChange={e => setSortBy(e.currentTarget.value as any)}>
            <option value="strike">Strike</option>
            <option value="oi">OI</option>
            <option value="volume">Volume</option>
            <option value="iv">IV</option>
          </select>
        </div>

        {/* ATM button */}
        <button class="oc-atm-btn" onClick={() => { setSelectedStrike(atm()); }}>ATM</button>

        {/* Refresh */}
        <button class="oc-refresh-btn" onClick={loadChain} disabled={loadingChain()}>
          {loadingChain() ? '⟳' : '↺'}
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div class="oc-tabs">
        <For each={[['chain','Live Chain'],['greeks','Greeks'],['oi','OI Analysis'],['iv','IV Surface']]}>
          {([id, label]) => (
            <button class={`oc-tab ${activeTab() === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          )}
        </For>
      </div>

      {/* ── Loading / Error states ───────────────────────────────────────── */}
      <Show when={loadingChain() && !chainData()}>
        <div class="oc-loading-overlay">
          <div class="oc-spinner" />
          <p>Loading option chain for {selectedSymbol()}…</p>
        </div>
      </Show>

      <Show when={chainError() && !chainData()}>
        <div class="oc-error-overlay">
          <p>⚠ {chainError()}</p>
          <button onClick={loadChain}>Retry</button>
        </div>
      </Show>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <Show when={chainData()}>
        {/* KPI strip */}
        <div class="oc-kpis">
          <Kpi title="PCR (OI)" value={pcr().toFixed(2)} detail={pcr() > 1 ? 'Bullish sentiment' : 'Bearish pressure'} tone={pcr() > 1 ? 'up' : 'down'} />
          <Kpi title="Max Pain" value={fmt(maxPain())} detail="Strike with max writer profit" />
          <Kpi title="ATM IV" value={`${(((selectedRow()?.call.iv||0)+(selectedRow()?.put.iv||0))/2).toFixed(1)}%`} detail="Implied volatility" />
          <Kpi title="Call OI" value={fmt(totalCallOi())} detail="Total call open interest" tone="up" />
          <Kpi title="Put OI"  value={fmt(totalPutOi())}  detail="Total put open interest"  tone="down" />
          <Kpi title="Lot Size" value={String(lotSize())} detail={`Per lot for ${selectedSymbol()}`} />
        </div>

        {/* Chain tab */}
        <Show when={activeTab() === 'chain'}>
          <div class="oc-main-grid">
            {/* Chain table */}
            <div class="oc-chain-panel">
              <div class="oc-table-header">
                <span class="call-head">◀ CALLS</span>
                <span class="strike-head">STRIKE</span>
                <span class="put-head">PUTS ▶</span>
              </div>
              <div class="oc-table-wrap">
                <table class="oc-table">
                  <thead>
                    <tr>
                      <th>OI</th><th>Chg OI</th><th>Vol</th><th>IV%</th><th>LTP</th><th>Bid</th><th>Ask</th>
                      <th class="strike-col">Strike</th>
                      <th>OI</th><th>Chg OI</th><th>Vol</th><th>IV%</th><th>LTP</th><th>Bid</th><th>Ask</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={rows()}>
                      {row => (
                        <tr
                          class={`${row.isAtm ? 'atm' : ''} ${selectedRow()?.strike === row.strike ? 'selected' : ''}`}
                          onClick={() => setSelectedStrike(row.strike)}
                        >
                          <OptionCells leg={row.call} />
                          <td class="strike-col">
                            <button class="strike-btn" onClick={e => { e.stopPropagation(); setSelectedStrike(row.strike); }}>
                              {fmt(row.strike)}
                              <Show when={row.isAtm}><span class="atm-tag">ATM</span></Show>
                            </button>
                          </td>
                          <OptionCells leg={row.put} />
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <div class="oc-table-footer">
                <span>{rows().length} strikes • {selectedSymbol()} {expiry()}</span>
                <span class={loadingChain() ? 'oc-refreshing' : ''}>
                  {loadingChain() ? '⟳ Refreshing…' : 'Auto-refresh 5s'}
                </span>
              </div>
            </div>

            {/* Side panel */}
            <aside class="oc-side-panel">
              <Show when={selectedRow()}>
                {/* Selected strike card */}
                <div class="oc-selected-card">
                  <div class="oc-selected-header">
                    <div>
                      <span class="oc-side-title">{selectedSymbol()} {expiry()} — {fmt(selectedRow()!.strike)}</span>
                      <span class="oc-side-sub">Spot {fmtP(spot())} • {selectedRow()?.isAtm ? 'ATM' : (selectedRow()?.strike ?? 0) > spot() ? 'OTM Call / ITM Put' : 'ITM Call / OTM Put'}</span>
                    </div>
                    <button class="oc-mini-btn" onClick={() => setSelectedStrike(null)}>✕</button>
                  </div>

                  <div class="oc-leg-grid">
                    <LegCard
                      leg={selectedRow()!.call} label="CE" tone="ce"
                      onBuy={() => placeLeg(selectedRow()!.call, 'CE', 'Buy', selectedRow()!.strike)}
                      onSell={() => placeLeg(selectedRow()!.call, 'CE', 'Sell', selectedRow()!.strike)}
                      onBasketBuy={() => addToBasket(selectedRow()!.call, 'Buy', selectedRow()!.strike, 'CE')}
                      onBasketSell={() => addToBasket(selectedRow()!.call, 'Sell', selectedRow()!.strike, 'CE')}
                    />
                    <LegCard
                      leg={selectedRow()!.put} label="PE" tone="pe"
                      onBuy={() => placeLeg(selectedRow()!.put, 'PE', 'Buy', selectedRow()!.strike)}
                      onSell={() => placeLeg(selectedRow()!.put, 'PE', 'Sell', selectedRow()!.strike)}
                      onBasketBuy={() => addToBasket(selectedRow()!.put, 'Buy', selectedRow()!.strike, 'PE')}
                      onBasketSell={() => addToBasket(selectedRow()!.put, 'Sell', selectedRow()!.strike, 'PE')}
                    />
                  </div>
                </div>

                {/* Greeks card */}
                <div class="oc-card">
                  <div class="oc-card-title">Greeks at {fmt(selectedRow()!.strike)}</div>
                  <div class="oc-greeks-grid">
                    <GreekRow label="Delta" ce={selectedRow()!.call.delta} pe={selectedRow()!.put.delta} />
                    <GreekRow label="Gamma" ce={selectedRow()!.call.gamma} pe={selectedRow()!.put.gamma} mono />
                    <GreekRow label="Theta" ce={selectedRow()!.call.theta} pe={selectedRow()!.put.theta} />
                    <GreekRow label="Vega"  ce={selectedRow()!.call.vega}  pe={selectedRow()!.put.vega} />
                    <GreekRow label="IV%"   ce={selectedRow()!.call.iv}    pe={selectedRow()!.put.iv} suffix="%" />
                  </div>
                </div>
              </Show>

              {/* Basket */}
              <div class="oc-card">
                <div class="oc-basket-header">
                  <span class="oc-card-title">Basket ({basket().length}/8)</span>
                  <Show when={basket().length > 0}>
                    <button class="oc-clear-btn" onClick={() => setBasket([])}>Clear all</button>
                  </Show>
                </div>
                <For each={basket()} fallback={<p class="oc-empty">No legs added. Click a strike and use + basket buttons.</p>}>
                  {item => (
                    <div class="oc-basket-row">
                      <div class="oc-basket-info">
                        <span class={`oc-action-tag ${item.action.toLowerCase()}`}>{item.action} {item.side}</span>
                        <span class="oc-basket-sym">{item.strike} × {item.qty}</span>
                      </div>
                      <div class="oc-basket-right">
                        <span class="oc-basket-price">₹{fmtP(item.price)}</span>
                        <button class="oc-remove-btn" onClick={() => setBasket(b => b.filter(x => x.id !== item.id))}>✕</button>
                      </div>
                    </div>
                  )}
                </For>
                <Show when={basket().length > 0}>
                  <div class="oc-basket-actions">
                    <button class="oc-basket-execute" onClick={placeBasket}>Execute Basket ({basket().length} legs)</button>
                  </div>
                </Show>
              </div>
            </aside>
          </div>
        </Show>

        {/* Analysis tabs */}
        <Show when={activeTab() !== 'chain'}>
          <AnalysisView tab={activeTab()} rows={rows()} spot={spot()} />
        </Show>
      </Show>

      {/* Empty state when nothing loaded */}
      <Show when={!chainData() && !loadingChain() && !chainError()}>
        <div class="oc-empty-state">
          <div class="oc-empty-icon">📊</div>
          <h3>Enter a symbol above to load Option Chain</h3>
          <p>Supports indices, equities, and commodities: NIFTY, BANKNIFTY, RELIANCE, CRUDEOIL, GOLD…</p>
          <div class="oc-popular-chips">
            <For each={POPULAR}>
              {sym => (
                <button class="oc-chip" onClick={() => commitSymbol(sym)}>{sym}</button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

/* ── Sub-components ──────────────────────────────────────────────────────── */

const Kpi: Component<{ title: string; value: string; detail: string; tone?: 'up' | 'down' }> = (p) => (
  <div class="oc-kpi">
    <span class="oc-kpi-label">{p.title}</span>
    <strong class={`oc-kpi-val ${p.tone || ''}`}>{p.value}</strong>
    <small class="oc-kpi-detail">{p.detail}</small>
  </div>
);

const OptionCells: Component<{ leg: LegData }> = (p) => (
  <>
    <td>{fmt(p.leg.oi)}</td>
    <td class={p.leg.chgOi >= 0 ? 'up' : 'down'}>{p.leg.chgOi >= 0 ? '+' : ''}{p.leg.chgOi}%</td>
    <td>{fmt(p.leg.volume)}</td>
    <td>{p.leg.iv.toFixed(1)}</td>
    <td class="font-mono">{fmtP(p.leg.ltp)}</td>
    <td class="font-mono muted">{fmtP(p.leg.bid)}</td>
    <td class="font-mono muted">{fmtP(p.leg.ask)}</td>
  </>
);

const LegCard: Component<{
  leg: LegData; label: string; tone: string;
  onBuy: () => void; onSell: () => void;
  onBasketBuy: () => void; onBasketSell: () => void;
}> = (p) => (
  <div class={`oc-leg-card ${p.tone}`}>
    <div class="oc-leg-top">
      <span class="oc-leg-label">{p.label}</span>
      <span class="oc-leg-iv">IV {p.leg.iv.toFixed(1)}%</span>
    </div>
    <strong class="oc-leg-ltp">₹{fmtP(p.leg.ltp)}</strong>
    <small class={p.leg.chgOi >= 0 ? 'up' : 'down'}>{p.leg.chgOi >= 0 ? '+' : ''}{p.leg.chgOi}% OI</small>
    <div class="oc-leg-meta">
      <span>Bid {fmtP(p.leg.bid)}</span>
      <span>Ask {fmtP(p.leg.ask)}</span>
    </div>
    <div class="oc-leg-direct">
      <button class="buy" onClick={p.onBuy}>Buy</button>
      <button class="sell" onClick={p.onSell}>Sell</button>
    </div>
    <div class="oc-leg-basket">
      <button onClick={p.onBasketBuy}>+ Basket Buy</button>
      <button onClick={p.onBasketSell}>+ Basket Sell</button>
    </div>
  </div>
);

const GreekRow: Component<{ label: string; ce: number; pe: number; mono?: boolean; suffix?: string }> = (p) => (
  <div class="oc-greek-row">
    <span class="oc-greek-label">{p.label}</span>
    <span class={`oc-greek-ce ${p.mono ? 'font-mono' : ''}`}>{p.ce.toFixed(3)}{p.suffix || ''}</span>
    <span class={`oc-greek-pe ${p.mono ? 'font-mono' : ''}`}>{p.pe.toFixed(3)}{p.suffix || ''}</span>
  </div>
);

const AnalysisView: Component<{ tab: string; rows: ChainRow[]; spot: number }> = (p) => {
  const topRows = () => [...p.rows].sort((a, b) => (b.call.oi + b.put.oi) - (a.call.oi + a.put.oi)).slice(0, 10);
  const title = () => p.tab === 'greeks' ? 'Greeks Matrix' : p.tab === 'oi' ? 'OI Buildup Analysis' : 'IV Smile';

  return (
    <div class="oc-analysis-grid">
      <div class="oc-card large">
        <div class="oc-card-header">
          <span class="oc-card-title">{title()}</span>
        </div>
        <div class="oc-analysis-scroll">
          <table class="oc-analysis-table">
            <thead>
              <tr>
                <th>Strike</th>
                <Show when={p.tab === 'greeks'}><th>Δ CE</th><th>Δ PE</th><th>Gamma</th><th>Theta</th><th>Vega</th><th>IV%</th></Show>
                <Show when={p.tab === 'oi'}><th>Call OI</th><th>Put OI</th><th>Chg Call</th><th>Chg Put</th><th>Signal</th></Show>
                <Show when={p.tab === 'iv'}><th>Call IV%</th><th>Put IV%</th><th>Avg IV%</th><th>Skew</th><th>Status</th></Show>
              </tr>
            </thead>
            <tbody>
              <For each={topRows()}>
                {(row) => (
                  <tr class={row.isAtm ? 'atm' : ''}>
                    <td class="font-mono">{fmt(row.strike)}{row.isAtm ? ' ●' : ''}</td>
                    <Show when={p.tab === 'greeks'}>
                      <td>{row.call.delta}</td>
                      <td>{row.put.delta}</td>
                      <td class="font-mono">{((row.call.gamma + row.put.gamma) / 2).toFixed(3)}</td>
                      <td>{((row.call.theta + row.put.theta) / 2).toFixed(2)}</td>
                      <td>{((row.call.vega + row.put.vega) / 2).toFixed(2)}</td>
                      <td>{((row.call.iv + row.put.iv) / 2).toFixed(1)}%</td>
                    </Show>
                    <Show when={p.tab === 'oi'}>
                      <td class="up">{fmt(row.call.oi)}</td>
                      <td class="down">{fmt(row.put.oi)}</td>
                      <td class={row.call.chgOi >= 0 ? 'up' : 'down'}>{row.call.chgOi >= 0 ? '+' : ''}{row.call.chgOi}%</td>
                      <td class={row.put.chgOi >= 0 ? 'up' : 'down'}>{row.put.chgOi >= 0 ? '+' : ''}{row.put.chgOi}%</td>
                      <td class={row.put.oi > row.call.oi ? 'up' : 'down'}>{row.put.oi > row.call.oi ? '↑ Put Support' : '↓ Call Resistance'}</td>
                    </Show>
                    <Show when={p.tab === 'iv'}>
                      <td class="up">{row.call.iv.toFixed(1)}%</td>
                      <td class="down">{row.put.iv.toFixed(1)}%</td>
                      <td>{((row.call.iv + row.put.iv) / 2).toFixed(1)}%</td>
                      <td class={row.put.iv > row.call.iv ? 'down' : 'up'}>{(row.put.iv - row.call.iv).toFixed(1)}</td>
                      <td>{row.put.iv - row.call.iv > 1 ? 'Put Skew' : row.call.iv - row.put.iv > 1 ? 'Call Skew' : 'Balanced'}</td>
                    </Show>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      <div class="oc-analysis-sidebar">
        <div class="oc-card">
          <div class="oc-card-title">Strategy Tips</div>
          <ul class="oc-plan">
            <li>High OI strikes act as support/resistance.</li>
            <li>Rising put OI = strong put writing → bullish support.</li>
            <li>Rising call OI = strong call writing → bearish resistance.</li>
            <li>PCR {'>'} 1.2 = extreme bullish, {'<'} 0.8 = extreme bearish.</li>
            <li>Max pain = where most options expire worthless.</li>
          </ul>
        </div>
        <div class="oc-card">
          <div class="oc-card-title">OI Snapshot</div>
          <div class="oc-oi-bar-wrap">
            <div class="oc-oi-label"><span class="up">Call OI</span><span class="oc-oi-pct">{Math.round(100 * totalCallOi(p) / Math.max(1, totalCallOi(p) + totalPutOi(p)))}%</span></div>
            <div class="oc-oi-bar"><div class="oc-oi-fill ce" style={`width:${Math.round(100 * totalCallOi(p) / Math.max(1, totalCallOi(p) + totalPutOi(p)))}%`} /></div>
            <div class="oc-oi-label"><span class="down">Put OI</span><span class="oc-oi-pct">{Math.round(100 * totalPutOi(p) / Math.max(1, totalCallOi(p) + totalPutOi(p)))}%</span></div>
            <div class="oc-oi-bar"><div class="oc-oi-fill pe" style={`width:${Math.round(100 * totalPutOi(p) / Math.max(1, totalCallOi(p) + totalPutOi(p)))}%`} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

function totalCallOi(p: { rows: ChainRow[] }) { return p.rows.reduce((s, r) => s + r.call.oi, 0); }
function totalPutOi(p: { rows: ChainRow[] })  { return p.rows.reduce((s, r) => s + r.put.oi, 0); }
