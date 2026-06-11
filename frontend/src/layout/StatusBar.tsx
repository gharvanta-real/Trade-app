import { createSignal, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { HugeIcon } from '../components/HugeIcon';
import { WifiIcon, SparklesIcon } from '@hugeicons/core-free-icons';

export const StatusBar: Component = () => {
  const [latency, setLatency] = createSignal(15);

  const interval = setInterval(() => {
    setLatency(l => {
      const delta = Math.floor((Math.random() - 0.5) * 4);
      const newL = l + delta;
      return newL >= 8 && newL <= 25 ? newL : l;
    });
  }, 3000);

  onCleanup(() => clearInterval(interval));

  return (
    <footer class="statusbar">
      <div class="statusbar-left">
        <span class="status-indicator live"></span>
        <span class="status-text font-mono">Lightning Fast • {latency()}ms</span>
        <span class="status-divider">|</span>
        <span class="status-text">Data: Live</span>
      </div>

      <div class="statusbar-center">
        <HugeIcon icon={SparklesIcon} size={12} class="ai-spark-icon" />
        <span class="ai-status-text">AI Engine: Active</span>
      </div>

      <div class="statusbar-right">
        <HugeIcon icon={WifiIcon} size={12} class="net-icon" />
        <span class="status-text">Connected</span>
      </div>
    </footer>
  );
};
