import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, cancelRealOrder, placeRealOrder } from '../../store/tradingStore';
import type { Order, OrderLog } from '../../store/tradingStore';
import { ModifyOrderModal } from '../../components/ModifyOrderModal';
import { OrderModal } from '../../components/OrderModal';
import './orders.css';

export const OrdersPage: Component = () => {
  const [selectedTab, setSelectedTab] = createSignal('open');
  const [filterAction, setFilterAction] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedOrderId, setSelectedOrderId] = createSignal<string | null>(null);
  const [showNewOrder, setShowNewOrder] = createSignal(false);
  const [showModify, setShowModify] = createSignal(false);
  const [modifyTarget, setModifyTarget] = createSignal<Order | null>(null);
  const [cancellingId, setCancellingId] = createSignal<string | null>(null);

  const handleCancelOrder = async (e: Event, ordId: string) => {
    e.stopPropagation();
    setCancellingId(ordId);
    await cancelRealOrder(ordId);
    setCancellingId(null);
  };

  const handleModifyOrder = (e: Event, ord: Order) => {
    e.stopPropagation();
    setModifyTarget(ord);
    setShowModify(true);
  };

  const handleReorder = async (e: Event, ord: Order) => {
    e.stopPropagation();
    await placeRealOrder({
      inst: ord.inst,
      side: ord.side as 'Buy' | 'Sell',
      type: ord.type as any,
      qty: ord.qty,
      price: ord.price,
      trigger: ord.trigger,
      prod: ord.prod as 'MIS' | 'NRML' | 'CNC',
      exchange: ord.exchange,
    });
  };

  // Canvas ref for donut execution chart
  let execCanvasRef!: HTMLCanvasElement;

  const drawExecutionSummary = () => {
    if (!execCanvasRef) return;
    const ctx = execCanvasRef.getContext('2d');
    if (!ctx) return;

    const size = 95;
    const dpi = window.devicePixelRatio || 1;
    execCanvasRef.width = size * dpi;
    execCanvasRef.height = size * dpi;
    ctx.scale(dpi, dpi);

    const center = size / 2;
    const radius = 35;
    const thickness = 9;

    ctx.fillStyle = store.settings.theme === 'dark' ? '#161618' : '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Mocks: Executed (63.6%), Open (27.3%), Partially Filled (6.8%), Cancelled/Rejected (2.3%)
    const angles = [0.636 * Math.PI * 2, 0.273 * Math.PI * 2, 0.068 * Math.PI * 2, 0.023 * Math.PI * 2];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'];

    let startAngle = -Math.PI / 2;
    for (let i = 0; i < angles.length; i++) {
      ctx.beginPath();
      ctx.arc(center, center, radius, startAngle, startAngle + angles[i]);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = thickness;
      ctx.stroke();
      startAngle += angles[i];
    }
  };

  onMount(() => {
    drawExecutionSummary();
  });

  createEffect(() => {
    store.settings.theme;
    drawExecutionSummary();
  });

  // Derived computations — always use store (real broker data synced every 5s)
  const getOrders = () => store.orders;

  const filteredOrders = () => {
    let list = getOrders();

    // Tab filter
    const tab = selectedTab();
    if (tab === 'open') {
      list = list.filter(o => o.status === 'open' || o.status === 'partially_filled' || o.status === 'trigger_pending');
    } else if (tab === 'executed') {
      list = list.filter(o => o.status === 'executed');
    } else if (tab === 'history') {
      list = list.filter(o => o.status === 'executed' || o.status === 'cancelled' || o.status === 'rejected');
    } else if (tab === 'basket') {
      return []; // basket orders are empty
    }

    // Side/Type filters
    const act = filterAction();
    if (act === 'buy') {
      list = list.filter(o => o.side === 'Buy' || o.side === 'B');
    } else if (act === 'sell') {
      list = list.filter(o => o.side === 'Sell' || o.side === 'S');
    } else if (act === 'options') {
      list = list.filter(o => o.inst.includes('CE') || o.inst.includes('PE'));
    } else if (act === 'futures') {
      list = list.filter(o => o.inst.includes('FUT') || o.inst.includes('-I'));
    } else if (act === 'stocks') {
      list = list.filter(o => !o.inst.includes('CE') && !o.inst.includes('PE') && !o.inst.includes('FUT') && !o.inst.includes('-I'));
    }

    // Search query filter
    const query = searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(o => o.inst.toLowerCase().includes(query) || o.id.toLowerCase().includes(query));
    }

    return list;
  };

  const getOrderTimeline = (ord: Order): OrderLog[] => {
    if (ord.logs && ord.logs.length > 0) return ord.logs;

    const time = ord.time;
    const price = ord.price;
    const side = ord.side;

    const nodes: OrderLog[] = [
      { title: 'Order Placed', desc: `${side} order initiated for ${ord.qty} qty`, time, status: 'completed' }
    ];

    if (ord.status === 'rejected') {
      nodes.push({ title: 'Order Rejected', desc: ord.failReason || 'Rejected by broker', time, status: 'failed' });
    } else if (ord.status === 'submitting') {
      nodes.push({ title: 'Submitting', desc: 'Connecting to Kotak Neo gateway...', time, status: 'active' });
    } else {
      nodes.push({ title: 'Acknowledged by Exchange', desc: 'Order sent to exchange', time, status: 'completed' });
      if (ord.status === 'executed') {
        nodes.push({ title: 'Executed', desc: `Filled successfully at ₹${price}`, time, status: 'completed' });
      } else if (ord.status === 'open' || ord.status === 'trigger_pending') {
        nodes.push({ title: ord.status === 'open' ? 'Open' : 'Trigger Pending', desc: `Waiting to be matched at ₹${price}`, time, status: 'active' });
      } else if (ord.status === 'cancelled') {
        nodes.push({ title: 'Cancelled', desc: 'Order cancelled by user', time, status: 'completed' });
      } else if (ord.status === 'partially_filled') {
        nodes.push({ title: 'Partially Filled', desc: `Filled partially at ₹${price}`, time, status: 'active' });
      }
    }

    return nodes;
  };

  // Selected Order details
  const activeOrder = () => {
    const orders = filteredOrders();
    const id = selectedOrderId();
    if (id) {
      return orders.find(o => o.id === id) || orders[0];
    }
    return orders[0];
  };

  // KPI Computations
  const activeOrdersCount = () => getOrders().filter(o => o.status === 'open' || o.status === 'partially_filled' || o.status === 'trigger_pending').length;
  const filledTodayCount = () => getOrders().filter(o => o.status === 'executed').length;
  const pendingValueVal = () => getOrders().filter(o => o.status === 'open').reduce((sum, o) => sum + o.qty * o.price, 0);
  const filledValueVal = () => getOrders().filter(o => o.status === 'executed').reduce((sum, o) => sum + o.qty * o.price, 0);
  const rejectedOrdersCount = () => getOrders().filter(o => o.status === 'rejected').length;
  const averageFillPrice = () => {
    const filled = getOrders().filter(o => o.status === 'executed' && o.qty > 0);
    const totalQty = filled.reduce((sum, o) => sum + o.qty, 0);
    if (!totalQty) return 0;
    return filled.reduce((sum, o) => sum + o.qty * o.price, 0) / totalQty;
  };
  const fillRate = () => {
    const orders = getOrders();
    return orders.length > 0 ? (filledTodayCount() / orders.length) * 100 : 0;
  };

  return (
    <div class="orders-split-layout">
      <OrderModal isOpen={showNewOrder} onClose={() => setShowNewOrder(false)} />
      <ModifyOrderModal isOpen={showModify} onClose={() => { setShowModify(false); setModifyTarget(null); }} order={modifyTarget} />

      {/* Title Header */}
      <div class="orders-title-header">
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', width: '100%' }}>
          <div>
            <h1 class="orders-title-text">Orders <span class="star-icon">☆</span></h1>
            <p class="orders-sub-text">Track and manage all your open, executed and historical orders in one place.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
            <Show when={store.paperTradeMode}>
              <span style={{ background: 'var(--theme-color-neutral-bg)', color: 'var(--theme-color-neutral)', padding: '4px 10px', 'border-radius': '20px', 'font-size': '11px', 'font-weight': '700' }}>📝 PAPER MODE</span>
            </Show>
            <button
              onClick={() => setShowNewOrder(true)}
              style={{ background: 'var(--theme-color-neutral)', color: '#fff', padding: '8px 18px', 'border-radius': '6px', 'font-weight': '700', 'font-size': '12px' }}
            >+ New Order</button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Row 1) */}
      <div class="orders-kpis-bar">
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Active Orders</span>
          <span class="kpi-val font-semibold">{activeOrdersCount()}</span>
          <span class="kpi-sub-lbl">₹ {pendingValueVal().toLocaleString('en-IN')} (Est. Value)</span>
        </div>
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Filled Today</span>
          <span class="kpi-val font-semibold">{filledTodayCount()}</span>
          <span class="kpi-sub-lbl up">₹ {filledValueVal().toLocaleString('en-IN')}</span>
        </div>
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Pending Value</span>
          <span class="kpi-val font-semibold">₹ {pendingValueVal().toLocaleString('en-IN')}</span>
          <span class="kpi-sub-lbl">Across {activeOrdersCount()} orders</span>
        </div>
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Rejected Orders</span>
          <span class="kpi-val font-semibold">{rejectedOrdersCount()}</span>
          <span class="kpi-sub-lbl">Today</span>
        </div>
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Avg. Fill Price</span>
          <span class="kpi-val font-semibold">₹ {averageFillPrice().toFixed(2)}</span>
          <span class="kpi-sub-lbl">Today's Orders</span>
        </div>
        <div class="orders-kpi-cell">
          <span class="kpi-lbl">Save on Charges</span>
          <span class="kpi-val font-semibold">₹ 0.00</span>
          <span class="kpi-sub-lbl up">Broker data only</span>
        </div>
      </div>

      {/* Main Area Split */}
      <div class="orders-split-body">
        {/* Left Column (Table + Bottom charts) */}
        <div class="orders-left-col">
          <div class="orders-panel-main">
            {/* Tabs row */}
            <div class="orders-tabs-row">
              <button class={`tab-btn-ord ${selectedTab() === 'open' ? 'active' : ''}`} onClick={() => setSelectedTab('open')}>Open Orders</button>
              <button class={`tab-btn-ord ${selectedTab() === 'executed' ? 'active' : ''}`} onClick={() => setSelectedTab('executed')}>Executed Orders</button>
              <button class={`tab-btn-ord ${selectedTab() === 'history' ? 'active' : ''}`} onClick={() => setSelectedTab('history')}>Order History</button>
              <button class={`tab-btn-ord ${selectedTab() === 'basket' ? 'active' : ''}`} onClick={() => setSelectedTab('basket')}>Basket Orders</button>
            </div>

            {/* Sub-Filters Row */}
            <div class="orders-filters-row">
              <div class="filters-btns-left">
                <For each={['all', 'buy', 'sell', 'options', 'futures', 'stocks']}>
                  {(act) => (
                    <button
                      class={`filter-btn-sub ${filterAction() === act ? 'active' : ''}`}
                      onClick={() => setFilterAction(act)}
                    >
                      {act.toUpperCase()}
                    </button>
                  )}
                </For>
              </div>
              <div class="filters-inputs-right">
                <span class="date-picker-box">23 May 2024 - 23 May 2024</span>
                <input
                  type="text"
                  class="orders-search-input"
                  placeholder="Search by symbol or order ID"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
                <button class="filters-popup-btn">Filters</button>
              </div>
            </div>

            {/* Table */}
            <div class="orders-table-wrapper">
              <table class="orders-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Instrument</th>
                    <th>Action</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Order Type</th>
                    <th>Price</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Broker</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredOrders()} fallback={
                    <tr>
                      <td colspan="11" class="no-orders-lbl">No orders matching the active filters.</td>
                    </tr>
                  }>
                    {(ord) => (
                      <tr
                        onClick={() => setSelectedOrderId(ord.id)}
                        class={activeOrder()?.id === ord.id ? 'active-row' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td class="font-mono">{ord.time}</td>
                        <td class="font-bold">{ord.inst}</td>
                        <td>
                          <span class={`side-badge ${ord.side.toLowerCase()}`}>
                            {ord.side.toUpperCase()}
                          </span>
                        </td>
                        <td class="font-semibold">{ord.prod}</td>
                        <td class="font-mono">{ord.qty}</td>
                        <td>{ord.type}</td>
                        <td class="font-mono">₹{ord.price.toFixed(2)}</td>
                        <td class="font-mono">{ord.trigger > 0 ? `₹${ord.trigger.toFixed(2)}` : '—'}</td>
                        <td>
                          <span class={`order-status-badge ${ord.status}`}>
                            {ord.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>{ord.broker || 'KOTAK'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Show when={ord.status === 'open' || ord.status === 'trigger_pending'}>
                              <button
                                class="table-action-cancel"
                                title="Modify Order"
                                onClick={(e) => handleModifyOrder(e, ord as any)}
                                style={{ background: 'var(--theme-color-neutral-bg)', color: 'var(--theme-color-neutral)', border: '1px solid var(--theme-color-neutral)', padding: '3px 7px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '600' }}
                              >✎</button>
                              <button
                                class="table-action-cancel"
                                title="Cancel Order"
                                onClick={(e) => handleCancelOrder(e, ord.orderId || ord.id)}
                                style={{ opacity: cancellingId() === (ord.orderId || ord.id) ? 0.5 : 1 }}
                              >{cancellingId() === (ord.orderId || ord.id) ? '…' : '✕'}</button>
                            </Show>
                            <Show when={ord.status === 'executed' || ord.status === 'cancelled' || ord.status === 'rejected'}>
                              <button
                                title="Reorder"
                                onClick={(e) => handleReorder(e, ord as any)}
                                style={{ background: 'var(--theme-bg-active)', color: 'var(--theme-text-secondary)', border: '1px solid var(--theme-border)', padding: '3px 7px', 'border-radius': '6px', 'font-size': '10px', 'font-weight': '600' }}
                              >↻</button>
                            </Show>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summaries Row */}
          <div class="orders-bottom-grid">
            {/* Recent Activity */}
            <div class="summary-box-new">
              <div class="panel-header-new">
                <span class="panel-title-new">Recent Activity</span>
                <span class="view-all-btn">View All</span>
              </div>
              <div class="activity-list-wrapper">
                <For each={filteredOrders().slice(0, 4)}>
                  {(ord) => (
                    <div class="activity-row">
                      <span class="act-time">{ord.time}</span>
                      <span class={`act-side ${ord.side.toLowerCase()}`}>{ord.side.toUpperCase()}</span>
                      <span class="act-inst">{ord.inst}</span>
                      <span class="act-qty">{ord.qty} @ ₹{ord.price}</span>
                      <span class={`act-status order-status-badge ${ord.status}`}>{ord.status.toUpperCase()}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Execution Summary Donut */}
            <div class="summary-box-new">
              <div class="panel-header-new">
                <span class="panel-title-new">Execution Summary</span>
              </div>
              <div class="execution-summary-body">
                <canvas ref={execCanvasRef} class="exec-summary-canvas"></canvas>
                <div class="exec-legend">
                  <div class="legend-row"><span class="legend-dot green"></span> Executed (63.6%)</div>
                  <div class="legend-row"><span class="legend-dot indigo"></span> Open (27.3%)</div>
                  <div class="legend-row"><span class="legend-dot amber"></span> Partially (6.8%)</div>
                </div>
              </div>
            </div>

            {/* Order Analytics */}
            <div class="summary-box-new">
              <div class="panel-header-new">
                <span class="panel-title-new">Order Analytics (Today)</span>
              </div>
              <div class="analytics-metrics-list">
                <div class="analytics-row">
                  <span class="anal-label">Total Orders</span>
                  <span class="anal-val font-semibold">{getOrders().length}</span>
                </div>
                <div class="analytics-row">
                  <span class="anal-label">Fill Rate</span>
                  <span class="anal-val font-semibold text-green">{fillRate().toFixed(1)}%</span>
                </div>
                <div class="analytics-row">
                  <span class="anal-label">Avg. Time to Fill</span>
                  <span class="anal-val font-semibold">1.42 sec</span>
                </div>
                <div class="analytics-row">
                  <span class="anal-label">Smart Savings</span>
                  <span class="anal-val font-semibold text-green">₹ 0.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Detailed Order Sidebar) */}
        <div class="orders-right-sidebar">
          <Show when={activeOrder()} fallback={
            <div class="details-placeholder">
              <p>Select an order to view audit logs & actions.</p>
            </div>
          }>
            {(ord) => (
              <div class="order-details-panel">
                <div class="details-header">
                  <div class="details-title-row">
                    <span class="details-inst-name font-bold">{ord().inst}</span>
                    <button class="close-sidebar-btn">✕</button>
                  </div>
                  <span class="details-inst-subtitle">NFO Options CE <span class={`side-badge ${ord().side.toLowerCase()}`}>{ord().side.toUpperCase()}</span></span>
                </div>

                <div class="details-status-row">
                  <span class={`order-status-badge ${ord().status}`}>{ord().status.toUpperCase()}</span>
                  <span class="details-placed-time">Placed: {ord().time}</span>
                </div>

                <Show when={ord().failReason}>
                  <div style={{
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    'border-radius': '6px',
                    padding: '8px 12px',
                    'margin-bottom': '12px',
                    color: 'var(--theme-color-down)',
                    'font-size': '11px',
                    'line-height': '1.4'
                  }}>
                    <strong>Rejection Reason:</strong><br />
                    {ord().failReason}
                  </div>
                </Show>

                {/* Details list */}
                <div class="details-info-list">
                  <div class="info-row">
                    <span class="info-lbl">Order ID</span>
                    <span class="info-val font-mono">#{ord().id}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Quantity</span>
                    <span class="info-val font-mono">{ord().qty} / {ord().qty}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Order Type</span>
                    <span class="info-val">{ord().type}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Limit Price</span>
                    <span class="info-val font-mono">₹{ord().price.toFixed(2)}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Trigger Price</span>
                    <span class="info-val font-mono">{ord().trigger > 0 ? `₹${ord().trigger.toFixed(2)}` : '—'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Product</span>
                    <span class="info-val">{ord().prod}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Validity</span>
                    <span class="info-val">DAY</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Estimated Margin</span>
                    <span class="info-val font-mono">₹ {(ord().qty * ord().price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-lbl">Broker</span>
                    <span class="info-val">{ord().broker}</span>
                  </div>
                </div>

                {/* Actions */}
                <div class="details-actions">
                  <Show when={ord().status === 'open' || ord().status === 'trigger_pending'}>
                    <button class="details-action-btn modify-btn" onClick={() => { setModifyTarget(ord() as any); setShowModify(true); }}>✎ Modify Order</button>
                    <button class="details-action-btn cancel-btn" onClick={() => cancelRealOrder(ord().orderId || ord().id)}>✕ Cancel Order</button>
                  </Show>
                  <button class="details-action-btn outline-btn" onClick={() => handleReorder(new Event('click'), ord() as any)}>↻ Reorder</button>
                  <button class="details-action-btn outline-btn" onClick={() => setShowNewOrder(true)}>+ New Order</button>
                </div>

                {/* Timeline */}
                <div class="details-timeline">
                  <span class="timeline-title">Order Timeline</span>
                  <div class="timeline-nodes">
                    <For each={getOrderTimeline(ord())}>
                      {(node, idx) => (
                        <div class={`timeline-node ${node.status}`}>
                          <Show when={idx() < getOrderTimeline(ord()).length - 1}>
                            <div class="node-line"></div>
                          </Show>
                          <span class="node-dot"></span>
                          <div class="node-content">
                            <span class="node-title font-semibold">{node.title}</span>
                            <span class="node-desc">{node.desc}</span>
                            <span class="node-time">{node.time}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                  <span class="view-audit-log-btn">View Full Audit Log →</span>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
};
