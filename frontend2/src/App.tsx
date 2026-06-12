import { createSignal, createEffect, Switch, Match, Show, onMount, For } from 'solid-js';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { StatusBar } from './layout/StatusBar';

// Page Imports
import { LoginPage } from './features/login/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { WatchlistPage } from './features/watchlist/WatchlistPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { OptionChainPage } from './features/optionchain/OptionChainPage';
import { PositionsPage } from './features/positions/PositionsPage';
import { ChartsPage } from './features/charts/ChartsPage';
import { AiLabPage } from './features/ailab/AiLabPage';
import { StrategyPage } from './features/strategy/StrategyPage';
import { AlertsPage } from './features/alerts/AlertsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ProfilePage } from './features/profile/ProfilePage';

// Store Import
import { store, initMarketWebSocket, registerTabNavigator, removeNotification, navigateToTab, updateSetting } from './store/tradingStore';

import './layout/layout.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const theme = () => store.settings.theme;
  const setTheme = (t: 'dark' | 'light') => updateSetting('theme', t);
  const [activeTab, setActiveTab] = createSignal('dashboard');

  onMount(() => {
    initMarketWebSocket();
    registerTabNavigator(setActiveTab);
  });

  // Sync theme selection to document element data-theme attribute
  createEffect(() => {
    document.documentElement.setAttribute('data-theme', theme());
  });

  return (
    <Show 
      when={isAuthenticated()} 
      fallback={<LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />}
    >
      <div class="app-wrapper">
        <TopBar 
          theme={theme} 
          setTheme={setTheme} 
          // Link profile avatar click to route to profile page
          onProfileClick={() => setActiveTab('profile')} 
        />
        
        <div class="shell-middle">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={() => {
              setIsAuthenticated(false);
              setActiveTab('dashboard'); // reset tab
            }}
          />
          
          <main class="main-workspace">
            <Switch fallback={<DashboardPage theme={theme} />}>
              <Match when={activeTab() === 'dashboard'}>
                <DashboardPage theme={theme} />
              </Match>
              <Match when={activeTab() === 'watchlist'}>
                <WatchlistPage />
              </Match>
              <Match when={activeTab() === 'orders'}>
                <OrdersPage />
              </Match>
              <Match when={activeTab() === 'option-chain'}>
                <OptionChainPage />
              </Match>
              <Match when={activeTab() === 'positions'}>
                <PositionsPage />
              </Match>
              <Match when={activeTab() === 'charts'}>
                <ChartsPage theme={theme} />
              </Match>
              <Match when={activeTab() === 'ailab'}>
                <AiLabPage onRunBacktest={() => setActiveTab('strategy')} />
              </Match>
              <Match when={activeTab() === 'strategy'}>
                <StrategyPage theme={theme} />
              </Match>
              <Match when={activeTab() === 'alerts'}>
                <AlertsPage />
              </Match>
              <Match when={activeTab() === 'reports'}>
                <ReportsPage theme={theme} />
              </Match>
              <Match when={activeTab() === 'settings'}>
                <SettingsPage theme={theme} setTheme={setTheme} />
              </Match>
              <Match when={activeTab() === 'profile'}>
                <ProfilePage />
              </Match>
            </Switch>
          </main>
        </div>

        <StatusBar />

        {/* Floating Toast Notification Container */}
        <div class="toast-container">
          <For each={store.notifications}>
            {(notif) => (
              <div 
                class={`toast-card ${notif.type}`}
                onClick={() => {
                  if (notif.targetTab) {
                    navigateToTab(notif.targetTab);
                  }
                  removeNotification(notif.id);
                }}
              >
                <div class="toast-header">
                  <span class="toast-title">{notif.title}</span>
                  <button 
                    class="toast-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                  >
                    &times;
                  </button>
                </div>
                <div class="toast-body">{notif.message}</div>
                <span class="toast-time">{notif.timestamp}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

export default App;
