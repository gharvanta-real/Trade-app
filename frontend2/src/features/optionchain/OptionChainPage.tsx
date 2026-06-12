import { createMemo, createSignal, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { addNotification, placeRealOrder, store } from '../../store/tradingStore';
import './optionchain.css';

type ChainSymbol = 'NIFTY 50' | 'BANKNIFTY' | 'FINNIFTY';
type Side = 'CE' | 'PE';

interface ChainRow {
  strike: number;
  call: LegData;
  put: LegData;
}

interface LegData {
  side: Side;
  symbol: string;
  ltp: number;
  bid: number;
  ask: number;
  oi: number;
  chgOi: number;
  volume: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface BasketItem {
  id: string;
  symbol: string;
  side: Side;
  action: 'Buy' | 'Sell';
  strike: number;
  price: number;
  qty: number;
}

const expiries = ['23 MAY 2025', '30 MAY 2025', '06 JUN 2025', '27 JUN 2025'];
const lotSizes: Record<ChainSymbol, number> = { 'NIFTY 50': 50, BANKNIFTY: 15, FINNIFTY: 40 };

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatPrice(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function makeLeg(symbol: ChainSymbol, expiry: string, strike: number, side: Side, spot: number, index: number): LegData {
  const distance = Math.abs(strike - spot);
  const intrinsic = side === 'CE' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  const timeValue = Math.max(12, 180 - distance * 0.075);
  const skew = side === 'PE' ? 1.08 : 0.96;
  const ltp = Number((intrinsic + timeValue * skew + (index % 3) * 1.7).toFixed(2));
  const oiBase = Math.max(58000, 245000 - distance * 6 + (index % 5) * 9200);
  const chgBase = ((spot - strike) / spot) * 100;
  const chgOi = Number(((side === 'CE' ? -chgBase : chgBase) + ((index % 4) - 1.5) * 1.8).toFixed(2));
  const iv = Number((12 + distance / spot * 90 + (side === 'PE' ? 0.7 : 0)).toFixed(1));
  const moneyness = (spot - strike) / spot;

  return {
    side,
    symbol: `${symbol.replace(' 50', '')} ${expiry} ${strike} ${side}`,
    ltp,
    bid: Number((ltp - 0.65).toFixed(2)),
    ask: Number((ltp + 0.75).toFixed(2)),
    oi: Math.round(oiBase),
    chgOi,
    volume: Math.round(oiBase * (1.45 + (index % 4) * 0.12)),
    iv,
    delta: Number((side === 'CE' ? Math.min(0.92, Math.max(0.08, 0.5 + moneyness * 8)) : -Math.min(0.92, Math.max(0.08, 0.5 - moneyness * 8))).toFixed(2)),
    gamma: Number((0.008 + Math.max(0, 1 - distance / 900) * 0.014).toFixed(3)),
    theta: Number((-(ltp * 0.022 + distance * 0.002)).toFixed(2)),
    vega: Number((4 + Math.max(0, 1 - distance / 900) * 5).toFixed(2)),
  };
}

export const OptionChainPage: Component = () => {
  const [symbol, setSymbol] = createSignal<ChainSymbol>('NIFTY 50');
  const [expiry, setExpiry] = createSignal(expiries[0]);
  const [activeTab, setActiveTab] = createSignal('chain');
  const [search, setSearch] = createSignal('');
  const [filter, setFilter] = createSignal<'all' | 'itm' | 'otm'>('all');
  const [sortBy, setSortBy] = createSignal<'strike' | 'oi' | 'volume' | 'iv'>('strike');
  const [selectedStrike, setSelectedStrike] = createSignal<number | null>(null);
  const [basket, setBasket] = createSignal<BasketItem[]>([]);
  const [alertStrike, setAlertStrike] = createSignal<number | null>(null);

  const spot = createMemo(() => store.symbols[symbol()]?.price || (symbol() === 'BANKNIFTY' ? 55100 : symbol() === 'FINNIFTY' ? 25200 : 23150));
  const step = createMemo(() => symbol() === 'BANKNIFTY' ? 100 : 50);
  const atm = createMemo(() => roundToStep(spot(), step()));

  const rows = createMemo<ChainRow[]>(() => {
    const base = atm();
    const strikes = Array.from({ length: 21 }, (_, i) => base + (i - 10) * step());
    let chain = strikes.map((strike, index) => ({
      strike,
      call: makeLeg(symbol(), expiry(), strike, 'CE', spot(), index),
      put: makeLeg(symbol(), expiry(), strike, 'PE', spot(), index),
    }));

    const query = search().trim();
    if (query) chain = chain.filter(row => String(row.strike).includes(query));
    if (filter() === 'itm') chain = chain.filter(row => row.strike <= spot());
    if (filter() === 'otm') chain = chain.filter(row => row.strike > spot());

    const sort = sortBy();
    chain = [...chain].sort((a, b) => {
      if (sort === 'oi') return (b.call.oi + b.put.oi) - (a.call.oi + a.put.oi);
      if (sort === 'volume') return (b.call.volume + b.put.volume) - (a.call.volume + a.put.volume);
      if (sort === 'iv') return (b.call.iv + b.put.iv) - (a.call.iv + a.put.iv);
      return a.strike - b.strike;
    });
    return chain;
  });

  const selectedRow = createMemo(() => rows().find(row => row.strike === (selectedStrike() || atm())) || rows()[Math.floor(rows().length / 2)]);
  const totalCallOi = createMemo(() => rows().reduce((sum, row) => sum + row.call.oi, 0));
  const totalPutOi = createMemo(() => rows().reduce((sum, row) => sum + row.put.oi, 0));
  const pcr = createMemo(() => totalCallOi() ? totalPutOi() / totalCallOi() : 0);
  const maxPain = createMemo(() => rows().reduce((best, row) => {
    const pain = Math.abs(row.call.oi - row.put.oi);
    return pain < best.pain ? { strike: row.strike, pain } : best;
  }, { strike: atm(), pain: Number.POSITIVE_INFINITY }).strike);

  const selectRow = (strike: number) => {
    setSelectedStrike(strike);
    setAlertStrike(strike);
  };

  const addToBasket = (leg: LegData, action: 'Buy' | 'Sell', strike: number) => {
    const item: BasketItem = {
      id: `${Date.now()}-${leg.symbol}-${action}`,
      symbol: leg.symbol,
      side: leg.side,
      action,
      strike,
      price: action === 'Buy' ? leg.ask : leg.bid,
      qty: lotSizes[symbol()],
    };
    setBasket(items => [item, ...items].slice(0, 8));
    addNotification('Added to Basket', `${action} ${leg.symbol}`, 'success', 'orders');
  };

  const placeLegOrder = async (leg: LegData, action: 'Buy' | 'Sell') => {
    const result = await placeRealOrder({
      inst: leg.symbol,
      side: action,
      type: 'Limit',
      qty: lotSizes[symbol()],
      price: action === 'Buy' ? leg.ask : leg.bid,
      prod: 'NRML',
      exchange: 'nse_fo',
    });
    addNotification(result.success ? 'Order Sent' : 'Order Failed', result.message, result.success ? 'success' : 'error', 'orders');
  };

  const clearBasket = () => {
    setBasket([]);
    addNotification('Basket Cleared', 'Option basket is empty now.', 'info');
  };

  return (
    <div class="oc-page">
      <div class="oc-header">
        <div>
          <h1 class="oc-title">Option Chain</h1>
          <p class="oc-subtitle">Analyze calls, puts, OI, IV and quick actions in real time</p>
        </div>
        <div class="oc-header-right">
          <span class={`oc-live-badge ${store.brokerConnected ? 'on' : 'off'}`}>{store.brokerConnected ? 'Live Broker' : 'Offline'}</span>
          <span class="oc-updated">Spot {formatPrice(spot())}</span>
        </div>
      </div>

      <div class="oc-tabs">
        <For each={[
          ['chain', 'Live Chain'],
          ['greeks', 'Greeks'],
          ['oi', 'OI Analysis'],
          ['iv', 'IV Surface'],
        ]}>
          {(tab) => (
            <button class={`oc-tab ${activeTab() === tab[0] ? 'active' : ''}`} onClick={() => setActiveTab(tab[0])}>{tab[1]}</button>
          )}
        </For>
      </div>

      <div class="oc-toolbar">
        <select class="oc-select" value={symbol()} onChange={(e) => { setSymbol(e.currentTarget.value as ChainSymbol); setSelectedStrike(null); }}>
          <option value="NIFTY 50">NIFTY 50</option>
          <option value="BANKNIFTY">BANKNIFTY</option>
          <option value="FINNIFTY">FINNIFTY</option>
        </select>
        <select class="oc-select" value={expiry()} onChange={(e) => setExpiry(e.currentTarget.value)}>
          <For each={expiries}>{(ex) => <option value={ex}>{ex}</option>}</For>
        </select>
        <input class="oc-search" value={search()} onInput={(e) => setSearch(e.currentTarget.value)} placeholder="Search strike" />
        <button class="oc-tool-btn" onClick={() => { setSearch(''); setSelectedStrike(atm()); }}>ATM</button>
        <select class="oc-select compact" value={filter()} onChange={(e) => setFilter(e.currentTarget.value as any)}>
          <option value="all">All</option>
          <option value="itm">ITM</option>
          <option value="otm">OTM</option>
        </select>
        <select class="oc-select compact" value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value as any)}>
          <option value="strike">Sort Strike</option>
          <option value="oi">Sort OI</option>
          <option value="volume">Sort Volume</option>
          <option value="iv">Sort IV</option>
        </select>
      </div>

      <Show when={activeTab() === 'chain'}>
        <div class="oc-kpis">
          <Kpi title="PCR (OI)" value={pcr().toFixed(2)} detail={pcr() > 1 ? 'Put writing strong' : 'Call writing visible'} tone={pcr() > 1 ? 'up' : 'down'} />
          <Kpi title="Max Pain" value={formatNumber(maxPain())} detail="Nearest pressure strike" />
          <Kpi title="ATM IV" value={`${(((selectedRow()?.call.iv || 0) + (selectedRow()?.put.iv || 0)) / 2).toFixed(1)}%`} detail="Moderate volatility" />
          <Kpi title="Total Call OI" value={formatNumber(totalCallOi())} detail="+5.6% session" tone="up" />
          <Kpi title="Total Put OI" value={formatNumber(totalPutOi())} detail="+3.2% session" tone="up" />
          <Kpi title="Market Bias" value={pcr() > 1 ? 'Bullish' : 'Neutral'} detail="OI weighted reading" />
        </div>

        <div class="oc-main-grid">
          <div class="oc-chain-panel">
            <div class="oc-table-header">
              <span class="call-head">CALLS</span>
              <span class="strike-head">STRIKE</span>
              <span class="put-head">PUTS</span>
            </div>
            <div class="oc-table-wrap">
              <table class="oc-table">
                <thead>
                  <tr>
                    <th>OI</th><th>Chg OI</th><th>Vol</th><th>IV</th><th>LTP</th><th>Bid</th><th>Ask</th>
                    <th class="strike-col">Strike</th>
                    <th>OI</th><th>Chg OI</th><th>Vol</th><th>IV</th><th>LTP</th><th>Bid</th><th>Ask</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={rows()}>
                    {(row) => (
                      <tr class={`${row.strike === atm() ? 'atm' : ''} ${selectedRow()?.strike === row.strike ? 'selected' : ''}`} onClick={() => selectRow(row.strike)}>
                        <OptionCells leg={row.call} />
                        <td class="strike-col">
                          <button class="strike-btn" onClick={(e) => { e.stopPropagation(); selectRow(row.strike); }}>
                            {formatNumber(row.strike)}
                            <Show when={row.strike === atm()}><span>ATM</span></Show>
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
              <span>Showing {rows().length} strikes around ATM</span>
              <span>Last updated just now</span>
            </div>
          </div>

          <aside class="oc-side-panel">
            <div class="oc-selected-card">
              <div class="oc-selected-header">
                <div>
                  <span class="oc-side-title">{symbol()} {expiry()} {selectedRow()?.strike}</span>
                  <span class="oc-side-sub">Spot {formatPrice(spot())}</span>
                </div>
                <button class="oc-mini-btn" onClick={() => setSelectedStrike(null)}>x</button>
              </div>
              <div class="oc-leg-grid">
                <LegCard leg={selectedRow()?.call} actionLabel="CE" onBuy={() => { const row = selectedRow(); if (row) placeLegOrder(row.call, 'Buy'); }} onSell={() => { const row = selectedRow(); if (row) placeLegOrder(row.call, 'Sell'); }} />
                <LegCard leg={selectedRow()?.put} actionLabel="PE" onBuy={() => { const row = selectedRow(); if (row) placeLegOrder(row.put, 'Buy'); }} onSell={() => { const row = selectedRow(); if (row) placeLegOrder(row.put, 'Sell'); }} />
              </div>
              <div class="oc-side-actions">
                <button onClick={() => { const row = selectedRow(); if (row) addToBasket(row.call, 'Buy', row.strike); }}>Add Buy CE</button>
                <button onClick={() => { const row = selectedRow(); if (row) addToBasket(row.put, 'Buy', row.strike); }}>Add Buy PE</button>
                <button onClick={() => { const row = selectedRow(); if (row) addToBasket(row.call, 'Sell', row.strike); }}>Add Sell CE</button>
                <button onClick={() => { const row = selectedRow(); if (row) addToBasket(row.put, 'Sell', row.strike); }}>Add Sell PE</button>
              </div>
            </div>

            <div class="oc-card">
              <div class="oc-card-title">Basket ({basket().length})</div>
              <For each={basket()} fallback={<p class="oc-empty">No legs added yet.</p>}>
                {(item) => (
                  <div class="oc-basket-row">
                    <div>
                      <span class={`oc-action ${item.action.toLowerCase()}`}>{item.action} {item.side}</span>
                      <span>{item.strike} x {item.qty}</span>
                    </div>
                    <span class="font-mono">Rs. {formatPrice(item.price)}</span>
                  </div>
                )}
              </For>
              <div class="oc-basket-actions">
                <button disabled={basket().length === 0} onClick={clearBasket}>Clear</button>
                <button disabled={basket().length === 0} onClick={() => addNotification('Basket Ready', 'Review legs before execution.', 'info', 'orders')}>Review</button>
              </div>
            </div>

            <div class="oc-card">
              <div class="oc-card-title">Quick Alert</div>
              <div class="oc-alert-row">
                <span>Alert at strike</span>
                <input value={alertStrike() || selectedRow()?.strike || atm()} onInput={(e) => setAlertStrike(Number(e.currentTarget.value))} />
              </div>
              <button class="oc-wide-btn" onClick={() => addNotification('Alert Created', `${symbol()} ${alertStrike() || selectedRow()?.strike || atm()} option alert is active.`, 'success', 'alerts')}>Create Alert</button>
            </div>
          </aside>
        </div>
      </Show>

      <Show when={activeTab() !== 'chain'}>
        <AnalysisView tab={activeTab()} rows={rows()} />
      </Show>
    </div>
  );
};

const Kpi: Component<{ title: string; value: string; detail: string; tone?: 'up' | 'down' }> = (props) => (
  <div class="oc-kpi">
    <span>{props.title}</span>
    <strong class={props.tone || ''}>{props.value}</strong>
    <small class={props.tone || ''}>{props.detail}</small>
  </div>
);

const OptionCells: Component<{ leg: LegData }> = (props) => (
  <>
    <td>{formatNumber(props.leg.oi)}</td>
    <td class={props.leg.chgOi >= 0 ? 'up' : 'down'}>{props.leg.chgOi >= 0 ? '+' : ''}{props.leg.chgOi}%</td>
    <td>{formatNumber(props.leg.volume)}</td>
    <td>{props.leg.iv.toFixed(1)}</td>
    <td class="font-mono">{formatPrice(props.leg.ltp)}</td>
    <td class="font-mono">{formatPrice(props.leg.bid)}</td>
    <td class="font-mono">{formatPrice(props.leg.ask)}</td>
  </>
);

const LegCard: Component<{ leg?: LegData; actionLabel: Side; onBuy: () => void; onSell: () => void }> = (props) => (
  <div class={`oc-leg-card ${props.actionLabel.toLowerCase()}`}>
    <span>{props.actionLabel}</span>
    <strong>Rs. {formatPrice(props.leg?.ltp || 0)}</strong>
    <small class={(props.leg?.chgOi || 0) >= 0 ? 'up' : 'down'}>{(props.leg?.chgOi || 0) >= 0 ? '+' : ''}{props.leg?.chgOi || 0}% OI</small>
    <div class="oc-leg-meta">
      <span>Bid {formatPrice(props.leg?.bid || 0)}</span>
      <span>Ask {formatPrice(props.leg?.ask || 0)}</span>
    </div>
    <div class="oc-leg-actions">
      <button class="buy" onClick={props.onBuy}>Buy</button>
      <button class="sell" onClick={props.onSell}>Sell</button>
    </div>
  </div>
);

const AnalysisView: Component<{ tab: string; rows: ChainRow[] }> = (props) => {
  const topRows = () => [...props.rows].sort((a, b) => (b.call.oi + b.put.oi) - (a.call.oi + a.put.oi)).slice(0, 8);
  return (
    <div class="oc-analysis-grid">
      <div class="oc-card large">
        <div class="oc-card-title">{props.tab === 'greeks' ? 'Greeks Matrix' : props.tab === 'oi' ? 'OI Buildup' : 'IV Smile'}</div>
        <table class="oc-analysis-table">
          <thead>
            <tr><th>Strike</th><th>Call Delta</th><th>Put Delta</th><th>Gamma</th><th>Theta</th><th>IV</th><th>Signal</th></tr>
          </thead>
          <tbody>
            <For each={topRows()}>
              {(row) => (
                <tr>
                  <td>{formatNumber(row.strike)}</td>
                  <td>{row.call.delta}</td>
                  <td>{row.put.delta}</td>
                  <td>{((row.call.gamma + row.put.gamma) / 2).toFixed(3)}</td>
                  <td>{((row.call.theta + row.put.theta) / 2).toFixed(2)}</td>
                  <td>{((row.call.iv + row.put.iv) / 2).toFixed(1)}%</td>
                  <td class={row.put.oi > row.call.oi ? 'up' : 'down'}>{row.put.oi > row.call.oi ? 'Put Support' : 'Call Resistance'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <div class="oc-card">
        <div class="oc-card-title">Action Plan</div>
        <ul class="oc-plan">
          <li>Use ATM row for fastest scalps and tighter spreads.</li>
          <li>Prefer strikes with rising OI and higher volume.</li>
          <li>Add both legs to basket before executing spreads.</li>
          <li>Create alerts near support and resistance strikes.</li>
        </ul>
      </div>
    </div>
  );
};
