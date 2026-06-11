import { createSignal, onMount, onCleanup, createEffect, For, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { store, addNotification } from '../../store/tradingStore';
import './strategy.css';

interface StrategyPageProps {
  theme: () => 'dark' | 'light';
}

export const StrategyPage: Component<StrategyPageProps> = () => {
  const [activeTab, setActiveTab] = createSignal('Overview');
  const [strategyName, setStrategyName] = createSignal('NIFTY Iron Condor Intraday');
  const [isEditingName, setIsEditingName] = createSignal(false);
  const [selectedUnderlying, setSelectedUnderlying] = createSignal('NIFTY 50');
  const [selectedTimeframe, setSelectedTimeframe] = createSignal('1D');
  
  // Rule Blocks navigation state
  const [activeRuleBlock, setActiveRuleBlock] = createSignal(1);
  const [activeTemplate, setActiveTemplate] = createSignal('Iron Condor');
  const [deployMode, setDeployMode] = createSignal<'paper' | 'live'>('paper');
  const [isDeploying, setIsDeploying] = createSignal(false);

  // Form states for rule blocks
  const [entryConditions, setEntryConditions] = createSignal([
    { id: 1, indicator: 'EMA Crossover', fastEma: 20, slowEma: 50, timeframe: '15m', condition: 'Above' },
    { id: 2, indicator: 'RSI', timeframe: '15m', condition: 'Between', min: 40, max: 60 }
  ]);
  
  const [timeConditions, setTimeConditions] = createSignal({
    startTime: '09:20 AM',
    endTime: '03:10 PM',
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
    timezone: 'IST'
  });

  const [riskRules, setRiskRules] = createSignal({
    maxDailyLoss: '₹5,000',
    maxConsecutiveLoss: '3'
  });

  const [stopsTargets, setStopsTargets] = createSignal({
    maxLoss: '₹3,000',
    target: '₹6,000',
    rrRatio: '1:2'
  });

  const [exitLogic, setExitLogic] = createSignal({
    exitTrigger: 'Exit on Target or Stop',
    squareOffTime: '03:15 PM'
  });

  // Canvas refs for payoff and backtest charts
  let payoffCanvasRef!: HTMLCanvasElement;
  let backtestCanvasRef!: HTMLCanvasElement;
  let backtestContainerRef!: HTMLDivElement;

  // Option Payoff canvas condor curve
  const drawPayoffGraph = () => {
    if (!payoffCanvasRef) return;
    const ctx = payoffCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = 290;
    const height = 110;
    const dpi = window.devicePixelRatio || 1;
    payoffCanvasRef.width = width * dpi;
    payoffCanvasRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = store.settings.theme === 'dark';
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw coordinate axes
    ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
    ctx.lineWidth = 1;
    
    // Y Axis (centered horizontally or left)
    const xAxisY = height / 2 + 10;
    ctx.beginPath();
    ctx.moveTo(20, xAxisY);
    ctx.lineTo(width - 20, xAxisY);
    ctx.stroke();

    // Coordinates guide lines
    ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
    ctx.font = '8px var(--sys-font-mono)';
    ctx.fillText('21,500', 30, xAxisY + 12);
    ctx.fillText('22,000', 80, xAxisY + 12);
    ctx.fillText('22,500', 140, xAxisY + 12);
    ctx.fillText('23,000', 200, xAxisY + 12);
    ctx.fillText('23,500', 250, xAxisY + 12);

    // Label Y axes regions
    ctx.fillStyle = 'var(--theme-color-up)';
    ctx.fillText('+6K', 5, 25);
    ctx.fillStyle = 'var(--theme-color-down)';
    ctx.fillText('-3K', 5, height - 15);

    // Draw Payoff Curve Shape (Iron Condor has flat top in middle, drops off to max loss sides)
    const flatL = 100;
    const flatR = 190;
    const dropL = 60;
    const dropR = 230;

    const maxProfitY = 25;
    const maxLossY = height - 25;

    // Draw regions shading (green profit area, red loss areas)
    // Left loss area
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.beginPath();
    ctx.moveTo(20, xAxisY);
    ctx.lineTo(dropL, maxLossY);
    ctx.lineTo(20, maxLossY);
    ctx.closePath();
    ctx.fill();

    // Right loss area
    ctx.beginPath();
    ctx.moveTo(dropR, maxLossY);
    ctx.lineTo(width - 20, xAxisY);
    ctx.lineTo(width - 20, maxLossY);
    ctx.lineTo(dropR, maxLossY);
    ctx.closePath();
    ctx.fill();

    // Middle profit area
    const grad = ctx.createLinearGradient(0, maxProfitY, 0, xAxisY);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(dropL, xAxisY);
    ctx.lineTo(flatL, maxProfitY);
    ctx.lineTo(flatR, maxProfitY);
    ctx.lineTo(dropR, xAxisY);
    ctx.closePath();
    ctx.fill();

    // Draw the payoff boundary line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(20, maxLossY);
    ctx.lineTo(dropL, maxLossY);
    ctx.lineTo(flatL, maxProfitY);
    ctx.lineTo(flatR, maxProfitY);
    ctx.lineTo(dropR, maxLossY);
    ctx.lineTo(width - 20, maxLossY);
    ctx.stroke();

    // Breakeven dots
    ctx.fillStyle = isDark ? '#ffffff' : '#09090b';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    // Left breakeven dot (intersects xAxisY)
    ctx.beginPath();
    ctx.arc(80, xAxisY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right breakeven dot
    ctx.beginPath();
    ctx.arc(210, xAxisY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Backtest Performance equity curve
  const drawBacktestGraph = () => {
    if (!backtestCanvasRef || !backtestContainerRef) return;
    const ctx = backtestCanvasRef.getContext('2d');
    if (!ctx) return;

    const width = backtestContainerRef.clientWidth;
    const height = backtestContainerRef.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    backtestCanvasRef.width = width * dpi;
    backtestCanvasRef.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = store.settings.theme === 'dark';
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = isDark ? '#1f1f23' : '#f3f4f6';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Curve line path
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    const points = [15, 20, 18, 25, 32, 28, 45, 35, 52, 48, 55, 42, 60, 72, 65, 80, 85, 78, 92, 105];
    const step = width / (points.length - 1);
    
    ctx.moveTo(0, height - points[0]);
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = step * i;
      const y1 = height - points[i];
      const x2 = step * (i + 1);
      const y2 = height - points[i + 1];
      const xc = (x1 + x2) / 2;
      const yc = (y1 + y2) / 2;
      ctx.quadraticCurveTo(x1, y1, xc, yc);
    }
    ctx.lineTo(width, height - points[points.length - 1]);
    ctx.stroke();

    // Area fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.fillStyle = grad;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Draw peak highlight dots
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    const peakIndices = [6, 13, 19];
    peakIndices.forEach(idx => {
      const px = step * idx;
      const py = height - points[idx];
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Date X axis labels
    ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
    ctx.font = '8px var(--sys-font-mono)';
    ctx.textAlign = 'center';
    const dates = ['01 Jan', '15 Jan', '29 Jan', '12 Feb', '26 Feb', '11 Mar', '25 Mar', '08 Apr', '22 Apr', '06 May', '20 May'];
    const labelStep = width / (dates.length - 1);
    dates.forEach((lbl, idx) => {
      ctx.fillText(lbl, labelStep * idx, height - 3);
    });
  };

  const handleResize = () => {
    drawPayoffGraph();
    drawBacktestGraph();
  };

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  createEffect(() => {
    store.settings.theme;
    activeTemplate();
    setTimeout(handleResize, 100);
  });

  const handleDeploy = () => {
    if (isDeploying()) return;
    setIsDeploying(true);
    
    setTimeout(() => {
      setIsDeploying(false);
      addNotification(
        'Strategy Deployed',
        `Successfully deployed "${strategyName()}" in ${deployMode() === 'paper' ? 'Paper Trading' : 'Live Deploy'} mode!`,
        'success'
      );
    }, 1200);
  };

  const handleOptimize = () => {
    addNotification(
      'Strategy Optimized',
      'AI strategy copilot optimized stops and Entry thresholds for maximum efficiency.',
      'info'
    );
    // Apply simulated optimizations
    setStopsTargets(prev => ({
      ...prev,
      maxLoss: '₹2,500',
      target: '₹7,500',
      rrRatio: '1:3'
    }));
  };

  const addEntryCondition = () => {
    setEntryConditions(prev => [
      ...prev,
      { id: Date.now(), indicator: 'RSI', timeframe: '15m', condition: 'Above', min: 70 } as any
    ]);
  };

  const removeEntryCondition = (id: number) => {
    setEntryConditions(prev => prev.filter(c => c.id !== id));
  };

  const loadTemplate = (tpl: string) => {
    setActiveTemplate(tpl);
    if (tpl === 'Iron Condor') {
      setStrategyName('NIFTY Iron Condor Intraday');
      setEntryConditions([
        { id: 1, indicator: 'EMA Crossover', fastEma: 20, slowEma: 50, timeframe: '15m', condition: 'Above' },
        { id: 2, indicator: 'RSI', timeframe: '15m', condition: 'Between', min: 40, max: 60 }
      ]);
    } else if (tpl === 'ORB Breakout') {
      setStrategyName('ORB Crossover Strategy');
      setEntryConditions([
        { id: 1, indicator: 'ORB High Crossover', fastEma: 0, slowEma: 0, timeframe: '15m', condition: 'Crosses Above' } as any
      ]);
    }
    addNotification('Template Loaded', `Loaded parameters for ${tpl} strategy`, 'info');
  };

  return (
    <div class="strat-split-layout">
      {/* Left Columns Workspace */}
      <div class="strat-left-workspace">
        {/* Main Title Header */}
        <div class="strat-page-header">
          <div class="strat-header-left">
            <h1 class="strat-title-text">
              Strategy Builder
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="star-icon-builder">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </h1>
            <p class="strat-subtitle-text">Build, test, automate, and deploy option strategies.</p>
          </div>
          <div class="strat-header-actions-right">
            <button class="strat-action-btn primary">+ New Strategy</button>
            <button class="strat-action-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px; display:inline-block; vertical-align:middle;">
                <path d="M12 17V3M12 17L7 12M12 17L17 12"/>
              </svg>
              Import
            </button>
            <button class="strat-action-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px; display:inline-block; vertical-align:middle;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Deploy
            </button>
            <button class="strat-action-icon-btn">&bull;&bull;&bull;</button>
          </div>
        </div>

        {/* Navigation Tabs bar */}
        <div class="strat-tabs-row">
          <div class="strat-tabs-left">
            <For each={['Overview', 'Builder', 'Backtest', 'Live Deploy', 'Templates']}>
              {(tab) => (
                <button
                  class={`strat-tab-btn ${activeTab() === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              )}
            </For>
          </div>
          <div class="strat-tabs-right">
            <button class="strat-save-btn">
              Save
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left: 4px;">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <span class="strat-saved-text">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--theme-color-up)" stroke-width="3" style="margin-right: 3px; display:inline-block; vertical-align:middle;">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Last saved: 09:47 AM
            </span>
            <button class="strat-layout-icon-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button class="strat-layout-icon-btn active">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button class="strat-layout-icon-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Builder Form Workspace Section */}
        <div class="strat-builder-workspace">
          {/* Strategy name edit and filters header */}
          <div class="strat-builder-toolbar">
            <div class="strat-name-editor-box">
              <Show when={isEditingName()} fallback={
                <h2 class="strat-name-display">
                  {strategyName()}
                  <button class="edit-name-btn" onClick={() => setIsEditingName(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </button>
                </h2>
              }>
                <input
                  type="text"
                  class="strat-name-input"
                  value={strategyName()}
                  onInput={(e) => setStrategyName(e.currentTarget.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                  autofocus
                />
              </Show>
              <span class="strat-badge draft">Draft</span>
            </div>
            
            <div class="strat-meta-dropdowns">
              <div class="meta-select-wrapper">
                <span class="select-label">Underlying</span>
                <select value={selectedUnderlying()} onChange={(e) => setSelectedUnderlying(e.currentTarget.value)}>
                  <option>NIFTY 50</option>
                  <option>BANKNIFTY</option>
                  <option>FINNIFTY</option>
                </select>
              </div>
              <div class="meta-select-wrapper">
                <span class="select-label">Timeframe</span>
                <select value={selectedTimeframe()} onChange={(e) => setSelectedTimeframe(e.currentTarget.value)}>
                  <option>1m</option>
                  <option>15m</option>
                  <option>1D</option>
                </select>
              </div>
            </div>
          </div>

          {/* Core Rule Builder configuration layout splits */}
          <div class="strat-rules-split-grid">
            {/* Left Rule Navigation list */}
            <div class="rules-navigation-sidebar">
              <For each={[
                { id: 1, label: 'Entry Conditions' },
                { id: 2, label: 'Time Conditions' },
                { id: 3, label: 'Risk Rules' },
                { id: 4, label: 'Stops & Targets' },
                { id: 5, label: 'Exit Logic' },
                { id: 6, label: 'Position Sizing' },
                { id: 7, label: 'Filters (Optional)' }
              ]}>
                {(rule) => (
                  <button 
                    class={`rule-nav-item ${activeRuleBlock() === rule.id ? 'active' : ''}`}
                    onClick={() => setActiveRuleBlock(rule.id)}
                  >
                    <span class="nav-number">{rule.id}</span>
                    <span class="nav-label">{rule.label}</span>
                  </button>
                )}
              </For>
              <button class="add-rule-block-btn">+ Add Rule Block</button>
            </div>

            {/* Central Rules Editor forms container */}
            <div class="rules-form-editor-container">
              <Switch>
                {/* 1. Entry Conditions */}
                <Match when={activeRuleBlock() === 1}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">1. Entry Conditions</h3>
                    
                    <div class="rule-rows-list">
                      <For each={entryConditions()}>
                        {(cond) => (
                          <div class="indicator-condition-row">
                            <div class="field-item">
                              <span class="field-label">Indicator</span>
                              <select value={cond.indicator}>
                                <option>EMA Crossover</option>
                                <option>RSI</option>
                                <option>MACD</option>
                                <option>Supertrend</option>
                              </select>
                            </div>

                            <Show when={cond.indicator === 'EMA Crossover'}>
                              <div class="field-item small">
                                <span class="field-label">Fast EMA</span>
                                <input type="number" class="field-input" value={(cond as any).fastEma} />
                              </div>
                              <div class="field-item small">
                                <span class="field-label">Slow EMA</span>
                                <input type="number" class="field-input" value={(cond as any).slowEma} />
                              </div>
                            </Show>

                            <div class="field-item">
                              <span class="field-label">Timeframe</span>
                              <select value={cond.timeframe}>
                                <option>5m</option>
                                <option>15m</option>
                                <option>1H</option>
                                <option>1D</option>
                              </select>
                            </div>

                            <div class="field-item">
                              <span class="field-label">Condition</span>
                              <select value={cond.condition}>
                                <option>Above</option>
                                <option>Below</option>
                                <option>Between</option>
                                <option>Crosses Above</option>
                              </select>
                            </div>

                            <Show when={cond.condition === 'Between'}>
                              <div class="field-item extra-small">
                                <span class="field-label">Min</span>
                                <input type="number" class="field-input" value={(cond as any).min} />
                              </div>
                              <div class="field-item extra-small">
                                <span class="field-label">Max</span>
                                <input type="number" class="field-input" value={(cond as any).max} />
                              </div>
                            </Show>

                            <button class="delete-row-btn" onClick={() => removeEntryCondition(cond.id)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </For>
                    </div>

                    <button class="add-condition-btn" onClick={addEntryCondition}>+ Add Condition</button>
                  </div>
                </Match>

                {/* 2. Time Conditions */}
                <Match when={activeRuleBlock() === 2}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">2. Time Conditions</h3>
                    <div class="time-settings-row">
                      <div class="field-item">
                        <span class="field-label">Start Time</span>
                        <div class="time-picker-input">
                          <input type="text" class="field-input" value={timeConditions().startTime} />
                          <span class="clock-icon">🕒</span>
                        </div>
                      </div>
                      <div class="field-item">
                        <span class="field-label">End Time</span>
                        <div class="time-picker-input">
                          <input type="text" class="field-input" value={timeConditions().endTime} />
                          <span class="clock-icon">🕒</span>
                        </div>
                      </div>
                      <div class="field-item">
                        <span class="field-label">Timezone</span>
                        <select value={timeConditions().timezone}>
                          <option>IST</option>
                          <option>EST</option>
                          <option>GMT</option>
                        </select>
                      </div>
                    </div>

                    <div class="days-select-box">
                      <span class="field-label">Trading Days</span>
                      <div class="days-pills-row">
                        <For each={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}>
                          {(day) => {
                            const isActive = () => (timeConditions().days as any)[day] || false;
                            return (
                              <button 
                                class={`day-pill ${isActive() ? 'active' : ''}`}
                                onClick={() => {
                                  setTimeConditions(prev => ({
                                    ...prev,
                                    days: { ...prev.days, [day]: !isActive() }
                                  }));
                                }}
                              >
                                {day}
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </div>
                </Match>

                {/* 3. Risk Rules */}
                <Match when={activeRuleBlock() === 3}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">3. Risk Rules</h3>
                    <div class="time-settings-row">
                      <div class="field-item">
                        <span class="field-label">Max Daily Loss</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={riskRules().maxDailyLoss} 
                          onInput={(e) => setRiskRules(prev => ({ ...prev, maxDailyLoss: e.currentTarget.value }))}
                        />
                      </div>
                      <div class="field-item">
                        <span class="field-label">Max Consecutive Loss Trades</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={riskRules().maxConsecutiveLoss} 
                          onInput={(e) => setRiskRules(prev => ({ ...prev, maxConsecutiveLoss: e.currentTarget.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </Match>

                {/* 4. Stops & Targets */}
                <Match when={activeRuleBlock() === 4}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">4. Stops & Targets</h3>
                    <div class="time-settings-row">
                      <div class="field-item">
                        <span class="field-label">Max Loss</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={stopsTargets().maxLoss} 
                          onInput={(e) => setStopsTargets(prev => ({ ...prev, maxLoss: e.currentTarget.value }))}
                        />
                      </div>
                      <div class="field-item">
                        <span class="field-label">Target (Take Profit)</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={stopsTargets().target} 
                          onInput={(e) => setStopsTargets(prev => ({ ...prev, target: e.currentTarget.value }))}
                        />
                      </div>
                      <div class="field-item">
                        <span class="field-label">Risk-to-Reward Ratio</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={stopsTargets().rrRatio} 
                          onInput={(e) => setStopsTargets(prev => ({ ...prev, rrRatio: e.currentTarget.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </Match>

                {/* 5. Exit Logic */}
                <Match when={activeRuleBlock() === 5}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">5. Exit Logic</h3>
                    <div class="time-settings-row">
                      <div class="field-item">
                        <span class="field-label">Exit Trigger Condition</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={exitLogic().exitTrigger} 
                          onInput={(e) => setExitLogic(prev => ({ ...prev, exitTrigger: e.currentTarget.value }))}
                        />
                      </div>
                      <div class="field-item">
                        <span class="field-label">Daily Auto Square-off Time</span>
                        <input 
                          type="text" 
                          class="field-input" 
                          value={exitLogic().squareOffTime} 
                          onInput={(e) => setExitLogic(prev => ({ ...prev, squareOffTime: e.currentTarget.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </Match>
                
                {/* Fallbacks */}
                <Match when={activeRuleBlock() > 5}>
                  <div class="rule-form-section">
                    <h3 class="rule-form-title">Parameters Block Config</h3>
                    <p style={{ color: "var(--theme-text-muted)", "font-size": "11px" }}>
                      Advanced properties can be configured in detail once live broker connection is established.
                    </p>
                  </div>
                </Match>
              </Switch>
            </div>

            {/* Right sidebar inside Builder containing Templates */}
            <div class="rules-templates-container">
              <div class="template-header-box">
                <span class="template-title">Strategy Templates</span>
                <a href="#" class="template-view-all">View All</a>
              </div>

              <div class="template-items-list">
                <For each={[
                  { key: 'Iron Condor', desc: 'Neutral market, defined risk' },
                  { key: 'ORB Breakout', desc: 'Open range breakout strategy' },
                  { key: 'VWAP Reversal', desc: 'Revert to VWAP mean' },
                  { key: 'Trend Follow Options', desc: 'Ride the trend with options' },
                  { key: 'Short Straddle', desc: 'High IV, neutral bias' }
                ]}>
                  {(tpl) => (
                    <div 
                      class={`template-item-card ${activeTemplate() === tpl.key ? 'active' : ''}`}
                      onClick={() => loadTemplate(tpl.key)}
                    >
                      <div class="tpl-icon-box">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <path d="M9 17V7M15 17V7"/>
                        </svg>
                      </div>
                      <div class="tpl-info-box">
                        <span class="tpl-name">{tpl.key}</span>
                        <span class="tpl-desc">{tpl.desc}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <button class="browse-templates-btn">Browse All Templates</button>
            </div>
          </div>
        </div>

        {/* Bottom Double Charts Panels section */}
        <div class="strat-bottom-charts-row">
          {/* Card 1: Backtest Performance */}
          <div class="strat-chart-cell">
            <div class="chart-card-header">
              <span class="chart-card-title">
                Backtest Performance
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="info-icon">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </span>
              <span class="chart-card-date">01 Jan 2024 - 22 May 2024</span>
            </div>

            {/* Metrics parameters */}
            <div class="chart-stats-grid">
              <div class="stat-cell">
                <span class="stat-lbl">Total Return</span>
                <span class="stat-val green">+28.45%</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Win Rate</span>
                <span class="stat-val">64.17%</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Profit Factor</span>
                <span class="stat-val">1.87</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Max Drawdown</span>
                <span class="stat-val red">-6.23%</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Total Trades</span>
                <span class="stat-val">128</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Expectancy</span>
                <span class="stat-val font-mono">₹2,450.35</span>
              </div>
            </div>

            {/* Equity chart canvas */}
            <div class="equity-canvas-wrapper" ref={backtestContainerRef}>
              <canvas ref={backtestCanvasRef} class="equity-curve-canvas"></canvas>
            </div>
          </div>

          {/* Card 2: Payoff & Risk Profile */}
          <div class="strat-chart-cell">
            <div class="chart-card-header">
              <span class="chart-card-title">Payoff & Risk Profile</span>
              <div class="profile-dropdown">
                <select value={activeTemplate()}>
                  <option>Iron Condor</option>
                  <option>ORB Breakout</option>
                </select>
              </div>
            </div>

            {/* Metrics parameters */}
            <div class="chart-stats-grid">
              <div class="stat-cell">
                <span class="stat-lbl">Max Profit</span>
                <span class="stat-val green">+₹6,000</span>
              </div>
              <div class="stat-cell">
                <span class="stat-lbl">Max Loss</span>
                <span class="stat-val red">-₹3,000</span>
              </div>
              <div class="stat-cell" style={{ "grid-column": "span 2" }}>
                <span class="stat-lbl">Breakeven</span>
                <span class="stat-val font-semibold">22,250 / 22,750</span>
              </div>
            </div>

            {/* Option payoff condor canvas */}
            <div class="payoff-canvas-wrapper">
              <canvas ref={payoffCanvasRef} class="payoff-profile-canvas"></canvas>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column (Sidebars) */}
      <div class="strat-right-sidebars">
        {/* Card 1: AI Strategy Copilot */}
        <div class="copilot-sidebar-section">
          <div class="copilot-header">
            <div class="copilot-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="sparks-icon">
                <path d="M12 3v18M3 12h18M12 3l3 3M12 21l-3-3M3 12l3 3M21 12l-3-3"/>
              </svg>
              AI Strategy Copilot
              <span class="copilot-badge">Beta</span>
            </div>
            <button class="copilot-close-btn">&times;</button>
          </div>

          <p class="copilot-greet">Hi Aman, <br />Here are insights to improve your strategy.</p>

          <div class="copilot-alert-box success">
            <span class="alert-dot"></span>
            <div class="alert-info">
              <span class="alert-title">Strong Setup Detected</span>
              <p class="alert-body">Iron Condor works well in low volatility range markets like current conditions.</p>
            </div>
          </div>

          <div class="copilot-insights-list">
            <div class="insight-section">
              <span class="section-title suggestions">Suggestions</span>
              <ul class="insights-bullets">
                <li>Consider widening strikes to 1.5x ATR for better range.</li>
                <li>Add IV Rank filter below 40 for higher probability.</li>
              </ul>
            </div>
            
            <div class="insight-section">
              <span class="section-title warnings">Warnings</span>
              <ul class="insights-bullets warnings">
                <li>High daily loss limit vs. stop size. Consider lowering max daily loss.</li>
              </ul>
            </div>
          </div>

          <button class="optimize-action-btn" onClick={handleOptimize}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Optimize Strategy
          </button>
        </div>

        {/* Card 2: Deployment Status */}
        <div class="deploy-sidebar-section">
          <div class="deploy-header-box">
            <span class="deploy-status-dot"></span>
            <div class="deploy-status-info">
              <span class="status-title">Ready to Deploy</span>
              <span class="status-subtitle">All checks passed</span>
            </div>
          </div>

          <div class="deploy-checklist">
            <div class="checklist-item done">
              <span class="check-icon">✓</span>
              <span>Backtest Completed</span>
            </div>
            <div class="checklist-item done">
              <span class="check-icon">✓</span>
              <span>Risk Checks Passed</span>
            </div>
            <div class="checklist-item done">
              <span class="check-icon">✓</span>
              <span>Rules Validated</span>
            </div>
            <div class="checklist-item done">
              <span class="check-icon">✓</span>
              <span>No Conflicts Detected</span>
            </div>
          </div>

          <div class="deploy-mode-toggle-box">
            <span class="mode-label">Deploy Mode</span>
            <div class="mode-toggles">
              <button 
                class={`mode-btn ${deployMode() === 'paper' ? 'active' : ''}`}
                onClick={() => setDeployMode('paper')}
              >
                Paper Trading
              </button>
              <button 
                class={`mode-btn ${deployMode() === 'live' ? 'active' : ''}`}
                onClick={() => setDeployMode('live')}
              >
                Live Deploy
              </button>
            </div>
          </div>

          <button 
            class={`deploy-submit-btn ${isDeploying() ? 'loading' : ''}`}
            onClick={handleDeploy}
          >
            {isDeploying() ? 'Deploying Strategy...' : 'Deploy Strategy'}
          </button>
        </div>
      </div>
    </div>
  );
};
