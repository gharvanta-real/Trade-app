import { createSignal, For } from 'solid-js';
import type { Component } from 'solid-js';
import './profile.css';

export const ProfilePage: Component = () => {
  const [activeSubTab, setActiveSubTab] = createSignal('profile');

  const accountDetails = [
    { label: 'Account ID', val: 'NEXUS123456' },
    { label: 'Segment', val: 'Equity, F&O, Currency' },
    { label: 'Brokerage Plan', val: 'Premium Elite' },
    { label: 'Account Status', val: 'Active', highlight: 'up' },
  ];

  return (
    <div class="profile-page-layout">
      <div class="profile-title-header">
        <div class="profile-title-left">
          <h1 class="profile-title-text">Profile Information</h1>
          <p class="profile-sub-text">Manage your personal settings and active trading segment privileges</p>
        </div>
      </div>

      <div class="profile-panel-main">
        <div class="profile-grid">
          {/* Left Sub-nav */}
          <div class="profile-nav">
            <For each={['Profile', 'Preferences', 'Security', 'Subscription']}>
              {(tab) => (
                <button
                  class={`profile-nav-item ${activeSubTab() === tab.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setActiveSubTab(tab.toLowerCase())}
                >
                  {tab}
                </button>
              )}
            </For>
          </div>

          {/* Right Main Details */}
          <div class="profile-main">
            <div class="profile-user-card">
              <div class="profile-lg-avatar">SK</div>
              <div class="profile-user-details">
                <span class="profile-user-name">Sunil Kumar</span>
                <span style={{ "font-size": "11px", color: "var(--theme-text-secondary)" }}>
                  sunil.kumar@example.com
                </span>
                <span style={{ "font-size": "10px", color: "var(--theme-text-muted)", "font-family": "var(--sys-font-mono)" }}>
                  +91 98765 43210
                </span>
              </div>
            </div>

            <div style={{ display: "flex", "flex-direction": "column", gap: "var(--sys-space-3)", "margin-top": "var(--sys-space-2)" }}>
              <h3 class="orders-title" style={{ "font-size": "12px", "border-bottom": "1px solid var(--theme-border-light)", "padding-bottom": "var(--sys-space-2)" }}>
                Trading Account Details
              </h3>

              <table class="db-pos-overview-table" style={{ width: "100%", "max-width": "480px" }}>
                <tbody>
                  <For each={accountDetails}>
                    {(detail) => (
                      <tr>
                        <td style={{ color: "var(--theme-text-secondary)", "font-weight": "500" }}>{detail.label}</td>
                        <td style={{ "text-align": "right", "font-weight": "600" }} class={detail.highlight ? 'up' : ''}>
                          {detail.val}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            <button 
              class="orders-action-btn" 
              style={{ "margin-top": "var(--sys-space-4)", "max-width": "120px", "text-align": "center" }}
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
