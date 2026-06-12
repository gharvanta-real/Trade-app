import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { roadmap } from '../aiLabData';

export const AiRoadmap: Component = () => (
  <section class="aiops-section">
    <div class="aiops-section-head">
      <span>Next 100 Percent Work</span>
      <strong>Execution plan</strong>
    </div>
    <div class="aiops-roadmap">
      <For each={roadmap}>
        {(item) => (
          <div class="aiops-roadmap-item">
            <span>{item.phase}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </div>
        )}
      </For>
    </div>
  </section>
);

