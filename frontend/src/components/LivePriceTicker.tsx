import { createSignal, createEffect } from 'solid-js';
import type { Component } from 'solid-js';
import { store } from '../store/tradingStore';

interface LivePriceTickerProps {
  symbol: string;
  showChange?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LivePriceTicker: Component<LivePriceTickerProps> = (props) => {
  const [flash, setFlash] = createSignal<'up' | 'down' | null>(null);
  let prevPrice = 0;

  const sym = () => store.symbols[props.symbol];
  const price = () => sym()?.price || 0;
  const change = () => sym()?.change || 0;
  const pct = () => sym()?.pct || 0;
  const isUp = () => sym()?.up ?? true;

  const sizeMap = { sm: '11px', md: '14px', lg: '18px' };
  const fontSize = () => sizeMap[props.size || 'md'];

  createEffect(() => {
    const current = price();
    if (prevPrice !== 0 && current !== prevPrice) {
      const dir = current > prevPrice ? 'up' : 'down';
      setFlash(dir);
      setTimeout(() => setFlash(null), 500);
    }
    prevPrice = current;
  });

  return (
    <span style={{ display: 'inline-flex', 'align-items': 'baseline', gap: '4px' }}>
      <span style={{
        'font-family': 'var(--sys-font-mono)', 'font-size': fontSize(), 'font-weight': '700',
        color: isUp() ? 'var(--theme-color-up)' : 'var(--theme-color-down)',
        transition: 'color 0.15s',
        animation: flash() ? `flash-${flash()} 0.5s ease` : 'none',
      }}>
        ₹{price().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {props.showChange && (
        <span style={{
          'font-family': 'var(--sys-font-mono)',
          'font-size': `calc(${fontSize()} - 2px)`,
          color: isUp() ? 'var(--theme-color-up)' : 'var(--theme-color-down)',
        }}>
          {change() >= 0 ? '+' : ''}{change().toFixed(2)} ({pct() >= 0 ? '+' : ''}{pct().toFixed(2)}%)
        </span>
      )}
      <style>{`
        @keyframes flash-up {
          0%   { color: var(--theme-color-up); background: rgba(16,185,129,0.2); border-radius: 3px; padding: 0 2px; }
          100% { color: var(--theme-color-up); background: transparent; }
        }
        @keyframes flash-down {
          0%   { color: var(--theme-color-down); background: rgba(244,63,94,0.2); border-radius: 3px; padding: 0 2px; }
          100% { color: var(--theme-color-down); background: transparent; }
        }
      `}</style>
    </span>
  );
};
