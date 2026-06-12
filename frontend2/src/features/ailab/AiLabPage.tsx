import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { store, runStrategyBacktest } from '../../store/tradingStore';
import './ailab.css';

interface AiLabPageProps {
  onRunBacktest?: () => void;
}

export const AiLabPage: Component<AiLabPageProps> = () => {
  const [activeTab, setActiveTab] = createSignal('overview');

  // Strategy Builder form states
  const [strategyName, setStrategyName] = createSignal('My AI Strategy');
  const [strategyTemplate, setStrategyTemplate] = createSignal('Momentum Breakout');

  // Overview Tab Mock Data
  const recentExperiments = [
    { name: 'Opening Range Breakout v3', type: 'Strategy', status: 'running', perf: '+18.42%', time: '9:30 AM', up: true },
    { name: 'Trend Following NIFTY', type: 'Strategy', status: 'completed', perf: '+12.07%', time: 'Yesterday', up: true },
    { name: 'Mean Reversion BANKNIFTY', type: 'Strategy', status: 'completed', perf: '-3.21%', time: '2 days ago', up: false },
  ];

  const aiExperiments = [
    { name: 'Breakout Strategy v2', status: 'running' },
    { name: 'Opened Range Reversal', status: 'completed' },
    { name: 'IV Crush Scalping', status: 'running' }
  ];

  return (
    <div class="ailab-page-layout">
      {/* Workspace Header */}
      <div class="ailab-title-header">
        <div class="ailab-title-left">
          <h1 class="ailab-title-text">AI Labs</h1>
          <p class="ailab-sub-text">AI-powered insights, strategy generation & trade intelligence</p>
        </div>
        <div class="ailab-header-actions-right">
          <button class="ailab-btn-how-works">
            <svg class="ailab-btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            How AI Labs Works
          </button>
          <button class="ailab-btn-new-experiment">
            <svg class="ailab-btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Experiment
          </button>
          
          <div class="ailab-header-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="badge-dot-count">3</span>
          </div>

          <div class="ailab-user-profile-badge">
            <div class="profile-avatar-sm">AT</div>
            <span class="profile-name-sm font-semibold">Aman Trader</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div class="ailab-tabs-bar">
        <div class="table-tabs">
          <button class={`table-tab ${activeTab() === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button class={`table-tab ${activeTab() === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>Market Intelligence</button>
          <button class={`table-tab ${activeTab() === 'strategy' ? 'active' : ''}`} onClick={() => setActiveTab('strategy')}>Strategy Generator</button>
          <button class={`table-tab ${activeTab() === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>Trade Coach</button>
          <button class={`table-tab ${activeTab() === 'scanner' ? 'active' : ''}`} onClick={() => setActiveTab('scanner')}>Pattern Scanner</button>
          <button class={`table-tab ${activeTab() === 'datalab' ? 'active' : ''}`} onClick={() => setActiveTab('datalab')}>Data Lab</button>
          <button class={`table-tab ${activeTab() === 'experiments' ? 'active' : ''}`} onClick={() => setActiveTab('experiments')}>Experiments</button>
        </div>
      </div>

      {/* Panel Contents */}
      <div class="ailab-panel-main">
        
        {/* ── Tab 1: Overview ────────────────────────────────────────── */}
        <Show when={activeTab() === 'overview'}>
          <div class="ailab-dashboard-split">
            {/* Left Column Workspace */}
            <div class="ailab-dash-left">
              
              {/* Row 1: Welcome Banner Card */}
              <div class="ailab-welcome-banner">
                <div class="welcome-text-side">
                  <h2 class="welcome-heading">Welcome to AI Labs 🤖</h2>
                  <p class="welcome-para">Your intelligent trading co-pilot. Analyze markets, discover opportunities, and continuously improve your trading edge.</p>
                  <div class="welcome-badges-row">
                    <span class="welcome-badge">Market Aware</span>
                    <span class="welcome-badge">Pattern Recognition</span>
                    <span class="welcome-badge">Self Learning</span>
                    <span class="welcome-badge">Risk Intelligent</span>
                  </div>
                </div>
                <div class="welcome-robot-graphic">
                  {/* Clean futuristic Robot SVG icon */}
                  <svg width="85" height="85" viewBox="0 0 100 100" fill="none">
                    <rect x="15" y="25" width="70" height="50" rx="20" fill="var(--theme-color-ai-bg)" stroke="var(--theme-color-ai)" stroke-width="2" />
                    <ellipse cx="38" cy="48" rx="8" ry="8" fill="var(--theme-color-ai)" />
                    <ellipse cx="62" cy="48" rx="8" ry="8" fill="var(--theme-color-ai)" />
                    <circle cx="38" cy="48" r="3" fill="#fff" />
                    <circle cx="62" cy="48" r="3" fill="#fff" />
                    <path d="M42 63C42 63 45 66 50 66C55 66 58 63 58 63" stroke="var(--theme-color-ai)" stroke-width="2" stroke-linecap="round" />
                    <line x1="50" y1="25" x2="50" y2="15" stroke="var(--theme-color-ai)" stroke-width="2.5" />
                    <circle cx="50" cy="12" r="4" fill="var(--theme-color-ai)" />
                    <path d="M15 45H10V55H15" stroke="var(--theme-color-ai)" stroke-width="2" stroke-linecap="round" />
                    <path d="M85 45H90V55H85" stroke="var(--theme-color-ai)" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              </div>

              {/* Row 2: "What would you like AI to help you" Grid */}
              <div class="ailab-actions-section">
                <span class="actions-section-title font-semibold">What would you like AI to help you with today?</span>
                <div class="ailab-actions-buttons-grid">
                  <button class="action-tile-btn" onClick={() => setActiveTab('market')}>
                    <span class="action-tile-icon purple">📊</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Market Summary</span>
                      <span class="action-tile-sub">AI overview</span>
                    </div>
                  </button>
                  <button class="action-tile-btn" onClick={() => setActiveTab('coach')}>
                    <span class="action-tile-icon pink">🧠</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Trade Coach</span>
                      <span class="action-tile-sub">Review last trade</span>
                    </div>
                  </button>
                  <button class="action-tile-btn" onClick={() => setActiveTab('strategy')}>
                    <span class="action-tile-icon blue">⚡</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Strategy Generator</span>
                      <span class="action-tile-sub">Create new strategy</span>
                    </div>
                  </button>
                  <button class="action-tile-btn" onClick={() => setActiveTab('scanner')}>
                    <span class="action-tile-icon green">🔍</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Pattern Scanner</span>
                      <span class="action-tile-sub">Find opportunities</span>
                    </div>
                  </button>
                  <button class="action-tile-btn" onClick={() => setActiveTab('datalab')}>
                    <span class="action-tile-icon orange">🛡️</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Risk Analyzer</span>
                      <span class="action-tile-sub">Check risk exposure</span>
                    </div>
                  </button>
                  <button class="action-tile-btn" onClick={() => setActiveTab('experiments')}>
                    <span class="action-tile-icon gray">📖</span>
                    <div class="action-tile-lbl-box">
                      <span class="action-tile-lbl font-semibold">Journal Insights</span>
                      <span class="action-tile-sub">Personal analytics</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Row 3: Market Intelligence & Strategy Suggestion splits */}
              <div class="ailab-overview-splits-row">
                
                {/* Market Intelligence Box */}
                <div class="overview-split-cell">
                  <div class="split-cell-header">
                    <span class="split-cell-title font-bold">Market Intelligence</span>
                    <span class="live-indicator-pill">Live</span>
                  </div>
                  
                  <div class="market-intel-content">
                    {/* Index split */}
                    <div class="market-intel-left-pane">
                      <div class="index-quote-box">
                        <span class="index-lbl font-bold">NIFTY 50</span>
                        <div class="index-quote-price-row">
                          <span class="index-price font-bold font-mono">22,937.50</span>
                          <span class="index-change-val font-mono up">+96.40 (0.42%)</span>
                        </div>
                        {/* Sparkline */}
                        <div class="index-sparkline-svg">
                          <svg width="120" height="25" viewBox="0 0 120 25">
                            <path d="M0,20 Q20,15 40,22 T80,5 T120,2" fill="none" stroke="var(--theme-color-up)" stroke-width="2" stroke-linecap="round" />
                          </svg>
                        </div>
                      </div>

                      {/* Metrics table */}
                      <table class="index-regime-table">
                        <tbody>
                          <tr>
                            <td>Market Regime</td>
                            <td class="font-bold font-mono text-right" style={{ color: "var(--theme-color-neutral)" }}>Range Bound</td>
                          </tr>
                          <tr>
                            <td>Volatility (India VIX)</td>
                            <td class="font-mono text-right down">14.62 (-1.23%)</td>
                          </tr>
                          <tr>
                            <td>Put Call Ratio (NIFTY)</td>
                            <td class="font-mono text-right">1.08 (Neutral)</td>
                          </tr>
                          <tr>
                            <td>Fear & Greed Index</td>
                            <td class="font-mono text-right">56 (Neutral)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* AI Market text summary */}
                    <div class="market-intel-right-pane">
                      <div class="ai-summary-time-row">
                        <span class="ai-summary-lbl font-bold">AI Market Summary</span>
                        <span class="ai-summary-time font-mono">9:42 AM</span>
                      </div>
                      <p class="ai-summary-txt">NIFTY is trading in a range between 22,850 - 23,050. Volatility is moderate with no strong directional bias. Options data shows balanced sentiment.</p>
                      
                      <ul class="ai-bullets-list">
                        <li>Liquidity is concentrated around 23,000 strike</li>
                        <li>No major OI build-up on either side</li>
                        <li>Ideal for range-bound strategies</li>
                        <li>Breakout likely above 23,080 or below 22,620</li>
                      </ul>
                      
                      <button class="ai-view-more-btn" onClick={() => setActiveTab('market')}>
                        View Full Analysis &rarr;
                      </button>
                    </div>
                  </div>
                </div>

                {/* Strategy Generator suggested strategy Box */}
                <div class="overview-split-cell">
                  <div class="split-cell-header">
                    <span class="split-cell-title font-bold">Strategy Generator</span>
                    <span class="preview-indicator-pill">Preview</span>
                  </div>

                  <div class="suggested-strategy-body">
                    <span class="suggest-lbl">AI Suggested Strategy</span>
                    <div class="suggest-header-row">
                      <span class="suggest-strategy-name font-bold">Iron Condor</span>
                      <span class="suggest-badge neutral">Neutral</span>
                    </div>
                    <p class="suggest-strategy-desc">High probability range strategy for current market condition</p>

                    <div class="suggest-stats-grid">
                      <div class="suggest-stat-item">
                        <span class="suggest-stat-lbl">Expected Win Rate</span>
                        <span class="suggest-stat-val font-mono font-bold">68%</span>
                      </div>
                      <div class="suggest-stat-item">
                        <span class="suggest-stat-lbl">Max Profit</span>
                        <span class="suggest-stat-val font-mono font-bold">₹4,250</span>
                      </div>
                      <div class="suggest-stat-item">
                        <span class="suggest-stat-lbl">Max Loss</span>
                        <span class="suggest-stat-val font-mono font-bold">₹5,750</span>
                      </div>
                      <div class="suggest-stat-item">
                        <span class="suggest-stat-lbl">Risk Reward</span>
                        <span class="suggest-stat-val font-mono font-bold">1:0.74</span>
                      </div>
                    </div>

                    <button class="ai-generate-strategy-btn" onClick={() => setActiveTab('strategy')}>
                      Generate Full Strategy
                    </button>
                  </div>
                </div>

              </div>

              {/* Row 4: Recent Experiments table */}
              <div class="ailab-table-panel">
                <div class="panel-header-new">
                  <span class="panel-title-new">Recent Experiments</span>
                  <button class="ai-view-more-btn" style={{ "margin": 0 }} onClick={() => setActiveTab('experiments')}>
                    View All Experiments &rarr;
                  </button>
                </div>
                
                <div class="ailab-table-wrapper">
                  <table class="experiments-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Performance</th>
                        <th>Last Run</th>
                        <th style={{ "text-align": "right", width: "40px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={recentExperiments}>
                        {(exp) => (
                          <tr>
                            <td class="font-bold">{exp.name}</td>
                            <td>{exp.type}</td>
                            <td>
                              <span class={`status-pill ${exp.status}`}>
                                <span class="status-dot"></span>
                                {exp.status.toUpperCase()}
                              </span>
                            </td>
                            <td class={`font-mono font-bold ${exp.up ? 'up' : 'down'}`}>
                              {exp.perf}
                            </td>
                            <td class="font-mono">{exp.time}</td>
                            <td style={{ "text-align": "right" }}>
                              <button class="row-menu-btn">•••</button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Column Sidebar */}
            <div class="ailab-dash-right">
              
              {/* Sidebar item 1: AI Confidence Progress Donut */}
              <div class="sidebar-widget-cell">
                <div class="widget-header">
                  <span class="widget-title font-semibold">AI Confidence Today</span>
                  <span class="widget-info-btn">ⓘ</span>
                </div>
                
                <div class="ai-confidence-body">
                  <div class="circular-progress-box">
                    <svg width="85" height="85" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="var(--theme-bg-active)" stroke-width="8" fill="none" />
                      <circle cx="50" cy="50" r="40" stroke="var(--theme-color-ai)" stroke-width="8" fill="none" 
                        stroke-dasharray="251.2" stroke-dashoffset={251.2 * (1 - 0.72)} stroke-linecap="round" />
                      <text x="50" y="56" font-weight="700" font-family="var(--sys-font-display)" font-size="18" fill="var(--theme-text-primary)" text-anchor="middle">
                        72%
                      </text>
                    </svg>
                  </div>
                  <div class="ai-confidence-lbl-box">
                    <span class="confidence-summary font-bold">Moderate Confidence</span>
                    <span class="confidence-sub font-mono">Market condition: Choppy</span>
                  </div>
                </div>
              </div>

              {/* Sidebar item 2: AI Trade Coach Last Trade box */}
              <div class="sidebar-widget-cell">
                <div class="widget-header">
                  <span class="widget-title font-semibold">AI Trade Coach</span>
                </div>

                <div class="trade-coach-review-box">
                  <div class="coach-review-top-row">
                    <span class="coach-review-lbl font-semibold">Last Trade Review</span>
                    <span class="coach-review-badge loss">Loss</span>
                  </div>

                  <div class="coach-trade-info">
                    <span class="coach-trade-inst font-bold">BANKNIFTY 48500 CE</span>
                    <span class="coach-trade-pnl font-mono down">-₹1,250 (-0.83%)</span>
                  </div>

                  <div class="coach-diagnostic-section">
                    <span class="diag-title font-bold">AI Analysis</span>
                    <p class="diag-text">Entry was taken during low volume breakout. No OI support and price rejected at key resistance.</p>
                  </div>

                  <div class="coach-diagnostic-section">
                    <span class="diag-title font-bold">Improvement</span>
                    <p class="diag-text">Wait for volume confirmation above resistance with OI build-up.</p>
                  </div>

                  <button class="coach-full-review-btn" onClick={() => setActiveTab('coach')}>
                    View Full Review &rarr;
                  </button>
                </div>
              </div>

              {/* Sidebar item 3: Learning Insights Progress bar */}
              <div class="sidebar-widget-cell">
                <div class="widget-header">
                  <span class="widget-title font-semibold">Learning Insights</span>
                  <select class="insights-filter-select">
                    <option>This Week</option>
                    <option>This Month</option>
                  </select>
                </div>

                <div class="learning-insights-list">
                  <div class="learning-item-row">
                    <span class="learning-item-lbl">Best Performing Setup</span>
                    <span class="learning-item-val font-bold up">OR Breakout</span>
                    <span class="learning-item-detail font-mono up">+₹8,450</span>
                  </div>

                  <div class="learning-item-row">
                    <span class="learning-item-lbl">Common Mistake</span>
                    <span class="learning-item-val font-bold down">Early Entry</span>
                    <span class="learning-item-detail font-mono text-muted">3 times</span>
                  </div>

                  <div class="patience-progress-container">
                    <div class="patience-progress-header">
                      <span class="patience-lbl font-semibold">Patience Score</span>
                      <span class="patience-val font-mono font-bold">72/100</span>
                    </div>
                    <div class="patience-bar-track">
                      <div class="patience-bar-fill" style={{ width: "72%" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar item 4: AI Experiments List */}
              <div class="sidebar-widget-cell">
                <div class="widget-header">
                  <span class="widget-title font-semibold">AI Experiments</span>
                  <button class="ai-view-all-sidebar-btn" onClick={() => setActiveTab('experiments')}>View All</button>
                </div>
                
                <div class="sidebar-experiments-list">
                  <For each={aiExperiments}>
                    {(exp) => (
                      <div class="sidebar-exp-row">
                        <div class="exp-row-left">
                          <span class="exp-dot-bullet"></span>
                          <span class="exp-row-name font-semibold">{exp.name}</span>
                        </div>
                        <span class={`exp-row-status ${exp.status}`}>
                          {exp.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

            </div>
          </div>
        </Show>

        {/* ── Tab 2: Market Intelligence ────────────────────────────── */}
        <Show when={activeTab() === 'market'}>
          <div class="ailab-details-subview">
            <h2 class="subview-title">Market Intelligence Hub</h2>
            <p class="subview-intro">Live index sentiment analysis, put-call ratio trackers, volatility diagnostic matrices, and options boundary alerts.</p>
            
            <div class="subview-cards-grid">
              <div class="subview-metric-pane">
                <span class="pane-lbl">NIFTY Trend Analysis</span>
                <span class="pane-val font-bold up">Moderately Bullish</span>
                <p class="pane-desc">Index is holding above its 20 EMA at 22,860, indicating strong immediate support. Immediate resistance lies at 23,080.</p>
              </div>

              <div class="subview-metric-pane">
                <span class="pane-lbl">India VIX Diagnostics</span>
                <span class="pane-val font-bold font-mono">14.62</span>
                <p class="pane-desc">Implied volatility fell by 1.23% today. Option premiums are cooling off, suggesting range-bound condors and spreads will yield better decay.</p>
              </div>

              <div class="subview-metric-pane">
                <span class="pane-lbl">OI Build-up Spectrum</span>
                <span class="pane-val font-bold" style={{ color: "var(--theme-color-neutral)" }}>Long Unwinding</span>
                <p class="pane-desc">Concentrated call writing detected at 23,200 strike and put writing at 22,700 strike, mapping the broad weekly trading boundary.</p>
              </div>
            </div>
            
            <button class="subview-back-btn" onClick={() => setActiveTab('overview')}>
              &larr; Back to Dashboard
            </button>
          </div>
        </Show>

        {/* ── Tab 3: Strategy Generator (Builder Form) ─────────────── */}
        <Show when={activeTab() === 'strategy'}>
          <div class="ailab-grid">
            {/* Left Panel: Params */}
            <div class="ailab-form">
              <h3 class="orders-title" style={{ "font-size": "12px", "border-bottom": "1px solid var(--theme-border-light)", "padding-bottom": "var(--sys-space-2)" }}>
                Create New Strategy
              </h3>
              
              <div class="ailab-label-select">
                <label class="login-label">Name</label>
                <input 
                  type="text" 
                  class="api-input" 
                  value={strategyName()} 
                  onInput={(e) => setStrategyName(e.currentTarget.value)}
                />
              </div>

              <div class="ailab-label-select">
                <label class="login-label">Select Template</label>
                <select 
                  class="ailab-select" 
                  value={strategyTemplate()}
                  onChange={(e) => setStrategyTemplate(e.currentTarget.value)}
                >
                  <option value="Momentum Breakout">Momentum Breakout</option>
                  <option value="Mean Reversion">Mean Reversion</option>
                  <option value="Arbitrage Grid">Arbitrage Grid</option>
                </select>
              </div>

              <button class="wl-add-btn" style={{ "margin-top": "var(--sys-space-2)", "background-color": "var(--theme-bg-surface-elevated)", "border": "1px solid var(--theme-border-light)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Condition
              </button>
            </div>

            {/* Right Panel: Conditional blocks */}
            <div class="builder-workspace">
              {/* If section */}
              <div class="builder-section">
                <span class="builder-section-title">If All of the following</span>
                
                <div class="condition-card">
                  <span class="condition-segment">EMA (9)</span>
                  <span class="condition-segment operator">Crosses Above</span>
                  <span class="condition-segment">EMA (20)</span>
                </div>

                <div class="condition-card">
                  <span class="condition-segment">RSI (14)</span>
                  <span class="condition-segment operator">Greater Than</span>
                  <span class="condition-segment font-mono">55</span>
                </div>

                <div class="condition-card">
                  <span class="condition-segment">Volume</span>
                  <span class="condition-segment operator">Greater Than</span>
                  <span class="condition-segment">SMA (20)</span>
                </div>
              </div>

              {/* Then section */}
              <div class="builder-section" style={{ "margin-top": "var(--sys-space-3)" }}>
                <span class="builder-section-title">Then</span>
                
                <div class="condition-card">
                  <span class="condition-segment" style={{ color: "var(--theme-color-up)" }}>Buy Position</span>
                  <span class="condition-segment font-mono">Size: Fixed Qty</span>
                </div>
              </div>

              {/* Footer buttons */}
              <div class="builder-footer">
                <button class="orders-action-btn" style={{ "border": "1px solid var(--theme-border)" }}>
                  Save Strategy
                </button>
                <button 
                  class="orders-action-btn" 
                  style={{ "background-color": "var(--theme-color-ai)", color: "var(--sys-color-white)", "border-color": "var(--theme-color-ai)" }}
                  onClick={() => runStrategyBacktest(strategyName(), strategyTemplate())}
                >
                  Run Backtest
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* ── Tab 4: Trade Coach (Reviews Details) ───────────────────── */}
        <Show when={activeTab() === 'coach'}>
          <div class="ailab-details-subview">
            <h2 class="subview-title">AI Trade Coach Diagnostic Studio</h2>
            <p class="subview-intro">Post-trade reviews, error analysis logs, psychological diagnostics, and tailored improvement checkpoints.</p>
            
            <div class="trade-coach-full-layout">
              <div class="subview-metric-pane border-bottom">
                <span class="pane-lbl">Last Review (BANKNIFTY 48500 CE)</span>
                <span class="pane-val font-bold down">Unproductive Entry (-₹1,250)</span>
                <p class="pane-desc"><strong>Execution Time:</strong> 11:34 AM. <strong>Error Code:</strong> FOMO Breakout.</p>
                <p class="pane-desc">The index was consolidating in a narrow range. The entry was triggered on a minor price surge without accompanying volume or open interest build-up. This type of entry has a high failure rate in low-liquidity environments.</p>
              </div>

              <div class="subview-metric-pane">
                <span class="pane-lbl">Actionable Recommendations</span>
                <ul class="ai-bullets-list">
                  <li><strong>Wait for the retest:</strong> Allow the breakout price boundary to be re-tested before placing buy orders.</li>
                  <li><strong>OI threshold check:</strong> Only enter if the option OI increases by at least 15% during the breakout candle.</li>
                  <li><strong>Time-based restriction:</strong> Do not initiate new breakout trades between 11:30 AM and 1:30 PM (lunch hour consolidation).</li>
                </ul>
              </div>
            </div>

            <button class="subview-back-btn" onClick={() => setActiveTab('overview')}>
              &larr; Back to Dashboard
            </button>
          </div>
        </Show>

        {/* ── Tab 5: Pattern Scanner ────────────────────────────────── */}
        <Show when={activeTab() === 'scanner'}>
          <div class="ailab-details-subview">
            <h2 class="subview-title">Real-Time Pattern Scanner</h2>
            <p class="subview-intro">Scans live charts for harmonic patterns, candlesticks patterns, and structural consolidation breakouts.</p>
            
            <table class="experiments-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Timeframe</th>
                  <th>Detected Pattern</th>
                  <th>Direction</th>
                  <th>Match Confidence</th>
                  <th>Trigger Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-bold">RELIANCE</td>
                  <td class="font-mono">15m</td>
                  <td>Double Bottom</td>
                  <td class="up">BULLISH</td>
                  <td class="font-mono">92%</td>
                  <td class="font-mono">₹2,845.00</td>
                </tr>
                <tr>
                  <td class="font-bold">HDFCBANK</td>
                  <td class="font-mono">5m</td>
                  <td>Flag Breakout</td>
                  <td class="up">BULLISH</td>
                  <td class="font-mono">85%</td>
                  <td class="font-mono">₹1,562.50</td>
                </tr>
                <tr>
                  <td class="font-bold">NIFTY 50</td>
                  <td class="font-mono">1h</td>
                  <td>Ascending Triangle</td>
                  <td class="up">BULLISH</td>
                  <td class="font-mono">78%</td>
                  <td class="font-mono">₹22,950.00</td>
                </tr>
              </tbody>
            </table>

            <button class="subview-back-btn" onClick={() => setActiveTab('overview')}>
              &larr; Back to Dashboard
            </button>
          </div>
        </Show>

        {/* ── Tab 6: Data Lab ────────────────────────────────────────── */}
        <Show when={activeTab() === 'datalab'}>
          <div class="ailab-details-subview">
            <h2 class="subview-title">Options Data Lab & Analytics</h2>
            <p class="subview-intro">Imbalance trackers, Max Pain indicators, and historical volatility distributions for indexing structures.</p>
            
            <div class="subview-cards-grid">
              <div class="subview-metric-pane">
                <span class="pane-lbl">NIFTY Max Pain strike</span>
                <span class="pane-val font-bold font-mono">22,900</span>
                <p class="pane-desc">Expiry settlement pain is concentrated around the 22,900 call and put strike clusters.</p>
              </div>
              <div class="subview-metric-pane">
                <span class="pane-lbl">Aggregate Call-Put Ratio</span>
                <span class="pane-val font-bold font-mono">0.93</span>
                <p class="pane-desc">Call option writing exceeds put writing slightly, maintaining a minor bearish resistance.</p>
              </div>
            </div>

            <button class="subview-back-btn" onClick={() => setActiveTab('overview')}>
              &larr; Back to Dashboard
            </button>
          </div>
        </Show>

        {/* ── Tab 7: Experiments (Backtest History) ──────────────────── */}
        <Show when={activeTab() === 'experiments'}>
          <div class="ailab-details-subview">
            <h2 class="subview-title">AI Strategy Experiments Ledger</h2>
            <p class="subview-intro">Review previous strategy configurations, backtest simulation outcomes, and deployment logs.</p>
            
            <div class="experiments-ledger-box">
              <div class="ledger-header">
                <span class="ledger-title font-semibold">Active Backtest Simulation State</span>
              </div>
              
              <Show when={store.activeBacktest.status === 'idle'}>
                <div class="ledger-idle-msg">
                  No active strategy simulation is running. Go to <strong>Strategy Generator</strong> to create a strategy and start a backtest.
                </div>
              </Show>

              <Show when={store.activeBacktest.status === 'running'}>
                <div class="ledger-running-progress">
                  <span class="progress-lbl font-semibold">Running simulation: {store.activeBacktest.progress}%</span>
                  <div class="patience-bar-track">
                    <div class="patience-bar-fill" style={{ width: `${store.activeBacktest.progress}%`, "background-color": "var(--theme-color-ai)" }}></div>
                  </div>
                </div>
              </Show>

              <Show when={store.activeBacktest.status === 'done'}>
                <div class="ledger-results-panel">
                  <span class="results-heading font-bold" style={{ color: "var(--theme-color-up)" }}>Backtest Results Ready</span>
                  
                  <div class="suggest-stats-grid" style={{ "margin-top": "var(--sys-space-3)" }}>
                    <div class="suggest-stat-item">
                      <span class="suggest-stat-lbl">Win Rate</span>
                      <span class="suggest-stat-val font-mono font-bold up">{store.activeBacktest.metrics.winRate.toFixed(1)}%</span>
                    </div>
                    <div class="suggest-stat-item">
                      <span class="suggest-stat-lbl">Profit Factor</span>
                      <span class="suggest-stat-val font-mono font-bold">{store.activeBacktest.metrics.profitFactor.toFixed(2)}</span>
                    </div>
                    <div class="suggest-stat-item">
                      <span class="suggest-stat-lbl">Max Drawdown</span>
                      <span class="suggest-stat-val font-mono font-bold down">{store.activeBacktest.metrics.drawdown.toFixed(2)}%</span>
                    </div>
                    <div class="suggest-stat-item">
                      <span class="suggest-stat-lbl">Total Trades</span>
                      <span class="suggest-stat-val font-mono font-bold">{store.activeBacktest.metrics.trades}</span>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <button class="subview-back-btn" onClick={() => setActiveTab('overview')}>
              &larr; Back to Dashboard
            </button>
          </div>
        </Show>

      </div>
    </div>
  );
};
