import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { warnings } from '../aiLabData';

export const AiWarnings: Component = () => (
  <section class="aiops-section">
    <div class="aiops-section-head">
      <span>Warnings And Guardrails</span>
      <strong>Do not ignore</strong>
    </div>
    <div class="aiops-warning-grid">
      <For each={warnings}>
        {(warning) => (
          <div class={`aiops-warning ${warning.severity.toLowerCase()}`}>
            <span>{warning.severity}</span>
            <strong>{warning.title}</strong>
            <p>{warning.detail}</p>
          </div>
        )}
      </For>
    </div>
  </section>
);

