# NIFTY Options Algorithmic Trading System
## Product Requirements Document (PRD) — End-to-End Build Guide
**Version:** 1.0 | **Status:** Production Blueprint | **Exchange:** NSE India | **Instrument:** NIFTY 50 Index Options

---

## TABLE OF CONTENTS

1. [Project Overview & Goal](#1-project-overview--goal)
2. [System Architecture — Full Map](#2-system-architecture--full-map)
3. [Phase 1 — Data Pipeline (Month 1–3)](#3-phase-1--data-pipeline-month-13)
4. [Phase 2 — Feature Engineering (Month 2–4)](#4-phase-2--feature-engineering-month-24)
5. [Phase 3 — ML Model Build (Month 4–6)](#5-phase-3--ml-model-build-month-46)
6. [Phase 4 — Backtesting & Simulator (Month 5–7)](#6-phase-4--backtesting--simulator-month-57)
7. [Phase 5 — Policy Engine & EV Optimizer (Month 7–8)](#7-phase-5--policy-engine--ev-optimizer-month-78)
8. [Phase 6 — Live Deployment (Month 9–12)](#8-phase-6--live-deployment-month-912)
9. [Complete File & Folder Structure](#9-complete-file--folder-structure)
10. [Database Schema (ClickHouse)](#10-database-schema-clickhouse)
11. [API & Broker Integration — Kotak Neo](#11-api--broker-integration--kotak-neo)
12. [Risk Management Rules](#12-risk-management-rules)
13. [Validation Framework](#13-validation-framework)
14. [Infrastructure & Cost Estimate](#14-infrastructure--cost-estimate)
15. [Hard Failure Modes & How to Avoid Them](#15-hard-failure-modes--how-to-avoid-them)
16. [Glossary](#16-glossary)

---

## 1. Project Overview & Goal

### What Are We Building?

A fully automated, institutional-grade algorithmic options trading system that:

- **Ingests** live NSE option chain data via Kotak Neo API (free, already available)
- **Builds** a real-time Implied Volatility (IV) surface using SABR/SVI calibration
- **Trains** a hierarchical ML model (Transformer + TCN + LightGBM) to predict option premium moves, IV shifts, and volatility risk premium
- **Decides** which option strategy to execute (Buy Call, Buy Put, Straddle, Spread, or WAIT) using an Expected Value optimizer
- **Executes** trades via Kotak Neo order API with real slippage and tax modeling
- **Monitors** portfolio Greeks (Delta, Gamma, Vega, Theta) in real time

### What This System Is NOT

- NOT a high-frequency market-making system (needs tick-by-tick L3 data for that)
- NOT a guaranteed profit machine — it's a statistical edge finder
- NOT a copy of someone else's strategy — this is a research-first build

### Core Edge Philosophy

```
Edge = (Model's IV Forecast Accuracy) × (Premium Mispricing Size) − (All Execution Costs)
```

If Edge ≤ 0, the system does NOTHING. This is the most important rule.

### Target Holding Period
- Minimum: 15 minutes
- Maximum: 1 expiry cycle (weekly, Thursday)
- NO overnight holds in early phases

---

## 2. System Architecture — Full Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│                                                                 │
│  Kotak Neo API ──► Option Chain Ingestor ──► ClickHouse DB      │
│  (1-min snapshots)   (ingestor.py)           (raw storage)      │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYTICS LAYER                             │
│                                                                 │
│  IV Surface Builder ──► Greeks Engine ──► Feature Store         │
│  (surface_calibrator.py)  (greeks.py)    (store.py / Feast)     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ML MODEL LAYER                             │
│                                                                 │
│  Label Factory ──► Surface Transformer ──► TCN/TFT ──► LightGBM │
│  (labels.py)        (PyTorch)             (PyTorch)   (meta)    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STRATEGY LAYER                               │
│                                                                 │
│  EV Optimizer ──► Strategy Ranker ──► Risk Checker ──► Executor │
│  (ev_engine.py)   (ranker.py)        (risk_mgr.py)  (executor.py)│
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MONITORING LAYER                              │
│                                                                 │
│  Portfolio Dashboard ──► Alpha Decay Monitor ──► Alerts         │
│  (dashboard.py)           (decay_monitor.py)    (Telegram bot)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1 — Data Pipeline (Month 1–3)

### 3.1 Kotak Neo API Setup

**What you get for free with Kotak Neo:**
- Real-time option chain quotes (bid/ask/LTP/OI/Volume)
- 1-minute OHLCV historical data
- Order placement and execution
- WebSocket streaming for live quotes

**Installation:**
```bash
pip install neo-api-client
```

**Authentication Flow:**
```python
# File: quant_engine/data/kotak_client.py

from neo_api_client import NeoAPI

client = NeoAPI(
    consumer_key="YOUR_CONSUMER_KEY",
    consumer_secret="YOUR_CONSUMER_SECRET",
    environment="prod"  # or "uat" for testing
)

# Step 1: Generate OTP
client.login(mobilenumber="YOUR_MOBILE", password="YOUR_PASSWORD")

# Step 2: Validate OTP (sent to your registered mobile)
client.session_2fa(OTP="123456")
```

### 3.2 Option Chain Ingestor

**File:** `quant_engine/data/ingestor.py`

**What it does:**
1. Connects to Kotak Neo WebSocket every market day at 09:15
2. Fetches complete NIFTY option chain every 60 seconds
3. Parses each option contract (strike, expiry, CE/PE, bid/ask, OI, volume, IV)
4. Writes to ClickHouse in batches
5. Handles disconnections and reconnects automatically

**Key Data Points to Collect Per Snapshot:**

| Field | Source | Description |
|-------|--------|-------------|
| `timestamp` | System clock | IST, millisecond precision |
| `underlying_price` | NIFTY spot | Current index level |
| `expiry_date` | Chain header | Weekly (nearest Thursday) |
| `strike` | Chain row | Strike price (e.g., 22000, 22050) |
| `option_type` | Chain row | CE or PE |
| `bid_price` | Market data | Best bid |
| `ask_price` | Market data | Best ask |
| `bid_size` | Market data | Qty at best bid |
| `ask_size` | Market data | Qty at best ask |
| `ltp` | Market data | Last traded price |
| `volume` | Market data | Contracts traded today |
| `open_interest` | Market data | Outstanding contracts |
| `iv` | Exchange provided | Implied volatility (use as sanity check only) |

**Instruments to Collect:**
- Current week expiry: ALL strikes (typically 100+ strikes per expiry)
- Next week expiry: ATM ±30 strikes
- Monthly expiry: ATM ±20 strikes
- India VIX: 1-minute candles
- NIFTY Futures (front month): bid/ask/LTP

**Sample Ingestor Skeleton:**
```python
import asyncio
import clickhouse_connect
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")

class OptionChainIngestor:
    def __init__(self, neo_client, ch_client):
        self.neo = neo_client
        self.ch = ch_client
        self.buffer = []
        self.BATCH_SIZE = 500

    async def fetch_and_store(self):
        """Called every 60 seconds during market hours"""
        ts = datetime.now(IST)
        chain = await self.neo.option_chain("NIFTY")

        rows = []
        for contract in chain["data"]:
            rows.append({
                "timestamp": ts,
                "underlying_symbol": "NIFTY",
                "underlying_price": chain["spot_price"],
                "expiry_date": contract["expiry"],
                "strike": float(contract["strike"]),
                "option_type": contract["option_type"],  # CE or PE
                "bid_price": contract["bid"],
                "ask_price": contract["ask"],
                "bid_size": contract["bid_qty"],
                "ask_size": contract["ask_qty"],
                "ltp": contract["ltp"],
                "volume": contract["volume"],
                "open_interest": contract["oi"],
            })

        self.buffer.extend(rows)
        if len(self.buffer) >= self.BATCH_SIZE:
            self.flush()

    def flush(self):
        self.ch.insert("nse_options.option_chain_snapshots", self.buffer)
        self.buffer.clear()

    async def run(self):
        while True:
            if self._is_market_hours():
                await self.fetch_and_store()
            await asyncio.sleep(60)

    def _is_market_hours(self):
        now = datetime.now(IST)
        return (now.weekday() < 5 and
                now.hour >= 9 and
                (now.hour < 15 or (now.hour == 15 and now.minute <= 30)))
```

### 3.3 Historical Data Collection Strategy

**Free Sources (Start Here):**

| Source | What | How |
|--------|------|-----|
| NSE Website | Historical option chain EOD data | Scrape `nseindia.com/report-detail/fo_eq_security` |
| Kotak Neo API | 1-min OHLCV going back 60+ days | `client.historical_data()` |
| India VIX | NSE publishes free CSV files | Download from NSE archives |
| True Data | Paid but affordable (₹500–2000/month) | Historical tick data |

**Minimum Data Required Before Training:**
- Option chains: 6 months × ~250 trading days = ~1500 snapshots per day
- That's approximately 1,500 × 200 strikes = 300,000 rows/day
- 6 months = ~45 million rows total

**How to Get Historical NSE Data (NSE Bhav Copy):**
```python
# File: quant_engine/data/nse_historical.py
import requests
import pandas as pd
from datetime import date, timedelta

def download_nse_fo_bhav(target_date: date) -> pd.DataFrame:
    """Download F&O Bhav Copy from NSE for any date"""
    date_str = target_date.strftime("%d%b%Y").upper()
    url = f"https://archives.nseindia.com/content/historical/DERIVATIVES/{target_date.year}/{target_date.strftime('%b').upper()}/fo{date_str}bhav.csv.zip"

    resp = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    # Filter for NIFTY options
    df = pd.read_csv(resp.content, compression="zip")
    nifty_opts = df[(df["SYMBOL"] == "NIFTY") &
                    (df["INSTRUMENT"].isin(["OPTIDX"]))]
    return nifty_opts
```

> **NOTE:** NSE Bhav Copy is End-of-Day only. For intraday 1-min data, you MUST use Kotak Neo API or a paid vendor.

---

## 4. Phase 2 — Feature Engineering (Month 2–4)

### 4.1 IV Surface Builder

**File:** `quant_engine/data/surface_calibrator.py`

The IV Surface is the single most important derived quantity. Instead of using raw exchange-provided IV (which is noisy), we fit a smooth mathematical model.

**What is IV Surface?**
- A 2D function: IV = f(Strike/Spot, Days-To-Expiry)
- Called "smile" for single expiry, "surface" for all expiries together
- Tells you the market's consensus expected volatility for every possible strike

**Step 1: Clean the Raw Chain**
```python
def clean_option_chain(df: pd.DataFrame, spot: float) -> pd.DataFrame:
    """Remove illiquid/bad strikes before calibration"""
    mid_price = (df["bid_price"] + df["ask_price"]) / 2

    # Remove zero-bid options (no market)
    df = df[df["bid_price"] > 0]

    # Remove deep OTM (moneyness outside 0.80 to 1.20)
    df["moneyness"] = df["strike"] / spot
    df = df[(df["moneyness"] >= 0.80) & (df["moneyness"] <= 1.20)]

    # Remove wide spread options (bid-ask > 20% of mid)
    df["spread_ratio"] = (df["ask_price"] - df["bid_price"]) / mid_price
    df = df[df["spread_ratio"] < 0.20]

    return df
```

**Step 2: Extract IV Using Black-Scholes Inversion**
```python
from scipy.optimize import brentq
from scipy.stats import norm
import numpy as np

def bs_price(S, K, T, r, sigma, option_type="CE"):
    """Black-Scholes price"""
    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))
    d2 = d1 - sigma*np.sqrt(T)
    if option_type == "CE":
        return S*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2)
    else:
        return K*np.exp(-r*T)*norm.cdf(-d2) - S*norm.cdf(-d1)

def extract_iv(market_price, S, K, T, r=0.065, option_type="CE"):
    """Newton's method to extract IV from market price"""
    try:
        iv = brentq(
            lambda sigma: bs_price(S, K, T, r, sigma, option_type) - market_price,
            1e-6, 10.0, xtol=1e-6
        )
        return iv
    except ValueError:
        return np.nan
```

**Step 3: Fit SVI (Stochastic Volatility Inspired) Smile**
```python
from scipy.optimize import minimize

def svi_raw(k, a, b, rho, m, sigma):
    """SVI parameterization: total variance w(k)"""
    return a + b * (rho*(k - m) + np.sqrt((k - m)**2 + sigma**2))

def fit_svi(log_moneyness, total_variance):
    """Fit SVI params to extracted IVs for one expiry"""
    def objective(params):
        a, b, rho, m, sigma = params
        w_model = svi_raw(log_moneyness, a, b, rho, m, sigma)
        return np.sum((w_model - total_variance)**2)

    # Initial guess
    x0 = [0.04, 0.1, -0.5, 0.0, 0.1]
    bounds = [(-1, 1), (1e-4, 2), (-0.999, 0.999), (-2, 2), (1e-4, 2)]

    result = minimize(objective, x0, bounds=bounds, method="L-BFGS-B")
    return result.x  # [a, b, rho, m, sigma]
```

### 4.2 Greeks Engine

**File:** `quant_engine/features/greeks.py`

Compute Greeks from the FITTED IV surface (not raw exchange IVs):

| Greek | Symbol | What It Measures |
|-------|--------|-----------------|
| Delta | Δ | Price sensitivity to ±1 point NIFTY move |
| Gamma | Γ | Rate of Delta change (convexity) |
| Vega | V | Sensitivity to ±1% IV change |
| Theta | Θ | Daily time decay (premium lost per day) |
| Vanna | ∂Δ/∂σ | Delta change with IV (skew risk) |
| Volga | ∂V/∂σ | Vega change with IV (vol-of-vol risk) |

```python
def compute_greeks(S, K, T, r, sigma, option_type="CE"):
    """All Greeks from BS formula"""
    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))
    d2 = d1 - sigma*np.sqrt(T)
    pdf_d1 = norm.pdf(d1)
    sign = 1 if option_type == "CE" else -1

    delta = sign * norm.cdf(sign * d1)
    gamma = pdf_d1 / (S * sigma * np.sqrt(T))
    vega  = S * pdf_d1 * np.sqrt(T) / 100  # per 1% IV move
    theta = (-(S * pdf_d1 * sigma) / (2*np.sqrt(T))
             - sign * r * K * np.exp(-r*T) * norm.cdf(sign * d2)) / 365

    return {"delta": delta, "gamma": gamma, "vega": vega, "theta": theta}
```

### 4.3 Feature Store

**File:** `quant_engine/features/store.py`

**All Features to Compute (Per Timestamp):**

**Group A — Volatility Features:**
| Feature | Formula | Window |
|---------|---------|--------|
| Realized Volatility | `std(log_returns) × √252` | 5, 15, 30, 60 min |
| IV-RV Spread (VRP) | `ATM_IV − RV_30min` | Rolling |
| IV Percentile | Rank of current ATM IV vs 1-year history | — |
| IV Term Structure Slope | `IV_next_expiry − IV_front_expiry` | — |
| Put-Call IV Skew | `IV(0.95 moneyness PE) − IV(ATM)` | — |

**Group B — Order Flow Features:**
| Feature | Formula | Window |
|---------|---------|--------|
| CE OI Change | `(OI_now − OI_prev) / OI_prev` | 5, 15 min |
| PE OI Change | Same for puts | 5, 15 min |
| Put-Call OI Ratio | `Total PE OI / Total CE OI` | Rolling |
| PCR Volume | `PE Volume / CE Volume` | Same day |
| OBI (Order Book Imbalance) | `(Ask Size − Bid Size)/(Ask Size + Bid Size)` | ATM strike |

**Group C — Market Structure Features:**
| Feature | Description |
|---------|-------------|
| Minutes to Expiry | Exact calendar time to Thursday 15:30 |
| Minutes to Market Close | Time to 15:30 today |
| Day of Week (one-hot) | Monday=0 … Thursday=3 |
| Is Expiry Day | Binary: 1 if today is Thursday |
| NIFTY vs 20-min EMA | Distance from short-term trend |
| India VIX Level | Current VIX reading |
| India VIX Change | VIX delta vs 15 min ago |

**Group D — Cross-Strike Surface Features:**
| Feature | Description |
|---------|-------------|
| ATM IV | IV of nearest ATM call |
| Skew 25-Delta | `IV(25Δ Put) − IV(25Δ Call)` |
| Kurtosis of Vol Smile | Curvature of the IV smile fit |
| SVI Parameters [a,b,ρ,m,σ] | Raw fitted surface params |

---

## 5. Phase 3 — ML Model Build (Month 4–6)

### 5.1 Label Generation

**File:** `quant_engine/models/labels.py`

**What the model must predict (Y targets):**

```python
PREDICTION_HORIZONS = [5, 15, 30, 60]  # minutes

def generate_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Generate all Y targets for each row"""

    for tau in PREDICTION_HORIZONS:
        # Y1: ATM Option Premium Return
        df[f"Y_prem_CE_{tau}m"] = (
            df["atm_ce_price"].shift(-tau) - df["atm_ce_price"]
        ) / df["atm_ce_price"]

        # Y2: Underlying return
        df[f"Y_spot_ret_{tau}m"] = np.log(
            df["underlying_price"].shift(-tau) / df["underlying_price"]
        )

        # Y3: IV Surface Shift at ATM
        df[f"Y_iv_shift_{tau}m"] = (
            df["atm_iv"].shift(-tau) - df["atm_iv"]
        )

        # Y4: VRP (Realized Vol vs Implied Vol)
        realized_vol = df["log_ret"].rolling(tau).std() * np.sqrt(252*375/tau)
        df[f"Y_vrp_{tau}m"] = realized_vol.shift(-tau) - df["atm_iv"]

        # Y5: Direction class (for classification head)
        # 0 = bearish (<−0.2%), 1 = flat, 2 = bullish (>+0.2%)
        ret = df[f"Y_spot_ret_{tau}m"]
        df[f"Y_dir_{tau}m"] = pd.cut(ret,
            bins=[-np.inf, -0.002, 0.002, np.inf],
            labels=[0, 1, 2]
        ).astype(int)

    return df.dropna()
```

### 5.2 Model 1 — Option Surface Transformer

**File:** `quant_engine/models/surface_transformer.py`

**What it does:** Processes the ENTIRE option chain simultaneously. Treats each option contract (strike × expiry × CE/PE) as a token in a sequence, like a sentence in NLP.

**Architecture:**
```
Input: [N_contracts × 10 features] per timestamp
         ↓
Token Embedding Layer (Linear projection)
         ↓
Positional Encoding (by moneyness + DTE)
         ↓
4× Transformer Encoder Blocks
   (Multi-Head Self-Attention + FFN + LayerNorm)
         ↓
CLS Token Pooling (global chain representation)
         ↓
Output: 256-dim embedding vector
```

```python
import torch
import torch.nn as nn

class OptionSurfaceTransformer(nn.Module):
    def __init__(self, n_features=10, d_model=128, n_heads=4, n_layers=4):
        super().__init__()

        # Project raw features to d_model dimensions
        self.input_proj = nn.Linear(n_features, d_model)

        # CLS token (learnable summary vector)
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model))

        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=512,
            dropout=0.1,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)

        # Output projection
        self.output_proj = nn.Linear(d_model, 256)

    def forward(self, x):
        # x shape: [batch, n_contracts, n_features]
        batch_size = x.shape[0]

        # Project features
        x = self.input_proj(x)  # [batch, n_contracts, d_model]

        # Prepend CLS token
        cls = self.cls_token.expand(batch_size, -1, -1)
        x = torch.cat([cls, x], dim=1)  # [batch, n_contracts+1, d_model]

        # Transformer encoding
        x = self.transformer(x)  # [batch, n_contracts+1, d_model]

        # Extract CLS token as chain summary
        cls_output = x[:, 0, :]  # [batch, d_model]

        return self.output_proj(cls_output)  # [batch, 256]
```

**Token Input Features (per option contract):**
```python
TOKEN_FEATURES = [
    "log_moneyness",      # log(Strike / Spot)
    "dte_normalized",     # Days to Expiry / 30
    "log_volume",         # log(1 + volume)
    "log_oi",             # log(1 + open_interest)
    "bid_ask_spread_pct", # (ask-bid) / mid
    "bid_size_log",       # log(1 + bid_size)
    "ask_size_log",       # log(1 + ask_size)
    "svi_iv",             # SVI-fitted IV for this strike
    "delta",              # Option delta
    "theta_normalized",   # Theta / premium
]
```

### 5.3 Model 2 — Temporal TCN

**File:** `quant_engine/models/temporal_tcn.py`

**What it does:** Processes 60-minute history of NIFTY returns, VIX, and surface features as a time series.

```python
class CausalTCN(nn.Module):
    """Temporal Convolutional Network with causal (no look-ahead) convolutions"""

    def __init__(self, n_inputs, n_channels=[64, 128, 128, 256], kernel_size=3):
        super().__init__()
        layers = []
        for i, out_ch in enumerate(n_channels):
            in_ch = n_inputs if i == 0 else n_channels[i-1]
            dilation = 2 ** i  # Exponential dilation: 1, 2, 4, 8
            padding = (kernel_size - 1) * dilation  # Causal padding

            layers += [
                nn.utils.weight_norm(
                    nn.Conv1d(in_ch, out_ch, kernel_size,
                              padding=padding, dilation=dilation)
                ),
                nn.GELU(),
                nn.Dropout(0.1),
            ]

        self.network = nn.Sequential(*layers)
        self.output_proj = nn.Linear(n_channels[-1], 256)

    def forward(self, x):
        # x: [batch, time_steps, n_features]
        x = x.transpose(1, 2)  # [batch, features, time]
        out = self.network(x)
        out = out[:, :, -1]  # Take last time step only (causal!)
        return self.output_proj(out)
```

**TCN Input Features (per time step, 60 steps of 1-min data):**
```python
TCN_FEATURES = [
    "nifty_log_return",    # 1-min log return
    "nifty_volume",        # Normalized trading volume
    "india_vix",           # VIX level
    "vix_change",          # VIX delta
    "atm_iv",              # ATM IV from surface
    "vrp",                 # IV - RV spread
    "ce_pe_oi_ratio",      # Put-Call OI ratio
    "bid_ask_atm",         # ATM bid-ask spread
]
```

### 5.4 Model 3 — CE/PE Cross-Attention Fusion

**File:** `quant_engine/models/ce_pe_fusion.py`

```python
class CEPECrossAttentionFusion(nn.Module):
    """
    Separate CE and PE chain embeddings, then fuse via cross-attention.
    This captures institutional hedging flows: e.g., massive PE buying
    steepening the skew while CE remains flat.
    """
    def __init__(self, d_model=256, n_heads=4):
        super().__init__()
        self.cross_attn = nn.MultiheadAttention(d_model, n_heads, batch_first=True)
        self.norm = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, 512),
            nn.GELU(),
            nn.Linear(512, 256)
        )

    def forward(self, ce_emb, pe_emb):
        # ce_emb, pe_emb: [batch, n_strikes, 256]
        # Q from CE, K/V from PE (CE "asks" PE what it knows)
        fused, _ = self.cross_attn(query=ce_emb, key=pe_emb, value=pe_emb)
        fused = self.norm(fused + ce_emb)
        return self.ffn(fused.mean(dim=1))  # Pool → [batch, 256]
```

### 5.5 Model 4 — LightGBM Meta-Learner

**File:** `quant_engine/models/meta_learner.py`

```python
import lightgbm as lgb

# Combine all neural embeddings + scalar features
# X = [surface_transformer_emb (256) + tcn_emb (256) + fusion_emb (256) + scalar_features (40)]
# Total: ~808 features

LGBM_PARAMS = {
    "objective": "regression",         # For premium return prediction
    "metric": "rmse",
    "learning_rate": 0.05,
    "num_leaves": 127,
    "max_depth": 8,
    "feature_fraction": 0.7,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "min_child_samples": 50,
    "lambda_l1": 0.1,
    "lambda_l2": 0.1,
    "n_estimators": 1000,
    "early_stopping_rounds": 50,
    "verbose": -1,
}

# Train a SEPARATE LightGBM model per prediction head:
PREDICTION_HEADS = {
    "direction_15m": "multiclass",    # Bearish / Flat / Bullish
    "prem_return_15m": "regression",  # ATM premium % change
    "iv_shift_15m": "regression",     # ATM IV change
    "vrp_30m": "regression",          # Variance risk premium
    "fill_prob": "binary",            # Probability of clean fill
}
```

### 5.6 Training Pipeline

**File:** `quant_engine/models/train.py`

```
Step 1: Load raw features from ClickHouse
Step 2: Apply Purged + Embargoed CV splits (see Section 13)
Step 3: Train Surface Transformer (PyTorch, GPU preferred)
Step 4: Train TCN (PyTorch, GPU preferred)
Step 5: Extract embeddings from trained neural models
Step 6: Concatenate embeddings + scalar features → X_meta
Step 7: Train LightGBM meta-learner on X_meta → Y targets
Step 8: Save all model artifacts to models/saved/
Step 9: Evaluate on holdout set, log metrics
```

**Compute Requirements:**
- Training neural models: Google Colab Pro (T4 GPU, ~₹1000/month) OR local GPU
- LightGBM: Runs fine on any CPU with 16GB RAM
- Inference (live): Single CPU machine is sufficient (sub-second latency)

---

## 6. Phase 4 — Backtesting & Simulator (Month 5–7)

### 6.1 Simulator Architecture

**File:** `quant_engine/simulator/engine.py`

The backtester MUST simulate every cost and friction. No shortcuts.

**Core Simulation Loop:**
```
FOR each 1-minute bar in history:
    1. Reconstruct option chain state at this timestamp
    2. Feed features to trained model → get predictions
    3. Run Policy Engine → get strategy decision
    4. If action ≠ WAIT:
        a. Apply bid-ask bounce (entry at Ask, exit at Bid)
        b. Apply market impact function
        c. Check execution freeze (price band breach)
        d. Apply all statutory costs
        e. Record fill with slippage
    5. Update open positions (mark-to-market)
    6. Check stop-loss / profit-target rules
    7. Log portfolio Greeks
    8. Repeat
```

### 6.2 Exact Cost Model (NSE India)

Every simulated trade MUST subtract all of the following:

```python
def compute_total_cost(premium: float, lots: int, lot_size: int = 50,
                       side: str = "buy", is_exercise: bool = False) -> dict:
    """
    Compute full statutory cost for ONE option leg.
    premium: price per unit (e.g., 120.50)
    lots: number of lots traded
    lot_size: NIFTY = 50 units per lot
    """
    qty = lots * lot_size
    notional_premium = premium * qty

    # 1. STT
    if side == "sell" and not is_exercise:
        stt = 0.00125 * notional_premium  # 0.125% on sell premium
    elif is_exercise:
        # DANGER: STT on FULL NOTIONAL at exercise
        underlying_price = get_nifty_price()  # From live feed
        stt = 0.001 * underlying_price * qty  # 0.1% on total notional
    else:
        stt = 0.0  # No STT on buy side

    # 2. Exchange Transaction Charges
    exchange_charges = 0.0005 * notional_premium  # ~0.05%

    # 3. SEBI Turnover Fee
    sebi_fee = 0.000001 * notional_premium  # 0.0001%

    # 4. Stamp Duty (buy side only)
    stamp_duty = 0.00003 * notional_premium if side == "buy" else 0.0  # 0.003%

    # 5. Brokerage (Kotak Neo flat fee)
    brokerage = 20.0  # ₹20 per order flat

    # 6. GST on (Brokerage + Exchange Charges)
    gst = 0.18 * (brokerage + exchange_charges)

    total_cost = stt + exchange_charges + sebi_fee + stamp_duty + brokerage + gst

    return {
        "stt": stt,
        "exchange": exchange_charges,
        "sebi": sebi_fee,
        "stamp": stamp_duty,
        "brokerage": brokerage,
        "gst": gst,
        "total": total_cost,
        "cost_per_unit": total_cost / qty,
    }
```

### 6.3 Slippage Model

```python
def apply_slippage(mid_price: float, spread: float,
                   order_size: int, depth_size: int,
                   gamma: float = 0.10, alpha: float = 0.5) -> float:
    """
    Market impact + bid-ask slippage model for NIFTY options.

    For NIFTY options (liquid ATM strikes):
    - gamma ≈ 0.10 (impact coefficient)
    - alpha ≈ 0.50 (impact exponent, square root law)
    """
    size_ratio = order_size / max(depth_size, 1)
    impact_multiplier = 1 + gamma * (size_ratio ** alpha)
    effective_spread = spread * impact_multiplier
    return effective_spread / 2  # Half-spread as cost per side
```

### 6.4 Critical Expiry Day Rules

```python
def check_expiry_restrictions(timestamp, position):
    """Block dangerous expiry-day behaviors"""
    is_thursday = timestamp.weekday() == 3
    time = timestamp.time()

    # Block new entries after 14:30 on expiry
    if is_thursday and time >= time(14, 30):
        return "BLOCKED: No new positions after 14:30 on expiry"

    # Force exit OTM options by 15:00 on expiry
    if is_thursday and time >= time(15, 0):
        moneyness = position["strike"] / get_nifty_price()
        if abs(moneyness - 1.0) > 0.005:  # More than 0.5% OTM
            return "FORCE_EXIT: OTM option near expiry worthless"

    # Warn about ITM exercise STT trap
    if is_thursday and time >= time(15, 15):
        if position_is_itm(position):
            intrinsic_value = compute_intrinsic(position)
            stt_on_exercise = 0.001 * get_nifty_price() * 50  # per lot
            if stt_on_exercise > intrinsic_value * 50:
                return "WARNING: STT exceeds intrinsic value. Consider selling, not holding to exercise."

    return "OK"
```

### 6.5 Performance Metrics to Track

| Metric | Formula | Target |
|--------|---------|--------|
| Sharpe Ratio | `Mean(daily_PnL) / Std(daily_PnL) × √252` | > 1.5 |
| Calmar Ratio | `Annual Return / Max Drawdown` | > 1.0 |
| Win Rate | `Winning trades / Total trades` | > 45% |
| Profit Factor | `Gross Profit / Gross Loss` | > 1.5 |
| Max Drawdown | `Peak-to-trough capital drop` | < 15% |
| Avg Trade Duration | Minutes per trade | 15–120 min |
| Cost-Adjusted Alpha | `Return − Benchmark` | > 0 |

---

## 7. Phase 5 — Policy Engine & EV Optimizer (Month 7–8)

### 7.1 EV Engine

**File:** `quant_engine/strategy/ev_engine.py`

```python
def compute_strategy_ev(strategy: dict, model_outputs: dict,
                        greeks: dict, market: dict) -> float:
    """
    Compute Expected Value for a multi-leg option strategy.

    EV = Σ_i [E[ΔS]·Δᵢ + 0.5·E[(ΔS)²]·Γᵢ + E[Δσᵢ]·Vᵢ + Θᵢ·Δt]
         + Surface_Edge − Friction − λ·CVaR
    """
    ev = 0.0

    for leg in strategy["legs"]:
        sign = 1 if leg["side"] == "buy" else -1
        delta = greeks[leg["strike"]][leg["type"]]["delta"]
        gamma = greeks[leg["strike"]][leg["type"]]["gamma"]
        vega  = greeks[leg["strike"]][leg["type"]]["vega"]
        theta = greeks[leg["strike"]][leg["type"]]["theta"]

        # Direction component (from TCN prediction)
        ev_direction = model_outputs["E_delta_S"] * delta

        # Convexity component (gamma scalping)
        ev_gamma = 0.5 * model_outputs["E_delta_S_sq"] * gamma

        # Volatility edge component
        ev_vega = model_outputs["E_delta_iv"] * vega

        # Time decay (always works against long options)
        dt = 1.0 / (375 * 60)  # 1 minute as fraction of trading year
        ev_theta = theta * dt

        leg_ev = sign * (ev_direction + ev_gamma + ev_vega + ev_theta)
        ev += leg_ev

    # Add surface mispricing edge
    ev += market["surface_edge"]

    # Subtract execution friction
    ev -= strategy["total_friction"]

    # Apply tail risk penalty (CVaR)
    lambda_risk = 0.3  # Risk aversion coefficient
    ev -= lambda_risk * strategy["cvar_estimate"]

    return ev
```

### 7.2 Strategy Definitions

```python
STRATEGIES = {
    "WAIT": {
        "legs": [],
        "description": "No position"
    },
    "BUY_ATM_CALL": {
        "legs": [{"type": "CE", "moneyness": 1.0, "side": "buy"}],
        "description": "Long ATM Call — directional bullish"
    },
    "BUY_ATM_PUT": {
        "legs": [{"type": "PE", "moneyness": 1.0, "side": "buy"}],
        "description": "Long ATM Put — directional bearish"
    },
    "BUY_CALL_SPREAD": {
        "legs": [
            {"type": "CE", "moneyness": 1.0,  "side": "buy"},
            {"type": "CE", "moneyness": 1.02, "side": "sell"},
        ],
        "description": "Bullish debit spread — capped risk/reward"
    },
    "BUY_PUT_SPREAD": {
        "legs": [
            {"type": "PE", "moneyness": 1.0,  "side": "buy"},
            {"type": "PE", "moneyness": 0.98, "side": "sell"},
        ],
        "description": "Bearish debit spread"
    },
    "LONG_STRADDLE": {
        "legs": [
            {"type": "CE", "moneyness": 1.0, "side": "buy"},
            {"type": "PE", "moneyness": 1.0, "side": "buy"},
        ],
        "description": "Buy both ATM CE + PE — bet on big move any direction"
    },
    "LONG_STRANGLE": {
        "legs": [
            {"type": "CE", "moneyness": 1.02, "side": "buy"},
            {"type": "PE", "moneyness": 0.98, "side": "buy"},
        ],
        "description": "Buy OTM CE + PE — cheaper than straddle, needs bigger move"
    },
}
```

### 7.3 Strategy Ranking & Selection

```python
def select_strategy(model_outputs: dict, market: dict,
                    portfolio: dict) -> str:
    """Rank all strategies by EV, select best valid one"""

    ev_scores = {}
    for name, strategy in STRATEGIES.items():
        if name == "WAIT":
            ev_scores[name] = 0.0
            continue

        # Compute EV
        ev = compute_strategy_ev(strategy, model_outputs, market)

        # Hard filters
        if ev <= 0:
            continue  # Never trade negative EV

        if not check_margin_available(strategy, portfolio):
            continue  # Skip if insufficient margin

        if not check_greek_limits(strategy, portfolio):
            continue  # Skip if would breach Greek limits

        ev_scores[name] = ev

    if not ev_scores or max(ev_scores.values()) <= 0:
        return "WAIT"

    return max(ev_scores, key=ev_scores.get)
```

---

## 8. Phase 6 — Live Deployment (Month 9–12)

### 8.1 Live Execution Engine

**File:** `quant_engine/execution/executor.py`

```python
class LiveExecutor:
    def __init__(self, neo_client, risk_manager):
        self.neo = neo_client
        self.risk = risk_manager

    def execute_strategy(self, strategy_name: str, signal: dict):
        """Execute a multi-leg strategy via Kotak Neo"""

        strategy = STRATEGIES[strategy_name]
        atm_strike = round(signal["nifty_price"] / 50) * 50  # Round to nearest 50

        orders = []
        for leg in strategy["legs"]:
            # Determine exact strike
            strike = round(atm_strike * leg["moneyness"] / 50) * 50

            # Build order
            order = {
                "trading_symbol": f"NIFTY{signal['expiry']}{strike}{leg['type']}",
                "exchange_segment": "nfo_fo",
                "transaction_type": "B" if leg["side"] == "buy" else "S",
                "quantity": signal["lots"] * 50,
                "order_type": "L",  # Limit order
                "price": self._compute_limit_price(strike, leg),
                "validity": "IOC",  # Immediate or Cancel
                "product": "MIS",   # Intraday
            }
            orders.append(order)

        # Pre-flight risk check
        if not self.risk.approve(orders):
            return {"status": "REJECTED", "reason": "Risk limit breached"}

        # Place legs sequentially (CE first for spreads)
        results = []
        for order in orders:
            result = self.neo.place_order(**order)
            results.append(result)

        return results

    def _compute_limit_price(self, strike, leg):
        """Set limit price at mid + small buffer"""
        chain = self.neo.option_chain("NIFTY")
        contract = chain[strike][leg["type"]]
        mid = (contract["bid"] + contract["ask"]) / 2

        if leg["side"] == "buy":
            return round(mid * 1.002, 1)   # Bid up 0.2% to improve fill chance
        else:
            return round(mid * 0.998, 1)   # Ask down 0.2%
```

### 8.2 Telegram Alert Bot

**File:** `quant_engine/monitoring/alerts.py`

```python
import requests

TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"

def send_alert(message: str, level: str = "INFO"):
    """Send trade alerts to Telegram"""
    emoji = {"INFO": "ℹ️", "TRADE": "✅", "STOP": "🛑", "WARN": "⚠️"}
    text = f"{emoji.get(level, '')} [{level}]\n{message}"

    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT_ID, "text": text}
    )

# Example usage:
# send_alert(f"TRADE: BUY_STRADDLE @ 22050 | EV=2.3 | Lots=1", "TRADE")
# send_alert(f"STOP: Portfolio Delta > limit. Force closing.", "STOP")
```

### 8.3 Risk Management Rules (Hard Limits)

```python
RISK_LIMITS = {
    "max_portfolio_delta": 200,      # Max net delta exposure
    "max_portfolio_vega": 5000,      # Max vega (₹ per 1% IV move)
    "max_daily_loss": 10000,         # Stop trading if P&L < -₹10,000
    "max_drawdown_pct": 0.10,        # Stop if 10% drawdown from peak
    "max_open_positions": 3,          # Max concurrent strategies
    "max_lots_per_trade": 2,          # Max 2 lots per order (₹1-2L margin)
    "no_trade_before": "09:20",       # Wait for market to settle
    "no_trade_after": "15:00",        # No new positions in final 30 min
    "no_new_trade_on_expiry_after": "14:30",  # Expiry day cutoff
}
```

---

## 9. Complete File & Folder Structure

```
nifty_options_algo/
│
├── README.md                          # Project overview
├── requirements.txt                   # All Python dependencies
├── .env                               # API keys (NEVER commit to git)
├── config.py                          # Central config (risk limits, params)
│
├── quant_engine/
│   │
│   ├── data/
│   │   ├── __init__.py
│   │   ├── kotak_client.py            # Kotak Neo API wrapper
│   │   ├── ingestor.py                # Option chain → ClickHouse writer
│   │   ├── nse_historical.py          # NSE Bhav Copy downloader
│   │   └── surface_calibrator.py     # SVI/SABR IV surface fitter
│   │
│   ├── features/
│   │   ├── __init__.py
│   │   ├── greeks.py                  # Delta, Gamma, Vega, Theta
│   │   ├── store.py                   # Feature computation & caching
│   │   └── labels.py                  # Y target generation
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── surface_transformer.py     # PyTorch: Option chain attention
│   │   ├── temporal_tcn.py            # PyTorch: Causal temporal model
│   │   ├── ce_pe_fusion.py            # PyTorch: CE/PE cross-attention
│   │   ├── meta_learner.py            # LightGBM meta-model
│   │   ├── train.py                   # End-to-end training pipeline
│   │   ├── inference.py               # Live inference wrapper
│   │   └── saved/                     # Trained model artifacts
│   │       ├── surface_transformer.pt
│   │       ├── tcn_model.pt
│   │       ├── lgbm_direction.pkl
│   │       ├── lgbm_prem_return.pkl
│   │       └── lgbm_vrp.pkl
│   │
│   ├── strategy/
│   │   ├── __init__.py
│   │   ├── ev_engine.py               # EV computation per strategy
│   │   ├── ranker.py                  # Strategy ranking & selection
│   │   └── definitions.py             # Strategy leg definitions
│   │
│   ├── simulator/
│   │   ├── __init__.py
│   │   ├── engine.py                  # Event-driven backtester
│   │   ├── cost_model.py              # STT, exchange fees, GST, slippage
│   │   └── expiry_rules.py            # Expiry day special handling
│   │
│   ├── execution/
│   │   ├── __init__.py
│   │   ├── executor.py                # Live order placement via Kotak Neo
│   │   └── order_tracker.py           # Open position tracking
│   │
│   ├── risk/
│   │   ├── __init__.py
│   │   └── risk_manager.py            # Real-time Greek + PnL limits
│   │
│   ├── validation/
│   │   ├── __init__.py
│   │   └── cv_purger.py               # Purged + Embargoed CV splits
│   │
│   ├── monitoring/
│   │   ├── __init__.py
│   │   ├── alerts.py                  # Telegram bot
│   │   ├── dashboard.py               # Streamlit live dashboard
│   │   └── decay_monitor.py           # Alpha decay tracker
│   │
│   └── main.py                        # Master orchestrator (live mode)
│
├── notebooks/
│   ├── 01_data_exploration.ipynb      # EDA on raw option chain data
│   ├── 02_iv_surface_analysis.ipynb   # IV surface visualization
│   ├── 03_feature_importance.ipynb    # Feature SHAP analysis
│   ├── 04_model_training.ipynb        # Training experiments
│   └── 05_backtest_results.ipynb      # Full backtest report
│
├── scripts/
│   ├── setup_clickhouse.sh            # Install & configure ClickHouse
│   ├── download_historical.py         # Bulk historical data downloader
│   ├── run_backtest.py                # Standalone backtest runner
│   └── run_live.py                    # Live trading runner
│
└── tests/
    ├── test_ingestor.py
    ├── test_surface_calibrator.py
    ├── test_cost_model.py
    ├── test_ev_engine.py
    └── test_risk_manager.py
```

---

## 10. Database Schema (ClickHouse)

```sql
-- Raw option chain snapshots
CREATE TABLE nse_options.option_chain_snapshots (
    timestamp     DateTime64(3, 'Asia/Kolkata'),
    underlying_symbol LowCardinality(String),
    underlying_price  Float64,
    expiry_date   Date,
    strike        Float64,
    option_type   Enum8('CE' = 1, 'PE' = 2),
    bid_price     Float64,
    bid_size      UInt32,
    ask_price     Float64,
    ask_size      UInt32,
    ltp           Float64,
    volume        UInt32,
    open_interest UInt64
) ENGINE = ReplacingMergeTree(timestamp)
ORDER BY (underlying_symbol, expiry_date, strike, option_type, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- Computed IV surface snapshots
CREATE TABLE nse_options.iv_surface (
    timestamp      DateTime64(3, 'Asia/Kolkata'),
    expiry_date    Date,
    strike         Float64,
    option_type    Enum8('CE' = 1, 'PE' = 2),
    raw_iv         Float32,
    svi_iv         Float32,
    log_moneyness  Float32,
    dte_days       UInt16,
    delta          Float32,
    gamma          Float32,
    vega           Float32,
    theta          Float32
) ENGINE = MergeTree()
ORDER BY (timestamp, expiry_date, strike, option_type);

-- Computed features (for ML training)
CREATE TABLE nse_options.features (
    timestamp      DateTime64(3, 'Asia/Kolkata'),
    atm_iv         Float32,
    vrp_15m        Float32,
    skew_25d       Float32,
    rv_15m         Float32,
    rv_30m         Float32,
    obi_atm        Float32,
    pcr_oi         Float32,
    pcr_volume     Float32,
    vix            Float32,
    vix_change     Float32,
    dte            UInt16,
    minutes_to_close UInt16
) ENGINE = MergeTree()
ORDER BY timestamp;

-- Trade log
CREATE TABLE nse_options.trades (
    trade_id       UUID DEFAULT generateUUIDv4(),
    timestamp      DateTime64(3, 'Asia/Kolkata'),
    strategy       String,
    action         Enum8('OPEN'=1, 'CLOSE'=2),
    strike         Float64,
    option_type    Enum8('CE'=1, 'PE'=2),
    side           Enum8('BUY'=1, 'SELL'=2),
    lots           UInt8,
    fill_price     Float64,
    total_cost     Float64,
    ev_at_entry    Float32,
    pnl            Nullable(Float64)
) ENGINE = MergeTree()
ORDER BY timestamp;
```

---

## 11. API & Broker Integration — Kotak Neo

### Available Endpoints

| Endpoint | Method | Use |
|----------|--------|-----|
| `option_chain()` | GET | Fetch full NIFTY option chain |
| `historical_data()` | GET | 1-min candles (up to 60 days back) |
| `place_order()` | POST | Submit new order |
| `cancel_order()` | DELETE | Cancel pending order |
| `order_report()` | GET | All today's orders + status |
| `positions()` | GET | Current open positions |
| `portfolio()` | GET | Holdings + PnL |
| `margin_required()` | POST | Check margin before placing |

### WebSocket Streaming
```python
# Subscribe to live quotes for specific instruments
def on_message(data):
    # data contains live bid/ask/LTP updates
    process_live_quote(data)

client.subscribe(
    instrument_tokens=["NIFTY2412022050CE", "NIFTY2412022050PE"],
    on_message=on_message
)
```

### Instrument Naming Convention
```
Format: {SYMBOL}{EXPIRY_DDMMMYY}{STRIKE}{TYPE}
Example: NIFTY24DEC2022050CE
         NIFTY24DEC2022050PE
         NIFTY25JAN2222100CE
```

---

## 12. Risk Management Rules

### Pre-Trade Checks (Before Every Order)
1. Is daily P&L > −₹10,000? (If not, stop trading)
2. Will this trade keep portfolio delta within ±200?
3. Is margin available (with 20% buffer)?
4. Is it before 15:00? (Hard cutoff for new positions)
5. If expiry day, is it before 14:30?
6. Is the bid-ask spread < 2% of premium? (Liquidity check)

### In-Trade Monitoring (Every Minute)
1. Is P&L on any open trade < −30% of premium paid? → Stop Loss
2. Is P&L on any open trade > +50% of premium paid? → Take Profit
3. Has portfolio delta exceeded limit? → Delta hedge or close
4. Is expiry in < 60 minutes and position is OTM? → Force exit

### Post-Trade Logging
Every trade must log: entry price, exit price, slippage, all costs, fill latency, model EV at entry, actual realized P&L, strategy used.

---

## 13. Validation Framework

### Purged + Embargoed Cross-Validation

```python
# File: quant_engine/validation/cv_purger.py

def purged_kfold_split(df, n_splits=5, purge_minutes=30, embargo_weeks=2):
    """
    Proper time-series CV for options. Prevents ALL forms of data leakage.

    purge_minutes: Remove training samples whose label window overlaps test
    embargo_weeks: Remove training samples immediately after test window
    """
    splits = []
    fold_size = len(df) // n_splits

    for fold in range(n_splits - 1):
        test_start = fold * fold_size
        test_end   = (fold + 1) * fold_size

        # Purge: remove samples that "see" the future test window
        purge_cutoff = df.index[test_start] - pd.Timedelta(minutes=purge_minutes)
        train_before = df[df.index <= purge_cutoff]

        # Embargo: remove samples too close after test
        embargo_cutoff = df.index[test_end] + pd.Timedelta(weeks=embargo_weeks)
        train_after = df[df.index >= embargo_cutoff]

        train = pd.concat([train_before, train_after])
        test  = df.iloc[test_start:test_end]

        splits.append((train.index, test.index))

    return splits
```

### Walk-Forward Validation Schedule

| Period | Train | Test |
|--------|-------|------|
| Round 1 | Expiries 1–24 | Expiries 25–28 |
| Round 2 | Expiries 1–28 | Expiries 29–32 |
| Round 3 | Expiries 1–32 | Expiries 33–36 |
| … | … | … |

### Regime Stress Tests (Mandatory)

The backtest must be run separately on these market regimes and performance must be positive in ALL:

| Regime | VIX Range | Characteristics |
|--------|-----------|----------------|
| Low Vol | VIX 10–15 | Slow grind, expensive to buy options |
| Normal | VIX 15–20 | Typical NSE market |
| High Vol | VIX 20–28 | Post-event, mean-reversion rich |
| Crisis | VIX > 28 | Extreme moves, wide spreads |
| Expiry Day | Any | Gamma risk, crush patterns |
| RBI Day | Any | IV expansion, post-crush |
| Budget Day | Any | Extreme gap risk |

---

## 14. Infrastructure & Cost Estimate

### Minimum Setup (MVP Phase — Month 1–6)

| Component | Tool | Monthly Cost |
|-----------|------|-------------|
| Cloud Server | AWS t3.medium OR DigitalOcean 4GB | ₹1,500–3,000 |
| Database | ClickHouse (self-hosted on same server) | ₹0 |
| GPU Training | Google Colab Pro | ₹1,000 |
| Historical Data | NSE Bhav Copy (free) + Kotak Neo API (free) | ₹0 |
| Monitoring | Telegram Bot (free) | ₹0 |
| **Total** | | **~₹2,500–4,000/month** |

### Production Setup (Month 7+)

| Component | Tool | Monthly Cost |
|-----------|------|-------------|
| Dedicated Server | AWS c5.2xlarge (8 vCPU) | ₹8,000–12,000 |
| Tick Data | True Data / Global Data Feed | ₹2,000–5,000 |
| Monitoring | Grafana + ClickHouse | ₹500 |
| Backup | S3 Glacier | ₹200 |
| **Total** | | **~₹12,000–18,000/month** |

### Software Dependencies (requirements.txt)

```
# Core
pandas>=2.0
numpy>=1.24
scipy>=1.10
clickhouse-connect>=0.6

# ML
torch>=2.0
lightgbm>=4.0
scikit-learn>=1.3
shap>=0.43

# Data
neo-api-client>=1.0
requests>=2.31
aiohttp>=3.9
pytz>=2023.3

# Visualization
streamlit>=1.28
plotly>=5.17

# Utilities
python-dotenv>=1.0
loguru>=0.7
pytest>=7.4
```

---

## 15. Hard Failure Modes & How to Avoid Them

| Failure Mode | Why It Happens | How to Prevent |
|-------------|---------------|----------------|
| **Mid-price backtest bias** | Simulating execution at mid rather than ask/bid | Always use ask on entry, bid on exit in simulator |
| **STT exercise trap** | Holding ITM options to expiry, STT on notional destroys P&L | Force-exit all ITM options by 15:00 on Thursday |
| **Look-ahead bias in features** | Rolling features computed on future data | Use `.shift(1)` on all features, use purged CV |
| **Regime shift model failure** | Model trained on high-VIX, deployed in low-VIX | Tag each sample with VIX regime, test on all regimes |
| **Execution freeze** | NSE price bands breached during fast moves | Check circuit limits before order placement |
| **API disconnection** | Network drop during live trading | Auto-reconnect + position reconciliation on restart |
| **Margin shortfall** | Underestimated SPAN margin | Check margin via API BEFORE placing, 20% buffer |
| **Overfitting** | Model memorizes past specific events | Walk-forward validation, embargo periods, keep model simple |
| **Adverse selection** | Getting filled only on bad prices | IOC order type + limit prices close to mid |

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| ATM | At-the-Money: Strike closest to current spot |
| OTM | Out-of-the-Money: Strike away from spot (no intrinsic value) |
| ITM | In-the-Money: Strike with intrinsic value |
| IV | Implied Volatility: Market's expectation of future volatility |
| RV | Realized Volatility: Actual historical volatility |
| VRP | Variance Risk Premium: IV − RV (usually positive, sellers earn this) |
| DTE | Days To Expiry |
| SVI | Stochastic Volatility Inspired: Mathematical smile fitting formula |
| SABR | Stochastic Alpha Beta Rho: Another smile model |
| EV | Expected Value: Probability-weighted average outcome |
| CVaR | Conditional Value at Risk: Expected loss in worst X% scenarios |
| OBI | Order Book Imbalance: (Ask qty − Bid qty) / Total qty |
| PCR | Put-Call Ratio: Measure of market sentiment |
| TBT | Tick-By-Tick: Every individual trade/quote update |
| MFE | Maximum Favorable Excursion: Best unrealized P&L during trade |
| MAE | Maximum Adverse Excursion: Worst unrealized loss during trade |
| STT | Securities Transaction Tax: Government tax on options trades |
| SPAN | Standard Portfolio Analysis of Risk: NSE's margin system |
| TCN | Temporal Convolutional Network: Time-series deep learning model |
| LightGBM | Light Gradient Boosting Machine: Fast tree-based ML model |

---

*Document Version: 1.0 | Last Updated: June 2026 | For internal research use only.*
*This is a quantitative research blueprint, not financial advice. All trading involves risk of loss.*
