import { createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { store, placeRealOrder, searchInstruments } from '../store/tradingStore';

interface OrderModalProps {
  isOpen: () => boolean;
  onClose: () => void;
  defaultSymbol?: string;
  defaultSide?: 'Buy' | 'Sell';
}

const LOT_SIZES: Record<string, number> = {
  'NIFTY 50': 50, 'BANKNIFTY': 15, 'FINNIFTY': 40, 'MIDCPNIFTY': 75,
};

const EXCHANGE_MAP: Record<string, string> = {
  'NIFTY 50': 'nse_fo', 'BANKNIFTY': 'nse_fo', 'FINNIFTY': 'nse_fo', 'MIDCPNIFTY': 'nse_fo',
};

export const OrderModal: Component<OrderModalProps> = (props) => {
  const [side, setSide] = createSignal<'Buy' | 'Sell'>(props.defaultSide || 'Buy');
  const [orderType, setOrderType] = createSignal<'Market' | 'Limit' | 'SL' | 'SL-M'>('Market');
  const [product, setProduct] = createSignal<'MIS' | 'NRML' | 'CNC'>('MIS');
  const [validity, setValidity] = createSignal<'DAY' | 'IOC'>('DAY');
  const [qty, setQty] = createSignal(1);
  const [lots, setLots] = createSignal(1);
  const [price, setPrice] = createSignal(0);
  const [triggerPrice, setTriggerPrice] = createSignal(0);
  const [amo, setAmo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal(props.defaultSymbol || '');
  const [searchResults, setSearchResults] = createSignal<any[]>([]);
  const [showSearch, setShowSearch] = createSignal(false);
  const [selectedInst, setSelectedInst] = createSignal(props.defaultSymbol || 'NIFTY 50');

  const lotSize = () => LOT_SIZES[selectedInst()] || store.symbols[selectedInst()]?.lotSize || 1;
  const ltp = () => store.symbols[selectedInst()]?.price || 0;
  const isUp = () => store.symbols[selectedInst()]?.up ?? true;
  const change = () => store.symbols[selectedInst()]?.change || 0;
  const pct = () => store.symbols[selectedInst()]?.pct || 0;
  const available = () => store.margins.available;

  const effectivePrice = () => orderType() === 'Market' ? ltp() : price();
  const totalValue = () => qty() * effectivePrice();
  const brokerage = () => Math.min(20, totalValue() * 0.0003);
  const stt = () => side() === 'Sell' ? totalValue() * 0.00025 : 0;
  const sebi = () => totalValue() * 0.0001;
  const gst = () => (brokerage() + sebi()) * 0.18;
  const totalCharges = () => brokerage() + stt() + sebi() + gst();
  const netValue = () => side() === 'Buy' ? totalValue() + totalCharges() : totalValue() - totalCharges();
  const isInsufficient = () => side() === 'Buy' && available() > 0 && netValue() > available();

  createEffect(() => {
    if (!props.isOpen()) return;
    const nextSymbol = props.defaultSymbol || 'NIFTY 50';
    setSelectedInst(nextSymbol);
    setSearchQuery(nextSymbol);
    setSide(props.defaultSide || 'Buy');
    setShowSearch(false);
  });

  createEffect(() => {
    const inst = selectedInst();
    const lp = store.symbols[inst]?.price || 0;
    setPrice(lp);
    setTriggerPrice(lp > 0 ? +(lp * (side() === 'Buy' ? 0.995 : 1.005)).toFixed(2) : 0);
    setQty(lotSize());
    setLots(1);
  });

  createEffect(() => {
    const q = searchQuery();
    if (q.length >= 1) {
      const timer = setTimeout(async () => {
        const results = await searchInstruments(q);
        setSearchResults(results);
        setShowSearch(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowSearch(false);
    }
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

  const handleSelectInstrument = (inst: any) => {
    setSelectedInst(inst.name);
    setSearchQuery(inst.name);
    setShowSearch(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
    if (e.key === 'Enter' && !loading()) handlePlaceOrder();
  };

  onMount(() => window.addEventListener('keydown', handleKeyDown));
  onCleanup(() => window.removeEventListener('keydown', handleKeyDown));

  const handlePlaceOrder = async () => {
    if (loading()) return;
    setLoading(true);
    try {
      const result = await placeRealOrder({
        inst: selectedInst(),
        side: side(),
        type: orderType(),
        qty: qty(),
        price: effectivePrice(),
        trigger: orderType() === 'SL' || orderType() === 'SL-M' ? triggerPrice() : 0,
        prod: product(),
        validity: validity(),
        amo: amo(),
        exchange: EXCHANGE_MAP[selectedInst()],
      });
      if (result.success) {
        props.onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtINR = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Show when={props.isOpen()}>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          'z-index': 9999,
          display: 'flex', 'align-items': 'center', 'justify-content': 'center',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      >
        {/* Modal card */}
        <div style={{
          background: 'var(--theme-bg-surface)', border: '1px solid var(--theme-border)',
          'border-radius': '14px', width: '520px', 'max-height': '90vh', overflow: 'auto',
          'box-shadow': '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--theme-border)',
          animation: 'modalIn 0.18s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
            padding: '14px 18px', 'border-bottom': '1px solid var(--theme-border)',
            background: 'var(--theme-bg-surface-elevated)',
            'border-radius': '14px 14px 0 0',
          }}>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
              <div style={{
                width: '8px', height: '8px', 'border-radius': '50%',
                background: side() === 'Buy' ? 'var(--theme-color-neutral)' : 'var(--theme-color-down)',
              }} />
              <span style={{ 'font-family': 'var(--sys-font-display)', 'font-weight': '700', 'font-size': '15px' }}>
                Order Ticket
              </span>
              <Show when={store.paperTradeMode}>
                <span style={{
                  background: 'var(--theme-color-neutral-bg)', color: 'var(--theme-color-neutral)',
                  padding: '2px 8px', 'border-radius': '20px', 'font-size': '10px', 'font-weight': '600',
                }}>PAPER</span>
              </Show>
            </div>
            <button onClick={props.onClose} style={{
              color: 'var(--theme-text-muted)', 'font-size': '18px', width: '28px', height: '28px',
              display: 'flex', 'align-items': 'center', 'justify-content': 'center',
              'border-radius': '6px', transition: 'background 0.15s',
            }}>✕</button>
          </div>

          <div style={{ padding: '16px 18px', display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
            {/* Instrument search */}
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', 'align-items': 'center', gap: '8px',
                background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                'border-radius': '8px', padding: '8px 12px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-muted)" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21L16.65 16.65"/>
                </svg>
                <input
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  onFocus={() => searchResults().length > 0 && setShowSearch(true)}
                  placeholder="Search instrument..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--theme-text-primary)', 'font-size': '13px', 'font-weight': '600',
                  }}
                />
                <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end' }}>
                  <span style={{
                    'font-family': 'var(--sys-font-mono)', 'font-size': '15px', 'font-weight': '700',
                    color: isUp() ? 'var(--theme-color-up)' : 'var(--theme-color-down)',
                  }}>₹{fmtINR(ltp())}</span>
                  <span style={{
                    'font-size': '10px', 'font-family': 'var(--sys-font-mono)',
                    color: isUp() ? 'var(--theme-color-up)' : 'var(--theme-color-down)',
                  }}>
                    {change() >= 0 ? '+' : ''}{change().toFixed(2)} ({pct() >= 0 ? '+' : ''}{pct().toFixed(2)}%)
                  </span>
                </div>
              </div>
              <Show when={showSearch() && searchResults().length > 0}>
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, 'margin-top': '4px',
                  background: 'var(--theme-bg-surface)', border: '1px solid var(--theme-border)',
                  'border-radius': '8px', 'box-shadow': '0 8px 24px rgba(0,0,0,0.3)',
                  'z-index': 100, 'max-height': '200px', overflow: 'auto',
                }}>
                  <For each={searchResults()}>
                    {(inst) => (
                      <div
                        onClick={() => handleSelectInstrument(inst)}
                        style={{
                          display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                          padding: '8px 12px', cursor: 'pointer', transition: 'background 0.1s',
                          'border-bottom': '1px solid var(--theme-border-light)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-bg-surface-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <div>
                          <div style={{ 'font-weight': '600', 'font-size': '12px' }}>{inst.name}</div>
                          <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)' }}>{inst.exchange} · {inst.type}</div>
                        </div>
                        <Show when={inst.lot_size > 1}>
                          <span style={{ 'font-size': '10px', color: 'var(--theme-text-muted)' }}>Lot: {inst.lot_size}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Buy / Sell toggle */}
            <div style={{
              display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px',
              background: 'var(--theme-bg-surface-elevated)', 'border-radius': '10px', padding: '4px',
            }}>
              <button
                onClick={() => setSide('Buy')}
                style={{
                  padding: '10px', 'border-radius': '6px', 'font-weight': '700',
                  'font-size': '13px', 'letter-spacing': '0.5px', transition: 'all 0.2s',
                  background: side() === 'Buy' ? 'var(--theme-color-neutral)' : 'transparent',
                  color: side() === 'Buy' ? '#fff' : 'var(--theme-text-muted)',
                }}
              >BUY</button>
              <button
                onClick={() => setSide('Sell')}
                style={{
                  padding: '10px', 'border-radius': '6px', 'font-weight': '700',
                  'font-size': '13px', 'letter-spacing': '0.5px', transition: 'all 0.2s',
                  background: side() === 'Sell' ? 'var(--theme-color-down)' : 'transparent',
                  color: side() === 'Sell' ? '#fff' : 'var(--theme-text-muted)',
                }}
              >SELL</button>
            </div>

            {/* Order type pills */}
            <div>
              <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Order Type</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <For each={['Market', 'Limit', 'SL', 'SL-M'] as const}>
                  {(t) => (
                    <button
                      onClick={() => setOrderType(t)}
                      style={{
                        flex: 1, padding: '7px 4px', 'border-radius': '6px', 'font-size': '11px', 'font-weight': '600',
                        background: orderType() === t ? 'var(--theme-color-neutral-bg)' : 'var(--theme-bg-surface-elevated)',
                        color: orderType() === t ? 'var(--theme-color-neutral)' : 'var(--theme-text-secondary)',
                        border: orderType() === t ? '1px solid var(--theme-color-neutral)' : '1px solid var(--theme-border)',
                        transition: 'all 0.15s',
                      }}
                    >{t}</button>
                  )}
                </For>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-bottom': '6px' }}>
                <span style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Quantity</span>
                <span style={{ 'font-size': '10px', color: 'var(--theme-text-muted)' }}>Lot size: {lotSize()}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
                <div style={{
                  display: 'flex', 'align-items': 'center', flex: 1,
                  background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                  'border-radius': '8px', overflow: 'hidden',
                }}>
                  <button onClick={() => handleQtyChange(qty() - lotSize())} style={{ padding: '8px 14px', color: 'var(--theme-text-secondary)', 'font-size': '16px', 'font-weight': '300' }}>−</button>
                  <input
                    type="number" value={qty()}
                    onInput={(e) => handleQtyChange(Number(e.currentTarget.value))}
                    style={{
                      flex: 1, 'text-align': 'center', background: 'none', border: 'none', outline: 'none',
                      'font-family': 'var(--sys-font-mono)', 'font-size': '14px', 'font-weight': '700',
                      color: 'var(--theme-text-primary)',
                    }}
                  />
                  <button onClick={() => handleQtyChange(qty() + lotSize())} style={{ padding: '8px 14px', color: 'var(--theme-text-secondary)', 'font-size': '16px', 'font-weight': '300' }}>+</button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <For each={[1, 2, 5]}>
                    {(l) => (
                      <button
                        onClick={() => handleLotChange(l)}
                        style={{
                          padding: '8px 10px', 'border-radius': '6px', 'font-size': '11px', 'font-weight': '600',
                          background: lots() === l ? 'var(--theme-bg-active)' : 'var(--theme-bg-surface-elevated)',
                          color: lots() === l ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                          border: '1px solid var(--theme-border)', transition: 'all 0.15s',
                        }}
                      >{l}L</button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Price (for Limit / SL) */}
            <Show when={orderType() === 'Limit' || orderType() === 'SL'}>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Limit Price (₹)</div>
                <input
                  type="number" value={price()}
                  onInput={(e) => setPrice(Number(e.currentTarget.value))}
                  style={{
                    width: '100%', padding: '10px 12px', 'border-radius': '8px',
                    background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                    color: 'var(--theme-text-primary)', 'font-family': 'var(--sys-font-mono)',
                    'font-size': '14px', 'font-weight': '600', outline: 'none',
                  }}
                />
              </div>
            </Show>

            {/* Trigger price (for SL / SL-M) */}
            <Show when={orderType() === 'SL' || orderType() === 'SL-M'}>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Trigger Price (₹)</div>
                <input
                  type="number" value={triggerPrice()}
                  onInput={(e) => setTriggerPrice(Number(e.currentTarget.value))}
                  style={{
                    width: '100%', padding: '10px 12px', 'border-radius': '8px',
                    background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                    color: 'var(--theme-text-primary)', 'font-family': 'var(--sys-font-mono)',
                    'font-size': '14px', 'font-weight': '600', outline: 'none',
                  }}
                />
              </div>
            </Show>

            {/* Product + Validity row */}
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Product</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <For each={['MIS', 'NRML', 'CNC'] as const}>
                    {(p) => (
                      <button
                        onClick={() => setProduct(p)}
                        style={{
                          flex: 1, padding: '7px 4px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '600',
                          background: product() === p ? 'var(--theme-bg-active)' : 'var(--theme-bg-surface-elevated)',
                          color: product() === p ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                          border: product() === p ? '1px solid var(--theme-border)' : '1px solid var(--theme-border-light)',
                          transition: 'all 0.15s',
                        }}
                      >{p}</button>
                    )}
                  </For>
                </div>
              </div>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.5px' }}>Validity</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <For each={['DAY', 'IOC'] as const}>
                    {(v) => (
                      <button
                        onClick={() => setValidity(v)}
                        style={{
                          flex: 1, padding: '7px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '600',
                          background: validity() === v ? 'var(--theme-bg-active)' : 'var(--theme-bg-surface-elevated)',
                          color: validity() === v ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                          border: validity() === v ? '1px solid var(--theme-border)' : '1px solid var(--theme-border-light)',
                          transition: 'all 0.15s',
                        }}
                      >{v}</button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* AMO toggle */}
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
              <span style={{ 'font-size': '12px', color: 'var(--theme-text-secondary)' }}>After Market Order (AMO)</span>
              <div
                onClick={() => setAmo(!amo())}
                style={{
                  width: '36px', height: '20px', 'border-radius': '10px', cursor: 'pointer',
                  background: amo() ? 'var(--theme-color-neutral)' : 'var(--theme-bg-active)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: '16px', height: '16px', 'border-radius': '50%', background: '#fff',
                  position: 'absolute', top: '2px', transition: 'left 0.2s',
                  left: amo() ? '18px' : '2px',
                }} />
              </div>
            </div>

            {/* Cost summary */}
            <div style={{
              background: 'var(--theme-bg-surface-elevated)', 'border-radius': '8px',
              padding: '12px', border: '1px solid var(--theme-border-light)',
            }}>
              <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px 16px' }}>
                {[
                  ['Qty × Price', `${qty()} × ₹${fmtINR(effectivePrice())}`],
                  ['Est. Value', `₹${fmtINR(totalValue())}`],
                  ['Brokerage', `₹${brokerage().toFixed(2)}`],
                  ['STT', `₹${stt().toFixed(2)}`],
                  ['SEBI + GST', `₹${(sebi() + gst()).toFixed(2)}`],
                  ['Total Charges', `₹${totalCharges().toFixed(2)}`],
                ].map(([label, val]) => (
                  <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '11px' }}>
                    <span style={{ color: 'var(--theme-text-muted)' }}>{label}</span>
                    <span style={{ 'font-family': 'var(--sys-font-mono)', color: 'var(--theme-text-secondary)', 'font-weight': '500' }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ 'border-top': '1px solid var(--theme-border)', 'margin-top': '8px', 'padding-top': '8px', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span style={{ 'font-size': '12px', 'font-weight': '600', color: 'var(--theme-text-primary)' }}>Net {side() === 'Buy' ? 'Required' : 'Receivable'}</span>
                <span style={{
                  'font-family': 'var(--sys-font-mono)', 'font-size': '15px', 'font-weight': '700',
                  color: isInsufficient() ? 'var(--theme-color-down)' : side() === 'Buy' ? 'var(--theme-color-neutral)' : 'var(--theme-color-down)',
                }}>₹{fmtINR(netValue())}</span>
              </div>
              <Show when={available() > 0}>
                <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-top': '4px', 'font-size': '11px' }}>
                  <span style={{ color: 'var(--theme-text-muted)' }}>Available Margin</span>
                  <span style={{
                    'font-family': 'var(--sys-font-mono)', 'font-weight': '600',
                    color: isInsufficient() ? 'var(--theme-color-down)' : 'var(--theme-text-secondary)',
                  }}>₹{fmtINR(available())}</span>
                </div>
              </Show>
            </div>

            {/* Place Order button */}
            <button
              onClick={handlePlaceOrder}
              disabled={loading() || isInsufficient()}
              style={{
                width: '100%', padding: '14px', 'border-radius': '6px',
                'font-size': '14px', 'font-weight': '700', 'letter-spacing': '0.8px',
                cursor: loading() || isInsufficient() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                background: isInsufficient()
                  ? 'var(--theme-bg-active)'
                  : side() === 'Buy'
                    ? 'var(--theme-color-neutral)'
                    : 'var(--theme-color-down)',
                color: isInsufficient() ? 'var(--theme-text-muted)' : '#fff',
                opacity: loading() ? 0.8 : 1,
              }}
            >
              {loading()
                ? '⏳ Placing Order...'
                : isInsufficient()
                  ? '⚠ Insufficient Margin'
                  : `PLACE ${side().toUpperCase()} ORDER${store.paperTradeMode ? ' (PAPER)' : ''}`
              }
            </button>

            {/* Keyboard hint */}
            <div style={{ 'text-align': 'center', 'font-size': '10px', color: 'var(--theme-text-muted)' }}>
              Press <kbd style={{ background: 'var(--theme-bg-active)', padding: '1px 5px', 'border-radius': '3px' }}>Enter</kbd> to place · <kbd style={{ background: 'var(--theme-bg-active)', padding: '1px 5px', 'border-radius': '3px' }}>Esc</kbd> to cancel
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </Show>
  );
};
