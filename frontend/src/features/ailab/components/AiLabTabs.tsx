import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { AiTabId } from '../aiLabData';
import { aiTabs } from '../aiLabData';

interface AiLabTabsProps {
  active: AiTabId;
  onChange: (tab: AiTabId) => void;
}

export const AiLabTabs: Component<AiLabTabsProps> = (props) => (
  <div class="aiops-tabs" role="tablist">
    <For each={aiTabs}>
      {(tab) => (
        <button
          class={`aiops-tab ${props.active === tab.id ? 'active' : ''}`}
          onClick={() => props.onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      )}
    </For>
  </div>
);

