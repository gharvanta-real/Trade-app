import { createSignal, For } from 'solid-js';
import type { Component } from 'solid-js';
import { HugeIcon } from '../components/HugeIcon';
import {
  DashboardSquare01Icon,
  ListViewIcon,
  NoteIcon,
  Analytics01Icon,
  Briefcase01Icon,
  ChartLineIcon,
  CpuIcon,
  ZapIcon,
  BellIcon,
  BarChartIcon,
  Settings02Icon,
  Logout01Icon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@hugeicons/core-free-icons';

interface SidebarProps {
  activeTab: () => string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [isCollapsed, setIsCollapsed] = createSignal(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardSquare01Icon },
    { id: 'watchlist', label: 'Watchlist', icon: ListViewIcon },
    { id: 'orders', label: 'Orders', icon: NoteIcon },
    { id: 'option-chain', label: 'Option Chain', icon: Analytics01Icon },
    { id: 'positions', label: 'Positions', icon: Briefcase01Icon },
    { id: 'charts', label: 'Charts', icon: ChartLineIcon },
    { id: 'ailab', label: 'AI Lab', icon: CpuIcon },
    { id: 'strategy', label: 'Strategy', icon: ZapIcon },
    { id: 'alerts', label: 'Alerts', icon: BellIcon },
    { id: 'reports', label: 'Reports', icon: BarChartIcon },
    { id: 'settings', label: 'Settings', icon: Settings02Icon },
  ];

  return (
    <nav class={`sidebar ${isCollapsed() ? 'collapsed' : ''}`}>
      <div class="sidebar-menu">
        <For each={menuItems}>
          {(item) => {
            return (
              <button
                class={`sidebar-item ${props.activeTab() === item.id ? 'active' : ''}`}
                onClick={() => props.setActiveTab(item.id)}
                title={item.label}
              >
                <div class="sidebar-icon-wrapper">
                  <HugeIcon icon={item.icon} size={18} />
                </div>
                <span class="sidebar-label">{item.label}</span>
              </button>
            );
          }}
        </For>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", "border-top": "1px solid var(--theme-border-light)" }}>
        <button 
          class="sidebar-item" 
          onClick={() => props.onLogout()}
          title="Logout"
          style={{ color: "var(--theme-color-down)" }}
        >
          <div class="sidebar-icon-wrapper">
            <HugeIcon icon={Logout01Icon} size={18} />
          </div>
          <span class="sidebar-label">Logout</span>
        </button>

        <button 
          class="sidebar-collapse-btn" 
          onClick={() => setIsCollapsed(!isCollapsed())}
          title={isCollapsed() ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{ "border-top": "none", "margin-bottom": "0" }}
        >
          {isCollapsed() ? <HugeIcon icon={ChevronRightIcon} size={14} /> : <HugeIcon icon={ChevronLeftIcon} size={14} />}
          <span class="sidebar-label">Collapse</span>
        </button>
      </div>
    </nav>
  );
};
