import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { store, fetchCandles, addNotification, placeRealOrder } from "../../store/tradingStore";
import type { Candle } from "../../store/tradingStore";
import "./charts.css";

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

type TF = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
type Layout = "1x1" | "1x2" | "2x1" | "2x2";
type RPanel = "watchlist" | "scalp" | "settings";

const TF_LIST: TF[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];
const LAYOUT_PANES: Record<Layout, number> = { "1x1": 1, "1x2": 2, "2x1": 2, "2x2": 4 };
const Y_AXIS_W = 72;
const X_AXIS_H = 20;

// ═══════════════════════════════════════════════════════════════
// MOCK DATA (fallback when broker not connected)
// ═══════════════════════════════════════════════════════════════

const MOCK_BASE: Record<string, number> = {
  "NIFTY 50": 24200, "BANKNIFTY": 52100, "FINNIFTY": 23810,
  "RELIANCE": 2990, "HDFCBANK": 1756, "TCS": 4130,
  "INFY": 1621, "ICICIBANK": 1286, "KOTAKBANK": 2044, "SBIN": 836,
};
const TF_MS: Record<string, number> = {
  "1m": 60e3, "3m": 180e3, "5m": 300e3, "15m": 900e3,
  "30m": 1800e3, "1h": 3600e3, "4h": 14400e3, "1d": 86400e3,
};

function makeMock(symbol: string, tf: string, count = 300): Candle[] {
  const base = MOCK_BASE[symbol] ?? 1000;
  let s = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ^ tf.charCodeAt(0) * 7;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const ms = TF_MS[tf] ?? 900e3;
  let price = base;
  let t = Date.now() - count * ms;
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const range = price * 0.008;
    const open = price;
    const close = price * (1 + (rng() - 0.47) * 0.014);
    const high = Math.max(open, close) + rng() * range * 0.4;
    const low = Math.min(open, close) - rng() * range * 0.4;
    out.push({ time: t, open, high, low, close, volume: Math.floor(rng() * 900000 + 80000), isGreen: close >= open });
    price = close;
    t += ms;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════

function calcEMA(data: Candle[], p: number): number[] {
  const k = 2 / (p + 1);
  const r: number[] = new Array(data.length).fill(NaN);
  if (data.length < p) return r;
  let val = data.slice(0, p).reduce((a, c) => a + c.close, 0) / p;
  r[p - 1] = val;
  for (let i = p; i < data.length; i++) { val = data[i].close * k + val * (1 - k); r[i] = val; }
  return r;
}

function calcVWAP(data: Candle[]): number[] {
  let cv = 0, cpv = 0;
  return data.map(c => { const tp = (c.high + c.low + c.close) / 3; cv += c.volume; cpv += tp * c.volume; return cv > 0 ? cpv / cv : c.close; });
}

function calcBB(data: Candle[], p = 20): { u: number[]; m: number[]; l: number[] } {
  const u: number[] = [], m: number[] = [], l: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < p - 1) { u.push(NaN); m.push(NaN); l.push(NaN); continue; }
    const sl = data.slice(i - p + 1, i + 1).map(c => c.close);
    const avg = sl.reduce((a, b) => a + b, 0) / p;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - avg) ** 2, 0) / p);
    u.push(avg + 2 * std); m.push(avg); l.push(avg - 2 * std);
  }
  return { u, m, l };
}

function calcRSI(data: Candle[], p = 14): number[] {
  const r: number[] = new Array(data.length).fill(NaN);
  if (data.length < p + 1) return r;
  let ag = 0, al = 0;
  for (let i = 1; i <= p; i++) {
    const d = data[i].close - data[i - 1].close;
    if (d > 0) ag += d; else al -= d;
  }
  ag /= p; al /= p;
  r[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close;
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
    r[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT THUMBNAIL (sub-component)
// ═══════════════════════════════════════════════════════════════

const LayoutThumb = (props: { l: Layout }) => {
  const rowsMap: Record<Layout, number> = { "1x1": 1, "1x2": 1, "2x1": 2, "2x2": 2 };
  const colsMap: Record<Layout, number> = { "1x1": 1, "1x2": 2, "2x1": 1, "2x2": 2 };
  const rows = rowsMap[props.l];
  const cols = colsMap[props.l];
  return (
    <div class="tv-lt" style={{ "grid-template-columns": `repeat(${cols}, 1fr)`, "grid-template-rows": `repeat(${rows}, 1fr)` }}>
      <For each={Array.from({ length: rows * cols })}>{() => <div class="tv-lt-cell" />}</For>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export interface ChartsPageProps { theme: () => "dark" | "light"; }

export const ChartsPage: Component<ChartsPageProps> = (props) => {
  // ── Core chart state
  const [paneSymbols, setPaneSymbols] = createSignal<string[]>([
    "NIFTY 50",
    "BANKNIFTY",
    "RELIANCE",
    "HDFCBANK"
  ]);
  const symbol = () => paneSymbols()[activePane()];
  const setSymbol = (sym: string) => {
    const next = [...paneSymbols()];
    next[activePane()] = sym;
    setPaneSymbols(next);
  };
  const [layout, setLayout] = createSignal<Layout>("1x1");
  const [paneTFs, setPaneTFs] = createSignal<TF[]>(["15m", "1h", "1d", "5m"]);
  const [paneData, setPaneData] = createSignal<(Candle[] | null)[]>([null, null, null, null]);
  const [hoverCandle, setHoverCandle] = createSignal<(Candle | null)[]>([null, null, null, null]);
  const [activePane, setActivePane] = createSignal(0);

  // ── Chart viewport (per pane)
  const [panX, setPanX] = createSignal<number[]>([0, 0, 0, 0]);
  const [stepW, setStepW] = createSignal<number[]>([10, 10, 10, 10]);
  const [crosshair, setCrosshair] = createSignal<({ x: number; y: number } | null)[]>([null, null, null, null]);
  const [yBounds, setYBounds] = createSignal<({ min: number; max: number } | null)[]>([null, null, null, null]);

  // ── Indicators
  const [showEMA20, setShowEMA20] = createSignal(true);
  const [showEMA50, setShowEMA50] = createSignal(true);
  const [showVWAP, setShowVWAP] = createSignal(false);
  const [showBB, setShowBB] = createSignal(false);
  const [showRSI, setShowRSI] = createSignal(false);

  // ── UI state
  const [rPanel, setRPanel] = createSignal<RPanel | null>(null);
  const [indOpen, setIndOpen] = createSignal(false);
  const [layoutOpen, setLayoutOpen] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [tfDropPane, setTfDropPane] = createSignal<number | null>(null);
  const [scalpQty, setScalpQty] = createSignal(1);

  // ── Refs
  const canvasRefs: (HTMLCanvasElement | undefined)[] = [];
  const bodyRefs: (HTMLDivElement | undefined)[] = [];
  let animId = 0;

  // ── Drag state (mutable — no reactive overhead)
  let isDragging = false;
  let dragPane = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragType: "pan" | "y-scale" = "pan";
  let dragStartLo = 0;
  let dragStartHi = 0;

  // Stores the actual drawn bounds of each pane
  const visibleBounds = [
    { min: 0, max: 0 },
    { min: 0, max: 0 },
    { min: 0, max: 0 },
    { min: 0, max: 0 }
  ];

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  const paneCount = () => LAYOUT_PANES[layout()];
  const symData = () => store.symbols[symbol()];
  const setTF = (pi: number, tf: TF) => { const n = [...paneTFs()]; n[pi] = tf; setPaneTFs(n); };

  const gridStyle = () => {
    const l = layout();
    if (l === "1x2") return { display: "grid", "grid-template-columns": "1fr 1fr" };
    if (l === "2x1") return { display: "grid", "grid-template-rows": "1fr 1fr" };
    if (l === "2x2") return { display: "grid", "grid-template-columns": "1fr 1fr", "grid-template-rows": "1fr 1fr" };
    return {} as any;
  };

  const searchResults = () => {
    const q = search().trim().toUpperCase();
    if (!q) return Object.keys(store.symbols);
    return Object.keys(store.symbols).filter(k => k.toUpperCase().includes(q));
  };

  // Displayed candle for pane header (hover or last)
  const displayedCandle = (pi: number) => hoverCandle()[pi] ?? paneData()[pi]?.at(-1) ?? null;

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────

  const loadPane = async (pi: number) => {
    const sym = paneSymbols()[pi];
    const tf = paneTFs()[pi];
    let data = await fetchCandles(sym, tf);
    if (!data?.length) data = makeMock(sym, tf);
    const next = [...paneData()];
    next[pi] = data;
    setPaneData(next);
  };

  // ─────────────────────────────────────────────────────────────
  // CANVAS RENDERING
  // ─────────────────────────────────────────────────────────────

  const drawPane = (pi: number) => {
    const canvas = canvasRefs[pi];
    const body = bodyRefs[pi];
    if (!canvas || !body) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = body.clientWidth;
    const H = body.clientHeight;
    if (W <= 0 || H <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const dark = props.theme() === "dark";
    const data = paneData()[pi];
    const step = Math.max(3, Math.min(60, stepW()[pi]));
    const px = panX()[pi];

    const plotW = W - Y_AXIS_W;
    const plotH = H - X_AXIS_H;
    const RSI_H = showRSI() ? Math.min(plotH * 0.26, 90) : 0;
    const mainH = plotH - RSI_H;

    // ── Background color (Pure Black / Pure White)
    ctx.fillStyle = dark ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ── Grid border lines (X and Y axis separators)
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    // Vertical separator (Y-axis)
    ctx.beginPath(); ctx.moveTo(plotW, 0); ctx.lineTo(plotW, H); ctx.stroke();
    // Horizontal separator (X-axis)
    ctx.beginPath(); ctx.moveTo(0, plotH); ctx.lineTo(W, plotH); ctx.stroke();

    // ── No data
    if (!data || data.length === 0) {
      ctx.fillStyle = dark ? "#787b86" : "#9ca3af";
      ctx.font = "13px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Connecting…", plotW / 2, mainH / 2);
      return;
    }

    // ── Canvas-space x for candle at index i
    // rightmost candle (i = data.length-1) → x = plotW + px - step/2
    const xOf = (i: number) => plotW + px - (data.length - 1 - i) * step - step / 2;

    // ── Visible range
    let vStart = 0, vEnd = data.length;
    for (let i = 0; i < data.length; i++) {
      if (xOf(i) + step >= 0) { vStart = Math.max(0, i - 1); break; }
    }
    for (let i = data.length - 1; i >= 0; i--) {
      if (xOf(i) - step <= plotW) { vEnd = Math.min(data.length, i + 2); break; }
    }
    const vis = data.slice(vStart, vEnd);
    if (!vis.length) return;

    // ── Y-scale bounds (Auto or Manual drag)
    const manualBounds = yBounds()[pi];
    let lo: number, hi: number;
    if (manualBounds) {
      lo = manualBounds.min;
      hi = manualBounds.max;
    } else {
      let autoLo = Infinity, autoHi = -Infinity;
      vis.forEach(c => { autoLo = Math.min(autoLo, c.low); autoHi = Math.max(autoHi, c.high); });
      const pad = (autoHi - autoLo) * 0.07;
      lo = autoLo - pad;
      hi = autoHi + pad;
    }
    visibleBounds[pi] = { min: lo, max: hi };
    const pRange = hi - lo || 1;
    const toY = (v: number) => ((hi - v) / pRange) * mainH;
    const toP = (y: number) => hi - (y / mainH) * pRange;

    // ── Round-rect helper
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // ── Grid (hairlines)
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.038)" : "rgba(0,0,0,0.058)";
    ctx.lineWidth = 0.5;
    const GRID_N = 5;
    for (let i = 0; i <= GRID_N; i++) {
      const y = Math.round((mainH / GRID_N) * i) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
      // Y-axis price labels (aligned perfectly with decimal precision)
      const p = toP(y);
      ctx.fillStyle = dark ? "#787b86" : "#6b7280";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      if (y > 12 && y < mainH - 12) {
        ctx.fillText(p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 8, y);
      }
    }
    // Sparse vertical grid lines
    const gSkip = Math.max(1, Math.floor(vis.length / 7));
    vis.forEach((_, i) => {
      if ((i + vStart) % gSkip !== 0) return;
      const x = Math.round(xOf(i + vStart)) + 0.5;
      if (x < 0 || x > plotW) return;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mainH); ctx.stroke();
    });

    // ── Clip to chart area
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, plotW, plotH); ctx.clip();

    // ── Volume bars
    const maxVol = Math.max(...vis.map(c => c.volume), 1);
    vis.forEach((c, i) => {
      const x = xOf(i + vStart);
      const cw = Math.max(1, step - 2);
      const vh = Math.max((c.volume / maxVol) * mainH * 0.18, 1);
      ctx.fillStyle = c.isGreen
        ? (dark ? "rgba(38,166,154,0.22)" : "rgba(38,166,154,0.15)")
        : (dark ? "rgba(239,83,80,0.22)" : "rgba(239,83,80,0.15)");
      ctx.fillRect(x - cw / 2, mainH - vh, cw, vh);
    });

    // ── Bollinger Bands
    if (showBB()) {
      const bb = calcBB(data);
      const drawLine = (vals: number[], color: string, lw: number) => {
        ctx.strokeStyle = color; ctx.lineWidth = lw;
        ctx.beginPath(); let fp = true;
        for (let i = vStart; i < vEnd; i++) {
          const v = vals[i]; if (isNaN(v)) continue;
          const x = xOf(i), y = toY(v);
          if (fp) { ctx.moveTo(x, y); fp = false; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      // Fill between bands
      ctx.beginPath(); let fp2 = true;
      for (let i = vStart; i < vEnd; i++) {
        const v = bb.u[i]; if (isNaN(v)) continue;
        if (fp2) { ctx.moveTo(xOf(i), toY(v)); fp2 = false; } else ctx.lineTo(xOf(i), toY(v));
      }
      for (let i = vEnd - 1; i >= vStart; i--) {
        const v = bb.l[i]; if (isNaN(v)) continue;
        ctx.lineTo(xOf(i), toY(v));
      }
      ctx.closePath();
      ctx.fillStyle = dark ? "rgba(100,168,255,0.05)" : "rgba(41,98,255,0.04)";
      ctx.fill();
      drawLine(bb.u, dark ? "rgba(100,168,255,0.55)" : "rgba(41,98,255,0.45)", 1);
      drawLine(bb.m, dark ? "rgba(100,168,255,0.40)" : "rgba(41,98,255,0.35)", 1);
      drawLine(bb.l, dark ? "rgba(100,168,255,0.55)" : "rgba(41,98,255,0.45)", 1);
    }

    // ── EMA / VWAP lines
    const drawIndLine = (vals: number[], color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.3;
      ctx.beginPath(); let fp = true;
      for (let i = vStart; i < vEnd; i++) {
        const v = vals[i]; if (isNaN(v)) continue;
        const x = xOf(i), y = toY(v);
        if (fp) { ctx.moveTo(x, y); fp = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    if (showEMA20()) drawIndLine(calcEMA(data, 20), dark ? "#2979ff" : "#1a56db");
    if (showEMA50()) drawIndLine(calcEMA(data, 50), dark ? "#ff6d00" : "#e55e00");
    if (showVWAP()) drawIndLine(calcVWAP(data), dark ? "#e040fb" : "#9c27b0");

    // ── Candles (hollow green, solid red — Bloomberg style)
    const G = "#26a69a", R = "#ef5350";
    vis.forEach((c, i) => {
      const x = xOf(i + vStart);
      const cw = Math.max(1, step - 2);
      const yO = toY(c.open), yC = toY(c.close);
      const yH = toY(c.high), yL = toY(c.low);
      const bodyY = Math.min(yO, yC);
      const bodyH = Math.max(Math.abs(yC - yO), 1);
      const col = c.isGreen ? G : R;

      // Wick
      ctx.strokeStyle = col;
      ctx.lineWidth = step < 5 ? 0.8 : 1;
      ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();

      // Body
      if (c.isGreen && step >= 5) {
        // Hollow green (like Bloomberg / TradingView default)
        ctx.strokeStyle = G; ctx.lineWidth = 1.2;
        ctx.strokeRect(x - cw / 2, bodyY, cw, Math.max(bodyH, 1));
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(x - cw / 2, bodyY, cw, Math.max(bodyH, 1));
      }
    });

    ctx.restore(); // end clip

    // ── LTP Price Tag
    const last = data[data.length - 1];
    const ltpY = toY(last.close);
    const ltpC = last.isGreen ? G : R;
    const ltpCl = Math.max(10, Math.min(mainH - 10, ltpY));

    // Dashed horizontal line to price tag
    ctx.strokeStyle = ltpC + "55";
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, ltpY); ctx.lineTo(plotW, ltpY); ctx.stroke();
    ctx.setLineDash([]);

    // Rounded price pill
    ctx.fillStyle = ltpC;
    rr(plotW + 4, ltpCl - 9, Y_AXIS_W - 8, 18, 3); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(last.close.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 8, ltpCl);

    // ── RSI Sub-Panel
    if (showRSI() && RSI_H > 0) {
      const rsiVals = calcRSI(data);
      const rt = mainH;

      ctx.fillStyle = dark ? "#000000" : "#ffffff";
      ctx.fillRect(0, rt, plotW, RSI_H);

      // Separator
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, rt); ctx.lineTo(W, rt); ctx.stroke();

      const rtY = (v: number) => rt + ((100 - v) / 100) * (RSI_H - 14) + 7;

      // Reference lines
      ctx.setLineDash([3, 3]);
      [30, 50, 70].forEach(lvl => {
        ctx.strokeStyle = lvl === 50 ? "rgba(120,123,134,0.3)" : "rgba(220,100,100,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, rtY(lvl)); ctx.lineTo(plotW, rtY(lvl)); ctx.stroke();
        ctx.fillStyle = dark ? "#787b86" : "#9ca3af";
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(String(lvl), plotW - 2, rtY(lvl));
      });
      ctx.setLineDash([]);

      // RSI label + current value
      const latestRSI = [...rsiVals].reverse().find(v => !isNaN(v));
      ctx.fillStyle = dark ? "#787b86" : "#9ca3af";
      ctx.font = "9px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`RSI(14)  ${latestRSI != null ? latestRSI.toFixed(1) : ""}`, 4, rt + 2);

      // RSI line
      ctx.strokeStyle = "#ab47bc"; ctx.lineWidth = 1.2;
      ctx.beginPath(); let rfp = true;
      for (let i = vStart; i < vEnd; i++) {
        const v = rsiVals[i]; if (isNaN(v)) continue;
        const x = xOf(i), y = rtY(Math.max(0, Math.min(100, v)));
        if (rfp) { ctx.moveTo(x, y); rfp = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── X-Axis Time Labels
    const tf = paneTFs()[pi];
    const fmtT = (t: number) => {
      const d = new Date(t);
      if (tf === "1d") return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      if (tf === "4h" || tf === "1h") return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}h`;
      if (tf === "30m") return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    ctx.fillStyle = dark ? "#787b86" : "#9ca3af";
    ctx.font = "10px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tSkip = Math.max(1, Math.floor(vis.length / 7));
    vis.forEach((c, i) => {
      if (i % tSkip !== 0) return;
      const x = xOf(i + vStart);
      if (x < 20 || x > plotW - 20) return;
      ctx.fillText(fmtT(c.time), x, mainH + RSI_H + X_AXIS_H / 2);
    });

    // ── Crosshair
    const ch = crosshair()[pi];
    if (ch && ch.x >= 0 && ch.x <= plotW && ch.y >= 0 && ch.y <= plotH) {
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ch.x, 0); ctx.lineTo(ch.x, plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ch.y); ctx.lineTo(plotW, ch.y); ctx.stroke();
      ctx.setLineDash([]);

      // Y crosshair price label
      if (ch.y <= mainH) {
        const p = toP(ch.y);
        const ly = Math.max(10, Math.min(mainH - 10, ch.y));
        ctx.fillStyle = dark ? "#222222" : "#111111";
        rr(plotW + 4, ly - 8, Y_AXIS_W - 8, 16, 3); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotW + 8, ly);
      }

      // X crosshair time label
      const ci = Math.round(data.length - 1 - (plotW + px - ch.x - step / 2) / step);
      const clamped = Math.max(0, Math.min(data.length - 1, ci));
      if (data[clamped]) {
        const ts = fmtT(data[clamped].time);
        ctx.font = "9px 'Trebuchet MS', sans-serif";
        const tw = ctx.measureText(ts).width + 14;
        const tx = Math.max(tw / 2 + 2, Math.min(plotW - tw / 2 - 2, ch.x));
        ctx.fillStyle = dark ? "#363a45" : "#2a2e39";
        rr(tx - tw / 2, mainH + RSI_H, tw, X_AXIS_H - 1, 3); ctx.fill();
        ctx.fillStyle = dark ? "#d1d4dc" : "#f0f3fa";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ts, tx, mainH + RSI_H + X_AXIS_H / 2);
      }
    }
  };

  const drawAll = () => { for (let i = 0; i < paneCount(); i++) drawPane(i); };
  const sched = () => { cancelAnimationFrame(animId); animId = requestAnimationFrame(drawAll); };

  // ─────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────

  // Reload data when symbols or TFs change
  createEffect(() => {
    paneSymbols(); paneTFs();
    for (let i = 0; i < 4; i++) loadPane(i);
  });

  // Update last candle in real-time on live price ticks, and handle candle rollover
  createEffect(() => {
    const symbols = paneSymbols();
    const currentData = paneData();
    let changed = false;
    const next = [...currentData];

    symbols.forEach((sym, pi) => {
      const livePrice = store.symbols[sym]?.price;
      if (!livePrice || livePrice === 0) return;

      const pData = currentData[pi];
      if (!pData || pData.length === 0) return;

      const lastCandle = pData[pData.length - 1];
      if (!lastCandle) return;

      const tf = paneTFs()[pi];
      const ms = TF_MS[tf] ?? 60000;
      const nowTime = Date.now();
      const currentBucket = Math.floor(nowTime / ms) * ms;

      const updatedCandles = [...pData];

      if (currentBucket > lastCandle.time) {
        const newCandle = {
          time: currentBucket,
          open: livePrice,
          high: livePrice,
          low: livePrice,
          close: livePrice,
          volume: Math.floor(Math.random() * 5000 + 1000),
          isGreen: true
        };
        if (updatedCandles.length > 500) {
          updatedCandles.shift();
        }
        updatedCandles.push(newCandle);
        next[pi] = updatedCandles;
        changed = true;
      } else {
        if (lastCandle.close !== livePrice || livePrice > lastCandle.high || livePrice < lastCandle.low) {
          const newLast = { ...lastCandle };
          newLast.close = livePrice;
          newLast.high = Math.max(newLast.high, livePrice);
          newLast.low = Math.min(newLast.low, livePrice);
          newLast.isGreen = newLast.close >= newLast.open;
          newLast.volume = lastCandle.volume + Math.floor(Math.random() * 100);
          updatedCandles[updatedCandles.length - 1] = newLast;
          next[pi] = updatedCandles;
          changed = true;
        }
      }
    });

    if (changed) {
      setPaneData(next);
    }
  });

  // Redraw when anything visual changes
  createEffect(() => {
    props.theme(); layout(); paneData(); panX(); stepW(); yBounds();
    crosshair(); showEMA20(); showEMA50(); showVWAP(); showBB(); showRSI();
    paneSymbols().forEach(sym => store.symbols[sym]?.price);
    sched();
  });

  const ro = new ResizeObserver(sched);

  onMount(() => {
    drawAll();
    window.addEventListener("resize", sched);
    window.addEventListener("mouseup", () => { isDragging = false; });
    window.addEventListener("click", () => {
      setIndOpen(false); setLayoutOpen(false);
      setSearchOpen(false); setTfDropPane(null);
    });
  });

  onCleanup(() => {
    window.removeEventListener("resize", sched);
    cancelAnimationFrame(animId);
    ro.disconnect();
  });

  // ─────────────────────────────────────────────────────────────
  // MOUSE HANDLERS
  // ─────────────────────────────────────────────────────────────

  const onMouseDown = (pi: number) => (e: MouseEvent) => {
    e.preventDefault();
    setActivePane(pi);
    
    const canvas = canvasRefs[pi];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const plotW = canvas.clientWidth - Y_AXIS_W;
    
    isDragging = true;
    dragPane = pi;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    if (mx >= plotW) {
      dragType = "y-scale";
      dragStartLo = visibleBounds[pi].min;
      dragStartHi = visibleBounds[pi].max;
    } else {
      dragType = "pan";
      dragStartPanX = panX()[pi];
    }
  };

  const onMouseMove = (pi: number) => (e: MouseEvent) => {
    const canvas = canvasRefs[pi];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const plotW = canvas.clientWidth - Y_AXIS_W;

    // Show ns-resize cursor over Y-axis price bar
    if (mx >= plotW) {
      canvas.style.cursor = "ns-resize";
    } else {
      canvas.style.cursor = "crosshair";
    }

    // Update crosshair
    const nc = [...crosshair()]; nc[pi] = { x: mx, y: my }; setCrosshair(nc);

    // Update hover candle for OHLCV display
    const data = paneData()[pi];
    if (data && data.length > 0) {
      const step = stepW()[pi];
      const px = panX()[pi];
      const ci = Math.max(0, Math.min(data.length - 1,
        Math.round(data.length - 1 - (plotW + px - mx - step / 2) / step)
      ));
      const nh = [...hoverCandle()]; nh[pi] = data[ci]; setHoverCandle(nh);
    }

    // Pan or Y-scale drag
    if (isDragging && dragPane === pi) {
      if (dragType === "pan") {
        const dx = e.clientX - dragStartX;
        const np = [...panX()]; np[pi] = dragStartPanX + dx; setPanX(np);
      } else if (dragType === "y-scale") {
        const dy = e.clientY - dragStartY;
        const range = dragStartHi - dragStartLo;
        const factor = Math.exp(dy * 0.005);
        const newRange = range * factor;
        const center = (dragStartHi + dragStartLo) / 2;
        
        const nextLo = center - newRange / 2;
        const nextHi = center + newRange / 2;
        
        const next = [...yBounds()];
        next[pi] = { min: nextLo, max: nextHi };
        setYBounds(next);
      }
    }
  };

  const onMouseLeave = (pi: number) => () => {
    isDragging = false;
    const nc = [...crosshair()]; nc[pi] = null; setCrosshair(nc);
    const nh = [...hoverCandle()]; nh[pi] = null; setHoverCandle(nh);
  };

  const onWheel = (pi: number) => (e: WheelEvent) => {
    e.preventDefault();
    const ns = [...stepW()];
    ns[pi] = Math.max(3, Math.min(60, ns[pi] - e.deltaY * 0.06));
    setStepW(ns);
  };

  const resetView = (pi: number) => (e?: MouseEvent) => {
    if (e) {
      const canvas = canvasRefs[pi];
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const plotW = canvas.clientWidth - Y_AXIS_W;
        if (mx >= plotW) {
          // Double click on Y-axis: reset Y-scale only
          const next = [...yBounds()];
          next[pi] = null;
          setYBounds(next);
          return;
        }
      }
    }
    const np = [...panX()]; np[pi] = 0; setPanX(np);
    const ns = [...stepW()]; ns[pi] = 10; setStepW(ns);
    const nextY = [...yBounds()]; nextY[pi] = null; setYBounds(nextY);
  };

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────

  return (
    <div class="tv-root" data-theme={props.theme()}>

      {/* ════════════════ TOP TOOLBAR ════════════════ */}
      <div class="tv-bar">

        {/* Symbol search */}
        <div class="tv-search" onClick={e => e.stopPropagation()}>
          <div class="tv-search-box" onClick={() => setSearchOpen(v => !v)}>
            <svg class="tv-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span class="tv-search-sym">{symbol()}</span>
            <span class="tv-search-arr">▾</span>
          </div>
          <Show when={searchOpen()}>
            <div class="tv-search-drop">
              <input
                class="tv-search-input"
                type="text"
                placeholder="Search symbol…"
                value={search()}
                onInput={e => setSearch(e.currentTarget.value)}
                autofocus
              />
              <For each={searchResults()}>
                {(key) => (
                  <div class="tv-search-item" onClick={() => { setSymbol(key); setSearchOpen(false); setSearch(""); }}>
                    <span class="tv-si-name">{store.symbols[key].name}</span>
                    <span class="tv-si-price">{store.symbols[key].price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="tv-bar-sep" />

        {/* Timeframes — apply to active pane */}
        <div class="tv-tfs">
          <For each={TF_LIST}>
            {(t) => (
              <button class={`tv-tf ${paneTFs()[activePane()] === t ? "active" : ""}`} onClick={() => setTF(activePane(), t)}>
                {t}
              </button>
            )}
          </For>
        </div>

        <div class="tv-bar-sep" />

        {/* Indicators dropdown */}
        <div class="tv-dd-wrap" onClick={e => e.stopPropagation()}>
          <button class={`tv-bar-btn ${indOpen() ? "active" : ""}`} onClick={() => setIndOpen(v => !v)}>
            <svg class="tv-btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Indicators
          </button>
          <Show when={indOpen()}>
            <div class="tv-dd-panel tv-ind-panel">
              <div class="tv-dd-title">Indicators</div>
              <For each={[
                { label: "EMA 20",          color: "#2979ff", on: showEMA20, set: setShowEMA20 },
                { label: "EMA 50",          color: "#ff6d00", on: showEMA50, set: setShowEMA50 },
                { label: "VWAP",            color: "#e040fb", on: showVWAP,  set: setShowVWAP  },
                { label: "Bollinger Bands", color: "#64a8ff", on: showBB,    set: setShowBB    },
                { label: "RSI (14)",        color: "#ab47bc", on: showRSI,   set: setShowRSI   },
              ]}>
                {(ind) => (
                  <div class={`tv-ind-row ${ind.on() ? "on" : ""}`} onClick={() => ind.set(v => !v)}>
                    <span class="tv-ind-dot" style={{ background: ind.color }} />
                    <span class="tv-ind-lbl">{ind.label}</span>
                    <span class={`tv-ind-toggle ${ind.on() ? "on" : ""}`}><span class="tv-ind-knob" /></span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Layout dropdown */}
        <div class="tv-dd-wrap" onClick={e => e.stopPropagation()}>
          <button class={`tv-bar-btn ${layoutOpen() ? "active" : ""}`} onClick={() => setLayoutOpen(v => !v)}>
            <svg class="tv-btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <Show when={layoutOpen()}>
            <div class="tv-dd-panel tv-layout-panel">
              <div class="tv-dd-title">Layout</div>
              <div class="tv-layout-grid">
                <For each={[
                  { l: "1x1" as Layout, label: "Single" },
                  { l: "1x2" as Layout, label: "2 Col"  },
                  { l: "2x1" as Layout, label: "2 Row"  },
                  { l: "2x2" as Layout, label: "4 Pane" },
                ]}>
                  {(item) => (
                    <button class={`tv-layout-btn ${layout() === item.l ? "active" : ""}`}
                      onClick={() => { setLayout(item.l); setLayoutOpen(false); }}>
                      <LayoutThumb l={item.l} />
                      <span>{item.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>

        <div class="tv-bar-grow" />
      </div>

      {/* ════════════════ BODY ════════════════ */}
      <div class="tv-body">

        {/* Chart Area */}
        <div class="tv-chart-area">
          <div class="tv-chart-grid" style={gridStyle()}>
            <For each={Array.from({ length: paneCount() }, (_, i) => i)}>
              {(pi) => {
                const dc = () => displayedCandle(pi);
                const isUp = () => (dc()?.close ?? 0) >= (dc()?.open ?? 0);
                const pct = () => dc() ? (((dc()!.close - dc()!.open) / dc()!.open) * 100) : 0;

                return (
                  <div
                    class={`tv-pane ${activePane() === pi ? "tv-pane-active" : ""}`}
                    onClick={() => setActivePane(pi)}
                  >
                    {/* ── Pane Header */}
                    <div class="tv-pane-hdr">
                      <span class="tv-ph-sym">{paneSymbols()[pi]}</span>

                      {/* Per-pane TF picker */}
                      <div class="tv-ph-tf-wrap" onClick={e => e.stopPropagation()}>
                        <button class="tv-ph-tf" onClick={() => setTfDropPane(v => v === pi ? null : pi)}>
                          {paneTFs()[pi]}&nbsp;▾
                        </button>
                        <Show when={tfDropPane() === pi}>
                          <div class="tv-ph-tf-drop">
                            <For each={TF_LIST}>
                              {(t) => (
                                <button
                                  class={`tv-ph-tf-item ${paneTFs()[pi] === t ? "sel" : ""}`}
                                  onClick={() => { setTF(pi, t); setTfDropPane(null); }}
                                >
                                  {t}
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>

                      {/* OHLCV row */}
                      <Show when={dc()}>
                        <span class="tv-ph-sep">·</span>
                        <div class="tv-ph-ohlcv">
                          <span>O <b class={isUp() ? "up" : "dn"}>{dc()!.open.toFixed(2)}</b></span>
                          <span>H <b class={isUp() ? "up" : "dn"}>{dc()!.high.toFixed(2)}</b></span>
                          <span>L <b class={isUp() ? "up" : "dn"}>{dc()!.low.toFixed(2)}</b></span>
                          <span>C <b class={isUp() ? "up" : "dn"}>{dc()!.close.toFixed(2)}</b></span>
                          <b class={isUp() ? "up" : "dn"}>{isUp() ? "+" : ""}{pct().toFixed(2)}%</b>
                        </div>
                      </Show>

                      <div class="tv-ph-grow" />

                      {/* Reset view button */}
                      <button class="tv-ph-btn" title="Reset view" onClick={e => { e.stopPropagation(); resetView(pi)(); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                          <polyline points="3 3 3 8 8 8"/>
                        </svg>
                      </button>
                    </div>

                    {/* ── Canvas body */}
                    <div
                      class="tv-pane-body"
                      ref={el => { if (el) { bodyRefs[pi] = el; ro.observe(el); } }}
                    >
                      <canvas
                        class="tv-canvas"
                        ref={el => { if (el) canvasRefs[pi] = el; }}
                        onMouseDown={onMouseDown(pi)}
                        onMouseMove={onMouseMove(pi)}
                        onMouseUp={() => { isDragging = false; }}
                        onMouseLeave={onMouseLeave(pi)}
                        onWheel={onWheel(pi)}
                        onDblClick={(e) => resetView(pi)(e)}
                      />
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* ════════════════ RIGHT PANEL ════════════════ */}
        <div class="tv-right">
          {/* Icon strip */}
          <div class="tv-rstrip">
            <For each={[
              {
                id: "watchlist" as RPanel,
                label: "List",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="16" height="16">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                ),
              },
              {
                id: "scalp" as RPanel,
                label: "Trade",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="16" height="16">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                ),
              },
              {
                id: "settings" as RPanel,
                label: "Set",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="16" height="16">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"/>
                  </svg>
                ),
              },
            ]}>
              {(tab) => (
                <button
                  class={`tv-rtab ${rPanel() === tab.id ? "active" : ""}`}
                  title={tab.label}
                  onClick={() => setRPanel(v => v === tab.id ? null : tab.id)}
                >
                  {tab.icon}
                  <span class="tv-rtab-lbl">{tab.label}</span>
                </button>
              )}
            </For>
          </div>

          {/* Panel body */}
          <Show when={rPanel() !== null}>
            <div class="tv-rpanel">

              {/* ── WATCHLIST */}
              <Show when={rPanel() === "watchlist"}>
                <div class="tv-rp-title">Watchlist</div>
                <div class="tv-wl-list">
                  <For each={Object.values(store.symbols)}>
                    {(sym) => (
                      <div class={`tv-wl-item ${symbol() === sym.name ? "active" : ""}`}
                        onClick={() => setSymbol(sym.name)}>
                        <div class="tv-wli-left">
                          <span class="tv-wli-name">{sym.name}</span>
                          <span class="tv-wli-ex">{sym.exchange ?? "NSE"}</span>
                        </div>
                        <div class="tv-wli-right">
                          <span class="tv-wli-price">{sym.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          <span class={`tv-wli-pct ${sym.up ? "up" : "dn"}`}>{sym.up ? "+" : ""}{sym.pct.toFixed(2)}%</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* ── SCALP / QUICK TRADE */}
              <Show when={rPanel() === "scalp"}>
                <div class="tv-rp-title">Quick Trade</div>
                <div class="tv-scalp">
                  <div class="tv-scalp-sym">
                    <span>{symbol()}</span>
                    <span class={symData()?.up ? "up" : "dn"}>
                      {symData()?.price.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "--"}
                    </span>
                  </div>

                  <div class="tv-scalp-label">Quantity</div>
                  <div class="tv-scalp-qty">
                    <button class="tv-scalp-step" onClick={() => setScalpQty(q => Math.max(1, q - 1))}>−</button>
                    <span class="tv-scalp-qval">{scalpQty()}</span>
                    <button class="tv-scalp-step" onClick={() => setScalpQty(q => q + 1)}>+</button>
                  </div>

                  <div class="tv-scalp-presets">
                    <For each={[1, 5, 10, 25, 50]}>
                      {(q) => (
                        <button class={`tv-scalp-pre ${scalpQty() === q ? "on" : ""}`} onClick={() => setScalpQty(q)}>
                          {q}
                        </button>
                      )}
                    </For>
                  </div>

                  <div class="tv-scalp-btns">
                    <button class="tv-scalp-buy" onClick={async () => {
                      const r = await placeRealOrder({ inst: symbol(), side: "Buy", type: "Market", qty: scalpQty(), price: symData()?.price ?? 0, prod: "MIS", exchange: symData()?.exchange ?? "NSE" });
                      addNotification(r.success ? "Buy Placed" : "Order Failed", r.message, r.success ? "success" : "error", "orders");
                    }}>
                      <span>BUY</span>
                      <span class="tv-scalp-sub">{scalpQty()} · MKT</span>
                    </button>
                    <button class="tv-scalp-sell" onClick={async () => {
                      const r = await placeRealOrder({ inst: symbol(), side: "Sell", type: "Market", qty: scalpQty(), price: symData()?.price ?? 0, prod: "MIS", exchange: symData()?.exchange ?? "NSE" });
                      addNotification(r.success ? "Sell Placed" : "Order Failed", r.message, r.success ? "success" : "error", "orders");
                    }}>
                      <span>SELL</span>
                      <span class="tv-scalp-sub">{scalpQty()} · MKT</span>
                    </button>
                  </div>

                  <div class="tv-scalp-info">
                    <div class="tv-si-row">
                      <span>Est. Value</span>
                      <span>₹{((symData()?.price ?? 0) * scalpQty()).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="tv-si-row">
                      <span>MIS Margin ~15%</span>
                      <span>₹{((symData()?.price ?? 0) * scalpQty() * 0.15).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>
              </Show>

              {/* ── SETTINGS */}
              <Show when={rPanel() === "settings"}>
                <div class="tv-rp-title">Chart Settings</div>
                <div class="tv-cfg">
                  <For each={[
                    { label: "EMA 20",          on: showEMA20, set: setShowEMA20 },
                    { label: "EMA 50",          on: showEMA50, set: setShowEMA50 },
                    { label: "VWAP",            on: showVWAP,  set: setShowVWAP  },
                    { label: "Bollinger Bands", on: showBB,    set: setShowBB    },
                    { label: "RSI (14)",        on: showRSI,   set: setShowRSI   },
                  ]}>
                    {(row) => (
                      <div class="tv-cfg-row" onClick={() => row.set(v => !v)}>
                        <span class="tv-cfg-lbl">{row.label}</span>
                        <span class={`tv-cfg-toggle ${row.on() ? "on" : ""}`}><span class="tv-cfg-knob" /></span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

            </div>
          </Show>
        </div>

      </div>{/* end tv-body */}
    </div>
  );
};
