import { createSignal, Show, For, createEffect } from 'solid-js';
import type { Component } from 'solid-js';
import { modifyRealOrder, cancelRealOrder } from '../store/tradingStore';
import type { Order } from '../store/tradingStore';

interface ModifyOrderModalProps {
  isOpen: () => boolean;
  onClose: () => void;
  order: () => Order | null;
}

export const ModifyOrderModal: Component<ModifyOrderModalProps> = (props) => {
  const [qty, setQty] = createSignal(1);
  const [price, setPrice] = createSignal(0);
  const [trigger, setTrigger] = createSignal(0);
  const [orderType, setOrderType] = createSignal('Limit');
  const [validity, setValidity] = createSignal('DAY');
  const [loading, setLoading] = createSignal(false);
  const [cancelling, setCancelling] = createSignal(false);

  createEffect(() => {
    const o = props.order();
    if (o) {
      setQty(o.qty);
      setPrice(o.price);
      setTrigger(o.trigger || 0);
      setOrderType(o.type);
      setValidity('DAY');
    }
  });

  const typeMap: Record<string, string> = { 'Market': 'MKT', 'Limit': 'L', 'SL': 'SL', 'SL-M': 'SL-M' };
  const txnMap: Record<string, string> = { 'Buy': 'B', 'Sell': 'S' };

  const handleModify = async () => {
    const o = props.order();
    if (!o) return;
    setLoading(true);
    try {
      await modifyRealOrder({
        orderId: o.orderId || o.id,
        qty: qty(),
        price: price(),
        trigger: trigger(),
        orderType: typeMap[orderType()] || orderType(),
        validity: validity(),
        tradingSymbol: o.inst,
        exchangeSegment: o.exchange || 'nse_fo',
        product: o.prod,
        transactionType: txnMap[o.side] || o.side,
      });
      props.onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const o = props.order();
    if (!o) return;
    setCancelling(true);
    try {
      await cancelRealOrder(o.orderId || o.id);
      props.onClose();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Show when={props.isOpen() && props.order()}>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        'z-index': 9998,
        display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      }}
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
        <div style={{
          background: 'var(--theme-bg-surface)', border: '1px solid var(--theme-border)',
          'border-radius': '12px', width: '400px',
          'box-shadow': '0 24px 60px rgba(0,0,0,0.5)',
          animation: 'modalIn 0.18s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
            padding: '14px 16px', 'border-bottom': '1px solid var(--theme-border)',
            background: 'var(--theme-bg-surface-elevated)', 'border-radius': '12px 12px 0 0',
          }}>
            <div>
              <div style={{ 'font-weight': '700', 'font-size': '14px' }}>Modify Order</div>
              <div style={{ 'font-size': '11px', color: 'var(--theme-text-muted)', 'margin-top': '2px' }}>
                {props.order()?.side} · {props.order()?.inst} · {props.order()?.prod}
              </div>
            </div>
            <button onClick={props.onClose} style={{ color: 'var(--theme-text-muted)', 'font-size': '16px' }}>✕</button>
          </div>

          <div style={{ padding: '16px', display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
            {/* Order Type */}
            <div>
              <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase' }}>Order Type</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <For each={['Market', 'Limit', 'SL', 'SL-M']}>
                  {(t) => (
                    <button onClick={() => setOrderType(t)} style={{
                      flex: 1, padding: '7px 4px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '600',
                      background: orderType() === t ? 'var(--theme-color-neutral-bg)' : 'var(--theme-bg-surface-elevated)',
                      color: orderType() === t ? 'var(--theme-color-neutral)' : 'var(--theme-text-muted)',
                      border: orderType() === t ? '1px solid var(--theme-color-neutral)' : '1px solid var(--theme-border)',
                    }}>{t}</button>
                  )}
                </For>
              </div>
            </div>

            {/* Qty */}
            <div>
              <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase' }}>Quantity</div>
              <div style={{ display: 'flex', 'align-items': 'center', background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)', 'border-radius': '8px', overflow: 'hidden' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ padding: '9px 16px', color: 'var(--theme-text-secondary)', 'font-size': '16px' }}>−</button>
                <input type="number" value={qty()} onInput={(e) => setQty(Math.max(1, Number(e.currentTarget.value)))}
                  style={{ flex: 1, 'text-align': 'center', background: 'none', border: 'none', outline: 'none', 'font-family': 'var(--sys-font-mono)', 'font-size': '14px', 'font-weight': '700', color: 'var(--theme-text-primary)' }} />
                <button onClick={() => setQty(q => q + 1)} style={{ padding: '9px 16px', color: 'var(--theme-text-secondary)', 'font-size': '16px' }}>+</button>
              </div>
            </div>

            {/* Price */}
            <Show when={orderType() !== 'Market' && orderType() !== 'SL-M'}>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase' }}>Price (₹)</div>
                <input type="number" value={price()} onInput={(e) => setPrice(Number(e.currentTarget.value))}
                  style={{ width: '100%', padding: '10px 12px', 'border-radius': '8px', background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)', 'font-family': 'var(--sys-font-mono)', 'font-size': '14px', 'font-weight': '600', outline: 'none' }} />
              </div>
            </Show>

            {/* Trigger */}
            <Show when={orderType() === 'SL' || orderType() === 'SL-M'}>
              <div>
                <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase' }}>Trigger Price (₹)</div>
                <input type="number" value={trigger()} onInput={(e) => setTrigger(Number(e.currentTarget.value))}
                  style={{ width: '100%', padding: '10px 12px', 'border-radius': '8px', background: 'var(--theme-bg-surface-elevated)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)', 'font-family': 'var(--sys-font-mono)', 'font-size': '14px', 'font-weight': '600', outline: 'none' }} />
              </div>
            </Show>

            {/* Validity */}
            <div>
              <div style={{ 'font-size': '10px', color: 'var(--theme-text-muted)', 'margin-bottom': '6px', 'font-weight': '600', 'text-transform': 'uppercase' }}>Validity</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <For each={['DAY', 'IOC']}>
                  {(v) => (
                    <button onClick={() => setValidity(v)} style={{
                      flex: 1, padding: '8px', 'border-radius': '6px', 'font-size': '11px', 'font-weight': '600',
                      background: validity() === v ? 'var(--theme-bg-active)' : 'var(--theme-bg-surface-elevated)',
                      color: validity() === v ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                      border: '1px solid var(--theme-border)',
                    }}>{v}</button>
                  )}
                </For>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '8px', 'margin-top': '4px' }}>
              <button onClick={handleCancel} disabled={cancelling()}
                style={{
                  padding: '12px', 'border-radius': '6px', 'font-weight': '700', 'font-size': '12px',
                  background: 'var(--theme-color-down-bg)', color: 'var(--theme-color-down)',
                  border: '1px solid var(--theme-color-down)', cursor: cancelling() ? 'not-allowed' : 'pointer',
                  opacity: cancelling() ? 0.7 : 1, transition: 'opacity 0.2s',
                }}>
                {cancelling() ? 'Cancelling...' : '✕ Cancel Order'}
              </button>
              <button onClick={handleModify} disabled={loading()}
                style={{
                  padding: '12px', 'border-radius': '6px', 'font-weight': '700', 'font-size': '12px',
                  background: 'var(--theme-color-neutral)', color: '#fff',
                  cursor: loading() ? 'not-allowed' : 'pointer',
                  opacity: loading() ? 0.7 : 1, transition: 'opacity 0.2s',
                }}>
                {loading() ? 'Modifying...' : '✎ Modify Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
