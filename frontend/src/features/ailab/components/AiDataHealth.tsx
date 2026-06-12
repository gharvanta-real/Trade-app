import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { store } from '../../../store/tradingStore';

export const AiDataHealth: Component = () => {
  const dataFeeds = () => [
    { 
      feed: 'Broker ticks', 
      source: 'Kotak feed handler', 
      state: store.coreTicks > 0 ? 'Ready' : 'Waiting', 
      tone: store.coreTicks > 0 ? 'good' : 'warn',
      use: `Ticks: ${store.coreTicks} | normalized into MarketTick.` 
    },
    { 
      feed: 'Candles', 
      source: 'Rust candle builder', 
      state: store.coreCandles > 0 ? 'Ready' : 'Waiting', 
      tone: store.coreCandles > 0 ? 'good' : 'warn',
      use: `Closed rolling buckets: ${store.coreCandles}` 
    },
    { 
      feed: 'Option chain', 
      source: 'Rust Option Context mapper', 
      state: store.coreConnected ? 'Active' : 'Offline', 
      tone: store.coreConnected ? 'good' : 'warn',
      use: 'ATM strike, IV, OI, CE/PE ltp parsed dynamically on option ticks.' 
    },
    { 
      feed: 'Pending approvals', 
      source: 'Trading supervisor', 
      state: store.coreProposals.length > 0 ? 'Awaiting Human' : 'Clean', 
      tone: store.coreProposals.length > 0 ? 'info' : 'good',
      use: `${store.coreProposals.length} proposals in queue.` 
    },
  ];

  return (
    <section class="aiops-section">
      <div class="aiops-section-head">
        <span>Data Health</span>
        <strong>Input quality map</strong>
      </div>
      <table class="aiops-table">
        <thead>
          <tr>
            <th>Data Feed</th>
            <th>Source</th>
            <th>State</th>
            <th>Real Metrics / Use Case</th>
          </tr>
        </thead>
        <tbody>
          <For each={dataFeeds()}>
            {(feed) => (
              <tr>
                <td>{feed.feed}</td>
                <td>{feed.source}</td>
                <td><span class={`aiops-table-pill ${feed.tone}`}>{feed.state}</span></td>
                <td>{feed.use}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
};
