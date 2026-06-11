import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { store, fetchCandles } from '../../store/tradingStore';
import './charts.css';

interface ChartsPageProps {
  theme: () => 'dark' | 'light';
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isGreen?: boolean;
}

export const ChartsPage: Component<ChartsPageProps> = (props) => {
  const [activeWatchlistTab, setActiveWatchlistTab] = createSignal('Index');
  const [selectedPane, setSelectedPane] = createSignal(1);

  // Synced active symbols
  const [activeSymbol, setActiveSymbol] = createSignal('NIFTY 50');

  // Timeframes for each pane
  const [pane1Timeframe, setPane1Timeframe] = createSignal('5m');
  const [pane2Timeframe, setPane2Timeframe] = createSignal('15m');
  const [pane3Timeframe, setPane3Timeframe] = createSignal('1h');

  // Candle data for each pane
  const [pane1Candles, setPane1Candles] = createSignal<Candle[]>([]);
  const [pane2Candles, setPane2Candles] = createSignal<Candle[]>([]);
  const [pane3Candles, setPane3Candles] = createSignal<Candle[]>([]);

  // Pan offsets (horizontal pixel offset)
  const [panX1, setPanX1] = createSignal(0);
  const [panX2, setPanX2] = createSignal(0);
  const [panX3, setPanX3] = createSignal(0);

  // Zoom levels (number of visible candles on screen)
  const [zoom1, setZoom1] = createSignal(35);
  const [zoom2, setZoom2] = createSignal(35);
  const [zoom3, setZoom3] = createSignal(35);

  // Auto-Scale state (Y-axis scaling mode)
  const [autoScale1, setAutoScale1] = createSignal(true);
  const [autoScale2, setAutoScale2] = createSignal(true);
  const [autoScale3, setAutoScale3] = createSignal(true);

  // Manual price limits (used when autoScale is false)
  const [manualMin1, setManualMin1] = createSignal(0);
  const [manualMax1, setManualMax1] = createSignal(0);
  const [manualMin2, setManualMin2] = createSignal(0);
  const [manualMax2, setManualMax2] = createSignal(0);
  const [manualMin3, setManualMin3] = createSignal(0);
  const [manualMax3, setManualMax3] = createSignal(0);

  // Mouse crosshair coordinates
  const [crosshair1, setCrosshair1] = createSignal<{ x: number; y: number } | null>(null);
  const [crosshair2, setCrosshair2] = createSignal<{ x: number; y: number } | null>(null);
  const [crosshair3, setCrosshair3] = createSignal<{ x: number; y: number } | null>(null);

  // Canvas refs
  let canvas1Ref!: HTMLCanvasElement;
  let canvas2Ref!: HTMLCanvasElement;
  let canvas3Ref!: HTMLCanvasElement;
  
  let container1Ref!: HTMLDivElement;
  let container2Ref!: HTMLDivElement;
  let container3Ref!: HTMLDivElement;

  // Drag states
  let isDragging1 = false;
  let isDragging2 = false;
  let isDragging3 = false;
  
  let dragStartX1 = 0;
  let dragStartX2 = 0;
  let dragStartX3 = 0;

  let dragStartY1 = 0;
  let dragStartY2 = 0;
  let dragStartY3 = 0;

  let dragStartPanX1 = 0;
  let dragStartPanX2 = 0;
  let dragStartPanX3 = 0;

  let dragStartZoom1 = 35;
  let dragStartZoom2 = 35;
  let dragStartZoom3 = 35;

  let dragStartMin1 = 0;
  let dragStartMax1 = 0;
  let dragStartMin2 = 0;
  let dragStartMax2 = 0;
  let dragStartMin3 = 0;
  let dragStartMax3 = 0;

  // Active dragging area ('grid' | 'yaxis' | 'xaxis' | null)
  let dragArea1: 'grid' | 'yaxis' | 'xaxis' | null = null;
  let dragArea2: 'grid' | 'yaxis' | 'xaxis' | null = null;
  let dragArea3: 'grid' | 'yaxis' | 'xaxis' | null = null;

  let animationFrameId: number;

  // Watchlist items filtered by selected tab
  const getWatchlistItems = () => {
    return store.watchlist
      .map(key => ({ key, ...store.symbols[key] }))
      .filter(item => {
        if (!item.name) return false;
        const type = item.type || 'Equity';
        if (activeWatchlistTab() === 'Index') {
          return type === 'Index';
        } else if (activeWatchlistTab() === 'Stocks') {
          return type === 'Equity' || type === 'Stock';
        } else {
          return type.includes('Option') || type.includes('F&O') || (!type.includes('Index') && !type.includes('Equity'));
        }
      });
  };

  // Generate deterministic pseudorandom historical candles based on symbol, timeframe, and seed
  const generateCandles = (symbol: string, timeframe: string, count: number): Candle[] => {
    const currentPrice = store.symbols[symbol]?.price || 100;
    const candles: Candle[] = [];
    
    const keyStr = symbol + timeframe;
    let seed = 0;
    for (let i = 0; i < keyStr.length; i++) {
      seed = keyStr.charCodeAt(i) + ((seed << 5) - seed);
    }

    const pseudoRandom = (offset: number) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    let volatilityScale = 0.0015;
    if (timeframe === '1m') volatilityScale = 0.0006;
    else if (timeframe === '15m') volatilityScale = 0.0035;
    else if (timeframe === '30m') volatilityScale = 0.0050;
    else if (timeframe === '1h') volatilityScale = 0.0085;
    else if (timeframe === '1d') volatilityScale = 0.0250;

    const volatility = currentPrice * volatilityScale;

    let lastClose = currentPrice;
    for (let i = count - 1; i >= 0; i--) {
      const rand1 = pseudoRandom(i * 3);
      const rand2 = pseudoRandom(i * 3 + 1);
      const rand3 = pseudoRandom(i * 3 + 2);

      const change = (rand1 - 0.49) * volatility;
      const open = lastClose - change;
      const close = lastClose;
      const high = Math.max(open, close) + rand2 * (volatility * 0.3);
      const low = Math.min(open, close) - rand3 * (volatility * 0.3);

      candles.unshift({
        time: Date.now() - (i * 60 * 1000),
        open,
        high,
        low,
        close,
        volume: Math.floor(rand1 * 10000),
        isGreen: close >= open
      });
      lastClose = open;
    }

    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = currentPrice;
      last.high = Math.max(last.open, currentPrice, last.high);
      last.low = Math.min(last.open, currentPrice, last.low);
      last.isGreen = last.close >= last.open;
    }

    return candles;
  };

  // Canvas drawing function for standard TradingView Candlestick with pan & zoom support
  const drawCandleChart = (
    canvas: HTMLCanvasElement, 
    container: HTMLDivElement, 
    symbol: string,
    timeframe: string,
    crosshair: { x: number; y: number } | null,
    panX: number,
    zoomLevel: number,
    autoScale: boolean,
    manualMin: number,
    manualMax: number,
    paneIndex: number,
    candlesList: Candle[]
  ) => {
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    ctx.scale(dpi, dpi);

    const isDark = props.theme() === 'dark';
    ctx.fillStyle = isDark ? '#161618' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (!candlesList || candlesList.length === 0) {
      // Draw Loading text
      ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
      ctx.font = '12px var(--sys-font-body)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Loading ${symbol} (${timeframe}) chart...`, width / 2, height / 2);
      return;
    }

    ctx.strokeStyle = isDark ? '#1e1e21' : '#f3f4f6';
    ctx.lineWidth = 1;

    const paddingRight = 60;
    const paddingBottom = 20;
    const plotWidth = width - paddingRight;
    const plotHeight = height - paddingBottom;

    const step = plotWidth / zoomLevel;
    const cWidth = step * 0.72;

    // Filter which candles are currently visible on the screen
    const visibleCandles = candlesList.filter((_, i) => {
      const k = (candlesList.length - 1) - i;
      const x = plotWidth - step * (k + 1) + panX;
      return x + step >= 0 && x <= plotWidth;
    });

    const fallbackPrices = candlesList.flatMap(c => [c.low, c.high]);
    const visiblePrices = visibleCandles.length > 0 ? visibleCandles.flatMap(c => [c.low, c.high]) : fallbackPrices;
    
    const autoMin = Math.min(...visiblePrices);
    const autoMax = Math.max(...visiblePrices);

    // Pick final min/max price bounds depending on autoScale
    let minPrice = autoMin;
    let maxPrice = autoMax;

    if (!autoScale) {
      minPrice = manualMin !== 0 ? manualMin : autoMin;
      maxPrice = manualMax !== 0 ? manualMax : autoMax;
    } else {
      // Add padding to auto-scale bounds to avoid wicks touching the edges
      const range = autoMax - autoMin || 1;
      minPrice = autoMin - range * 0.12;
      maxPrice = autoMax + range * 0.12;

      // Sync local signals so drag remembers the start values
      if (paneIndex === 1) {
        setManualMin1(minPrice);
        setManualMax1(maxPrice);
      } else if (paneIndex === 2) {
        setManualMin2(minPrice);
        setManualMax2(maxPrice);
      } else {
        setManualMin3(minPrice);
        setManualMax3(maxPrice);
      }
    }

    const priceRange = maxPrice - minPrice || 1;

    // Horizontal Y-axis Grid Lines
    const yGridCount = 5;
    for (let i = 0; i <= yGridCount; i++) {
      const y = (plotHeight / yGridCount) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#71717a' : '#9ca3af';
      ctx.font = '9px JetBrains Mono';
      ctx.textAlign = 'left';
      const labelVal = maxPrice - (priceRange / yGridCount) * i;
      
      if (i === 0) {
        ctx.textBaseline = 'top';
        ctx.fillText(labelVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotWidth + 6, y + 4);
      } else if (i === yGridCount) {
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotWidth + 6, y - 4);
      } else {
        ctx.textBaseline = 'middle';
        ctx.fillText(labelVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plotWidth + 6, y);
      }
    }

    // Border separating axes
    ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
    ctx.beginPath();
    ctx.moveTo(plotWidth, 0);
    ctx.lineTo(plotWidth, plotHeight);
    ctx.stroke();

    const valToY = (val: number) => {
      return ((maxPrice - val) / priceRange) * plotHeight;
    };

    // Clip rendering of chart indicators and candles to the plot area to prevent bleeding
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotWidth, plotHeight);
    ctx.clip();

    // Draw Volume Bars at bottom (Clipping hidden segments)
    candlesList.forEach((c, i) => {
      const k = (candlesList.length - 1) - i;
      const x = plotWidth - step * (k + 1) + panX;
      
      if (x + step < 0 || x > plotWidth) return;

      const volHeight = Math.abs(Math.sin(i * 1.8)) * (plotHeight * 0.18) + 3;
      ctx.fillStyle = c.isGreen ? (isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)') 
                             : (isDark ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.08)');
      ctx.fillRect(x + (step - cWidth) / 2, plotHeight - volHeight, cWidth, volHeight);
    });

    // Draw Candlestick bodies and wicks
    const colorGreen = '#10b981';
    const colorRed = '#f43f5e';

    candlesList.forEach((c, i) => {
      const k = (candlesList.length - 1) - i;
      const x = plotWidth - step * (k + 1) + panX;

      if (x + step < 0 || x > plotWidth) return;

      const yOpen = valToY(c.open);
      const yClose = valToY(c.close);
      const yHigh = valToY(c.high);
      const yLow = valToY(c.low);

      // Shadow (Wick)
      ctx.strokeStyle = c.isGreen ? colorGreen : colorRed;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + step / 2, yHigh);
      ctx.lineTo(x + step / 2, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = c.isGreen ? colorGreen : colorRed;
      ctx.fillRect(x + (step - cWidth) / 2, Math.min(yOpen, yClose), cWidth, Math.max(Math.abs(yClose - yOpen), 1.5));
    });

    // VWAP Line (Orange indicator overlay, adjusted for pan)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let firstPoint = true;
    candlesList.forEach((c, i) => {
      const k = (candlesList.length - 1) - i;
      const x = plotWidth - step * (k + 1) + panX;

      if (x + step < 0 || x > plotWidth) return;

      const y = valToY((c.open + c.close + c.high + c.low) / 4);
      if (firstPoint) {
        ctx.moveTo(x + step / 2, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x + step / 2, y);
      }
    });
    ctx.stroke();

    // Horizontal LTP Tracker (Always visible even if latest candle is scrolled off screen)
    const latestPrice = candlesList[candlesList.length - 1].close;
    const ltpY = valToY(latestPrice);
    const triggerColor = candlesList[candlesList.length - 1].isGreen ? colorGreen : colorRed;

    ctx.strokeStyle = triggerColor + '50';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, ltpY);
    ctx.lineTo(plotWidth, ltpY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Restore clip context before rendering price margin pills
    ctx.restore();

    // Tracker Price pill on Y-Axis (Clamped to avoid getting cut off)
    const clampedLtpY = Math.max(8, Math.min(plotHeight - 8, ltpY));
    ctx.fillStyle = triggerColor;
    ctx.fillRect(plotWidth + 2, clampedLtpY - 8, 52, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 8.5px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(latestPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), plotWidth + 5, clampedLtpY);

    // Crosshair Tracker
    if (crosshair && crosshair.x < plotWidth && crosshair.y < plotHeight) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(crosshair.x, 0);
      ctx.lineTo(crosshair.x, plotHeight);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(plotWidth, crosshair.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Project price tag pill on margin (Clamped to avoid getting cut off)
      const priceAtY = maxPrice - (crosshair.y / plotHeight) * priceRange;
      const clampedCrosshairY = Math.max(8, Math.min(plotHeight - 8, crosshair.y));
      ctx.fillStyle = 'var(--theme-color-ai)';
      ctx.fillRect(plotWidth + 2, clampedCrosshairY - 8, 52, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px JetBrains Mono';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(priceAtY.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }), plotWidth + 5, clampedCrosshairY);
    }
  };

  createEffect(async () => {
    const sym = activeSymbol();
    const tf = pane1Timeframe();
    let candles = await fetchCandles(sym, tf);
    if (!candles || candles.length === 0) {
      candles = generateCandles(sym, tf, 120);
    }
    setPane1Candles(candles);
  });

  createEffect(async () => {
    const sym = activeSymbol();
    const tf = pane2Timeframe();
    let candles = await fetchCandles(sym, tf);
    if (!candles || candles.length === 0) {
      candles = generateCandles(sym, tf, 120);
    }
    setPane2Candles(candles);
  });

  createEffect(async () => {
    const sym = activeSymbol();
    const tf = pane3Timeframe();
    let candles = await fetchCandles(sym, tf);
    if (!candles || candles.length === 0) {
      candles = generateCandles(sym, tf, 120);
    }
    setPane3Candles(candles);
  });

  const drawAllCharts = () => {
    drawCandleChart(canvas1Ref, container1Ref, activeSymbol(), pane1Timeframe(), crosshair1(), panX1(), zoom1(), autoScale1(), manualMin1(), manualMax1(), 1, pane1Candles());
    drawCandleChart(canvas2Ref, container2Ref, activeSymbol(), pane2Timeframe(), crosshair2(), panX2(), zoom2(), autoScale2(), manualMin2(), manualMax2(), 2, pane2Candles());
    drawCandleChart(canvas3Ref, container3Ref, activeSymbol(), pane3Timeframe(), crosshair3(), panX3(), zoom3(), autoScale3(), manualMin3(), manualMax3(), 3, pane3Candles());
  };

  const handleResize = () => {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(drawAllCharts);
  };

  onMount(() => {
    drawAllCharts();
    window.addEventListener('resize', handleResize);
    
    // Global mouseup to clean drag locks outside canvases
    const globalMouseUp = () => {
      isDragging1 = false;
      isDragging2 = false;
      isDragging3 = false;
      dragArea1 = null;
      dragArea2 = null;
      dragArea3 = null;
    };
    window.addEventListener('mouseup', globalMouseUp);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', globalMouseUp);
      cancelAnimationFrame(animationFrameId);
    });
  });

  createEffect(() => {
    props.theme();
    
    // Timeframe, symbol, pan and zoom signals
    activeSymbol();
    pane1Timeframe();
    pane2Timeframe();
    pane3Timeframe();

    panX1();
    panX2();
    panX3();

    zoom1();
    zoom2();
    zoom3();

    autoScale1();
    autoScale2();
    autoScale3();

    manualMin1();
    manualMax1();
    manualMin2();
    manualMax2();
    manualMin3();
    manualMax3();

    // Mouse coordinates triggers
    crosshair1();
    crosshair2();
    crosshair3();

    // Candles updates triggers redraw
    pane1Candles();
    pane2Candles();
    pane3Candles();

    // WebSocket prices trigger redrawing
    store.symbols[activeSymbol()]?.price;

    handleResize();
  });

  // Watchlist Drawer Select updates the synchronized symbol
  const handleWatchlistSelect = (symbolKey: string) => {
    setActiveSymbol(symbolKey);
  };

  // Dragging event triggers (MouseDown)
  const handleMouseDown = (paneIndex: number) => (e: MouseEvent) => {
    e.preventDefault();
    const canvas = paneIndex === 1 ? canvas1Ref : paneIndex === 2 ? canvas2Ref : canvas3Ref;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = canvas.width / (window.devicePixelRatio || 1) - 60;
    const plotHeight = canvas.height / (window.devicePixelRatio || 1) - 20;

    // Detect where user clicked to pan/scale accordingly (Bloomberg/TradingView rules)
    let area: 'grid' | 'yaxis' | 'xaxis' = 'grid';
    if (x > plotWidth) area = 'yaxis';
    else if (y > plotHeight) area = 'xaxis';

    if (paneIndex === 1) {
      isDragging1 = true;
      dragArea1 = area;
      dragStartX1 = e.clientX;
      dragStartY1 = e.clientY;
      dragStartPanX1 = panX1();
      dragStartZoom1 = zoom1();
      dragStartMin1 = manualMin1();
      dragStartMax1 = manualMax1();
    } else if (paneIndex === 2) {
      isDragging2 = true;
      dragArea2 = area;
      dragStartX2 = e.clientX;
      dragStartY2 = e.clientY;
      dragStartPanX2 = panX2();
      dragStartZoom2 = zoom2();
      dragStartMin2 = manualMin2();
      dragStartMax2 = manualMax2();
    } else {
      isDragging3 = true;
      dragArea3 = area;
      dragStartX3 = e.clientX;
      dragStartY3 = e.clientY;
      dragStartPanX3 = panX3();
      dragStartZoom3 = zoom3();
      dragStartMin3 = manualMin3();
      dragStartMax3 = manualMax3();
    }
  };

  // Dragging & cursor projecting (MouseMove)
  const handleMouseMove = (paneIndex: number) => (e: MouseEvent) => {
    const canvas = paneIndex === 1 ? canvas1Ref : paneIndex === 2 ? canvas2Ref : canvas3Ref;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotHeight = rect.height - 20;

    if (paneIndex === 1) {
      if (isDragging1) {
        const deltaX = e.clientX - dragStartX1;
        const deltaY = e.clientY - dragStartY1;
        
        if (dragArea1 === 'yaxis') {
          // Stretch/Squash Price Scale (Vertical Zooming)
          setAutoScale1(false);
          const range = dragStartMax1 - dragStartMin1;
          const factor = 1 + deltaY * 0.005;
          const center = (dragStartMax1 + dragStartMin1) / 2;
          setManualMax1(center + (range / 2) * factor);
          setManualMin1(center - (range / 2) * factor);
        } else if (dragArea1 === 'xaxis') {
          // Compress/Expand Time Scale (Horizontal Zooming)
          setZoom1(Math.max(15, Math.min(90, dragStartZoom1 - deltaX * 0.15)));
        } else {
          // Drag Grid (Horizontal scroll and Vertical scroll if manual)
          setPanX1(dragStartPanX1 + deltaX);
          if (!autoScale1()) {
            const range = dragStartMax1 - dragStartMin1;
            const priceDelta = (deltaY / plotHeight) * range;
            setManualMax1(dragStartMax1 + priceDelta);
            setManualMin1(dragStartMin1 + priceDelta);
          }
        }
      } else {
        setCrosshair1({ x, y });
      }
    } else if (paneIndex === 2) {
      if (isDragging2) {
        const deltaX = e.clientX - dragStartX2;
        const deltaY = e.clientY - dragStartY2;

        if (dragArea2 === 'yaxis') {
          setAutoScale2(false);
          const range = dragStartMax2 - dragStartMin2;
          const factor = 1 + deltaY * 0.005;
          const center = (dragStartMax2 + dragStartMin2) / 2;
          setManualMax2(center + (range / 2) * factor);
          setManualMin2(center - (range / 2) * factor);
        } else if (dragArea2 === 'xaxis') {
          setZoom2(Math.max(15, Math.min(90, dragStartZoom2 - deltaX * 0.15)));
        } else {
          setPanX2(dragStartPanX2 + deltaX);
          if (!autoScale2()) {
            const range = dragStartMax2 - dragStartMin2;
            const priceDelta = (deltaY / plotHeight) * range;
            setManualMax2(dragStartMax2 + priceDelta);
            setManualMin2(dragStartMin2 + priceDelta);
          }
        }
      } else {
        setCrosshair2({ x, y });
      }
    } else {
      if (isDragging3) {
        const deltaX = e.clientX - dragStartX3;
        const deltaY = e.clientY - dragStartY3;

        if (dragArea3 === 'yaxis') {
          setAutoScale3(false);
          const range = dragStartMax3 - dragStartMin3;
          const factor = 1 + deltaY * 0.005;
          const center = (dragStartMax3 + dragStartMin3) / 2;
          setManualMax3(center + (range / 2) * factor);
          setManualMin3(center - (range / 2) * factor);
        } else if (dragArea3 === 'xaxis') {
          setZoom3(Math.max(15, Math.min(90, dragStartZoom3 - deltaX * 0.15)));
        } else {
          setPanX3(dragStartPanX3 + deltaX);
          if (!autoScale3()) {
            const range = dragStartMax3 - dragStartMin3;
            const priceDelta = (deltaY / plotHeight) * range;
            setManualMax3(dragStartMax3 + priceDelta);
            setManualMin3(dragStartMin3 + priceDelta);
          }
        }
      } else {
        setCrosshair3({ x, y });
      }
    }
  };

  // Dragging release (MouseUp)
  const handleMouseUp = (paneIndex: number) => () => {
    if (paneIndex === 1) isDragging1 = false;
    else if (paneIndex === 2) isDragging2 = false;
    else isDragging3 = false;
    dragArea1 = null;
    dragArea2 = null;
    dragArea3 = null;
  };

  // Mouse leave canvas (MouseLeave)
  const handleMouseLeave = (paneIndex: number) => () => {
    if (paneIndex === 1) {
      isDragging1 = false;
      setCrosshair1(null);
    } else if (paneIndex === 2) {
      isDragging2 = false;
      setCrosshair2(null);
    } else {
      isDragging3 = false;
      setCrosshair3(null);
    }
    dragArea1 = null;
    dragArea2 = null;
    dragArea3 = null;
  };

  // Zooming wheel trigger (Wheel)
  const handleWheel = (paneIndex: number) => (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    if (paneIndex === 1) {
      setZoom1((z) => Math.max(15, Math.min(90, z + (delta > 0 ? 3 : -3))));
    } else if (paneIndex === 2) {
      setZoom2((z) => Math.max(15, Math.min(90, z + (delta > 0 ? 3 : -3))));
    } else {
      setZoom3((z) => Math.max(15, Math.min(90, z + (delta > 0 ? 3 : -3))));
    }
  };

  // Double click resets y-axis back to auto-scale (TradingView Reset Rule)
  const handleDblClick = (paneIndex: number) => () => {
    if (paneIndex === 1) {
      setAutoScale1(true);
      setPanX1(0);
    } else if (paneIndex === 2) {
      setAutoScale2(true);
      setPanX2(0);
    } else {
      setAutoScale3(true);
      setPanX3(0);
    }
  };

  return (
    <div class="charts-split-grid">
      {/* 3 Split Candlestick Canvases (TradingView layout matching the NIFTY Mockup) */}
      <div class="charts-panes-area">
        
        {/* Pane 1 (Left Column - 100% Height) */}
        <div 
          class="chart-pane-cell" 
          style={{ 
            display: "flex",
            "flex-direction": "column", 
            flex: 1.1, 
            border: selectedPane() === 1 ? "1px solid var(--theme-color-ai)" : "1px solid var(--theme-border-light)",
            cursor: "crosshair",
            "min-width": "0",
            height: "100%",
            "z-index": selectedPane() === 1 ? 10 : 1,
            position: "relative"
          }}
          onClick={() => setSelectedPane(1)}
        >
          {/* Header */}
          <div class="chart-pane-header" style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            padding: "4px var(--sys-space-2)",
            "border-bottom": "1px solid var(--theme-border-light)",
            background: selectedPane() === 1 ? "var(--theme-bg-surface-elevated)" : "none",
            height: "32px",
            "font-size": "10px"
          }}>
            <div style={{ display: "flex", gap: "var(--sys-space-2)", "align-items": "center" }}>
              <Show when={selectedPane() === 1}>
                <div style={{ width: "3px", height: "14px", background: "var(--theme-color-ai)", "border-radius": "1px" }} />
              </Show>
              <span style={{ "font-weight": "bold", "font-family": "var(--sys-font-display)" }}>
                {store.symbols[activeSymbol()]?.name || activeSymbol()} · {pane1Timeframe()} · KOTAK NEO
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--sys-space-1)", "align-items": "center" }}>
              <For each={['1m', '5m', '15m', '1h', '1d']}>
                {(tf) => (
                  <button 
                    style={{
                      background: pane1Timeframe() === tf ? "var(--theme-bg-active)" : "none",
                      border: "none",
                      color: pane1Timeframe() === tf ? "var(--theme-text-primary)" : "var(--theme-text-muted)",
                      padding: "2px 5px",
                      "font-size": "9px",
                      "border-radius": "3px",
                      cursor: "pointer",
                      "font-weight": pane1Timeframe() === tf ? "bold" : "normal"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPane1Timeframe(tf);
                    }}
                  >
                    {tf}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Viewport */}
          <div class="mini-chart-viewport" ref={container1Ref} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <canvas 
              class="chart-canvas" 
              ref={canvas1Ref} 
              style={{ width: "100%", height: "100%" }}
              onMouseMove={handleMouseMove(1)}
              onMouseLeave={handleMouseLeave(1)}
              onMouseDown={handleMouseDown(1)}
              onMouseUp={handleMouseUp(1)}
              onWheel={handleWheel(1)}
              onDblClick={handleDblClick(1)}
            ></canvas>
          </div>
        </div>

        {/* Right Column: Split vertically into Pane 2 and Pane 3 */}
        <div class="chart-pane-right-col">
          
          {/* Pane 2 (Top-Right) */}
          <div 
            class="chart-pane-cell" 
            style={{ 
              display: "flex",
              "flex-direction": "column", 
              flex: 1, 
              border: selectedPane() === 2 ? "1px solid var(--theme-color-ai)" : "1px solid var(--theme-border-light)",
              cursor: "crosshair",
              "min-height": "0",
              "z-index": selectedPane() === 2 ? 10 : 1,
              position: "relative"
            }}
            onClick={() => setSelectedPane(2)}
          >
            {/* Header */}
            <div class="chart-pane-header" style={{
              display: "flex",
              "justify-content": "space-between",
              "align-items": "center",
              padding: "4px var(--sys-space-2)",
              "border-bottom": "1px solid var(--theme-border-light)",
              background: selectedPane() === 2 ? "var(--theme-bg-surface-elevated)" : "none",
              height: "32px",
              "font-size": "10px"
            }}>
              <div style={{ display: "flex", gap: "var(--sys-space-2)", "align-items": "center" }}>
                <Show when={selectedPane() === 2}>
                  <div style={{ width: "3px", height: "14px", background: "var(--theme-color-ai)", "border-radius": "1px" }} />
                </Show>
                <span style={{ "font-weight": "bold", "font-family": "var(--sys-font-display)" }}>
                  {store.symbols[activeSymbol()]?.name || activeSymbol()} · {pane2Timeframe()} · KOTAK NEO
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--sys-space-1)", "align-items": "center" }}>
                <For each={['1m', '5m', '15m', '1h', '1d']}>
                  {(tf) => (
                    <button 
                      style={{
                        background: pane2Timeframe() === tf ? "var(--theme-bg-active)" : "none",
                        border: "none",
                        color: pane2Timeframe() === tf ? "var(--theme-text-primary)" : "var(--theme-text-muted)",
                        padding: "2px 5px",
                        "font-size": "9px",
                        "border-radius": "3px",
                        cursor: "pointer",
                        "font-weight": pane2Timeframe() === tf ? "bold" : "normal"
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPane2Timeframe(tf);
                      }}
                    >
                      {tf}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Viewport */}
            <div class="mini-chart-viewport" ref={container2Ref} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <canvas 
                class="chart-canvas" 
                ref={canvas2Ref} 
                style={{ width: "100%", height: "100%" }}
                onMouseMove={handleMouseMove(2)}
                onMouseLeave={handleMouseLeave(2)}
                onMouseDown={handleMouseDown(2)}
                onMouseUp={handleMouseUp(2)}
                onWheel={handleWheel(2)}
                onDblClick={handleDblClick(2)}
              ></canvas>
            </div>
          </div>

          {/* Pane 3 (Bottom-Right) */}
          <div 
            class="chart-pane-cell" 
            style={{ 
              display: "flex",
              "flex-direction": "column", 
              flex: 1, 
              border: selectedPane() === 3 ? "1px solid var(--theme-color-ai)" : "1px solid var(--theme-border-light)",
              cursor: "crosshair",
              "min-height": "0",
              "z-index": selectedPane() === 3 ? 10 : 1,
              position: "relative"
            }}
            onClick={() => setSelectedPane(3)}
          >
            {/* Header */}
            <div class="chart-pane-header" style={{
              display: "flex",
              "justify-content": "space-between",
              "align-items": "center",
              padding: "4px var(--sys-space-2)",
              "border-bottom": "1px solid var(--theme-border-light)",
              background: selectedPane() === 3 ? "var(--theme-bg-surface-elevated)" : "none",
              height: "32px",
              "font-size": "10px"
            }}>
              <div style={{ display: "flex", gap: "var(--sys-space-2)", "align-items": "center" }}>
                <Show when={selectedPane() === 3}>
                  <div style={{ width: "3px", height: "14px", background: "var(--theme-color-ai)", "border-radius": "1px" }} />
                </Show>
                <span style={{ "font-weight": "bold", "font-family": "var(--sys-font-display)" }}>
                  {store.symbols[activeSymbol()]?.name || activeSymbol()} · {pane3Timeframe()} · KOTAK NEO
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--sys-space-1)", "align-items": "center" }}>
                <For each={['1m', '5m', '15m', '1h', '1d']}>
                  {(tf) => (
                    <button 
                      style={{
                        background: pane3Timeframe() === tf ? "var(--theme-bg-active)" : "none",
                        border: "none",
                        color: pane3Timeframe() === tf ? "var(--theme-text-primary)" : "var(--theme-text-muted)",
                        padding: "2px 5px",
                        "font-size": "9px",
                        "border-radius": "3px",
                        cursor: "pointer",
                        "font-weight": pane3Timeframe() === tf ? "bold" : "normal"
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPane3Timeframe(tf);
                      }}
                    >
                      {tf}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Viewport */}
            <div class="mini-chart-viewport" ref={container3Ref} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <canvas 
                class="chart-canvas" 
                ref={canvas3Ref} 
                style={{ width: "100%", height: "100%" }}
                onMouseMove={handleMouseMove(3)}
                onMouseLeave={handleMouseLeave(3)}
                onMouseDown={handleMouseDown(3)}
                onMouseUp={handleMouseUp(3)}
                onWheel={handleWheel(3)}
                onDblClick={handleDblClick(3)}
              ></canvas>
            </div>
          </div>

        </div>
      </div>

      {/* Right Drawer: Watchlist */}
      <div class="watchlist-drawer-panel">
        <div class="panel-header" style={{ padding: "var(--sys-space-2) var(--sys-space-3)", "border-bottom": "1px solid var(--theme-border-light)" }}>
          <span style={{ "font-family": "var(--sys-font-display)", "font-weight": "600" }}>Watchlist Drawer</span>
        </div>
        <div style={{ padding: "var(--sys-space-1) var(--sys-space-3)", "font-size": "9px", color: "var(--theme-text-muted)" }}>
          Click to sync active symbol across all panes
        </div>
        
        <div class="watchlist-tabs" style={{ padding: "var(--sys-space-1-5) var(--sys-space-3)" }}>
          <For each={['Index', 'Stocks', 'Options']}>
            {(tab) => (
              <button 
                class={`wl-tab ${activeWatchlistTab() === tab ? 'active' : ''}`}
                onClick={() => setActiveWatchlistTab(tab)}
              >
                {tab === 'Index' ? 'Indices' : tab === 'Stocks' ? 'Stocks' : 'Options'}
              </button>
            )}
          </For>
        </div>

        <div class="watchlist-items" style={{ "font-size": "10px", flex: 1, overflow: "auto" }}>
          <For each={getWatchlistItems()}>
            {(item) => (
              <div 
                class="wl-item" 
                style={{ 
                  padding: "var(--sys-space-2) var(--sys-space-3)", 
                  cursor: "pointer",
                  background: activeSymbol() === item.key ? "var(--theme-bg-active)" : "none"
                }}
                onClick={() => handleWatchlistSelect(item.key)}
              >
                <div class="wl-item-left">
                  <span class="wl-item-name" style={{ "font-size": "10px", "font-weight": "600" }}>{item.name}</span>
                  <span class="wl-item-desc">NSE LIVE</span>
                </div>
                <div class="wl-item-right" style={{ "text-align": "right" }}>
                  <span class="wl-item-price" style={{ "font-size": "10px", "font-weight": "bold", "font-family": "var(--sys-font-mono)" }}>
                    ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span class={`wl-item-change ${item.up ? 'up' : 'down'}`} style={{ "font-size": "8px", "font-family": "var(--sys-font-mono)" }}>
                    {item.up ? '+' : ''}{item.pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
