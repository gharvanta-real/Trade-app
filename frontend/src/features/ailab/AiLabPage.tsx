import { createSignal, Match, Switch } from 'solid-js';
import type { Component } from 'solid-js';
import './ailab.css';
import type { AiTabId } from './aiLabData';
import { AiDataHealth } from './components/AiDataHealth';
import { AiLabTabs } from './components/AiLabTabs';
import { AiModelLab } from './components/AiModelLab';
import { AiOperations } from './components/AiOperations';
import { AiOverview } from './components/AiOverview';
import { AiRoadmap } from './components/AiRoadmap';
import { AiWarnings } from './components/AiWarnings';

interface AiLabPageProps {
  onRunBacktest?: () => void;
}

export const AiLabPage: Component<AiLabPageProps> = () => {
  const [activeTab, setActiveTab] = createSignal<AiTabId>('overview');

  return (
    <div class="aiops-page">
      <header class="aiops-header">
        <div>
          <h1>AI Operations Lab</h1>
          <p>Understand what AI is doing, which data it trusts, what is blocked, and what comes next.</p>
        </div>
        <div class="aiops-header-status">
          <span class="aiops-live-dot" />
          Rust core: shadow ready
        </div>
      </header>

      <AiLabTabs active={activeTab()} onChange={setActiveTab} />

      <main class="aiops-content">
        <Switch>
          <Match when={activeTab() === 'overview'}>
            <AiOverview />
          </Match>
          <Match when={activeTab() === 'operations'}>
            <AiOperations />
          </Match>
          <Match when={activeTab() === 'data'}>
            <AiDataHealth />
          </Match>
          <Match when={activeTab() === 'warnings'}>
            <AiWarnings />
          </Match>
          <Match when={activeTab() === 'models'}>
            <AiModelLab />
          </Match>
          <Match when={activeTab() === 'roadmap'}>
            <AiRoadmap />
          </Match>
        </Switch>
      </main>
    </div>
  );
};
