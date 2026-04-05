"""Stock price fetching via yfinance with SQLite caching.

Prices are fetched lazily on the first request for each run and cached in
the price_snapshots table. current_price is re-fetched if the snapshot is
older than CACHE_TTL_HOURS. Historical window prices (30/60/90d) are never
re-fetched once populated — they are immutable once the date has passed.

Dashboard quotes use the ticker_quotes table (global per-symbol cache).
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta, timezone

import yfinance as yf

from market_researcher.db import (
    get_price_snapshot,
    get_ticker_quote_row,
    list_runs_for_user,
    upsert_price_snapshot,
    upsert_ticker_quote_row,
    utc_now,
)

log = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pct(base: float | None, target: float | None) -> float | None:
    """Return % change from base to target, rounded to 2 dp. None if unavailable."""
    if base is None or target is None or base == 0:
        return None
    return round((target - base) / base * 100, 2)


def _fetch_closing_price(ticker: str, target_date: date) -> float | None:
    """
    Return the adjusted closing price for `ticker` on `target_date` or the
    next available trading day within a 7-day window. Returns None on error.
    """
    start = target_date
    end = target_date + timedelta(days=7)
    try:
        df = yf.download(
            ticker,
            start=start.isoformat(),
            end=end.isoformat(),
            progress=False,
            auto_adjust=True,
        )
        if df.empty:
            return None
        close = df["Close"]
        # yfinance >=0.2.x returns multi-level columns for single-ticker downloads;
        # squeeze collapses (Close, TICKER) → a plain Series so iloc[0] gives a scalar.
        if hasattr(close, "columns"):
            close = close.squeeze()
        return float(close.iloc[0])
    except Exception as exc:
        log.warning("yfinance download error for %s on %s: %s", ticker, target_date, exc)
        return None


def _fetch_current_price(ticker: str) -> float | None:
    """Return the latest available closing price for `ticker`."""
    try:
        # history() is more reliable than fast_info.last_price across yfinance versions
        hist = yf.Ticker(ticker).history(period="5d", auto_adjust=True)
        if hist.empty:
            return None
        close = hist["Close"]
        if hasattr(close, "columns"):
            close = close.squeeze()
        return float(close.iloc[-1])
    except Exception as exc:
        log.warning("yfinance current price error for %s: %s", ticker, exc)
        return None


def _fetch_last_close_and_change_pct(ticker: str) -> tuple[float | None, float | None, str | None]:
    """
    Return (last_close, change_pct vs prior session, short_name) from recent history.
    change_pct is None if fewer than two closes.
    """
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="10d", auto_adjust=True)
        if hist.empty:
            return None, None, None
        close = hist["Close"]
        if hasattr(close, "columns"):
            close = close.squeeze()
        closes = [float(x) for x in close.tolist() if x == x]  # drop NaN
        if len(closes) < 1:
            return None, None, None
        last = closes[-1]
        chg: float | None = None
        if len(closes) >= 2 and closes[-2] != 0:
            chg = round((last - closes[-2]) / closes[-2] * 100, 2)
        name: str | None = None
        try:
            info = t.info
            if isinstance(info, dict):
                n = info.get("shortName") or info.get("longName")
                name = str(n).strip() if n else None
        except Exception:
            pass
        return last, chg, name
    except Exception as exc:
        log.warning("yfinance quote error for %s: %s", ticker, exc)
        return None, None, None


def _needs_refresh(snapshot: dict | None) -> bool:
    """True if no snapshot exists or it is older than CACHE_TTL_HOURS."""
    if snapshot is None:
        return True
    refreshed = snapshot.get("last_refreshed")
    if not refreshed:
        return True
    try:
        dt = datetime.fromisoformat(refreshed)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (utc_now() - dt) > timedelta(hours=CACHE_TTL_HOURS)
    except ValueError:
        return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_and_cache_prices(run_id: str, ticker: str, pick_date_iso: str) -> dict:
    """
    Fetch pick-date, 30/60/90-day, and current prices for a ticker.
    Stores results in price_snapshots. Windows that haven't elapsed yet
    are stored as None and will be populated on future refreshes.

    Returns the snapshot dict.
    """
    pick_date = date.fromisoformat(pick_date_iso[:10])
    today = date.today()

    pick_price = _fetch_closing_price(ticker, pick_date)

    def _at_offset(days: int) -> float | None:
        target = pick_date + timedelta(days=days)
        if target > today:
            return None  # window hasn't elapsed yet
        return _fetch_closing_price(ticker, target)

    d30 = _at_offset(30)
    d60 = _at_offset(60)
    d90 = _at_offset(90)
    current = _fetch_current_price(ticker)

    data: dict = {
        "ticker": ticker,
        "pick_date": pick_date_iso[:10],
        "pick_price": pick_price,
        "d30_price": d30,
        "d60_price": d60,
        "d90_price": d90,
        "current_price": current,
        "last_refreshed": utc_now().isoformat(),
    }
    upsert_price_snapshot(run_id, data)
    return data


def get_track_record(user_id: str) -> list[dict]:
    """
    Return all runs for a user enriched with price performance data.
    Prices are fetched/refreshed lazily, respecting CACHE_TTL_HOURS.
    """
    runs = list_runs_for_user(user_id, limit=100)
    results: list[dict] = []

    for run in runs:
        run_id = run["id"]
        ticker = run["recommended_ticker"]
        pick_date = (run.get("created_at") or "")[:10]

        snapshot = get_price_snapshot(run_id)
        if snapshot is None or _needs_refresh(snapshot):
            try:
                snapshot = fetch_and_cache_prices(run_id, ticker, pick_date)
            except Exception as exc:
                log.warning("price fetch failed for run %s / %s: %s", run_id, ticker, exc)
                snapshot = {}

        pick_price = snapshot.get("pick_price")
        pick_date_str = pick_date[:10] if pick_date else ""
        try:
            d0 = date.fromisoformat(pick_date_str) if pick_date_str else date.today()
            days_since = (date.today() - d0).days
        except ValueError:
            days_since = 0

        results.append(
            {
                "run_id": run_id,
                "sector": run["sector"],
                "ticker": ticker,
                "company_name": run.get("company_name"),
                "pick_date": pick_date_str,
                "pick_price": pick_price,
                "return_30d": _pct(pick_price, snapshot.get("d30_price")),
                "return_60d": _pct(pick_price, snapshot.get("d60_price")),
                "return_90d": _pct(pick_price, snapshot.get("d90_price")),
                "current_return": _pct(pick_price, snapshot.get("current_price")),
                "days_since_pick": days_since,
            }
        )

    return results


def get_or_refresh_quotes(symbols: list[str]) -> list[dict]:
    """
    Return a list of quote dicts for each unique symbol.
    Uses the ticker_quotes cache; refreshes any row older than CACHE_TTL_HOURS.
    """
    seen: set[str] = set()
    result: list[dict] = []

    for raw in symbols:
        sym = (raw or "").upper().strip()
        if not sym or sym in seen:
            continue
        seen.add(sym)

        row = get_ticker_quote_row(sym)
        if row is None or _needs_refresh(row):
            last_close, change_pct, name = _fetch_last_close_and_change_pct(sym)
            upsert_ticker_quote_row(sym, last_close, change_pct, name)
            row = {
                "ticker": sym,
                "last_close": last_close,
                "change_pct": change_pct,
                "name": name,
                "last_refreshed": utc_now().isoformat(),
            }

        result.append(row)

    return result
