import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { 
  store, 
  setCoreEngineMode, 
  approveCoreProposal, 
  rejectCoreProposal, 
  tripCoreKillSwitch, 
  resetCoreKillSwitch, 
  clearCoreData 
} from '../../../store/tradingStore';

export const AiOperations: Component = () => {
  const modes = ['Paper', 'Shadow', 'SupervisedLive', 'AutoLive', 'Stopped'];

  return (
    <div class="aiops-page-stack">
      {/* 1. Control Panel */}
      <section class="aiops-section">
        <div class="aiops-section-head">
          <span>Engine Control & Emergency Panel</span>
          <strong>State overrides</strong>
        </div>
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding: 12px 0;">
          {/* Mode Selector */}
          <div>
            <span style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Engine Execution Mode</span>
            <div class="mode-buttons" style="display: flex; gap: 6px;">
              <For each={modes}>
                {(m) => (
                  <button 
                    class={`aiops-btn ${store.coreMode === m ? 'active' : ''}`}
                    onClick={() => setCoreEngineMode(m)}
                    style="padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer;"
                  >
                    {m}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Kill Switch Toggle */}
          <div style="margin-left: auto; display: flex; gap: 12px;">
            <Show 
              when={store.coreKillSwitchActive} 
              fallback={
                <button 
                  class="aiops-btn-danger"
                  onClick={tripCoreKillSwitch}
                  style="background: var(--text-warn); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;"
                >
                  TRIP KILL SWITCH
                </button>
              }
            >
              <button 
                class="aiops-btn"
                onClick={resetCoreKillSwitch}
                style="background: var(--text-good); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;"
              >
                RESET KILL SWITCH
              </button>
            </Show>

            {/* Clear Database */}
            <button 
              class="aiops-btn"
              onClick={clearCoreData}
              style="padding: 8px 16px; border-radius: 4px; cursor: pointer;"
            >
              Clear Core Memory
            </button>
          </div>
        </div>
      </section>

      {/* 2. Supervised Approvals Queue */}
      <section class="aiops-section">
        <div class="aiops-section-head">
          <span>Supervised Live Proposals</span>
          <strong>{store.coreProposals.length} awaiting human review</strong>
        </div>
        <div style="padding: 12px 0;">
          <Show 
            when={store.coreProposals.length > 0} 
            fallback={<div style="color: var(--text-muted); padding: 12px; font-style: italic;">No pending trade proposals from AI strategy model. Mode: {store.coreMode}</div>}
          >
            <div style="display: grid; gap: 12px;">
              <For each={store.coreProposals}>
                {(proposal) => (
                  <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary);">
                    <div>
                      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: bold; font-size: 16px;">{proposal.order.symbol}</span>
                        <span class={`aiops-table-pill ${proposal.order.side === 'Buy' ? 'good' : 'warn'}`}>
                          {proposal.order.side.toUpperCase()}
                        </span>
                        <span style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">
                          Qty: {proposal.order.quantity} | type: {proposal.order.order_type}
                        </span>
                      </div>
                      <div style="font-size: 13px; color: var(--text-secondary);">
                        Model: <b>{proposal.signal.model_id}</b> (Confidence: {(proposal.signal.confidence * 100).toFixed(0)}%)
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        Reason: {proposal.signal.reason}
                      </div>
                      <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        SL: Rs. {proposal.protection.stop_loss} | Target: Rs. {proposal.protection.target || 'None'}
                      </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                      <button 
                        onClick={() => approveCoreProposal(proposal.order.symbol)}
                        style="background: var(--text-good); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;"
                      >
                        APPROVE
                      </button>
                      <button 
                        onClick={() => rejectCoreProposal(proposal.order.symbol)}
                        style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 16px; border-radius: 4px; cursor: pointer;"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </section>

      {/* 3. Paper Shadow Positions & Order Book */}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <section class="aiops-section">
          <div class="aiops-section-head">
            <span>Core Active Positions</span>
            <strong>{store.corePositions.length} position(s)</strong>
          </div>
          <table class="aiops-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Avg Price</th>
                <th>LTP</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              <Show 
                when={store.corePositions.length > 0} 
                fallback={<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 12px;">No active paper positions.</td></tr>}
              >
                <For each={store.corePositions}>
                  {(pos) => (
                    <tr>
                      <td style="font-weight: bold;">{pos.symbol}</td>
                      <td style={`color: ${pos.qty >= 0 ? 'var(--text-good)' : 'var(--text-warn)'}; font-weight: bold;`}>
                        {pos.qty}
                      </td>
                      <td>Rs. {pos.avg_price.toFixed(2)}</td>
                      <td>Rs. {pos.ltp.toFixed(2)}</td>
                      <td style={`color: ${pos.realized_pnl + pos.unrealized_pnl >= 0 ? 'var(--text-good)' : 'var(--text-warn)'}; font-weight: bold;`}>
                        Rs. {(pos.realized_pnl + pos.unrealized_pnl).toFixed(2)}
                      </td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </section>

        <section class="aiops-section">
          <div class="aiops-section-head">
            <span>Core Order Book</span>
            <strong>Live shadow book</strong>
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table class="aiops-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>State</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <Show 
                  when={store.orders.filter(o => o.broker === 'paper').length > 0} 
                  fallback={<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">No orders found in shadow book.</td></tr>}
                >
                  <For each={store.orders.filter(o => o.broker === 'paper')}>
                    {(o) => (
                      <tr>
                        <td>{o.inst}</td>
                        <td><span class={`aiops-table-pill ${o.side === 'Buy' ? 'good' : 'warn'}`}>{o.side}</span></td>
                        <td><span class="aiops-table-pill info">{o.status}</span></td>
                        <td>Rs. {o.price.toFixed(2)}</td>
                      </tr>
                    )}
                  </For>
                </Show>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
