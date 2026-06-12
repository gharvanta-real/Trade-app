import { createSignal, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { HugeIcon } from '../components/HugeIcon';
import { Sun01Icon, Moon01Icon, ChevronDownIcon } from '@hugeicons/core-free-icons';
import { store, togglePaperTrade } from '../store/tradingStore';

interface TopBarProps {
  theme: () => 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onProfileClick?: () => void;
}

export const TopBar: Component<TopBarProps> = (props) => {
  // Generate slightly fluctuating mock prices for real-time vibe
  const [nifty, setNifty] = createSignal({ price: 22957.30, pct: 0.62 });
  const [banknifty, setBanknifty] = createSignal({ price: 48353.45, pct: 0.71 });
  const [finnifty, setFinnifty] = createSignal({ price: 21675.55, pct: 0.44 });
  const [pnl, setPnl] = createSignal(18325.45);

  const interval = setInterval(() => {
    // Small random fluctuations
    setNifty(n => {
      const change = (Math.random() - 0.48) * 2;
      const newPrice = Number((n.price + change).toFixed(2));
      const newPct = Number((n.pct + change / 229).toFixed(2));
      return { price: newPrice, pct: newPct };
    });
    setBanknifty(n => {
      const change = (Math.random() - 0.48) * 4;
      const newPrice = Number((n.price + change).toFixed(2));
      const newPct = Number((n.pct + change / 483).toFixed(2));
      return { price: newPrice, pct: newPct };
    });
    setFinnifty(n => {
      const change = (Math.random() - 0.48) * 2;
      const newPrice = Number((n.price + change).toFixed(2));
      const newPct = Number((n.pct + change / 216).toFixed(2));
      return { price: newPrice, pct: newPct };
    });
    setPnl(p => p + (Math.random() - 0.45) * 50);
  }, 2000);

  onCleanup(() => clearInterval(interval));

  const [time, setTime] = createSignal(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const timeInterval = setInterval(() => {
    setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
  }, 1000);
  onCleanup(() => clearInterval(timeInterval));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const getIndexData = (symbolName: string, fallbackSignal: () => { price: number; pct: number }) => {
    const sym = store.symbols[symbolName];
    if (sym && sym.price > 0) {
      return { price: sym.price, pct: sym.pct };
    }
    return fallbackSignal();
  };

  const displayedEquity = () => {
    if (store.brokerConnected) {
      const holdingsValue = store.holdings.reduce((sum, h) => sum + h.current, 0);
      return store.margins.available + holdingsValue;
    }
    return 25430.75; // exact value from user's screen
  };

  const displayedPnl = () => {
    if (store.brokerConnected) {
      return store.positions.reduce((sum, p) => sum + p.pnl, 0);
    }
    return pnl();
  };

  return (
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo">
          NEXUS <span class="logo-ai">AI</span>
        </div>
        <div class="live-clock">
          <span class="live-dot"></span>
          <span class="live-text">LIVE</span>
          <span class="time-string">{time()}</span>
        </div>
      </div>

      <div class="ticker-ribbon">
        <div class="ticker-item">
          <span class="ticker-name">NIFTY 50</span>
          <span class="ticker-price">{getIndexData('NIFTY 50', nifty).price.toFixed(2)}</span>
          <span class={`ticker-change ${getIndexData('NIFTY 50', nifty).pct >= 0 ? 'up' : 'down'}`}>
            {getIndexData('NIFTY 50', nifty).pct >= 0 ? '+' : ''}{getIndexData('NIFTY 50', nifty).pct.toFixed(2)}%
          </span>
        </div>
        <div class="ticker-item">
          <span class="ticker-name">BANKNIFTY</span>
          <span class="ticker-price">{getIndexData('BANKNIFTY', banknifty).price.toFixed(2)}</span>
          <span class={`ticker-change ${getIndexData('BANKNIFTY', banknifty).pct >= 0 ? 'up' : 'down'}`}>
            {getIndexData('BANKNIFTY', banknifty).pct >= 0 ? '+' : ''}{getIndexData('BANKNIFTY', banknifty).pct.toFixed(2)}%
          </span>
        </div>
        <div class="ticker-item">
          <span class="ticker-name">FINNIFTY</span>
          <span class="ticker-price">{getIndexData('FINNIFTY', finnifty).price.toFixed(2)}</span>
          <span class={`ticker-change ${getIndexData('FINNIFTY', finnifty).pct >= 0 ? 'up' : 'down'}`}>
            {getIndexData('FINNIFTY', finnifty).pct >= 0 ? '+' : ''}{getIndexData('FINNIFTY', finnifty).pct.toFixed(2)}%
          </span>
        </div>
      </div>

      <div class="topbar-right">
        <button
          class={`paper-mode-toggle ${store.paperTradeMode ? 'on' : ''}`}
          onClick={togglePaperTrade}
          title={store.paperTradeMode ? 'Switch to Live Trading' : 'Switch to Paper Trading'}
        >
          {store.paperTradeMode ? 'Paper' : 'Live'}
        </button>

        <div class="portfolio-summary">
          <div class="summary-item">
            <span class="summary-label">Equity</span>
            <span class="summary-val">{formatCurrency(displayedEquity())}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">PnL (Today)</span>
            <span class={`summary-val ${displayedPnl() >= 0 ? 'up' : 'down'}`}>
              {displayedPnl() >= 0 ? '+' : ''}{formatCurrency(displayedPnl())}
            </span>
          </div>
        </div>

        <button 
          class="theme-toggle" 
          onClick={() => props.setTheme(props.theme() === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${props.theme() === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {props.theme() === 'dark' ? <HugeIcon icon={Sun01Icon} size={15} /> : <HugeIcon icon={Moon01Icon} size={15} />}
        </button>

        <div class="profile-menu" onClick={() => props.onProfileClick && props.onProfileClick()}>
          <span class="profile-avatar">SK</span>
          <HugeIcon icon={ChevronDownIcon} size={14} class="profile-arrow" />
        </div>
      </div>
    </header>
  );
};
