import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store } from '../../../store/tradingStore';

export const AiOverview: Component = () => {
  const statusCards = () => [
    { 
      label: 'Core Mode', 
      value: store.coreConnected ? store.coreMode : 'Offline', 
      tone: store.coreConnected ? 'info' : 'warn',
      detail: store.coreConnected 
        ? `Running in ${store.coreMode} mode.` 
        : 'Feed handler is not running.' 
    },
    { 
      label: 'Risk Gate', 
      value: store.coreKillSwitchActive ? 'TRIPPED' : (store.coreConnected ? 'Armed' : 'Inactive'), 
      tone: store.coreKillSwitchActive ? 'warn' : 'good', 
      detail: store.coreKillSwitchActive 
        ? 'Kill switch is active. AI blocked.' 
        : 'Kill switch, daily loss limits active.' 
    },
    { 
      label: 'Paper P&L', 
      value: `Rs. ${store.coreRealizedPnl.toFixed(2)}`, 
      tone: store.coreRealizedPnl >= 0 ? 'good' : 'warn', 
      detail: `Realized: Rs. ${store.coreRealizedPnl.toFixed(2)} | Unrealized: Rs. ${store.coreUnrealizedPnl.toFixed(2)}` 
    },
    { 
      label: 'Ticks Ingested', 
      value: store.coreTicks.toLocaleString(), 
      tone: 'neutral', 
      detail: `Closed Candles: ${store.coreCandles}` 
    },
  ];

  return (
    <div class="aiops-grid two-one">
      <section class="aiops-section">
        <div class="aiops-section-head">
          <span>AI Operating State</span>
          <strong>{store.coreConnected ? 'Live Connection' : 'Disconnected'}</strong>
        </div>
        <div class="aiops-metric-grid">
          <For each={statusCards()}>
            {(card) => (
              <div class={`aiops-metric ${card.tone}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="aiops-section">
        <div class="aiops-section-head">
          <span>Top Warnings</span>
          <strong>{store.coreWarnings.length}</strong>
        </div>
        <div class="aiops-list compact">
          <Show 
            when={store.coreWarnings.length > 0} 
            fallback={<div style="color: var(--text-good); padding: 12px;">All risk controls clean. No warnings.</div>}
          >
            <For each={store.coreWarnings.slice(0, 3)}>
              {(warning) => (
                <div class="aiops-list-row">
                  <b style="color: var(--text-warn); margin-right: 8px;">{warning.severity}</b>
                  <span>{warning.title}</span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </section>

      <section class="aiops-section wide">
        <div class="aiops-section-head">
          <span>Recent Core Audit Trail</span>
          <strong>Last {store.coreAuditLogs.length} events</strong>
        </div>
        <div class="aiops-table-container" style="max-height: 300px; overflow-y: auto;">
          <table class="aiops-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Time (ms)</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <Show 
                when={store.coreAuditLogs.length > 0} 
                fallback={<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No core events recorded. Start feed client.</td></tr>}
              >
                <For each={store.coreAuditLogs}>
                  {(log) => (
                    <tr>
                      <td><span class="aiops-table-pill info" style="font-family: monospace;">{log.event_type}</span></td>
                      <td>{log.timestamp}</td>
                      <td><pre style="margin: 0; font-size: 11px; color: var(--text-secondary); max-width: 500px; overflow-x: auto;">{JSON.stringify(log.data)}</pre></td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
