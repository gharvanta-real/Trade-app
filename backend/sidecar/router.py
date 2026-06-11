"""
router.py — Kotak Neo REST API routes.
Handles: credentials CRUD, login (auto-TOTP), session status, order placement,
         order cancel/modify, live quotes, historical OHLCV, instrument search, funds.
"""

import asyncio
import logging
import sys
import threading
import time
import warnings
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import pyotp
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from credentials import save_credentials, load_credentials, get_masked_credentials

# ── Suppress yfinance / pandas deprecation noise ──────────────────────────────
def _custom_showwarning(message, category, filename, lineno, file=None, line=None):
    msg = str(message).lower()
    cat = str(category).lower()
    if "utcnow" in msg or "pandas4" in cat or "deprecation" in cat or "deprecation" in msg:
        return
    try:
        if file is None:
            file = sys.stderr
        if file is not None:
            file.write(warnings.formatwarning(message, category, filename, lineno, line))
    except Exception:
        pass

warnings.showwarning = _custom_showwarning
warnings.filterwarnings("ignore")

class _WarningFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage().lower()
        if "utcnow" in msg or "pandas4" in msg or "deprecation" in msg:
            return False
        return True

logging.getLogger("py.warnings").addFilter(_WarningFilter())
logging.getLogger().addFilter(_WarningFilter())

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

# ── In-memory session state ───────────────────────────────────────────────────
_session: Dict[str, Any] = {
    "client":       None,
    "status":       "DISCONNECTED",
    "error":        None,
    "access_token": None,
    "sid":          None,
}

# ── Feed state ────────────────────────────────────────────────────────────────
_feed_clients:      List[asyncio.Queue] = []
_feed_loop:         Optional[asyncio.AbstractEventLoop] = None
_feed_started:      bool = False
_feed_last_error:   Optional[str] = None
_feed_last_tick_ts: float = 0.0

# ── yfinance index quote cache ────────────────────────────────────────────────
_index_quote_cache:    Dict[str, Dict[str, Any]] = {}
_index_quote_cache_ts: Dict[str, float] = {}
_index_quote_pending:  set = set()
_quote_executor = ThreadPoolExecutor(max_workers=3)

router = APIRouter(prefix="/api/kotak")

# ── Pydantic request models ───────────────────────────────────────────────────
class CredentialsRequest(BaseModel):
    ucc:          str
    mobile_number: str
    consumer_key: str
    mpin:         str
    totp_secret:  Optional[str] = ""

class LoginRequest(BaseModel):
    totp_code: Optional[str] = None

class OrderRequest(BaseModel):
    exchange_segment: str
    product:          str
    price:            float
    order_type:       str
    quantity:         int
    validity:         str
    trading_symbol:   str
    transaction_type: str
    trigger_price:    Optional[float] = 0.0
    amo:              Optional[str]   = "NO"

class ModifyOrderRequest(BaseModel):
    order_id:         str
    quantity:         int
    price:            float
    trigger_price:    Optional[float] = 0.0
    order_type:       str
    validity:         str
    trading_symbol:   str
    exchange_segment: str
    product:          str
    transaction_type: str

# ── Instrument master (NSE F&O + Cash) ───────────────────────────────────────
INSTRUMENTS = [
    {"name": "NIFTY 50",   "symbol": "NIFTY 50",   "exchange": "NSE", "type": "Index",  "token": "26000", "lot_size": 50,  "yf_symbol": "^NSEI"},
    {"name": "BANKNIFTY",  "symbol": "BANKNIFTY",  "exchange": "NSE", "type": "Index",  "token": "26009", "lot_size": 15,  "yf_symbol": "^NSEBANK"},
    {"name": "FINNIFTY",   "symbol": "FINNIFTY",   "exchange": "NSE", "type": "Index",  "token": "26037", "lot_size": 40,  "yf_symbol": "NIFTY_FIN_SERVICE.NS"},
    {"name": "MIDCPNIFTY", "symbol": "MIDCPNIFTY", "exchange": "NSE", "type": "Index",  "token": "26074", "lot_size": 75,  "yf_symbol": "^CNXMIDCAP"},
    {"name": "SENSEX",     "symbol": "SENSEX",     "exchange": "BSE", "type": "Index",  "token": "1",     "lot_size": 10,  "yf_symbol": "^BSESN"},
    {"name": "RELIANCE",   "symbol": "RELIANCE",   "exchange": "NSE", "type": "Equity", "token": "2885",  "lot_size": 1,   "yf_symbol": "RELIANCE.NS"},
    {"name": "HDFCBANK",   "symbol": "HDFCBANK",   "exchange": "NSE", "type": "Equity", "token": "1333",  "lot_size": 1,   "yf_symbol": "HDFCBANK.NS"},
    {"name": "TCS",        "symbol": "TCS",        "exchange": "NSE", "type": "Equity", "token": "11536", "lot_size": 1,   "yf_symbol": "TCS.NS"},
    {"name": "INFY",       "symbol": "INFY",       "exchange": "NSE", "type": "Equity", "token": "1594",  "lot_size": 1,   "yf_symbol": "INFY.NS"},
    {"name": "ICICIBANK",  "symbol": "ICICIBANK",  "exchange": "NSE", "type": "Equity", "token": "4963",  "lot_size": 1,   "yf_symbol": "ICICIBANK.NS"},
    {"name": "KOTAKBANK",  "symbol": "KOTAKBANK",  "exchange": "NSE", "type": "Equity", "token": "1922",  "lot_size": 1,   "yf_symbol": "KOTAKBANK.NS"},
    {"name": "SBIN",       "symbol": "SBIN",       "exchange": "NSE", "type": "Equity", "token": "3045",  "lot_size": 1,   "yf_symbol": "SBIN.NS"},
    {"name": "AXISBANK",   "symbol": "AXISBANK",   "exchange": "NSE", "type": "Equity", "token": "5900",  "lot_size": 1,   "yf_symbol": "AXISBANK.NS"},
    {"name": "LT",         "symbol": "LT",         "exchange": "NSE", "type": "Equity", "token": "11483", "lot_size": 1,   "yf_symbol": "LT.NS"},
    {"name": "ITC",        "symbol": "ITC",        "exchange": "NSE", "type": "Equity", "token": "1660",  "lot_size": 1,   "yf_symbol": "ITC.NS"},
    {"name": "HINDUNILVR", "symbol": "HINDUNILVR", "exchange": "NSE", "type": "Equity", "token": "1394",  "lot_size": 1,   "yf_symbol": "HINDUNILVR.NS"},
    {"name": "ASIANPAINT", "symbol": "ASIANPAINT", "exchange": "NSE", "type": "Equity", "token": "236",   "lot_size": 1,   "yf_symbol": "ASIANPAINT.NS"},
    {"name": "MARUTI",     "symbol": "MARUTI",     "exchange": "NSE", "type": "Equity", "token": "10999", "lot_size": 1,   "yf_symbol": "MARUTI.NS"},
    {"name": "BAJFINANCE", "symbol": "BAJFINANCE", "exchange": "NSE", "type": "Equity", "token": "317",   "lot_size": 1,   "yf_symbol": "BAJFINANCE.NS"},
    {"name": "ADANIENT",   "symbol": "ADANIENT",   "exchange": "NSE", "type": "Equity", "token": "25",    "lot_size": 1,   "yf_symbol": "ADANIENT.NS"},
    {"name": "TATAMOTORS", "symbol": "TATAMOTORS", "exchange": "NSE", "type": "Equity", "token": "3456",  "lot_size": 1,   "yf_symbol": "TATAMOTORS.NS"},
    {"name": "WIPRO",      "symbol": "WIPRO",      "exchange": "NSE", "type": "Equity", "token": "3787",  "lot_size": 1,   "yf_symbol": "WIPRO.NS"},
    {"name": "HCLTECH",    "symbol": "HCLTECH",    "exchange": "NSE", "type": "Equity", "token": "1363",  "lot_size": 1,   "yf_symbol": "HCLTECH.NS"},
    {"name": "TECHM",      "symbol": "TECHM",      "exchange": "NSE", "type": "Equity", "token": "13538", "lot_size": 1,   "yf_symbol": "TECHM.NS"},
    {"name": "ONGC",       "symbol": "ONGC",       "exchange": "NSE", "type": "Equity", "token": "2475",  "lot_size": 1,   "yf_symbol": "ONGC.NS"},
    {"name": "NTPC",       "symbol": "NTPC",       "exchange": "NSE", "type": "Equity", "token": "11630", "lot_size": 1,   "yf_symbol": "NTPC.NS"},
    {"name": "POWERGRID",  "symbol": "POWERGRID",  "exchange": "NSE", "type": "Equity", "token": "14977", "lot_size": 1,   "yf_symbol": "POWERGRID.NS"},
    {"name": "COALINDIA",  "symbol": "COALINDIA",  "exchange": "NSE", "type": "Equity", "token": "20374", "lot_size": 1,   "yf_symbol": "COALINDIA.NS"},
    {"name": "BPCL",       "symbol": "BPCL",       "exchange": "NSE", "type": "Equity", "token": "526",   "lot_size": 1,   "yf_symbol": "BPCL.NS"},
    {"name": "IOC",        "symbol": "IOC",        "exchange": "NSE", "type": "Equity", "token": "1624",  "lot_size": 1,   "yf_symbol": "IOC.NS"},
    {"name": "TITAN",      "symbol": "TITAN",      "exchange": "NSE", "type": "Equity", "token": "3506",  "lot_size": 1,   "yf_symbol": "TITAN.NS"},
    {"name": "NESTLEIND",  "symbol": "NESTLEIND",  "exchange": "NSE", "type": "Equity", "token": "17963", "lot_size": 1,   "yf_symbol": "NESTLEIND.NS"},
    {"name": "SUNPHARMA",  "symbol": "SUNPHARMA",  "exchange": "NSE", "type": "Equity", "token": "3351",  "lot_size": 1,   "yf_symbol": "SUNPHARMA.NS"},
    {"name": "DRREDDY",    "symbol": "DRREDDY",    "exchange": "NSE", "type": "Equity", "token": "881",   "lot_size": 1,   "yf_symbol": "DRREDDY.NS"},
    {"name": "CIPLA",      "symbol": "CIPLA",      "exchange": "NSE", "type": "Equity", "token": "694",   "lot_size": 1,   "yf_symbol": "CIPLA.NS"},
    {"name": "TATASTEEL",  "symbol": "TATASTEEL",  "exchange": "NSE", "type": "Equity", "token": "3499",  "lot_size": 1,   "yf_symbol": "TATASTEEL.NS"},
    {"name": "JSWSTEEL",   "symbol": "JSWSTEEL",   "exchange": "NSE", "type": "Equity", "token": "11723", "lot_size": 1,   "yf_symbol": "JSWSTEEL.NS"},
    {"name": "HINDALCO",   "symbol": "HINDALCO",   "exchange": "NSE", "type": "Equity", "token": "1363",  "lot_size": 1,   "yf_symbol": "HINDALCO.NS"},
    {"name": "BHARTIARTL", "symbol": "BHARTIARTL", "exchange": "NSE", "type": "Equity", "token": "10604", "lot_size": 1,   "yf_symbol": "BHARTIARTL.NS"},
    {"name": "ULTRACEMCO", "symbol": "ULTRACEMCO", "exchange": "NSE", "type": "Equity", "token": "11532", "lot_size": 1,   "yf_symbol": "ULTRACEMCO.NS"},
    {"name": "GRASIM",     "symbol": "GRASIM",     "exchange": "NSE", "type": "Equity", "token": "1232",  "lot_size": 1,   "yf_symbol": "GRASIM.NS"},
    {"name": "DIVISLAB",   "symbol": "DIVISLAB",   "exchange": "NSE", "type": "Equity", "token": "10940", "lot_size": 1,   "yf_symbol": "DIVISLAB.NS"},
    {"name": "ZOMATO",     "symbol": "ZOMATO",     "exchange": "NSE", "type": "Equity", "token": "21296", "lot_size": 1,   "yf_symbol": "ZOMATO.NS"},
    {"name": "PAYTM",      "symbol": "PAYTM",      "exchange": "NSE", "type": "Equity", "token": "21302", "lot_size": 1,   "yf_symbol": "PAYTM.NS"},
    {"name": "IRCTC",      "symbol": "IRCTC",      "exchange": "NSE", "type": "Equity", "token": "13611", "lot_size": 1,   "yf_symbol": "IRCTC.NS"},
    {"name": "NYKAA",      "symbol": "NYKAA",      "exchange": "NSE", "type": "Equity", "token": "21304", "lot_size": 1,   "yf_symbol": "NYKAA.NS"},
    {"name": "DMART",      "symbol": "DMART",      "exchange": "NSE", "type": "Equity", "token": "19913", "lot_size": 1,   "yf_symbol": "DMART.NS"},
    {"name": "PIDILITIND", "symbol": "PIDILITIND", "exchange": "NSE", "type": "Equity", "token": "2664",  "lot_size": 1,   "yf_symbol": "PIDILITIND.NS"},
    {"name": "BAJAJFINSV", "symbol": "BAJAJFINSV", "exchange": "NSE", "type": "Equity", "token": "16675", "lot_size": 1,   "yf_symbol": "BAJAJFINSV.NS"},
    {"name": "M&M",        "symbol": "M&M",        "exchange": "NSE", "type": "Equity", "token": "2031",  "lot_size": 1,   "yf_symbol": "M&M.NS"},
]

YF_MAP = {inst["name"]: inst["yf_symbol"] for inst in INSTRUMENTS}

# ── Utility helpers ───────────────────────────────────────────────────────────
def _ensure_connected():
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        raise HTTPException(status_code=401, detail="Not connected")
    return client

def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, "", "NA", "--"):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

def _as_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, "", "NA", "--"):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default

def _extract_rows(response: Any) -> List[Any]:
    if isinstance(response, list):
        return response
    if not isinstance(response, dict):
        return []
    for key in ("data", "Data", "result", "Result", "orders", "OrderBook", "Positions", "holdings", "HoldingVal"):
        value = response.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = _extract_rows(value)
            if nested:
                return nested
    return []

def _kotak_segment(exchange: str) -> str:
    exchange = (exchange or "NSE").upper()
    if exchange == "BSE":
        return "bse_cm"
    if exchange in ("NFO", "NSE_FO"):
        return "nse_fo"
    if exchange in ("BFO", "BSE_FO"):
        return "bse_fo"
    return "nse_cm"

def _quote_items(response: Any) -> List[Dict[str, Any]]:
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if not isinstance(response, dict):
        return []
    if isinstance(response.get("data"), list):
        return [item for item in response["data"] if isinstance(item, dict)]
    if isinstance(response.get("result"), list):
        return [item for item in response["result"] if isinstance(item, dict)]
    if isinstance(response.get("message"), list):
        return [item for item in response["message"] if isinstance(item, dict)]
    if isinstance(response.get("data"), dict):
        return _quote_items(response["data"])
    return []

def _quote_token(item: Dict[str, Any]) -> str:
    token = (
        item.get("instrument_token")
        or item.get("exchange_token")
        or item.get("tk")
        or item.get("token")
    )
    return str(token or "")

def _broker_error(response: Any) -> Optional[str]:
    if isinstance(response, list):
        for item in response:
            error = _broker_error(item)
            if error:
                return error
        return None
    if not isinstance(response, dict):
        return None
    for key in ("Error", "error", "Error Message", "error_message", "errMsg", "emsg"):
        value = response.get(key)
        if value not in (None, "", False, "None", "NA", "0"):
            return str(value)
    for key in ("data", "Data", "result", "Result", "message", "Message"):
        value = response.get(key)
        if isinstance(value, (dict, list)):
            error = _broker_error(value)
            if error:
                return error
    return None

def _broker_order_id(response: Any) -> str:
    if isinstance(response, list):
        for item in response:
            order_id = _broker_order_id(item)
            if order_id:
                return order_id
        return ""
    if not isinstance(response, dict):
        return ""
    for key in ("nApplNo", "order_id", "orderId", "ordNo", "orderNo", "nOrdNo", "nestOrderNumber"):
        value = response.get(key)
        if value not in (None, "", "NA", "0"):
            return str(value)
    for key in ("data", "Data", "result", "Result", "message", "Message"):
        value = response.get(key)
        if isinstance(value, (dict, list)):
            order_id = _broker_order_id(value)
            if order_id:
                return order_id
    return ""

def _normalized_quote(item: Dict[str, Any]) -> Dict[str, Any]:
    ohlc = item.get("ohlc") if isinstance(item.get("ohlc"), dict) else {}
    ltp = _as_float(
        item.get("ltp")
        or item.get("last_price")
        or item.get("last_traded_price")
        or item.get("iv")
        or item.get("lp")
    )
    close_px = _as_float(
        ohlc.get("close")
        or item.get("close")
        or item.get("c")
        or item.get("prev_day_close")
        or item.get("ic"),
        ltp,
    )
    change = _as_float(item.get("net_change") or item.get("change") or item.get("cng"), ltp - close_px)
    change_pct = _as_float(item.get("percent_change") or item.get("per_change") or item.get("change_pct") or item.get("nc"))
    if change_pct == 0 and close_px:
        change_pct = (change / close_px) * 100
    return {
        "ltp":        ltp,
        "open":       _as_float(ohlc.get("open") or item.get("open") or item.get("op") or item.get("openingPrice"), ltp),
        "high":       _as_float(ohlc.get("high") or item.get("high") or item.get("h") or item.get("highPrice"), ltp),
        "low":        _as_float(ohlc.get("low")  or item.get("low")  or item.get("lo") or item.get("lowPrice"), ltp),
        "close":      close_px,
        "volume":     _as_int(item.get("volume") or item.get("last_volume") or item.get("v")),
        "change":     round(change, 2),
        "change_pct": round(change_pct, 2),
    }

# ── Feed helpers ──────────────────────────────────────────────────────────────
INDEX_WS_MAP = {
    "26000": "Nifty 50",
    "26009": "Nifty Bank",
    "26037": "Nifty Fin Service",
}

def _feed_tokens(index: bool) -> List[Dict[str, str]]:
    wanted = {"NIFTY 50", "BANKNIFTY", "FINNIFTY", "RELIANCE", "HDFCBANK", "TCS", "INFY", "ICICIBANK", "KOTAKBANK", "SBIN"}
    rows = []
    for inst in INSTRUMENTS:
        if inst["name"] not in wanted or (inst.get("type") == "Index") != index:
            continue
        token = str(inst["token"])
        if index and token in INDEX_WS_MAP:
            token = INDEX_WS_MAP[token]
        rows.append({"instrument_token": token, "exchange_segment": _kotak_segment(inst["exchange"])})
    return rows

def _feed_symbol_for_token(token: str) -> str:
    for inst in INSTRUMENTS:
        t = str(inst["token"])
        if t == token or INDEX_WS_MAP.get(t) == token:
            return inst["name"]
    return ""

def _extract_feed_ticks(message: Any) -> List[Dict[str, Any]]:
    if isinstance(message, dict) and isinstance(message.get("data"), list):
        return [x for x in message["data"] if isinstance(x, dict)]
    if isinstance(message, list):
        return [x for x in message if isinstance(x, dict)]
    if isinstance(message, dict):
        return [message]
    return []

def _normalise_feed_message(message: Any) -> Dict[str, Any]:
    ticks = []
    for item in _extract_feed_ticks(message):
        token = str(item.get("tk") or item.get("token") or item.get("instrument_token") or item.get("exchange_token") or "")
        ltp   = _as_float(
            item.get("ltp")
            or item.get("iv")  # Index value from WebSocket
            or item.get("last_price")
            or item.get("lp")
            or item.get("ltpPrice")
            or item.get("c"),
            0
        )
        if not token or ltp <= 0:
            continue
        ticks.append({
            "token":           token,
            "instrument_token": token,
            "symbol":          _feed_symbol_for_token(token),
            "ltp":             ltp,
            "last_price":      ltp,
            "change":          _as_float(item.get("ch") or item.get("change") or item.get("cng"), 0),
            "change_pct":      _as_float(item.get("chp") or item.get("change_pct") or item.get("percent_change") or item.get("nc"), 0),
            "volume":          _as_int(item.get("v") or item.get("volume"), 0),
            "raw":             item,
        })
    return {"type": "tick", "data": ticks, "ts": time.time()}

def _broadcast_feed(message: Any) -> None:
    global _feed_last_tick_ts
    payload = _normalise_feed_message(message)
    if not payload["data"] or not _feed_loop:
        return
    _feed_last_tick_ts = time.time()
    for queue in list(_feed_clients):
        asyncio.run_coroutine_threadsafe(queue.put(payload), _feed_loop)

def _notify_feed_clients() -> None:
    """Push a feed_status event to every browser WebSocket currently connected.
    Called after login so the frontend immediately knows the live feed is active."""
    if not _feed_loop:
        return
    payload = {"type": "feed_status", "connected": _feed_started, "error": _feed_last_error}
    for queue in list(_feed_clients):
        asyncio.run_coroutine_threadsafe(queue.put(payload), _feed_loop)

def _start_kotak_feed() -> None:
    """Subscribe to Kotak Neo WebSocket feed for indices + equities.
    Safe to call multiple times — no-ops if feed is already running."""
    global _feed_started, _feed_last_error

    if _feed_started:
        return

    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        _feed_last_error = "Kotak session not connected"
        return

    # ── Callbacks ─────────────────────────────────────────────────────────────
    def on_message(message: Any):
        _broadcast_feed(message)

    def on_error(error: Any):
        global _feed_started, _feed_last_error
        _feed_started   = False
        _feed_last_error = str(error)
        print(f"[FEED] error: {error}")

    def on_close(*args):
        # Kotak lib calls on_close("The Session has been Closed!") with 1 arg.
        # *args makes this signature compatible regardless of call convention.
        global _feed_started
        _feed_started = False
        msg = args[0] if args else "connection closed"
        print(f"[FEED] closed: {msg}")
        # Auto-reconnect after 3 s if session is still valid
        def _reconnect():
            time.sleep(3)
            if _session.get("status") == "CONNECTED" and not _feed_started:
                print("[FEED] auto-reconnecting...")
                _start_kotak_feed()
                _notify_feed_clients()
        threading.Thread(target=_reconnect, daemon=True, name="feed-reconnect").start()

    def on_open(*args):
        # Kotak lib may pass the ws object as the first arg — *args absorbs it.
        print("[FEED] opened — live ticks active")

    # ── Attach callbacks ──────────────────────────────────────────────────────
    client.on_message = on_message
    client.on_error   = on_error
    client.on_close   = on_close
    client.on_open    = on_open

    # ── Subscribe ─────────────────────────────────────────────────────────────
    try:
        index_tokens  = _feed_tokens(index=True)
        equity_tokens = _feed_tokens(index=False)
        if index_tokens:
            client.subscribe(index_tokens,  isIndex=True,  isDepth=False)
        
        def subscribe_equities_after_connect():
            # Wait for client.NeoWebSocket to be initialized and is_hsw_open == 1
            timeout = 15  # seconds
            start_time = time.time()
            while time.time() - start_time < timeout:
                if (getattr(client, "NeoWebSocket", None) is not None 
                        and getattr(client.NeoWebSocket, "is_hsw_open", 0) == 1):
                    print("[FEED] WebSocket open, now subscribing equities")
                    try:
                        client.subscribe(equity_tokens, isIndex=False, isDepth=False)
                    except Exception as e:
                        print(f"[FEED] failed to subscribe equities: {e}")
                    return
                time.sleep(0.1)
            print("[FEED] timeout waiting for WebSocket connection to subscribe equities")

        if equity_tokens:
            if index_tokens:
                threading.Thread(target=subscribe_equities_after_connect, daemon=True, name="sub-equities").start()
            else:
                client.subscribe(equity_tokens, isIndex=False, isDepth=False)

        _feed_started    = True
        _feed_last_error = None
        print(f"[FEED] subscribed — {len(index_tokens)} indices, {len(equity_tokens)} equities")
    except Exception as exc:
        _feed_started    = False
        _feed_last_error = str(exc)
        print(f"[FEED] subscribe failed: {exc}")

# ── REST snapshot fallback (used when WS feed is stale) ──────────────────────
def _snapshot_feed_payload() -> Dict[str, Any]:
    """Fetch LTPs via REST when the live WS feed has been silent for >2 s.
    Equities use quote_type='all'; Indices need a separate call with quote_type='ltp'
    because Kotak routes index tokens differently internally."""
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        return {"type": "tick", "data": [], "ts": time.time()}

    wanted_equity = {"RELIANCE", "HDFCBANK", "TCS", "INFY", "ICICIBANK", "KOTAKBANK", "SBIN"}
    wanted_index  = {"NIFTY 50", "BANKNIFTY", "FINNIFTY"}

    equity_tokens = [
        {"instrument_token": str(inst["token"]), "exchange_segment": _kotak_segment(inst["exchange"])}
        for inst in INSTRUMENTS if inst["name"] in wanted_equity
    ]
    index_tokens = [
        {"instrument_token": INDEX_WS_MAP.get(str(inst["token"]), str(inst["token"])), "exchange_segment": _kotak_segment(inst["exchange"])}
        for inst in INSTRUMENTS if inst["name"] in wanted_index
    ]

    ticks: List[Dict[str, Any]] = []

    # Equities — full OHLCV
    if equity_tokens:
        try:
            response = client.quotes(instrument_tokens=equity_tokens, quote_type="all")
            for item in _quote_items(response):
                token = _quote_token(item)
                quote = _normalized_quote(item)
                if quote["ltp"] > 0:
                    ticks.append({
                        "token":           token,
                        "instrument_token": token,
                        "symbol":          _feed_symbol_for_token(token),
                        "ltp":             quote["ltp"],
                        "last_price":      quote["ltp"],
                        "change":          quote["change"],
                        "change_pct":      quote["change_pct"],
                        "volume":          quote["volume"],
                        "source":          "kotak-rest-equity",
                    })
        except Exception as exc:
            print(f"[SNAPSHOT] equity fetch failed: {exc}")

    # Indices — LTP only (Kotak requirement)
    if index_tokens:
        try:
            response = client.quotes(instrument_tokens=index_tokens, quote_type="ltp")
            for item in _quote_items(response):
                token = _quote_token(item)
                quote = _normalized_quote(item)
                if quote["ltp"] > 0:
                    ticks.append({
                        "token":           token,
                        "instrument_token": token,
                        "symbol":          _feed_symbol_for_token(token),
                        "ltp":             quote["ltp"],
                        "last_price":      quote["ltp"],
                        "change":          quote["change"],
                        "change_pct":      quote["change_pct"],
                        "volume":          quote["volume"],
                        "source":          "kotak-rest-index",
                    })
        except Exception as exc:
            print(f"[SNAPSHOT] index fetch failed: {exc}")

    return {"type": "tick", "data": ticks, "ts": time.time(), "fallback": True}

async def _snapshot_feed_loop(queue: asyncio.Queue):
    """Continuously supply REST snapshots to the queue when WS ticks are absent."""
    while True:
        await asyncio.sleep(0.35)
        # Skip if the live feed delivered a tick in the last 2 s
        if _feed_last_tick_ts and time.time() - _feed_last_tick_ts < 2:
            continue
        payload = await asyncio.to_thread(_snapshot_feed_payload)
        if payload["data"]:
            await queue.put(payload)

# ── yfinance index cache (for /quotes endpoint fallback) ─────────────────────
def _fetch_index_quote(inst: Dict[str, Any]) -> Dict[str, Any]:
    info      = yf.Ticker(inst["yf_symbol"]).fast_info
    ltp       = _as_float(getattr(info, "last_price", None))
    prev_close = _as_float(getattr(info, "previous_close", None), ltp)
    change    = ltp - prev_close
    return {
        "ltp":        ltp,
        "open":       _as_float(getattr(info, "open",     None), ltp),
        "high":       _as_float(getattr(info, "day_high", None), ltp),
        "low":        _as_float(getattr(info, "day_low",  None), ltp),
        "close":      prev_close,
        "volume":     0,
        "change":     round(change, 2),
        "change_pct": round((change / prev_close) * 100, 2) if prev_close else 0,
        "source":     "yfinance-index-fallback",
    }

def _refresh_index_quote(inst: Dict[str, Any]) -> None:
    name = inst["name"]
    try:
        quote = _fetch_index_quote(inst)
        _index_quote_cache[name]    = quote
        _index_quote_cache_ts[name] = time.time()
    except Exception as fallback_error:
        print(f"[YF] index quote failed for {name}: {fallback_error}")
    finally:
        _index_quote_pending.discard(name)

def _cached_index_quote(inst: Dict[str, Any], max_age_seconds: int = 2) -> Optional[Dict[str, Any]]:
    now    = time.time()
    name   = inst["name"]
    cached = _index_quote_cache.get(name)
    if cached and now - _index_quote_cache_ts.get(name, 0) < max_age_seconds:
        return cached
    if YFINANCE_AVAILABLE and name not in _index_quote_pending:
        _index_quote_pending.add(name)
        _quote_executor.submit(_refresh_index_quote, inst)
    return cached  # may be None if never fetched

# ── Credentials ───────────────────────────────────────────────────────────────
@router.post("/credentials")
def post_credentials(req: CredentialsRequest):
    save_credentials(req.model_dump())
    return {"ok": True, "message": "Credentials saved successfully."}

@router.get("/credentials")
def get_credentials():
    return get_masked_credentials()

# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(req: LoginRequest):
    from neo_api_client import NeoAPI
    creds = load_credentials()
    if not creds:
        raise HTTPException(status_code=400, detail="No credentials found. Save them first.")

    totp_code = req.totp_code
    if not totp_code:
        secret = creds.get("totp_secret", "")
        if not secret:
            raise HTTPException(status_code=400, detail="totp_secret not configured.")
        totp_code = pyotp.TOTP(secret).now()

    _session["status"] = "CONNECTING"
    _session["error"]  = None

    try:
        client    = NeoAPI(environment="prod", consumer_key=creds["consumer_key"])
        totp_resp = client.totp_login(
            mobile_number=creds["mobile_number"],
            ucc=creds["ucc"],
            totp=totp_code,
        )
        if not totp_resp or totp_resp.get("error"):
            raise ValueError(f"TOTP login failed: {totp_resp}")

        validate_resp = client.totp_validate(mpin=creds["mpin"])
        if not validate_resp or validate_resp.get("error"):
            raise ValueError(f"MPIN validation failed: {validate_resp}")

        _session["client"]       = client
        _session["status"]       = "CONNECTED"
        _session["access_token"] = client.configuration.edit_token
        _session["sid"]          = client.configuration.edit_sid

        # ── Kick live feed immediately after login ────────────────────────────
        # Reset flag so _start_kotak_feed() re-subscribes all instruments, then
        # push feed_status to any browser WS clients already waiting.
        global _feed_started
        _feed_started = False
        _start_kotak_feed()
        _notify_feed_clients()
        # ─────────────────────────────────────────────────────────────────────

        return {
            "ok":           True,
            "status":       "CONNECTED",
            "access_token": _session["access_token"],
            "sid":          _session["sid"],
        }
    except Exception as exc:
        _session["status"] = "DISCONNECTED"
        _session["error"]  = str(exc)
        raise HTTPException(status_code=500, detail=str(exc))

# ── Session status ────────────────────────────────────────────────────────────
@router.get("/status")
def get_status():
    return {
        "status":       _session["status"],
        "access_token": _session["access_token"],
        "sid":          _session["sid"],
        "error":        _session["error"],
    }

# ── Margins ───────────────────────────────────────────────────────────────────
@router.get("/margins")
def get_margins():
    client = _ensure_connected()
    try:
        res = client.limits()
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        rows = _extract_rows(res)
        data = rows[0] if rows and isinstance(rows[0], dict) else res if isinstance(res, dict) else {}
        available = _as_float(data.get("Net") or data.get("net") or data.get("available") or data.get("cashmarginavailable"))
        used      = _as_float(data.get("MarginUsed") or data.get("marginUsed") or data.get("used") or data.get("marginused"))
        return {"available": available, "used": used, "raw": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Funds (detailed) ──────────────────────────────────────────────────────────
@router.get("/funds")
def get_funds():
    client = _ensure_connected()
    try:
        res = client.limits()
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        rows = _extract_rows(res)
        data = rows[0] if rows and isinstance(rows[0], dict) else res if isinstance(res, dict) else {}
        net  = _as_float(data.get("Net") or data.get("net") or data.get("available") or data.get("cashmarginavailable"))
        return {
            "net_cash":     net,
            "available":    net,
            "used":         _as_float(data.get("MarginUsed") or data.get("marginUsed") or data.get("used") or data.get("marginused")),
            "collateral":   _as_float(data.get("Collateral") or data.get("collateral")),
            "adhoc_margin": _as_float(data.get("adhoc_margin") or data.get("adhocMargin")),
            "gross":        _as_float(data.get("Gross") or data.get("gross")),
            "payin_amount": _as_float(data.get("payinamt") or data.get("payinAmount")),
            "raw":          res,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Positions ─────────────────────────────────────────────────────────────────
@router.get("/positions")
def get_positions():
    client = _ensure_connected()
    try:
        res = client.positions()
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        if isinstance(res, dict) and res.get("stat") == "Not_Ok":
            return []
        return _extract_rows(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Holdings ──────────────────────────────────────────────────────────────────
@router.get("/holdings")
def get_holdings():
    client = _ensure_connected()
    try:
        res = client.holdings()
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        return _extract_rows(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Orders ────────────────────────────────────────────────────────────────────
@router.get("/orders")
def get_orders():
    client = _ensure_connected()
    try:
        res = client.order_report()
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        return _extract_rows(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Trades ────────────────────────────────────────────────────────────────────
@router.get("/trades")
def get_trades(order_id: Optional[str] = Query(None)):
    client = _ensure_connected()
    try:
        res = client.trade_report(order_id=order_id)
        if isinstance(res, dict) and (res.get("Error") or res.get("Error Message")):
            raise ValueError(res)
        return _extract_rows(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Live quotes (REST) ────────────────────────────────────────────────────────
@router.get("/quotes")
def get_quotes(symbols: str = Query(..., min_length=1)):
    client   = _ensure_connected()
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    tokens:        List[Dict[str, str]] = []
    token_to_sym:  Dict[str, str]       = {}

    for sym in sym_list:
        inst = next((i for i in INSTRUMENTS if i["name"].upper() == sym or i["symbol"].upper() == sym), None)
        if not inst:
            continue
        token = str(inst["token"])
        tokens.append({"instrument_token": token, "exchange_segment": _kotak_segment(inst["exchange"])})
        token_to_sym[token] = inst["name"]

    if not tokens:
        return {}

    try:
        quotes_resp = client.quotes(instrument_tokens=tokens, quote_type="all")
        if isinstance(quotes_resp, dict) and (quotes_resp.get("Error") or quotes_resp.get("error")):
            raise ValueError(quotes_resp)

        result: Dict[str, Dict[str, Any]] = {}
        for item in _quote_items(quotes_resp):
            token    = _quote_token(item)
            sym_name = token_to_sym.get(token)
            if not sym_name:
                trading_symbol = str(item.get("trading_symbol") or item.get("ts") or "").upper()
                sym_name = next((s for s in sym_list if s == trading_symbol), None)
            if sym_name:
                result[sym_name] = _normalized_quote(item)

        # Fill missing indices from yfinance cache
        for sym in sym_list:
            inst = next((i for i in INSTRUMENTS if i["name"].upper() == sym or i["symbol"].upper() == sym), None)
            if not inst or inst.get("type") != "Index" or inst["name"] in result:
                continue
            quote = _cached_index_quote(inst)
            if quote:
                result[inst["name"]] = quote

        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Kotak quotes failed: {e}")

# ── Live feed WebSocket ───────────────────────────────────────────────────────
@router.websocket("/ws")
async def kotak_feed_ws(websocket: WebSocket):
    global _feed_loop
    await websocket.accept()
    _feed_loop = asyncio.get_running_loop()

    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _feed_clients.append(queue)

    # Attempt to start feed (no-op if already running or not yet logged in)
    _start_kotak_feed()

    # Immediately tell the browser the current feed state
    await websocket.send_json({
        "type":      "feed_status",
        "connected": _feed_started,
        "error":     _feed_last_error,
    })

    snapshot_task = asyncio.create_task(_snapshot_feed_loop(queue))
    try:
        while True:
            payload = await queue.get()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        pass
    finally:
        snapshot_task.cancel()
        if queue in _feed_clients:
            _feed_clients.remove(queue)

# ── Historical OHLCV ──────────────────────────────────────────────────────────
@router.get("/historical")
def get_historical(
    symbol:    str           = Query(...),
    interval:  str           = Query("5m"),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
):
    candles = []

    # Try Kotak historical first
    client = _session.get("client")
    if client and _session["status"] == "CONNECTED":
        try:
            inst = next((i for i in INSTRUMENTS if i["name"] == symbol), None)
            if inst:
                kotak_interval_map = {
                    "1m": "1", "5m": "5", "15m": "15", "30m": "30",
                    "1h": "60", "1d": "1D",
                }
                k_interval = kotak_interval_map.get(interval, "5")
                resp = client.historical_candles(
                    instrument_token=inst["token"],
                    from_date=from_date or "",
                    to_date=to_date or "",
                    interval=k_interval,
                    exchange=inst["exchange"],
                    segment=inst["exchange"].lower() + "_cm",
                )
                if isinstance(resp, list) and len(resp) > 0:
                    for row in resp:
                        candles.append({
                            "time":   row[0] if isinstance(row, list) else row.get("time"),
                            "open":   float(row[1] if isinstance(row, list) else row.get("open", 0)),
                            "high":   float(row[2] if isinstance(row, list) else row.get("high", 0)),
                            "low":    float(row[3] if isinstance(row, list) else row.get("low", 0)),
                            "close":  float(row[4] if isinstance(row, list) else row.get("close", 0)),
                            "volume": int(row[5]   if isinstance(row, list) else row.get("volume", 0)),
                        })
        except Exception as e:
            print(f"[HIST] Kotak error: {e}")

    # Fallback: yfinance
    if not candles and YFINANCE_AVAILABLE:
        yf_sym = YF_MAP.get(symbol, symbol + ".NS")
        yf_interval_map = {
            "1m":  ("1m",  "1d"),
            "5m":  ("5m",  "5d"),
            "15m": ("15m", "10d"),
            "30m": ("30m", "20d"),
            "1h":  ("1h",  "60d"),
            "1d":  ("1d",  "2y"),
        }
        yf_interval, period = yf_interval_map.get(interval, ("5m", "5d"))
        try:
            ticker = yf.Ticker(yf_sym)
            df     = ticker.history(period=period, interval=yf_interval)
            for ts, row in df.iterrows():
                candles.append({
                    "time":   int(ts.timestamp()),
                    "open":   round(float(row["Open"]),  2),
                    "high":   round(float(row["High"]),  2),
                    "low":    round(float(row["Low"]),   2),
                    "close":  round(float(row["Close"]), 2),
                    "volume": int(row.get("Volume", 0)),
                })
        except Exception as e:
            print(f"[HIST] yfinance error for {symbol}: {e}")

    return candles

# ── Instrument search ─────────────────────────────────────────────────────────
@router.get("/search")
def search_instruments(q: str = Query("", min_length=0)):
    query = q.strip().upper()
    if not query:
        return INSTRUMENTS[:20]
    results = [
        inst for inst in INSTRUMENTS
        if query in inst["name"].upper() or query in inst["symbol"].upper()
    ]
    return results[:20]

# ── Place Order ───────────────────────────────────────────────────────────────
@router.post("/order")
def place_order(req: OrderRequest):
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        raise HTTPException(status_code=401, detail="Not authenticated. Login first.")
    try:
        response = client.place_order(
            exchange_segment=req.exchange_segment,
            product=req.product,
            price=str(req.price),
            order_type=req.order_type,
            quantity=str(req.quantity),
            validity=req.validity,
            trading_symbol=req.trading_symbol,
            transaction_type=req.transaction_type,
            trigger_price=str(req.trigger_price),
            amo=req.amo,
        )
        broker_error = _broker_error(response)
        if broker_error:
            raise HTTPException(status_code=502, detail=f"Kotak rejected order: {broker_error}")
        order_id = _broker_order_id(response)
        if not order_id:
            raise HTTPException(status_code=502, detail=f"Kotak order response had no order id: {response}")
        return {"ok": True, "order_id": order_id, "data": response}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Modify Order ──────────────────────────────────────────────────────────────
@router.post("/order/modify")
def modify_order(req: ModifyOrderRequest):
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        response = client.modify_order(
            order_id=req.order_id,
            quantity=str(req.quantity),
            price=str(req.price),
            trigger_price=str(req.trigger_price),
            validity=req.validity,
            order_type=req.order_type,
            trading_symbol=req.trading_symbol,
            exchange_segment=req.exchange_segment,
            product=req.product,
            transaction_type=req.transaction_type,
        )
        return {"ok": True, "data": response}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Cancel Order ──────────────────────────────────────────────────────────────
@router.delete("/order/{order_id}")
def cancel_order(order_id: str):
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        response = client.cancel_order(order_id=order_id, isVerify=False)
        return {"ok": True, "data": response}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Test Data ─────────────────────────────────────────────────────────────────
@router.get("/test_data")
def get_test_data():
    client = _session.get("client")
    if not client or _session["status"] != "CONNECTED":
        return {"error": "Not connected"}
    try:
        lims = client.limits()
    except Exception as e:
        lims = f"error: {str(e)}"
    try:
        pos = client.positions()
    except Exception as e:
        pos = f"error: {str(e)}"
    try:
        holds = client.holdings()
    except Exception as e:
        holds = f"error: {str(e)}"
    return {"limits": lims, "positions": pos, "holdings": holds}
