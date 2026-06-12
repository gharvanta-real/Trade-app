import { createSignal, onMount, onCleanup, createEffect, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { store, fetchCandles } from "../../store/tradingStore";
import "./charts.css";

interface ChartsPageProps {
  theme: () => "dark" | "light";
}

interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number; isGreen?: boolean;
}

type GridLayout = "1x1" | "1x2" | "2x1" | "2x2" | "1x3";
const GRID_CONFIGS: Record<GridLayout, { label: string; panes: number }> = {
  "1x1": { label: "1 Pane", panes: 1 }, "1x2": { label: "2 Col", panes: 2 },
  "2x1": { label: "2 Row", panes: 2 }, "2x2": { label: "4 Pane", panes: 4 },
  "1x3": { label: "3 Col", panes: 3 },
};

const SCALP_TFS = ["1m", "3m", "5m"];
const ALL_TFS = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];

type RightTab = "watchlist" | "scalp" | "indicators" | "tools" | "settings";
const RIGHT_TABS: { id: RightTab; icon: string; label: string }[] = [
  { id: "watchlist", icon: "W", label: "List" }, { id: "scalp", icon: "S", label: "Scalp" },
  { id: "indicators", icon: "I", label: "Ind" }, { id: "tools", icon: "T", label: "Tools" },
  { id: "settings", icon: "G", label: "Set" },
];

type DrawTool = "crosshair" | "trendline" | "pitchfork" | "brush" | "path" | "fibonacci" | "text" | "magnet" | "ruler" | "zoom" | "eraser" | "lock" | "hide";
const DRAW_TOOLS: { id: DrawTool; label: string }[] = [
  { id: "crosshair", label: "Crosshair" },
  { id: "trendline", label: "Trendline" },
  { id: "pitchfork", label: "Pitchfork" },
  { id: "brush", label: "Brush" },
  { id: "path", label: "Path" },
  { id: "fibonacci", label: "Fibonacci" },
  { id: "text", label: "Text" },
  { id: "magnet", label: "Magnet" },
  { id: "ruler", label: "Ruler" },
  { id: "zoom", label: "Zoom" },
  { id: "eraser", label: "Eraser" },
  { id: "lock", label: "Lock" },
  { id: "hide", label: "Hide" }
];

const formatVolume = (vol: number): string => {
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)}Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(2)}L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return String(vol);
};

const MAX_PANES = 4;
export const ChartsPage: Component<ChartsPageProps> = (props) => {
  const [activeWatchlistTab, setActiveWatchlistTab] = createSignal("Index");
  const [selectedPane, setSelectedPane] = createSignal(0);
  const [activeSymbol, setActiveSymbol] = createSignal("NIFTY 50");
  const [gridLayout, setGridLayout] = createSignal<GridLayout>("1x2");
  const [rightTab, setRightTab] = createSignal<RightTab>("watchlist");
  const [drawTool, setDrawTool] = createSignal<DrawTool>("crosshair");
  const [isRightPanelExpanded, setIsRightPanelExpanded] = createSignal(true);
  const [rightPanelWidth, setRightPanelWidth] = createSignal(280);
  const [openTfDropdownPane, setOpenTfDropdownPane] = createSignal<number | null>(null);
  const [openIndDropdownPane, setOpenIndDropdownPane] = createSignal<number | null>(null);

  const getToolIcon = (id: DrawTool) => {
    if (id === "crosshair") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    }
    if (id === "trendline") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/></svg>;
    }
    if (id === "pitchfork") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h12M16 6v12M10 6h10M10 18h10"/></svg>;
    }
    if (id === "brush") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zM8 12c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>;
    }
    if (id === "path") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c4-8 8 8 12 0s4-8 6 0"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/></svg>;
    }
    if (id === "fibonacci") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>;
    }
    if (id === "text") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>;
    }
    if (id === "magnet") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10a7 7 0 0 1 14 0v4a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-4a3 3 0 0 0-6 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z"/></svg>;
    }
    if (id === "ruler") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18M5 7h4M5 12h6M5 17h4"/></svg>;
    }
    if (id === "zoom") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
    }
    if (id === "eraser") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-1-1-1-3 0-4l9-9c1-1 3-1 4 0l4 4c1 1 1 3 0 4L12 19"/></svg>;
    }
    if (id === "lock") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    }
    if (id === "hide") {
      return <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    }
    return null;
  };

  let chartsBodyRef!: HTMLDivElement;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let isResizing = false;

  const onResizeMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    resizeStartX = e.clientX;
    resizeStartWidth = rightPanelWidth();
    isResizing = true;
    document.addEventListener("mousemove", onResizeMouseMove);
    document.addEventListener("mouseup", onResizeMouseUp);
  };

  const onResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(200, Math.min(600, resizeStartWidth - deltaX));
    setRightPanelWidth(newWidth);
    handleResize();
  };

  const onResizeMouseUp = () => {
    isResizing = false;
    document.removeEventListener("mousemove", onResizeMouseMove);
    document.removeEventListener("mouseup", onResizeMouseUp);
  };

  const handleTabClick = (tabId: RightTab) => {
    if (rightTab() === tabId && isRightPanelExpanded()) {
      setIsRightPanelExpanded(false);
    } else {
      setRightTab(tabId);
      setIsRightPanelExpanded(true);
    }
    setTimeout(handleResize, 10);
  };
  const [scalpingMode, setScalpingMode] = createSignal(false);
  const [showGridPicker, setShowGridPicker] = createSignal(false);
  const [scalpQty, setScalpQty] = createSignal(1);
  const [scalpProd, setScalpProd] = createSignal<"MIS" | "NRML">("MIS");
  const [showEMA20, setShowEMA20] = createSignal(true);
  const [showEMA50, setShowEMA50] = createSignal(true);
  const [showVWAP, setShowVWAP] = createSignal(true);
  const [showBB, setShowBB] = createSignal(false);
  const [showRSI, setShowRSI] = createSignal(false);
  const [paneTimeframes, setPaneTimeframes] = createSignal<string[]>(["5m", "15m", "1h", "1d"]);
  const [paneCandles, setPaneCandles] = createSignal<Candle[][]>([[], [], [], []]);
  const [panePanX, setPanePanX] = createSignal<number[]>([0, 0, 0, 0]);
  const [paneZoom, setPaneZoom] = createSignal<number[]>([50, 50, 50, 50]);
  const [paneAutoScale, setPaneAutoScale] = createSignal<boolean[]>([true, true, true, true]);
  const [paneManualMin, setPaneManualMin] = createSignal<number[]>([0, 0, 0, 0]);
  const [paneManualMax, setPaneManualMax] = createSignal<number[]>([0, 0, 0, 0]);
  const [paneCrosshair, setPaneCrosshair] = createSignal<({ x: number; y: number } | null)[]>([null, null, null, null]);

  const canvasRefs: HTMLCanvasElement[] = [];
  const containerRefs: HTMLDivElement[] = [];
  let isDragging: boolean[] = [false, false, false, false];
  let dragStartX: number[] = [0, 0, 0, 0];
  let dragStartY: number[] = [0, 0, 0, 0];
  let dragStartPanX: number[] = [0, 0, 0, 0];
  let dragStartZoom: number[] = [50, 50, 50, 50];
  let dragStartMin: number[] = [0, 0, 0, 0];
  let dragStartMax: number[] = [0, 0, 0, 0];
  let dragArea: ("grid" | "yaxis" | "xaxis" | null)[] = [null, null, null, null];
  let animFrameId = 0;

  createEffect(() => { if (store.activeChartSymbol) setActiveSymbol(store.activeChartSymbol); });

  const getWatchlistItems = () => store.watchlist
    .map(key => ({ key, ...store.symbols[key] }))
    .filter(item => {
      if (!item.name) return false;
      const t = item.type || "Equity";
      if (activeWatchlistTab() === "Index") return t === "Index";
      if (activeWatchlistTab() === "Stocks") return t === "Equity" || t === "Stock";
      return t.includes("Option") || t.includes("F&O") || (!t.includes("Index") && !t.includes("Equity"));
    });

  const activePaneCount = () => GRID_CONFIGS[gridLayout()].panes;

  const generateCandles = (symbol: string, timeframe: string, count: number): Candle[] => {
    const curPrice = store.symbols[symbol]?.price || 100;
    const candles: Candle[] = [];
    const keyStr = symbol + timeframe;
    let seed = 0;
    for (let i = 0; i < keyStr.length; i++) seed = keyStr.charCodeAt(i) + ((seed << 5) - seed);
    const rand = (o: number) => { const x = Math.sin(seed + o) * 10000; return x - Math.floor(x); };
    const vMap: Record<string, number> = { "1m": 0.0006, "3m": 0.001, "5m": 0.0015, "15m": 0.0035, "30m": 0.005, "1h": 0.0085, "4h": 0.018, "1d": 0.025 };
    const vol = curPrice * (vMap[timeframe] || 0.0015);
    let lastClose = curPrice;
    for (let i = count - 1; i >= 0; i--) {
      const r1 = rand(i * 3), r2 = rand(i * 3 + 1), r3 = rand(i * 3 + 2);
      const open = lastClose - (r1 - 0.49) * vol;
      const close = lastClose;
      candles.unshift({ time: Date.now() - i * 60000, open, high: Math.max(open, close) + r2 * vol * 0.3, low: Math.min(open, close) - r3 * vol * 0.3, close, volume: Math.floor(r1 * 10000), isGreen: close >= open });
      lastClose = open;
    }
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = curPrice; last.high = Math.max(last.open, curPrice, last.high); last.low = Math.min(last.open, curPrice, last.low); last.isGreen = last.close >= last.open;
    }
    return candles;
  };

  const calcEMA = (candles: Candle[], period: number): number[] => {
    if (candles.length < period) return new Array(candles.length).fill(0);
    const k = 2 / (period + 1);
    const result: number[] = new Array(candles.length).fill(0);
    let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    result[period - 1] = ema;
    for (let i = period; i < candles.length; i++) { ema = candles[i].close * k + ema * (1 - k); result[i] = ema; }
    return result;
  };

  const calcBB = (candles: Candle[], period = 20, mult = 2) => {
    const upper: number[] = [], lower: number[] = [], mid: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) { upper.push(0); lower.push(0); mid.push(0); continue; }
      const sl = candles.slice(i - period + 1, i + 1).map(c => c.close);
      const mean = sl.reduce((s, v) => s + v, 0) / period;
      const std = Math.sqrt(sl.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
      upper.push(mean + mult * std); lower.push(mean - mult * std); mid.push(mean);
    }
    return { upper, lower, mid };
  };

  const calcVWAP = (candles: Candle[]): number[] => {
    let cpv = 0, cv = 0;
    return candles.map(c => { const tp = (c.high + c.low + c.close) / 3; cpv += tp * c.volume; cv += c.volume; return cv > 0 ? cpv / cv : tp; });
  };

  const calcRSI = (candles: Candle[], period = 14): number[] => {
    if (candles.length <= period) return new Array(candles.length).fill(50);
    const result = new Array(period).fill(50);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) { const d = candles[i].close - candles[i - 1].close; if (d > 0) gains += d; else losses -= d; }
    let ag = gains / period, al = losses / period;
    result[period] = 100 - 100 / (1 + ag / (al || 0.0001));
    for (let i = period + 1; i < candles.length; i++) {
      const d = candles[i].close - candles[i - 1].close;
      ag = (ag * (period - 1) + Math.max(d, 0)) / period; al = (al * (period - 1) + Math.max(-d, 0)) / period;
      result.push(100 - 100 / (1 + ag / (al || 0.0001)));
    }
    return result;
  };
  const drawPane = (pi: number) => {
    const canvas = canvasRefs[pi]; const container = containerRefs[pi];
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = container.clientWidth, H = container.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    canvas.width = W * dpi; canvas.height = H * dpi; ctx.scale(dpi, dpi);
    const isDark = props.theme() === "dark";
    ctx.fillStyle = isDark ? "#0b0e11" : "#ffffff"; ctx.fillRect(0, 0, W, H);
    const candles = paneCandles()[pi];
    if (!candles || candles.length === 0) {
      ctx.fillStyle = isDark ? "#52525b" : "#9ca3af"; ctx.font = "11px Inter,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Loading " + activeSymbol() + " " + paneTimeframes()[pi] + "...", W / 2, H / 2);
      return;
    }
    const padR = 72, padB = 22;
    const hasRSI = showRSI() && pi === selectedPane();
    const rsiH = hasRSI ? 78 : 0;
    const plotW = W - padR; const mainH = H - padB - rsiH;
    const panX = panePanX()[pi]; const zoom = paneZoom()[pi];
    const step = plotW / zoom; const cWidth = Math.max(step * 0.7, 1);
    const visPrices = candles.filter((_, i) => {
      const k = (candles.length - 1) - i;
      const x = plotW - step * (k + 1) + panX;
      return x + step >= 0 && x <= plotW;
    }).flatMap(c => [c.low, c.high]);
    const autoMin = visPrices.length ? Math.min(...visPrices) : 0;
    const autoMax = visPrices.length ? Math.max(...visPrices) : 1;
    let minP = autoMin, maxP = autoMax;
    if (paneAutoScale()[pi]) {
      const r = autoMax - autoMin || 1;
      minP = autoMin - r * 0.10; maxP = autoMax + r * 0.10;
      const mn = [...paneManualMin()]; mn[pi] = minP; setPaneManualMin(mn);
      const mx = [...paneManualMax()]; mx[pi] = maxP; setPaneManualMax(mx);
    } else { minP = paneManualMin()[pi] || autoMin; maxP = paneManualMax()[pi] || autoMax; }
    const prR = maxP - minP || 1;
    const toY = (v: number) => ((maxP - v) / prR) * mainH;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)"; 
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i <= 5; i++) {
      const y = (mainH / 5) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    }
    for (let i = 0; i <= zoom; i += Math.max(1, Math.ceil(zoom / 6))) {
      ctx.beginPath(); ctx.moveTo((plotW / zoom) * i, 0); ctx.lineTo((plotW / zoom) * i, mainH); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = isDark ? "#1f2226" : "#e4e4e7";
    ctx.beginPath(); ctx.moveTo(plotW, 0); ctx.lineTo(plotW, H); ctx.stroke();
    for (let i = 0; i <= 5; i++) {
      ctx.fillStyle = isDark ? "#8f9298" : "#9ca3af"; ctx.font = "9px JetBrains Mono,monospace"; ctx.textAlign = "left";
      const lv = maxP - (prR / 5) * i;
      ctx.fillText(lv.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 5, (mainH / 5) * i + 2);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, plotW, mainH); ctx.clip();
    const maxVol = Math.max(...candles.map(c => c.volume), 1);
    candles.forEach((c, i) => {
      const k = (candles.length - 1) - i; const x = plotW - step * (k + 1) + panX;
      if (x + step < 0 || x > plotW) return;
      const vh = (c.volume / maxVol) * mainH * 0.14;
      ctx.fillStyle = c.isGreen ? (isDark ? "rgba(38,166,154,0.15)" : "rgba(38,166,154,0.10)") : (isDark ? "rgba(239,83,80,0.15)" : "rgba(239,83,80,0.10)");
      ctx.fillRect(x + (step - cWidth) / 2, mainH - vh, cWidth, vh);
    });
    if (showBB()) {
      const bb = calcBB(candles);
      const keys = ["upper", "lower", "mid"] as const;
      keys.forEach((key, ki) => {
        ctx.strokeStyle = ki === 2 ? "rgba(250,180,50,0.55)" : "rgba(100,160,255,0.4)";
        ctx.lineWidth = ki === 2 ? 1.2 : 1; ctx.setLineDash(ki === 2 ? [] : [3, 3]);
        ctx.beginPath(); let fp = true;
        candles.forEach((_, i) => {
          const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
          if (x + step < 0 || x > plotW) return;
          const val = bb[key][i]; if (!val) return; const y = toY(val);
          if (fp) { ctx.moveTo(x + step / 2, y); fp = false; } else ctx.lineTo(x + step / 2, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
      });
    }
    if (showVWAP()) {
      const vwap = calcVWAP(candles);
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5; ctx.beginPath(); let fp = true;
      candles.forEach((_, i) => {
        const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
        if (x + step < 0 || x > plotW) return; const y = toY(vwap[i]);
        if (fp) { ctx.moveTo(x + step / 2, y); fp = false; } else ctx.lineTo(x + step / 2, y);
      });
      ctx.stroke();
    }
    if (showEMA20()) {
      const ema = calcEMA(candles, 20);
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 1.2; ctx.beginPath(); let fp = true;
      candles.forEach((_, i) => {
        if (!ema[i]) return; const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
        if (x + step < 0 || x > plotW) return; const y = toY(ema[i]);
        if (fp) { ctx.moveTo(x + step / 2, y); fp = false; } else ctx.lineTo(x + step / 2, y);
      });
      ctx.stroke();
    }
    if (showEMA50()) {
      const ema = calcEMA(candles, 50);
      ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 1.2; ctx.beginPath(); let fp = true;
      candles.forEach((_, i) => {
        if (!ema[i]) return; const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
        if (x + step < 0 || x > plotW) return; const y = toY(ema[i]);
        if (fp) { ctx.moveTo(x + step / 2, y); fp = false; } else ctx.lineTo(x + step / 2, y);
      });
      ctx.stroke();
    }
    const colorG = "#26a69a", colorR = "#ef5350";
    candles.forEach((c, i) => {
      const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
      if (x + step < 0 || x > plotW) return;
      const yO = toY(c.open), yC = toY(c.close), yH = toY(c.high), yL = toY(c.low);
      ctx.strokeStyle = c.isGreen ? colorG : colorR; ctx.lineWidth = step < 3 ? 0.8 : 1.2;
      ctx.beginPath(); ctx.moveTo(x + step / 2, yH); ctx.lineTo(x + step / 2, yL); ctx.stroke();
      ctx.fillStyle = c.isGreen ? colorG : colorR;
      ctx.fillRect(x + (step - cWidth) / 2, Math.min(yO, yC), Math.max(cWidth, 1), Math.max(Math.abs(yC - yO), 1.5));
    });
    const ltp = candles[candles.length - 1].close;
    const ltpY = toY(ltp);
    const ltpColor = candles[candles.length - 1].isGreen ? colorG : colorR;
    ctx.strokeStyle = ltpColor + "50"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, ltpY); ctx.lineTo(plotW, ltpY); ctx.stroke(); ctx.setLineDash([]);
    const ch = paneCrosshair()[pi];
    if (ch && ch.x < plotW && ch.y < mainH) {
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ch.x, 0); ctx.lineTo(ch.x, mainH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ch.y); ctx.lineTo(plotW, ch.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    const cLtpY = Math.max(8, Math.min(mainH - 8, ltpY));
    ctx.fillStyle = ltpColor; ctx.fillRect(plotW + 2, cLtpY - 9, 68, 18);
    ctx.fillStyle = "#fff"; ctx.font = "bold 8.5px JetBrains Mono,monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 5, cLtpY);
    if (ch && ch.x < plotW && ch.y < mainH) {
      const pAtCh = maxP - (ch.y / mainH) * prR;
      const cChY = Math.max(8, Math.min(mainH - 8, ch.y));
      ctx.fillStyle = isDark ? "#3f3f46" : "#374151"; ctx.fillRect(plotW + 2, cChY - 8, 68, 16);
      ctx.fillStyle = "#fff"; ctx.font = "8px JetBrains Mono,monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(pAtCh.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 5, cChY);
    }
    if (hasRSI && rsiH > 0) {
      const rsiTop = mainH + 1;
      ctx.strokeStyle = isDark ? "#27272a" : "#e4e4e7"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, rsiTop); ctx.lineTo(W, rsiTop); ctx.stroke();
      ctx.fillStyle = isDark ? "rgba(18,18,22,0.97)" : "rgba(250,250,252,0.97)"; ctx.fillRect(0, rsiTop, plotW, rsiH);
      ctx.fillStyle = isDark ? "#52525b" : "#9ca3af"; ctx.font = "8px JetBrains Mono,monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("RSI(14)", 4, rsiTop + 3);
      const rsiData = calcRSI(candles);
      const rtY = (v: number) => rsiTop + ((100 - v) / 100) * (rsiH - 14) + 7;
      [30, 50, 70].forEach(lvl => {
        ctx.strokeStyle = lvl === 50 ? "rgba(120,120,140,0.35)" : "rgba(220,100,100,0.3)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(0, rtY(lvl)); ctx.lineTo(plotW, rtY(lvl)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = isDark ? "#52525b" : "#9ca3af"; ctx.font = "7px JetBrains Mono,monospace"; ctx.textAlign = "left";
        ctx.fillText(String(lvl), plotW + 3, rtY(lvl) - 3);
      });
      ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 1.2; ctx.beginPath(); let rfp = true;
      candles.forEach((_, i) => {
        const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX;
        if (x + step < 0 || x > plotW || !rsiData[i]) return; const y = rtY(rsiData[i]);
        if (rfp) { ctx.moveTo(x + step / 2, y); rfp = false; } else ctx.lineTo(x + step / 2, y);
      });
      ctx.stroke();
    }
    const skip = Math.max(1, Math.floor(zoom / 5));
    ctx.fillStyle = isDark ? "#52525b" : "#9ca3af"; ctx.font = "7.5px JetBrains Mono,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const tf = paneTimeframes()[pi];
    const fmt = (t: number) => { const d = new Date(t); return tf === "1d" || tf === "4h" ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }); };
    candles.forEach((c, i) => {
      if (i % skip !== 0) return; const k2 = (candles.length - 1) - i; const x = plotW - step * (k2 + 1) + panX + step / 2;
      if (x < 0 || x > plotW) return; ctx.fillText(fmt(c.time), x, mainH + rsiH + 4);
    });
  };

  const drawAllPanes = () => { for (let i = 0; i < activePaneCount(); i++) drawPane(i); };
  const handleResize = () => { cancelAnimationFrame(animFrameId); animFrameId = requestAnimationFrame(drawAllPanes); };

  const loadPaneCandles = async (pi: number) => {
    const sym = activeSymbol(), tf = paneTimeframes()[pi];
    let candles = await fetchCandles(sym, tf);
    if (!candles || candles.length === 0) candles = generateCandles(sym, tf, 150);
    const all = [...paneCandles()]; all[pi] = candles; setPaneCandles(all);
  };

  createEffect(() => { activeSymbol(); for (let i = 0; i < MAX_PANES; i++) loadPaneCandles(i); });
  for (let i = 0; i < MAX_PANES; i++) { createEffect(() => { paneTimeframes()[i]; loadPaneCandles(i); }); }

  createEffect(() => {
    props.theme(); activeSymbol(); gridLayout(); selectedPane();
    panePanX(); paneZoom(); paneAutoScale(); paneManualMin(); paneManualMax();
    paneCrosshair(); paneCandles(); paneTimeframes(); showEMA20(); showEMA50(); showVWAP(); showBB(); showRSI();
    store.symbols[activeSymbol()]?.price; handleResize();
  });

  onMount(() => {
    drawAllPanes(); window.addEventListener("resize", handleResize);
    const gup = () => { isDragging.fill(false); dragArea.fill(null); };
    window.addEventListener("mouseup", gup);
    const closeDropdowns = () => {
      setOpenTfDropdownPane(null);
      setOpenIndDropdownPane(null);
    };
    window.addEventListener("click", closeDropdowns);
    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mouseup", gup);
      window.removeEventListener("click", closeDropdowns);
      cancelAnimationFrame(animFrameId);
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
    });
  });

  const onMouseDown = (pi: number) => (e: MouseEvent) => {
    e.preventDefault(); const canvas = canvasRefs[pi]; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pW = canvas.width / (window.devicePixelRatio || 1) - 72;
    const pH = canvas.height / (window.devicePixelRatio || 1) - 22;
    let area: "grid" | "yaxis" | "xaxis" = "grid";
    if (x > pW) area = "yaxis"; else if (y > pH) area = "xaxis";
    isDragging[pi] = true; dragArea[pi] = area; dragStartX[pi] = e.clientX; dragStartY[pi] = e.clientY;
    dragStartPanX[pi] = panePanX()[pi]; dragStartZoom[pi] = paneZoom()[pi];
    dragStartMin[pi] = paneManualMin()[pi]; dragStartMax[pi] = paneManualMax()[pi];
    setSelectedPane(pi);
  };

  const onMouseMove = (pi: number) => (e: MouseEvent) => {
    const canvas = canvasRefs[pi]; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pH = rect.height - 22;
    if (isDragging[pi]) {
      const dX = e.clientX - dragStartX[pi], dY = e.clientY - dragStartY[pi];
      if (dragArea[pi] === "yaxis") {
        const as = [...paneAutoScale()]; as[pi] = false; setPaneAutoScale(as);
        const r = dragStartMax[pi] - dragStartMin[pi], f = 1 + dY * 0.005;
        const center = (dragStartMax[pi] + dragStartMin[pi]) / 2;
        const mn = [...paneManualMin()]; mn[pi] = center - (r / 2) * f; setPaneManualMin(mn);
        const mx = [...paneManualMax()]; mx[pi] = center + (r / 2) * f; setPaneManualMax(mx);
      } else if (dragArea[pi] === "xaxis") {
        const zm = [...paneZoom()]; zm[pi] = Math.max(10, Math.min(180, dragStartZoom[pi] - dX * 0.2)); setPaneZoom(zm);
      } else {
        const px = [...panePanX()]; px[pi] = dragStartPanX[pi] + dX; setPanePanX(px);
        if (!paneAutoScale()[pi]) {
          const r = dragStartMax[pi] - dragStartMin[pi], pd = (dY / pH) * r;
          const mn = [...paneManualMin()]; mn[pi] = dragStartMin[pi] + pd; setPaneManualMin(mn);
          const mx = [...paneManualMax()]; mx[pi] = dragStartMax[pi] + pd; setPaneManualMax(mx);
        }
      }
    } else { const ch = [...paneCrosshair()]; ch[pi] = { x, y }; setPaneCrosshair(ch); }
  };

  const onMouseUp = (pi: number) => () => { isDragging[pi] = false; dragArea[pi] = null; };
  const onMouseLeave = (pi: number) => () => {
    isDragging[pi] = false; dragArea[pi] = null;
    const ch = [...paneCrosshair()]; ch[pi] = null; setPaneCrosshair(ch);
  };
  const onWheel = (pi: number) => (e: WheelEvent) => {
    e.preventDefault(); const zm = [...paneZoom()]; zm[pi] = Math.max(10, Math.min(180, zm[pi] + (e.deltaY > 0 ? 4 : -4))); setPaneZoom(zm);
  };
  const onDblClick = (pi: number) => () => {
    const as = [...paneAutoScale()]; as[pi] = true; setPaneAutoScale(as);
    const px = [...panePanX()]; px[pi] = 0; setPanePanX(px);
  };

  const setTF = (pi: number, tf: string) => { const tfs = [...paneTimeframes()]; tfs[pi] = tf; setPaneTimeframes(tfs); };
  const getOHLCV = (pi: number) => { const c = paneCandles()[pi]; return c && c.length ? c[c.length - 1] : null; };

  const getGridStyle = () => {
    const l = gridLayout();
    if (l === "1x1") return { display: "grid", "grid-template-columns": "1fr", "grid-template-rows": "1fr" };
    if (l === "1x2") return { display: "grid", "grid-template-columns": "1fr 1fr", "grid-template-rows": "1fr" };
    if (l === "2x1") return { display: "grid", "grid-template-columns": "1fr", "grid-template-rows": "1fr 1fr" };
    if (l === "2x2") return { display: "grid", "grid-template-columns": "1fr 1fr", "grid-template-rows": "1fr 1fr" };
    if (l === "1x3") return { display: "grid", "grid-template-columns": "1fr 1fr 1fr", "grid-template-rows": "1fr" };
    return {};
  };

  const sym = () => store.symbols[activeSymbol()];
  const symName = () => sym()?.name || activeSymbol();
  return (
    <div class="charts-root">
      <div class="charts-toolbar">
        <div class="ctb-sym-info">
          <span class="ctb-sym-name">{symName()}</span>
          <Show when={sym()}>
            <span class={`ctb-sym-price ${sym()!.up ? "up" : "down"}`}>
              Rs.{sym()!.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span class={`ctb-sym-chg ${sym()!.up ? "up" : "down"}`}>
              {sym()!.up ? "+" : ""}{sym()!.change.toFixed(2)} ({sym()!.pct.toFixed(2)}%)
            </span>
            <span class="ctb-ohlc">O:{sym()!.open?.toFixed(2)} H:{sym()!.high?.toFixed(2)} L:{sym()!.low?.toFixed(2)}</span>
          </Show>
        </div>
        <div class="ctb-right-controls">
          <div style={{ position: "relative" }}>
            <button class={`ctb-btn ${showGridPicker() ? "active" : ""}`} onClick={() => setShowGridPicker(g => !g)} title="Layout">
              Layout: {gridLayout()}
            </button>
            <Show when={showGridPicker()}>
              <div class="grid-picker-dropdown">
                <div class="gpd-title">Chart Layout</div>
                <div class="gpd-grid">
                  <For each={Object.entries(GRID_CONFIGS) as [GridLayout, { label: string; panes: number }][]}>
                    {([key, cfg]) => (
                      <button class={`gpd-btn ${gridLayout() === key ? "active" : ""}`} onClick={() => { setGridLayout(key); setShowGridPicker(false); }}>
                        <div class={"gpd-thumb gpd-" + key}/>
                        <span>{cfg.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
          <button class={`ctb-btn ${scalpingMode() ? "ctb-scalp-active" : ""}`} onClick={() => { setScalpingMode(s => !s); setRightTab("scalp"); }}>
            Scalp Mode
          </button>
        </div>

      </div>

      <div class="charts-body" ref={chartsBodyRef}>
        <div class="charts-panes-wrapper">
          <div class="charts-panes-grid" style={getGridStyle()}>
            <For each={Array.from({ length: activePaneCount() }, (_, i) => i)}>
              {(pi) => {
                const ohlcv = () => getOHLCV(pi);
                return (
                  <div class={`chart-pane-cell ${selectedPane() === pi ? "selected" : ""}`} onClick={() => setSelectedPane(pi)}>
                    
                    {/* Nested Top Toolbar docked at cell top */}
                    <div class="chart-cell-top-bar">
                      <div class="cctb-left">
                        <div class="cctb-indicator" classList={{ active: selectedPane() === pi }} />
                        <span class="cctb-sym">{symName()}</span>
                        <span class="cctb-dot">·</span>
                        <span class="cctb-tf">{paneTimeframes()[pi]}</span>
                        
                        <div class="cctb-sep" />
                        
                        <For each={scalpingMode() ? SCALP_TFS : ["5m", "15m", "1h"]}>
                          {(tf) => (
                            <button class={`cctb-btn ${paneTimeframes()[pi] === tf ? "active" : ""}`}
                              onClick={(e) => { e.stopPropagation(); setTF(pi, tf); }}>
                              {tf}
                            </button>
                          )}
                        </For>
                        
                        <div style={{ position: "relative" }}>
                          <button class={`cctb-btn ${!(scalpingMode() ? SCALP_TFS : ["5m", "15m", "1h"]).includes(paneTimeframes()[pi]) ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTfDropdownPane(curr => curr === pi ? null : pi);
                            }}
                          >
                            <span>{!(scalpingMode() ? SCALP_TFS : ["5m", "15m", "1h"]).includes(paneTimeframes()[pi]) ? paneTimeframes()[pi] : "More"}</span>
                            <span class="tf-arrow">▼</span>
                          </button>
                          
                          <Show when={openTfDropdownPane() === pi}>
                            <div class="tf-dropdown-list" onClick={(e) => e.stopPropagation()}>
                              <For each={ALL_TFS}>
                                {(tf) => (
                                  <button class={`tf-dropdown-item ${paneTimeframes()[pi] === tf ? "selected" : ""}`}
                                    onClick={() => {
                                      setTF(pi, tf);
                                      setOpenTfDropdownPane(null);
                                    }}
                                  >
                                    {tf}
                                  </button>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                        
                        <div class="cctb-sep" />
                        
                        <button class="cctb-icon-btn active" title="Candlesticks">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="4" height="16" fill="currentColor"/><line x1="7" y1="2" x2="7" y2="4"/><line x1="7" y1="20" x2="7" y2="22"/><rect x="15" y="8" width="4" height="8" fill="currentColor"/><line x1="17" y1="4" x2="17" y2="8"/><line x1="17" y1="16" x2="17" y2="20"/></svg>
                        </button>
                        <button class="cctb-icon-btn" title="Area">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18V8l-6 4-6-6-6 6v8z" fill="rgba(38,166,154,0.08)" stroke="currentColor"/></svg>
                        </button>
                        <button class="cctb-icon-btn" title="Line">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 18 9 12 15 14 21 6"/></svg>
                        </button>

                        <div class="cctb-sep" />

                        <div style={{ position: "relative" }}>
                          <button class={`cctb-btn cctb-action-btn ${openIndDropdownPane() === pi ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenIndDropdownPane(curr => curr === pi ? null : pi);
                            }}
                          >
                            <span class="btn-icon">fx</span>
                            <span>Indicators</span>
                          </button>
                          
                          <Show when={openIndDropdownPane() === pi}>
                            <div class="ind-dropdown-list" onClick={(e) => e.stopPropagation()}>
                              <For each={[
                                { label: "EMA 20", active: showEMA20, set: setShowEMA20 },
                                { label: "EMA 50", active: showEMA50, set: setShowEMA50 },
                                { label: "VWAP",   active: showVWAP,  set: setShowVWAP  },
                                { label: "Bollinger Bands", active: showBB, set: setShowBB },
                                { label: "RSI (14)", active: showRSI, set: setShowRSI },
                              ]}>
                                {(ind) => (
                                  <div class="ind-dropdown-item" onClick={() => ind.set((v: boolean) => !v)}>
                                    <span class="ind-checkbox-box">
                                      <Show when={ind.active()}>
                                        <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </Show>
                                    </span>
                                    <span class="ind-dropdown-lbl">{ind.label}</span>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                        
                        <button class="cctb-btn cctb-action-btn">
                          <span class="btn-icon">+</span>
                          <span>Compare</span>
                        </button>
                      </div>

                      <div class="cctb-right">
                        <button class="cctb-icon-btn" onClick={(e) => { e.stopPropagation(); onDblClick(pi)(); }} title="Reset View">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
                        </button>
                        <button class="cctb-icon-btn" title="Maximize">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                        <button class="cctb-icon-btn" title="Screenshot">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                        <button class="cctb-icon-btn" title="Settings">
                          <svg class="cctb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Integrated Left Toolbar and Viewport Body */}
                    <div class="chart-cell-body">
                      <div class="chart-cell-draw-tb">
                        <For each={DRAW_TOOLS}>
                          {(tool) => (
                            <button class={`draw-tool-btn ${drawTool() === tool.id ? "active" : ""}`} onClick={() => setDrawTool(tool.id)} title={tool.label}>
                              {getToolIcon(tool.id)}
                            </button>
                          )}
                        </For>
                        <div class="draw-sep"/>
                        <button class="draw-tool-btn draw-clear-btn" onClick={() => setDrawTool("crosshair")} title="Clear Drawings">
                          <svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>

                      <div class="chart-cell-viewport-wrapper">
                        <Show when={ohlcv()}>
                          {(() => {
                            const c = ohlcv()!;
                            const isUp = c.close >= c.open;
                            const chg = ((c.close - c.open) / c.open * 100).toFixed(2);
                            return (
                              <div class="ohlcv-overlay">
                                <div class="ohlcv-meta-row">
                                  <span class="ohlcv-meta">{symName()} · {paneTimeframes()[pi]} · NSE</span>
                                  <span class="ohlcv-item">O<span class={`ohlcv-v ${isUp ? "up" : "down"}`}>{c.open.toFixed(2)}</span></span>
                                  <span class="ohlcv-item">H<span class={`ohlcv-v ${isUp ? "up" : "down"}`}>{c.high.toFixed(2)}</span></span>
                                  <span class="ohlcv-item">L<span class={`ohlcv-v ${isUp ? "up" : "down"}`}>{c.low.toFixed(2)}</span></span>
                                  <span class="ohlcv-item">C<span class={`ohlcv-v ${isUp ? "up" : "down"}`}>{c.close.toFixed(2)}</span></span>
                                  <span class={`ohlcv-chg ${isUp ? "up" : "down"}`}>{isUp ? "+" : ""}{chg}%</span>
                                </div>
                                <div class="ohlcv-vol-row">
                                  <span class="ohlcv-item">Volume <span class={`ohlcv-v ${isUp ? "up" : "down"}`}>{formatVolume(c.volume)}</span></span>
                                </div>
                              </div>
                            );
                          })()}
                        </Show>

                        <div class="chart-pane-viewport" ref={(el) => { containerRefs[pi] = el; }}>
                          <canvas class="chart-canvas" ref={(el) => { canvasRefs[pi] = el; }}
                            style={{ width: "100%", height: "100%", cursor: drawTool() === "crosshair" ? "crosshair" : "default" }}
                            onMouseDown={onMouseDown(pi)} onMouseMove={onMouseMove(pi)} onMouseUp={onMouseUp(pi)}
                            onMouseLeave={onMouseLeave(pi)} onWheel={onWheel(pi)} onDblClick={onDblClick(pi)}
                          />
                        </div>
                      </div>
                    </div>

                    <Show when={scalpingMode()}>
                      <div class="scalp-overlay">
                        <button class="scalp-ov-sell" onClick={(e) => e.stopPropagation()}>SELL {scalpQty()}</button>
                        <span class="scalp-ov-price">{sym()?.price.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "--"}</span>
                        <button class="scalp-ov-buy" onClick={(e) => e.stopPropagation()}>BUY {scalpQty()}</button>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={isRightPanelExpanded()}>
          <div class="charts-resize-handle" onMouseDown={onResizeMouseDown} />
        </Show>

        <div class="charts-right-panel" style={{
          width: isRightPanelExpanded() ? `${rightPanelWidth() + 44}px` : "44px",
          "min-width": isRightPanelExpanded() ? `${rightPanelWidth() + 44}px` : "44px"
        }}>
          <div class="rp-tab-strip">
            <For each={RIGHT_TABS}>
              {(tab) => (
                <button class={`rp-tab ${rightTab() === tab.id && isRightPanelExpanded() ? "active" : ""}`} onClick={() => handleTabClick(tab.id)} title={tab.label}>
                  <span class="rp-tab-ico">{tab.icon}</span>
                  <span class="rp-tab-lbl">{tab.label}</span>
                </button>
              )}
            </For>
          </div>
          <Show when={isRightPanelExpanded()}>
            <div class="rp-body" style={{ width: `${rightPanelWidth()}px` }}>
            <Show when={rightTab() === "watchlist"}>
              <div class="rp-title">Watchlist</div>
              <div class="watchlist-tabs" style={{ padding: "4px 8px" }}>
                <For each={["Index", "Stocks", "Options"]}>
                  {(tab) => (
                    <button class={`wl-tab ${activeWatchlistTab() === tab ? "active" : ""}`} onClick={() => setActiveWatchlistTab(tab)}>
                      {tab === "Index" ? "Indices" : tab}
                    </button>
                  )}
                </For>
              </div>
              <div class="watchlist-items">
                <For each={getWatchlistItems()}>
                  {(item) => (
                    <div class={`wl-item ${activeSymbol() === item.key ? "active" : ""}`} onClick={() => setActiveSymbol(item.key)}>
                      <div class="wl-item-left">
                        <span class="wl-item-name">{item.name}</span>
                        <span class="wl-item-desc">NSE</span>
                      </div>
                      <div class="wl-item-right">
                        <span class="wl-item-price">{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        <span class={`wl-item-change ${item.up ? "up" : "down"}`}>{item.up ? "+" : ""}{item.pct.toFixed(2)}%</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={rightTab() === "scalp"}>
              <div class="rp-title">Scalp Pad</div>
              <div class="scalp-pad">
                <div class="sp-sym-row">
                  <span class="sp-sym">{symName()}</span>
                  <span class={`sp-price ${sym()?.up ? "up" : "down"}`}>{sym()?.price.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "--"}</span>
                </div>
                <div class="sp-label">Quantity</div>
                <div class="sp-qty-row">
                  <button class="sp-step" onClick={() => setScalpQty(q => Math.max(1, q - 1))}>-</button>
                  <span class="sp-qty">{scalpQty()}</span>
                  <button class="sp-step" onClick={() => setScalpQty(q => q + 1)}>+</button>
                </div>
                <div class="sp-quick-qtys">
                  <For each={[1, 5, 10, 25, 50]}>
                    {(q) => <button class={`sp-q ${scalpQty() === q ? "active" : ""}`} onClick={() => setScalpQty(q)}>{q}</button>}
                  </For>
                </div>
                <div class="sp-label">Product</div>
                <div class="sp-prod-row">
                  <button class={`sp-prod ${scalpProd() === "MIS" ? "active" : ""}`} onClick={() => setScalpProd("MIS")}>MIS</button>
                  <button class={`sp-prod ${scalpProd() === "NRML" ? "active" : ""}`} onClick={() => setScalpProd("NRML")}>NRML</button>
                </div>
                <div class="sp-trade-btns">
                  <button class="sp-buy"><span>BUY</span><span class="sp-btn-sub">{scalpQty()} MKT</span></button>
                  <button class="sp-sell"><span>SELL</span><span class="sp-btn-sub">{scalpQty()} MKT</span></button>
                </div>
                <div class="sp-risk-box">
                  <div class="sp-risk-row"><span>Est. Value</span><span>{((sym()?.price || 0) * scalpQty()).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</span></div>
                  <div class="sp-risk-row"><span>1 Tick P&L</span><span class="up">+{(scalpQty() * 0.05).toFixed(2)}</span></div>
                  <div class="sp-risk-row"><span>Margin (MIS)</span><span>{((sym()?.price || 0) * scalpQty() * 0.15).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</span></div>
                </div>
                <div class="sp-label">Positions</div>
                <Show when={store.positions.length === 0}>
                  <div class="sp-no-pos">No open positions</div>
                </Show>
                <For each={store.positions.slice(0, 5)}>
                  {(pos) => (
                    <div class="sp-pos-row">
                      <span class="sp-pos-sym">{pos.inst}</span>
                      <span class={`sp-pos-pnl ${pos.up ? "up" : "down"}`}>{pos.up ? "+" : ""}Rs.{pos.pnl.toFixed(0)}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={rightTab() === "indicators"}>
              <div class="rp-title">Indicators</div>
              <div class="ind-list">
                <For each={[
                  { label: "EMA 20", color: "#60a5fa", active: showEMA20, set: setShowEMA20 },
                  { label: "EMA 50", color: "#a78bfa", active: showEMA50, set: setShowEMA50 },
                  { label: "VWAP",   color: "#f59e0b", active: showVWAP,  set: setShowVWAP  },
                  { label: "Bollinger Bands", color: "#64a8ff", active: showBB, set: setShowBB },
                  { label: "RSI (14)", color: "#818cf8", active: showRSI, set: setShowRSI },
                ]}>
                  {(ind) => (
                    <div class={`ind-item ${ind.active() ? "on" : ""}`} onClick={() => ind.set((v: boolean) => !v)}>
                      <div class="ind-dot" style={{ background: ind.color }}/>
                      <span class="ind-lbl">{ind.label}</span>
                      <div class={`ind-toggle ${ind.active() ? "on" : ""}`}><div class="ind-knob"/></div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={rightTab() === "tools"}>
              <div class="rp-title">Drawing Tools</div>
              <div class="tools-list">
                <For each={DRAW_TOOLS}>
                  {(tool) => (
                    <button class={`tool-item ${drawTool() === tool.id ? "active" : ""}`} onClick={() => setDrawTool(tool.id)}>
                      <span class="tool-lbl">{tool.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={rightTab() === "settings"}>
              <div class="rp-title">Settings</div>
              <div class="cfg-list">
                <For each={[
                  { label: "Candle Type", val: "Candlestick" }, { label: "Scale", val: "Auto" },
                  { label: "Data", val: "KOTAK NEO" }, { label: "TZ", val: "IST +5:30" },
                ]}>
                  {(s) => <div class="cfg-row"><span class="cfg-label">{s.label}</span><span class="cfg-val">{s.val}</span></div>}
                </For>
              </div>
              <div class="rp-title" style={{ "margin-top": "10px" }}>Pane Timeframes</div>
              <div class="cfg-list">
                <For each={Array.from({ length: activePaneCount() }, (_, i) => i)}>
                  {(pi) => (
                    <div class="cfg-row" style={{ "align-items": "center" }}>
                      <span class="cfg-label">Pane {pi + 1}</span>
                      <div style={{ display: "flex", gap: "3px" }}>
                        <For each={["5m", "15m", "1h", "1d"]}>
                          {(tf) => (
                            <button class={`mini-tf-btn ${paneTimeframes()[pi] === tf ? "active" : ""}`} onClick={() => setTF(pi, tf)}>{tf}</button>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};