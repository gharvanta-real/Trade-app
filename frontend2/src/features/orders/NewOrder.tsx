import { createSignal, For, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, placeRealOrder, searchInstruments } from '../../store/tradingStore';
import './orders.css';

interface NewOrderProps {
  onClose?: () => void;
}

const LOT_SIZES: Record<string, number> = {
  'NIFTY 50': 50, 'BANKNIFTY': 15, 'FINNIFTY': 40, 'MIDCPNIFTY': 75,
};

const EXCHANGE_MAP: Record<string, string> = {
  'NIFTY 50': 'nse_fo', 'BANKNIFTY': 'nse_fo', 'FINNIFTY': 'nse_fo', 'MIDCPNIFTY': 'nse_fo',
};

export const NewOrder: Component<NewOrderProps> = (props) => {
  const [selectedInst, setSelectedInst] = createSignal('NIFTY 50');
  const [orderMode, setOrderMode] = createSignal<'Buy' | 'Sell'>('Buy');
  const [orderType, setOrderType] = createSignal<'Market' | 'Limit' | 'SL' | 'SL-M'>('Market');
  const [productType, setProductType] = createSignal<'MIS' | 'NRML' | 'CNC'>('MIS');
  const [validity, setValidity] = createSignal<'DAY' | 'IOC'>('DAY');
  const [qty, setQty] = createSignal(50);
  const [lots, setLots] = createSignal(1);
  const [price, setPrice] = createSignal(0);
  const [triggerPrice, setTriggerPrice] = createSignal(0);
  const [amo, setAmo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = createSignal('NIFTY 50');
  const [searchResults, setSearchResults] = createSignal<any[]>([]);
  const [showSearch, setShowSearch] = createSignal(false);

  const lotSize = () => LOT_SIZES[selectedInst()] || store.symbols[selectedInst()]?.lotSize || 1;
  const ltp = () => store.symbols[selectedInst()]?.price || 0;
  const isUp = () => store.symbols[selectedInst()]?.up ?? true;
  const availableMargin = () => store.margins.available;

  // Auto-set defaults depending on active symbol
  createEffect(() => {
    const inst = selectedInst();
    const lp = store.symbols[inst]?.price || 0;
    setPrice(lp);
    setTriggerPrice(lp > 0 ? +(lp * (orderMode() === 'Buy' ? 0.995 : 1.005)).toFixed(2) : 0);
    setQty(lotSize());
    setLots(1);
  });

  // Autocomplete search trigger
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

  const estimatedValue = () => {
    const p = orderType() === 'Market' ? ltp() : price();
    return qty() * p;
  };
  
  const brokerage = () => Math.min(20, estimatedValue() * 0.0003);
  const stt = () => orderMode() === 'Sell' ? estimatedValue() * 0.00025 : 0;
  const sebi = () => estimatedValue() * 0.0001;
  const gst = () => (brokerage() + sebi()) * 0.18;
  const totalCharges = () => brokerage() + stt() + sebi() + gst();
  const netValue = () => orderMode() === 'Buy' ? estimatedValue() + totalCharges() : estimatedValue() - totalCharges();
  const isInsufficient = () => orderMode() === 'Buy' && availableMargin() > 0 && netValue() > availableMargin();

  const handlePlaceOrder = async () => {
    if (loading()) return;
    setLoading(true);
    try {
      const result = await placeRealOrder({
        inst: selectedInst(),
        side: orderMode(),
        type: orderType(),
        qty: qty(),
        price: orderType() === 'Market' ? ltp() : price(),
        trigger: orderType() === 'SL' || orderType() === 'SL-M' ? triggerPrice() : 0,
        prod: productType(),
        validity: validity(),
        amo: amo(),
        exchange: EXCHANGE_MAP[selectedInst()],
      });
      if (result.success && props.onClose) {
        props.onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div class="wl-page-container">
      <div class="wl-page-header" style={{ padding: "var(--sys-space-3) var(--sys-space-4)", "border-bottom": "1px solid var(--theme-border-light)" }}>
        <div>
          <h1 class="wl-page-title" style={{ "font-size": "18px", "font-weight": "700" }}>Place New Order</h1>
          <p style={{ "font-size": "11px", color: "var(--theme-text-muted)", "margin-top": "2px" }}>Place real-time buy or sell orders directly on NSE/BSE</p>
        </div>
        {props.onClose && (
          <button class="orders-action-btn" onClick={props.onClose}>
            Back to Orders
          </button>
        )}
      </div>

      <div class="wl-page-content" style={{ flex: 1, padding: "var(--sys-space-4)" }}>
        <div class="new-order-container" style={{ display: "grid", "grid-template-columns": "1.2fr 1fr", gap: "24px" }}>
          
          {/* Left panel: Inputs */}
          <div class="new-order-left" style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
            
            {/* Instrument Autocomplete Search */}
            <div style={{ position: 'relative' }}>
              <span class="input-group-label" style={{ "font-size": "10px", color: "var(--theme-text-muted)", "font-weight": "600", "text-transform": "uppercase" }}>Search Symbol</span>
              <div style={{
                display: 'flex', 'align-items': 'center', gap: '10px',
                background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                'border-radius': '8px', padding: '10px 14px', "margin-top": "4px"
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-muted)" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21L16.65 16.65"/>
                </svg>
                <input
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  onFocus={() => searchResults().length > 0 && setShowSearch(true)}
                  placeholder="Search stocks / options (e.g. RELIANCE)..."
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--theme-text-primary)', 'font-size': '13px', 'font-weight': '700',
                  }}
                />
                <div style={{ "text-align": "right" }}>
                  <span class={`font-mono font-bold ${isUp() ? 'up' : 'down'}`} style={{ "font-size": "15px" }}>
                    ₹{ltp().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <Show when={showSearch() && searchResults().length > 0}>
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, 'margin-top': '4px',
                  background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)',
                  'border-radius': '8px', 'box-shadow': '0 12px 32px rgba(0,0,0,0.4)',
                  'z-index': 1000, 'max-height': '220px', overflow: 'auto',
                }}>
                  <For each={searchResults()}>
                    {(inst) => (
                      <div
                        onClick={() => handleSelectInstrument(inst)}
                        style={{
                          display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                          padding: '10px 14px', cursor: 'pointer', transition: 'background 0.1s',
                          'border-bottom': '1px solid var(--theme-border-light)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-bg-active)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <div>
                          <div style={{ 'font-weight': '600', 'font-size': '12px', color: 'var(--theme-text-primary)' }}>{inst.name}</div>
                          <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)' }}>{inst.exchange} · {inst.type}</div>
                        </div>
                        <Show when={inst.lot_size > 1}>
                          <span style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'font-weight': '600' }}>Lot: {inst.lot_size}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Buy/Sell tab */}
            <div class="order-tabs" style={{ height: "38px" }}>
              <button 
                class={`order-tab ${orderMode() === 'Buy' ? 'active active-buy' : ''}`}
                onClick={() => setOrderMode('Buy')}
              >
                BUY
              </button>
              <button 
                class={`order-tab ${orderMode() === 'Sell' ? 'active active-sell' : ''}`}
                onClick={() => setOrderMode('Sell')}
              >
                SELL
              </button>
            </div>

            {/* Order types */}
            <div class="order-types-grid">
              <For each={['Market', 'Limit', 'SL', 'SL-M'] as const}>
                {(type) => (
                  <button 
                    class={`order-type-btn ${orderType() === type ? 'active' : ''}`}
                    onClick={() => setOrderType(type)}
                  >
                    {type}
                  </button>
                )}
              </For>
            </div>

            {/* Qty and lot sizing */}
            <div class="order-input-group">
              <div class="input-group-label" style={{ display: "flex", "justify-content": "space-between" }}>
                <span>Quantity</span>
                <span>Lot size: {lotSize()}</span>
              </div>
              <div class="input-stepper" style={{ "margin-top": "4px" }}>
                <button class="stepper-btn minus" onClick={() => handleQtyChange(qty() - lotSize())}>-</button>
                <input 
                  type="number" 
                  class="stepper-input" 
                  value={qty()} 
                  onInput={(e) => handleQtyChange(Number(e.currentTarget.value))}
                />
                <button class="stepper-btn plus" onClick={() => handleQtyChange(qty() + lotSize())}>+</button>
              </div>
              <div class="quick-qty-grid" style={{ "margin-top": "8px" }}>
                <button class="quick-qty-btn" onClick={() => handleLotChange(1)}>1 Lot ({lotSize()})</button>
                <button class="quick-qty-btn" onClick={() => handleLotChange(2)}>2 Lots ({2 * lotSize()})</button>
                <button class="quick-qty-btn" onClick={() => handleLotChange(5)}>5 Lots ({5 * lotSize()})</button>
                <button class="quick-qty-btn" onClick={() => handleLotChange(10)}>10 Lots ({10 * lotSize()})</button>
              </div>
            </div>

            {/* Show Price Input if Limit or SL */}
            <Show when={orderType() === 'Limit' || orderType() === 'SL'}>
              <div class="order-input-group">
                <span class="input-group-label">Limit Price (₹)</span>
                <div class="input-stepper" style={{ "margin-top": "4px" }}>
                  <button class="stepper-btn minus" onClick={() => setPrice(p => Math.max(0, +(p - 0.05).toFixed(2)))}>-</button>
                  <input 
                    type="number" 
                    class="stepper-input" 
                    value={price()} 
                    step="0.05"
                    onInput={(e) => setPrice(Number(e.currentTarget.value))}
                  />
                  <button class="stepper-btn plus" onClick={() => setPrice(p => +(p + 0.05).toFixed(2))}>+</button>
                </div>
              </div>
            </Show>

            {/* Show Trigger Price Input if SL or SL-M */}
            <Show when={orderType() === 'SL' || orderType() === 'SL-M'}>
              <div class="order-input-group">
                <span class="input-group-label">Trigger Price (₹)</span>
                <div class="input-stepper" style={{ "margin-top": "4px" }}>
                  <button class="stepper-btn minus" onClick={() => setTriggerPrice(p => Math.max(0, +(p - 0.05).toFixed(2)))}>-</button>
                  <input 
                    type="number" 
                    class="stepper-input" 
                    value={triggerPrice()} 
                    step="0.05"
                    onInput={(e) => setTriggerPrice(Number(e.currentTarget.value))}
                  />
                  <button class="stepper-btn plus" onClick={() => setTriggerPrice(p => +(p + 0.05).toFixed(2))}>+</button>
                </div>
              </div>
            </Show>

            {/* Product selection */}
            <div class="order-input-group">
              <span class="input-group-label">Product</span>
              <div class="order-product-grid" style={{ "margin-top": "4px" }}>
                <For each={['MIS', 'NRML', 'CNC'] as const}>
                  {(product) => (
                    <button 
                      class={`order-product-btn ${productType() === product ? 'active' : ''}`}
                      onClick={() => setProductType(product)}
                    >
                      {product === 'MIS' ? 'Intraday (MIS)' : product === 'NRML' ? 'Overnight (NRML)' : 'Long Term (CNC)'}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Validity */}
            <div class="order-input-group">
              <span class="input-group-label">Validity</span>
              <div class="order-product-grid" style={{ "grid-template-columns": "repeat(2, 1fr)", "margin-top": "4px" }}>
                <button 
                  class={`order-product-btn ${validity() === 'DAY' ? 'active' : ''}`}
                  onClick={() => setValidity('DAY')}
                >
                  DAY
                </button>
                <button 
                  class={`order-product-btn ${validity() === 'IOC' ? 'active' : ''}`}
                  onClick={() => setValidity('IOC')}
                >
                  IOC
                </button>
              </div>
            </div>
          </div>

          {/* Right panel: Summary & Margin checks */}
          <div class="new-order-right" style={{ background: "var(--theme-bg-surface-elevated)", border: "1px solid var(--theme-border)", "border-radius": "10px", padding: "18px", display: "flex", "flex-direction": "column", gap: "16px" }}>
            <h3 class="summary-title" style={{ "font-size": "14px", "font-weight": "700", "border-bottom": "1px solid var(--theme-border-light)", "padding-bottom": "8px" }}>Order Summary</h3>
            
            <div class="summary-rows" style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "12px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Instrument</span>
                <span class="summary-value font-bold">{selectedInst()}</span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "12px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Action</span>
                <span class="summary-value font-bold" style={{ color: orderMode() === 'Buy' ? "var(--theme-color-neutral)" : "var(--theme-color-down)" }}>
                  {orderMode().toUpperCase()}
                </span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "12px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Quantity</span>
                <span class="summary-value font-mono font-semibold">{qty()} ({lots()} Lot)</span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "12px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Order Type</span>
                <span class="summary-value font-semibold">{orderType()}</span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "12px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Limit / LTP</span>
                <span class="summary-value font-mono font-semibold">₹{estimatedValue() > 0 ? (estimatedValue() / qty()).toFixed(2) : ltp().toFixed(2)}</span>
              </div>
              
              <div style={{ "border-top": "1px dashed var(--theme-border)", "margin-top": "8px", "padding-top": "8px" }} />

              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "11px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Gross Premium</span>
                <span class="summary-value font-mono">₹{estimatedValue().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "11px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Est. Taxes & charges</span>
                <span class="summary-value font-mono">₹{totalCharges().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div class="summary-row total" style={{ display: "flex", "justify-content": "space-between", "border-top": "1px solid var(--theme-border)", "margin-top": "6px", "padding-top": "6px" }}>
                <span class="summary-label" style={{ "font-weight": "700", color: "var(--theme-text-primary)", "font-size": "13px" }}>Total Cost</span>
                <span class="summary-value font-mono font-bold" style={{ "font-size": "14px" }}>{fmtINR(netValue())}</span>
              </div>
            </div>

            <div class="summary-rows" style={{ background: "var(--theme-bg-surface)", border: "1px solid var(--theme-border-light)", "border-radius": "8px", padding: "10px", display: "flex", "flex-direction": "column", gap: "6px" }}>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "11px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Margin Required</span>
                <span class={`summary-value font-mono font-semibold ${isInsufficient() ? 'down' : ''}`}>
                  {fmtINR(netValue())}
                </span>
              </div>
              <div class="summary-row" style={{ display: "flex", "justify-content": "space-between", "font-size": "11px" }}>
                <span class="summary-label" style={{ color: "var(--theme-text-muted)" }}>Available Margin</span>
                <span class="summary-value font-mono font-semibold">{fmtINR(availableMargin())}</span>
              </div>
            </div>

            {/* After Market Order toggle */}
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', "font-size": "12px", color: "var(--theme-text-secondary)" }}>
              <span>After Market Order (AMO)</span>
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

            <button 
              class={`order-submit-btn ${orderMode() === 'Buy' ? 'buy' : 'sell'}`} 
              disabled={loading() || isInsufficient()}
              onClick={handlePlaceOrder}
              style={{
                width: "100%", padding: "12px", "border-radius": "8px", "font-weight": "700", "font-size": "13px", "letter-spacing": "0.5px",
                cursor: loading() || isInsufficient() ? "not-allowed" : "pointer",
                background: isInsufficient() ? "var(--theme-bg-active)" : orderMode() === 'Buy' ? "var(--theme-color-neutral)" : "var(--theme-color-down)",
                color: isInsufficient() ? "var(--theme-text-muted)" : "#fff",
                opacity: loading() ? 0.8 : 1,
                "margin-top": "8px"
              }}
            >
              {loading() 
                ? 'PLACING ORDER...' 
                : isInsufficient() 
                  ? 'INSUFFICIENT MARGIN' 
                  : `PLACE ${orderMode().toUpperCase()} ORDER${store.paperTradeMode ? ' (PAPER)' : ''}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
