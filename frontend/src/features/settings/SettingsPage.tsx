import { createSignal, createEffect, For, Show, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { store, updateSetting, addNotification } from '../../store/tradingStore';
import './settings.css';

// ── Types ──────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

interface CredentialForm {
  ucc: string;
  mobile_number: string;
  consumer_key: string;
  mpin: string;
  totp_secret: string;
}

const SIDECAR = 'http://localhost:8001';
const SETTINGS_STORAGE_KEY = 'tradesk-user-settings';
const TABS = [
  'Profile',
  'Trading',
  'Charts',
  'Alerts',
  'Brokers & API',
  'Security',
  'Appearance',
  'Advanced'
];

interface SettingsPageProps {
  theme: () => 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const SettingsPage: Component<SettingsPageProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal('appearance');

  // local preference signals for layout choices that are not in the global store
  const [density, setDensity] = createSignal<'comfortable' | 'compact'>('comfortable');
  const [accentColor, setAccentColor] = createSignal<'violet' | 'blue' | 'green' | 'orange'>('blue');
  const [fontSize, setFontSize] = createSignal(13);
  const [roundedCharts, setRoundedCharts] = createSignal(true);
  const [subtleBlur, setSubtleBlur] = createSignal(false);
  const [reducedMotion, setReducedMotion] = createSignal(false);

  // layout preferences
  const [rememberWorkspace, setRememberWorkspace] = createSignal(true);
  const [autoSaveLayout, setAutoSaveLayout] = createSignal(true);
  const [stickyOrderPanel, setStickyOrderPanel] = createSignal(true);
  const [showAiCopilot, setShowAiCopilot] = createSignal(true);
  const [showMarketBreadth, setShowMarketBreadth] = createSignal(true);
  const [showKeyboardHints, setShowKeyboardHints] = createSignal(false);

  // trading preferences
  const [defaultOrderType, setDefaultOrderType] = createSignal('LIMIT');
  const [defaultProduct, setDefaultProduct] = createSignal('INTRADAY');
  const [qtyPresets, setQtyPresets] = createSignal('5, 10, 25, 50, 100');
  const [panicExitConfirmation, setPanicExitConfirmation] = createSignal(true);
  const [preferredScalpingShortcuts, setPreferredScalpingShortcuts] = createSignal('Alt + S (Scalper Panel)');

  // chart preferences
  const [defaultTimeframe, setDefaultTimeframe] = createSignal('5 Minutes');
  const [candleType, setCandleType] = createSignal('Heikin Ashi');
  const [indicatorVisibility, setIndicatorVisibility] = createSignal('Last Used');
  const [vwapAutoLoad, setVwapAutoLoad] = createSignal(true);
  const [crosshairBehavior, setCrosshairBehavior] = createSignal('Magnet');
  const [priceLadderVisibility, setPriceLadderVisibility] = createSignal('Always Visible');

  // profile editable states
  const [profileName, setProfileName] = createSignal('Aman Trader');
  const [profileEmail, setProfileEmail] = createSignal('aman.trader@example.com');

  // security and diagnostic preferences
  const [twoFactorEnabled, setTwoFactorEnabled] = createSignal(true);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = createSignal(true);
  const [debugLogging, setDebugLogging] = createSignal(false);
  const [verboseConsole, setVerboseConsole] = createSignal(false);
  const [lastSyncedAt, setLastSyncedAt] = createSignal('Not synced yet');

  // API tab state
  const [connStatus, setConnStatus] = createSignal<ConnectionStatus>('DISCONNECTED');
  const [apiError, setApiError] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [logging, setLogging] = createSignal(false);
  const [showTotp, setShowTotp] = createSignal(false);
  const [form, setForm] = createSignal<CredentialForm>({
    ucc: '', mobile_number: '', consumer_key: '', mpin: '', totp_secret: '',
  });

  // Poll connection status when on API tab
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const startPolling = () => {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const r = await fetch(`${SIDECAR}/api/kotak/status`);
        const d = await r.json();
        setConnStatus(d.status as ConnectionStatus);
      } catch { /* sidecar not running */ }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = undefined;
  };

  createEffect(() => {
    if (activeTab() === 'brokers & api') {
      // Load masked credentials from sidecar
      fetch(`${SIDECAR}/api/kotak/credentials`)
        .then(r => r.json())
        .then(d => {
          if (d.has_credentials) {
            setForm(f => ({
              ...f,
              ucc: d.ucc || '',
              mobile_number: d.mobile_number || '',
              consumer_key: d.consumer_key || '',
            }));
          }
        })
        .catch(() => {});
      startPolling();
    } else {
      stopPolling();
    }
  });

  onCleanup(stopPolling);

  // API tab handlers
  const handleSave = async () => {
    setSaving(true);
    setApiError('');
    try {
      const r = await fetch(`${SIDECAR}/api/kotak/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form()),
      });
      if (!r.ok) throw new Error(await r.text());
      addNotification('API Settings', 'Kotak Neo credentials saved successfully.', 'success', 'settings');
    } catch (e: any) {
      setApiError(e.message || 'Failed to save credentials');
      addNotification('API Settings Error', e.message || 'Failed to save credentials.', 'error', 'settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async () => {
    setLogging(true);
    setApiError('');
    setConnStatus('CONNECTING');
    try {
      const r = await fetch(`${SIDECAR}/api/kotak/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Login failed');
      setConnStatus('CONNECTED');
      addNotification('Broker Connect', 'Authenticated with Kotak Neo API successfully.', 'success', 'settings');
    } catch (e: any) {
      setConnStatus('DISCONNECTED');
      setApiError(e.message || 'Authentication failed');
      addNotification('Broker Connect Error', e.message || 'Authentication failed.', 'error', 'settings');
    } finally {
      setLogging(false);
    }
  };

  const updateField = (key: keyof CredentialForm) =>
    (e: Event) => setForm(f => ({ ...f, [key]: (e.currentTarget as HTMLInputElement).value }));

  // Global settings handlers
  const buildSettingsSnapshot = () => ({
    theme: props.theme(),
    density: density(),
    accentColor: accentColor(),
    fontSize: fontSize(),
    roundedCharts: roundedCharts(),
    subtleBlur: subtleBlur(),
    reducedMotion: reducedMotion(),
    rememberWorkspace: rememberWorkspace(),
    autoSaveLayout: autoSaveLayout(),
    stickyOrderPanel: stickyOrderPanel(),
    showAiCopilot: showAiCopilot(),
    showMarketBreadth: showMarketBreadth(),
    showKeyboardHints: showKeyboardHints(),
    defaultOrderType: defaultOrderType(),
    defaultProduct: defaultProduct(),
    qtyPresets: qtyPresets(),
    panicExitConfirmation: panicExitConfirmation(),
    preferredScalpingShortcuts: preferredScalpingShortcuts(),
    defaultTimeframe: defaultTimeframe(),
    candleType: candleType(),
    indicatorVisibility: indicatorVisibility(),
    vwapAutoLoad: vwapAutoLoad(),
    crosshairBehavior: crosshairBehavior(),
    priceLadderVisibility: priceLadderVisibility(),
    profileName: profileName(),
    profileEmail: profileEmail(),
    twoFactorEnabled: twoFactorEnabled(),
    loginAlertsEnabled: loginAlertsEnabled(),
    debugLogging: debugLogging(),
    verboseConsole: verboseConsole(),
    settings: { ...store.settings },
  });

  const applyStoredSettings = (saved: Partial<ReturnType<typeof buildSettingsSnapshot>>) => {
    if (saved.theme === 'dark' || saved.theme === 'light') props.setTheme(saved.theme);
    if (saved.density === 'comfortable' || saved.density === 'compact') setDensity(saved.density);
    if (saved.accentColor === 'violet' || saved.accentColor === 'blue' || saved.accentColor === 'green' || saved.accentColor === 'orange') setAccentColor(saved.accentColor);
    if (typeof saved.fontSize === 'number') setFontSize(saved.fontSize);
    if (typeof saved.roundedCharts === 'boolean') setRoundedCharts(saved.roundedCharts);
    if (typeof saved.subtleBlur === 'boolean') setSubtleBlur(saved.subtleBlur);
    if (typeof saved.reducedMotion === 'boolean') setReducedMotion(saved.reducedMotion);
    if (typeof saved.rememberWorkspace === 'boolean') setRememberWorkspace(saved.rememberWorkspace);
    if (typeof saved.autoSaveLayout === 'boolean') setAutoSaveLayout(saved.autoSaveLayout);
    if (typeof saved.stickyOrderPanel === 'boolean') setStickyOrderPanel(saved.stickyOrderPanel);
    if (typeof saved.showAiCopilot === 'boolean') setShowAiCopilot(saved.showAiCopilot);
    if (typeof saved.showMarketBreadth === 'boolean') setShowMarketBreadth(saved.showMarketBreadth);
    if (typeof saved.showKeyboardHints === 'boolean') setShowKeyboardHints(saved.showKeyboardHints);
    if (typeof saved.defaultOrderType === 'string') setDefaultOrderType(saved.defaultOrderType);
    if (typeof saved.defaultProduct === 'string') setDefaultProduct(saved.defaultProduct);
    if (typeof saved.qtyPresets === 'string') setQtyPresets(saved.qtyPresets);
    if (typeof saved.panicExitConfirmation === 'boolean') setPanicExitConfirmation(saved.panicExitConfirmation);
    if (typeof saved.preferredScalpingShortcuts === 'string') setPreferredScalpingShortcuts(saved.preferredScalpingShortcuts);
    if (typeof saved.defaultTimeframe === 'string') setDefaultTimeframe(saved.defaultTimeframe);
    if (typeof saved.candleType === 'string') setCandleType(saved.candleType);
    if (typeof saved.indicatorVisibility === 'string') setIndicatorVisibility(saved.indicatorVisibility);
    if (typeof saved.vwapAutoLoad === 'boolean') setVwapAutoLoad(saved.vwapAutoLoad);
    if (typeof saved.crosshairBehavior === 'string') setCrosshairBehavior(saved.crosshairBehavior);
    if (typeof saved.priceLadderVisibility === 'string') setPriceLadderVisibility(saved.priceLadderVisibility);
    if (typeof saved.profileName === 'string') setProfileName(saved.profileName);
    if (typeof saved.profileEmail === 'string') setProfileEmail(saved.profileEmail);
    if (typeof saved.twoFactorEnabled === 'boolean') setTwoFactorEnabled(saved.twoFactorEnabled);
    if (typeof saved.loginAlertsEnabled === 'boolean') setLoginAlertsEnabled(saved.loginAlertsEnabled);
    if (typeof saved.debugLogging === 'boolean') setDebugLogging(saved.debugLogging);
    if (typeof saved.verboseConsole === 'boolean') setVerboseConsole(saved.verboseConsole);
    if (saved.settings) {
      (Object.entries(saved.settings) as Array<[keyof typeof store.settings, unknown]>).forEach(([key, value]) => {
        updateSetting(key, value as never);
      });
    }
  };

  onMount(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) applyStoredSettings(JSON.parse(saved));
    } catch {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  });

  const handleSaveAllSettings = () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(buildSettingsSnapshot()));
    addNotification('Settings Saved', 'Preferences updated and saved to local configuration.', 'success', 'settings');
  };

  const handlePreviewChanges = () => {
    const mode = props.theme() === 'dark' ? 'Dark' : 'Light';
    addNotification(
      'Settings Preview',
      `${mode} theme, ${density()} density, ${defaultOrderType()} ${defaultProduct()} orders selected.`,
      'info',
      'settings'
    );
  };

  const handleResetToDefault = () => {
    props.setTheme('light');
    updateSetting('theme', 'light');
    updateSetting('refreshRate', 2);
    updateSetting('timezone', 'kolkata');
    updateSetting('notificationTimeout', 6);
    updateSetting('soundAlerts', true);
    updateSetting('confirmOrder', true);
    updateSetting('showSummary', true);
    updateSetting('autoSquareOff', false);
    updateSetting('chartType', 'candlestick');
    updateSetting('showGrid', true);
    updateSetting('showVolume', true);

    setDensity('comfortable');
    setAccentColor('blue');
    setFontSize(13);
    setRoundedCharts(true);
    setSubtleBlur(false);
    setReducedMotion(false);
    setRememberWorkspace(true);
    setAutoSaveLayout(true);
    setStickyOrderPanel(true);
    setShowAiCopilot(true);
    setShowMarketBreadth(true);
    setShowKeyboardHints(false);
    setDefaultOrderType('LIMIT');
    setDefaultProduct('INTRADAY');
    setQtyPresets('5, 10, 25, 50, 100');
    setPanicExitConfirmation(true);
    setPreferredScalpingShortcuts('Alt + S (Scalper Panel)');
    setDefaultTimeframe('5 Minutes');
    setCandleType('Heikin Ashi');
    setIndicatorVisibility('Last Used');
    setVwapAutoLoad(true);
    setCrosshairBehavior('Magnet');
    setPriceLadderVisibility('Always Visible');
    setTwoFactorEnabled(true);
    setLoginAlertsEnabled(true);
    setDebugLogging(false);
    setVerboseConsole(false);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);

    addNotification('Settings Reset', 'Configuration values restored to defaults.', 'info', 'settings');
  };

  const handleSyncNow = () => {
    setLastSyncedAt(new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }));
    addNotification('Backup Sync', 'Workspace cloud backup completed successfully.', 'success', 'settings');
  };

  return (
    <div class="settings-split-layout">
      {/* ── Left Column: Config Panel ────────────────────────── */}
      <div class="settings-left-col">
        {/* Title Bar */}
        <div class="settings-title-header">
          <h1 class="settings-title-text">Settings</h1>
          <p class="settings-sub-text">Customize your trading workspace, preferences, security, and broker setup.</p>
        </div>

        {/* Tab List */}
        <div class="settings-tabs-row">
          <For each={TABS}>
            {(tab) => (
              <button
                class={`settings-tab-btn ${activeTab() === tab.toLowerCase() ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.toLowerCase())}
              >
                {tab}
              </button>
            )}
          </For>
        </div>

        {/* Dynamic content wrapper */}
        <div class="settings-tab-content-panel">
          
          {/* ── TAB: Appearance (Default) ────────────────────────── */}
          <Show when={activeTab() === 'appearance'}>
            {/* Section 1: Workspace Theme */}
            <div class="settings-section-group">
              <h3 class="settings-section-title">Workspace Theme</h3>
              <div class="settings-choices-grid">
                {/* Theme Selector */}
                <div class="choices-cell">
                  <span class="choices-cell-title">Theme</span>
                  <div class="choice-cards-row">
                    <button 
                      class={`choice-card-toggle ${props.theme() === 'light' ? 'active' : ''}`}
                      onClick={() => props.setTheme('light')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      Light
                    </button>
                    <button 
                      class={`choice-card-toggle ${props.theme() === 'dark' ? 'active' : ''}`}
                      onClick={() => props.setTheme('dark')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      Dark
                    </button>
                  </div>
                </div>

                {/* Density Selector */}
                <div class="choices-cell">
                  <span class="choices-cell-title">Density</span>
                  <div class="choice-cards-row">
                    <button 
                      class={`choice-card-toggle ${density() === 'comfortable' ? 'active' : ''}`}
                      onClick={() => setDensity('comfortable')}
                    >
                      Comfortable
                    </button>
                    <button 
                      class={`choice-card-toggle ${density() === 'compact' ? 'active' : ''}`}
                      onClick={() => setDensity('compact')}
                    >
                      Compact
                    </button>
                  </div>
                </div>

                {/* Accent Color picker */}
                <div class="choices-cell">
                  <span class="choices-cell-title">Accent Color</span>
                  <div class="accent-picker-row">
                    <div 
                      class={`accent-color-circle ${accentColor() === 'violet' ? 'active' : ''}`}
                      style={{ background: '#3b82f6' }}
                      onClick={() => setAccentColor('violet')}
                    />
                    <div 
                      class={`accent-color-circle ${accentColor() === 'blue' ? 'active' : ''}`}
                      style={{ background: '#2563eb' }}
                      onClick={() => setAccentColor('blue')}
                    />
                    <div 
                      class={`accent-color-circle ${accentColor() === 'green' ? 'active' : ''}`}
                      style={{ background: '#10b981' }}
                      onClick={() => setAccentColor('green')}
                    />
                    <div 
                      class={`accent-color-circle ${accentColor() === 'orange' ? 'active' : ''}`}
                      style={{ background: '#f59e0b' }}
                      onClick={() => setAccentColor('orange')}
                    />
                  </div>
                </div>

                {/* Font Size slider */}
                <div class="choices-cell" style="grid-column: 1 / span 2;">
                  <span class="choices-cell-title">Font Size</span>
                  <div class="font-size-slider-wrapper">
                    <span class="font-size-label-small">A</span>
                    <input 
                      type="range" 
                      min="11" 
                      max="15" 
                      step="1"
                      class="font-slider-input" 
                      value={fontSize()}
                      onInput={(e) => setFontSize(Number(e.currentTarget.value))}
                    />
                    <span class="font-size-label-large">A</span>
                  </div>
                </div>

                {/* Mini Toggles list on right */}
                <div class="choices-cell">
                  <div class="settings-toggle-item-row" style="padding-top: 0;">
                    <span>Rounded Charts</span>
                    <div 
                      class={`settings-switch-toggle ${roundedCharts() ? 'on' : ''}`}
                      onClick={() => setRoundedCharts(prev => !prev)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                  <div class="settings-toggle-item-row">
                    <span>Subtle Blur</span>
                    <div 
                      class={`settings-switch-toggle ${subtleBlur() ? 'on' : ''}`}
                      onClick={() => setSubtleBlur(prev => !prev)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                  <div class="settings-toggle-item-row">
                    <span>Reduced Motion</span>
                    <div 
                      class={`settings-switch-toggle ${reducedMotion() ? 'on' : ''}`}
                      onClick={() => setReducedMotion(prev => !prev)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Layout Preferences */}
            <div class="settings-section-group">
              <h3 class="settings-section-title">Layout Preferences</h3>
              <div class="settings-toggles-row-grid">
                <div class="settings-toggle-item-row">
                  <span>Remember last workspace</span>
                  <div 
                    class={`settings-switch-toggle ${rememberWorkspace() ? 'on' : ''}`}
                    onClick={() => setRememberWorkspace(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>

                <div class="settings-toggle-item-row">
                  <span>Show AI copilot</span>
                  <div 
                    class={`settings-switch-toggle ${showAiCopilot() ? 'on' : ''}`}
                    onClick={() => setShowAiCopilot(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>

                <div class="settings-toggle-item-row">
                  <span>Auto-save layout</span>
                  <div 
                    class={`settings-switch-toggle ${autoSaveLayout() ? 'on' : ''}`}
                    onClick={() => setAutoSaveLayout(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>

                <div class="settings-toggle-item-row">
                  <span>Show market breadth widgets</span>
                  <div 
                    class={`settings-switch-toggle ${showMarketBreadth() ? 'on' : ''}`}
                    onClick={() => setShowMarketBreadth(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>

                <div class="settings-toggle-item-row">
                  <span>Sticky order panel</span>
                  <div 
                    class={`settings-switch-toggle ${stickyOrderPanel() ? 'on' : ''}`}
                    onClick={() => setStickyOrderPanel(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>

                <div class="settings-toggle-item-row">
                  <span>Show keyboard shortcuts hints</span>
                  <div 
                    class={`settings-switch-toggle ${showKeyboardHints() ? 'on' : ''}`}
                    onClick={() => setShowKeyboardHints(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Trading Preferences */}
            <div class="settings-section-group">
              <h3 class="settings-section-title">Trading Preferences</h3>
              <div class="settings-inputs-grid-row">
                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Default Order Type</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={defaultOrderType()} 
                    onChange={(e) => setDefaultOrderType(e.currentTarget.value)}
                  >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                    <option value="SL">SL</option>
                    <option value="SL-M">SL-M</option>
                  </select>

                  <span class="inputs-row-cell-lbl" style="margin-top: 10px;">Default Product</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={defaultProduct()} 
                    onChange={(e) => setDefaultProduct(e.currentTarget.value)}
                  >
                    <option value="INTRADAY">INTRADAY (MIS)</option>
                    <option value="OVERNIGHT">OVERNIGHT (NRML)</option>
                    <option value="CASH">CASH (CNC)</option>
                  </select>

                  <span class="inputs-row-cell-lbl" style="margin-top: 10px;">Quantity Presets</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={qtyPresets()} 
                    onChange={(e) => setQtyPresets(e.currentTarget.value)}
                  >
                    <option value="5, 10, 25, 50, 100">5, 10, 25, 50, 100</option>
                    <option value="10, 25, 50, 100, 250">10, 25, 50, 100, 250</option>
                    <option value="75, 150, 300, 600">75, 150, 300, 600</option>
                  </select>
                </div>

                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Safety & Confirmation</span>
                  
                  <div class="settings-toggle-item-row">
                    <span>Confirm Bracket Order</span>
                    <div 
                      class={`settings-switch-toggle ${store.settings.confirmOrder ? 'on' : ''}`}
                      onClick={() => updateSetting('confirmOrder', !store.settings.confirmOrder)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>

                  <div class="settings-toggle-item-row">
                    <span>Before Square Off</span>
                    <div 
                      class={`settings-switch-toggle ${store.settings.showSummary ? 'on' : ''}`}
                      onClick={() => updateSetting('showSummary', !store.settings.showSummary)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>

                  <div class="settings-toggle-item-row">
                    <span>Panic Exit Confirmation</span>
                    <div 
                      class={`settings-switch-toggle ${panicExitConfirmation() ? 'on' : ''}`}
                      onClick={() => setPanicExitConfirmation(prev => !prev)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                </div>

                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Preferred Scalping Shortcuts</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={preferredScalpingShortcuts()} 
                    onChange={(e) => setPreferredScalpingShortcuts(e.currentTarget.value)}
                  >
                    <option value="Alt + S (Scalper Panel)">Alt + S (Scalper Panel)</option>
                    <option value="Ctrl + B (Quick Buy)">Ctrl + B (Quick Buy)</option>
                    <option value="Shift + S (Quick Sell)">Shift + S (Quick Sell)</option>
                  </select>
                  <p class="settings-field-subtext">Customize your preferred shortcuts for faster scalping execution.</p>
                </div>
              </div>
            </div>

            {/* Section 4: Chart Preferences */}
            <div class="settings-section-group">
              <h3 class="settings-section-title">Chart Preferences</h3>
              <div class="settings-inputs-grid-row">
                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Default Timeframe</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={defaultTimeframe()} 
                    onChange={(e) => setDefaultTimeframe(e.currentTarget.value)}
                  >
                    <option value="1 Minute">1 Minute</option>
                    <option value="5 Minutes">5 Minutes</option>
                    <option value="15 Minutes">15 Minutes</option>
                    <option value="1 Hour">1 Hour</option>
                    <option value="1 Day">1 Day</option>
                  </select>

                  <span class="inputs-row-cell-lbl" style="margin-top: 10px;">Candle Type</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={candleType()} 
                    onChange={(e) => setCandleType(e.currentTarget.value)}
                  >
                    <option value="Heikin Ashi">Heikin Ashi</option>
                    <option value="Candlestick">Japanese Candlesticks</option>
                    <option value="Line Chart">Line Chart</option>
                    <option value="Bar">OHLC Bars</option>
                  </select>
                </div>

                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Indicator Visibility</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={indicatorVisibility()} 
                    onChange={(e) => setIndicatorVisibility(e.currentTarget.value)}
                  >
                    <option value="Last Used">Last Used</option>
                    <option value="All Visible">All Visible</option>
                    <option value="Hide All">Hide All</option>
                  </select>
                  
                  <div class="settings-toggle-item-row" style="margin-top: 10px;">
                    <span>VWAP Auto-load</span>
                    <div 
                      class={`settings-switch-toggle ${vwapAutoLoad() ? 'on' : ''}`}
                      onClick={() => setVwapAutoLoad(prev => !prev)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>

                  <div class="settings-toggle-item-row">
                    <span>Volume Auto-load</span>
                    <div 
                      class={`settings-switch-toggle ${store.settings.showVolume ? 'on' : ''}`}
                      onClick={() => updateSetting('showVolume', !store.settings.showVolume)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                </div>

                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Crosshair Behavior</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={crosshairBehavior()} 
                    onChange={(e) => setCrosshairBehavior(e.currentTarget.value)}
                  >
                    <option value="Magnet">Magnet</option>
                    <option value="Normal">Normal</option>
                    <option value="Lock Y">Lock Y-axis</option>
                  </select>

                  <span class="inputs-row-cell-lbl" style="margin-top: 10px;">Price Ladder Visibility</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={priceLadderVisibility()} 
                    onChange={(e) => setPriceLadderVisibility(e.currentTarget.value)}
                  >
                    <option value="Always Visible">Always Visible</option>
                    <option value="On Hover">On Hover</option>
                    <option value="Hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Trading ────────────────────────────────────── */}
          <Show when={activeTab() === 'trading'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Trading Preferences</h3>
              <div class="settings-toggles-row-grid">
                <div class="settings-toggle-item-row">
                  <span>Auto Square Off (3:15 PM)</span>
                  <div 
                    class={`settings-switch-toggle ${store.settings.autoSquareOff ? 'on' : ''}`}
                    onClick={() => updateSetting('autoSquareOff', !store.settings.autoSquareOff)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
                <div class="settings-toggle-item-row">
                  <span>Panic Exit Confirmation</span>
                  <div 
                    class={`settings-switch-toggle ${panicExitConfirmation() ? 'on' : ''}`}
                    onClick={() => setPanicExitConfirmation(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Charts ─────────────────────────────────────── */}
          <Show when={activeTab() === 'charts'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Chart Layout</h3>
              <div class="settings-toggles-row-grid">
                <div class="settings-toggle-item-row">
                  <span>Show Chart Grid</span>
                  <div 
                    class={`settings-switch-toggle ${store.settings.showGrid ? 'on' : ''}`}
                    onClick={() => updateSetting('showGrid', !store.settings.showGrid)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
                <div class="settings-toggle-item-row">
                  <span>Show Volumebar Histogram</span>
                  <div 
                    class={`settings-switch-toggle ${store.settings.showVolume ? 'on' : ''}`}
                    onClick={() => updateSetting('showVolume', !store.settings.showVolume)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Alerts ─────────────────────────────────────── */}
          <Show when={activeTab() === 'alerts'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Notification Alerts</h3>
              <div class="settings-inputs-grid-row">
                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">Toast Auto-Dismiss</span>
                  <select 
                    class="settings-dropdown-select" 
                    value={store.settings.notificationTimeout}
                    onChange={(e) => updateSetting('notificationTimeout', Number(e.currentTarget.value))}
                  >
                    <option value="3">3 Seconds</option>
                    <option value="6">6 Seconds (Default)</option>
                    <option value="10">10 Seconds</option>
                    <option value="0">Never (Manual Dismiss)</option>
                  </select>
                </div>
                <div class="inputs-row-cell">
                  <span class="inputs-row-cell-lbl">System Sounds</span>
                  <div class="settings-toggle-item-row" style="margin-top: 5px;">
                    <span>Sound Alerts (Synth Beep)</span>
                    <div 
                      class={`settings-switch-toggle ${store.settings.soundAlerts ? 'on' : ''}`}
                      onClick={() => updateSetting('soundAlerts', !store.settings.soundAlerts)}
                    >
                      <div class="slider-thumb" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Brokers & API ──────────────────────────────── */}
          <Show when={activeTab() === 'brokers & api'}>
            <div class="api-connection-wrapper">
              <h3 class="settings-section-title">Kotak Neo API Settings</h3>
              
              {/* Connection Status Bar */}
              <div class="api-connection-status-bar">
                <div class="profile-card-body-box">
                  <div class="api-broker-logo">KN</div>
                  <div>
                    <span class="profile-info-name">Kotak Neo Terminal v2.0</span>
                    <div class="profile-info-email">REST Sidecar (8001) - Feed Handler (8002)</div>
                  </div>
                </div>

                <div class={`api-status-badge-inline ${connStatus().toLowerCase()}`}>
                  <span class="api-status-dot-pulse" />
                  {connStatus() === 'CONNECTED' ? 'Connected'
                    : connStatus() === 'CONNECTING' ? 'Connecting...'
                    : 'Disconnected'}
                </div>
              </div>

              {/* API Form */}
              <div class="api-cred-panel" style="padding: 0;">
                <Show when={apiError()}>
                  <div class="api-error-box" style="margin-bottom: var(--sys-space-3);">{apiError()}</div>
                </Show>

                <div class="api-form-grid">
                  <div class="api-field">
                    <label class="panel-section-lbl">User Client Code (UCC)</label>
                    <input class="panel-input" placeholder="e.g. AB1234"
                      value={form().ucc} onInput={updateField('ucc')} />
                  </div>

                  <div class="api-field">
                    <label class="panel-section-lbl">Registered Mobile Number</label>
                    <input class="panel-input" placeholder="+91XXXXXXXXXX"
                      value={form().mobile_number} onInput={updateField('mobile_number')} />
                  </div>

                  <div class="api-field api-field--full">
                    <label class="panel-section-lbl">Consumer Key</label>
                    <input class="panel-input" placeholder="From Kotak Neo > Invest > Trade API"
                      value={form().consumer_key} onInput={updateField('consumer_key')} />
                  </div>

                  <div class="api-field">
                    <label class="panel-section-lbl">MPIN (6-digit)</label>
                    <input class="panel-input" type="password" maxLength={6}
                      placeholder="******" value={form().mpin} onInput={updateField('mpin')} />
                  </div>

                  <div class="api-field">
                    <div class="api-label-row">
                      <span class="panel-section-lbl" style="margin-bottom: 0;">TOTP Secret</span>
                      <span class="api-optional-badge">Auto-login</span>
                    </div>
                    <div class="api-totp-input-wrapper">
                      <input
                        class="panel-input"
                        type={showTotp() ? 'text' : 'password'}
                        placeholder="Base32 secret from authenticator app"
                        value={form().totp_secret}
                        onInput={updateField('totp_secret')}
                      />
                      <button class="api-eye-btn" type="button" onClick={() => setShowTotp(v => !v)}>
                        {showTotp() ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="api-actions" style="margin-top: var(--sys-space-4);">
                  <button class="footer-btn-outline" onClick={handleSave} disabled={saving()}>
                    {saving() ? 'Saving...' : 'Save Credentials'}
                  </button>
                  <button
                    class="footer-btn-solid-submit"
                    onClick={handleLogin}
                    disabled={logging() || connStatus() === 'CONNECTED'}
                  >
                    {logging() ? 'Connecting...' : connStatus() === 'CONNECTED' ? 'Connected' : 'Connect API'}
                  </button>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Profile ────────────────────────────────────── */}
          <Show when={activeTab() === 'profile'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Personal Settings</h3>
              <div class="api-form-grid">
                <div class="api-field">
                  <span class="panel-section-lbl">Display Name</span>
                  <input 
                    class="panel-input" 
                    value={profileName()} 
                    onInput={(e) => setProfileName(e.currentTarget.value)}
                  />
                </div>
                <div class="api-field">
                  <span class="panel-section-lbl">Registered Email</span>
                  <input 
                    class="panel-input" 
                    value={profileEmail()} 
                    onInput={(e) => setProfileEmail(e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Security ───────────────────────────────────── */}
          <Show when={activeTab() === 'security'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Security Settings</h3>
              <div class="settings-toggles-row-grid">
                <div class="settings-toggle-item-row">
                  <span>Two-Factor Authentication</span>
                  <div
                    class={`settings-switch-toggle ${twoFactorEnabled() ? 'on' : ''}`}
                    onClick={() => setTwoFactorEnabled(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
                <div class="settings-toggle-item-row">
                  <span>Login Alerts</span>
                  <div
                    class={`settings-switch-toggle ${loginAlertsEnabled() ? 'on' : ''}`}
                    onClick={() => setLoginAlertsEnabled(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* ── TAB: Advanced ───────────────────────────────────── */}
          <Show when={activeTab() === 'advanced'}>
            <div class="settings-section-group">
              <h3 class="settings-section-title">Advanced Utilities</h3>
              <div class="settings-toggles-row-grid">
                <div class="settings-toggle-item-row">
                  <span>Debug Logging</span>
                  <div
                    class={`settings-switch-toggle ${debugLogging() ? 'on' : ''}`}
                    onClick={() => setDebugLogging(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
                <div class="settings-toggle-item-row">
                  <span>Verbose Console Output</span>
                  <div
                    class={`settings-switch-toggle ${verboseConsole() ? 'on' : ''}`}
                    onClick={() => setVerboseConsole(prev => !prev)}
                  >
                    <div class="slider-thumb" />
                  </div>
                </div>
              </div>
            </div>
          </Show>

        </div>

        {/* Footer actions bar */}
        <div class="settings-footer-actions-bar">
          <button class="footer-btn-left" onClick={handleResetToDefault}>
            Reset to Default
          </button>
          
          <div class="footer-btn-right-row">
            <button class="footer-btn-outline" onClick={handlePreviewChanges}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview Changes
            </button>
            <button class="footer-btn-solid-submit" onClick={handleSaveAllSettings}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Column: Sidebar ────────────────────────────── */}
      <div class="settings-right-sidebar">
        
        {/* Profile Summary section */}
        <div class="settings-sidebar-section">
          <div class="sidebar-section-header-row">
            <h4 class="sidebar-section-title">Profile Summary</h4>
            <span class="sidebar-section-action-icon" onClick={() => setActiveTab('profile')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </div>

          <div class="profile-card-body-box">
            <div class="profile-avatar-large">
              {profileName().substring(0, 1)}
            </div>
            
            <div class="profile-info-textbox">
              <span class="profile-info-name">{profileName()}</span>
              <span class="profile-info-email">{profileEmail()}</span>
            </div>
          </div>

          <div class="profile-badges-row-items">
            <span class="profile-plan-badge">Pro Plan</span>
            <span class="profile-renew-lbl">Renews on 12 Jun 2024</span>
          </div>

          <div class="profile-verified-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Verified
          </div>
        </div>

        {/* Connected Brokers section */}
        <div class="settings-sidebar-section">
          <div class="sidebar-section-header-row">
            <h4 class="sidebar-section-title">Connected Brokers</h4>
          </div>

          <div class="sidebar-vertical-list-items">
            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </span>
                <span class="list-row-item-name">Zerodha</span>
              </div>
              <span class="list-row-item-status-tag connected">Connected</span>
            </div>

            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </span>
                <span class="list-row-item-name">ANGEL ONE</span>
              </div>
              <span class="list-row-item-status-tag connected">Connected</span>
            </div>

            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M3 3v18h18" />
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                  </svg>
                </span>
                <span class="list-row-item-name">TradingView</span>
              </div>
              <span class="list-row-item-status-tag connected">Connected</span>
            </div>
          </div>

          <button 
            class="sidebar-row-action-link-btn"
            onClick={() => setActiveTab('brokers & api')}
          >
            <span>Manage Brokers & API</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 4px;">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Security Status section */}
        <div class="settings-sidebar-section">
          <div class="sidebar-section-header-row">
            <h4 class="sidebar-section-title">Security Status</h4>
          </div>

          <div class="sidebar-vertical-list-items">
            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span class="list-row-item-name">Two-Factor Authentication</span>
              </div>
              <span class={`list-row-item-status-tag ${twoFactorEnabled() ? 'enabled' : 'inactive'}`}>
                {twoFactorEnabled() ? 'Enabled' : 'Off'}
              </span>
            </div>

            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <span class="list-row-item-name">Login Alerts</span>
              </div>
              <span class={`list-row-item-status-tag ${loginAlertsEnabled() ? 'enabled' : 'inactive'}`}>
                {loginAlertsEnabled() ? 'Enabled' : 'Off'}
              </span>
            </div>

            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </span>
                <span class="list-row-item-name">API Token</span>
              </div>
              <span class="list-row-item-status-tag active">Active</span>
            </div>

            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </span>
                <span class="list-row-item-name">Active Sessions</span>
              </div>
              <button 
                class="sidebar-row-action-link-btn" 
                style="margin-top: 0;"
                onClick={() => setActiveTab('security')}
              >
                2 Active &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Backup & Sync section */}
        <div class="settings-sidebar-section">
          <div class="sidebar-section-header-row">
            <h4 class="sidebar-section-title">Backup & Sync</h4>
          </div>

          <div class="sidebar-vertical-list-items">
            <div class="sidebar-list-row-item">
              <div class="list-row-item-lbl-side">
                <span class="list-row-item-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a6 6 0 0 0 0-12z" />
                  </svg>
                </span>
                <span class="list-row-item-name">Cloud Sync</span>
              </div>
              <span class="list-row-item-status-tag enabled">Enabled</span>
            </div>
          </div>

          <div class="sync-time-row">
            <span>Last Synced</span>
            <span class="sync-time-val">{lastSyncedAt()}</span>
          </div>

          <div class="sync-action-row">
            <button class="sidebar-row-action-link-btn" onClick={handleSyncNow}>
              <span>Sync Now</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 4px;">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
