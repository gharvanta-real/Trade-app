import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { modelRows } from '../aiLabData';

export const AiModelLab: Component = () => (
  <section class="aiops-section">
    <div class="aiops-section-head">
      <span>Model And Backtest Lab</span>
      <strong>Rust core</strong>
    </div>
    <table class="aiops-table">
      <thead>
        <tr>
          <th>Module</th>
          <th>Role</th>
          <th>State</th>
          <th>Next Upgrade</th>
        </tr>
      </thead>
      <tbody>
        <For each={modelRows}>
          {(row) => (
            <tr>
              <td>{row.model}</td>
              <td>{row.role}</td>
              <td><span class="aiops-table-pill">{row.state}</span></td>
              <td>{row.next}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </section>
);

