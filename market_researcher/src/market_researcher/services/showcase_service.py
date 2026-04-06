"""Global daily showcase tickers: CrewAI + Serper, SQLite snapshot, code fallback."""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timedelta, timezone

from market_researcher.db import (
    get_showcase_snapshot,
    upsert_showcase_snapshot,
    utc_now,
)
from market_researcher.schemas import DailyShowcasePicks
from market_researcher.showcase_crew import ShowcaseResearcher

log = logging.getLogger(__name__)

SHOWCASE_TTL_HOURS = 24

# Hardcoded fallback when crew fails or DB is cold (no new .env knobs).
SHOWCASE_FALLBACK: list[dict[str, str | None]] = [
    {"ticker": "NVDA", "sector": "Semiconductors", "rationale": None},
    {"ticker": "MSFT", "sector": "Software", "rationale": None},
    {"ticker": "JPM", "sector": "Financials", "rationale": None},
    {"ticker": "UNH", "sector": "Healthcare", "rationale": None},
    {"ticker": "XOM", "sector": "Energy", "rationale": None},
]

_showcase_lock = threading.Lock()


def _snapshot_stale(refreshed_iso: str | None) -> bool:
    if not refreshed_iso:
        return True
    try:
        dt = datetime.fromisoformat(refreshed_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (utc_now() - dt) > timedelta(hours=SHOWCASE_TTL_HOURS)
    except ValueError:
        return True


def _picks_to_rows(picks: DailyShowcasePicks) -> list[dict[str, str | None]]:
    out: list[dict[str, str | None]] = []
    for p in picks.picks:
        out.append(
            {
                "ticker": p.ticker.strip().upper(),
                "sector": p.sector.strip(),
                "rationale": (p.rationale or "").strip() or None,
            }
        )
    return out


def _run_showcase_crew() -> DailyShowcasePicks | None:
    try:
        from market_researcher.observability import ensure_crewai_langfuse_instrumentation

        ensure_crewai_langfuse_instrumentation()

        year = str(utc_now().year)
        crew = ShowcaseResearcher().crew(cache=False)
        output = crew.kickoff(inputs={"current_year": year})
        from market_researcher.observability import flush_langfuse
        flush_langfuse()
        if isinstance(getattr(output, "pydantic", None), DailyShowcasePicks):
            return output.pydantic
        for task_out in reversed(getattr(output, "tasks_output", []) or []):
            p = getattr(task_out, "pydantic", None)
            if isinstance(p, DailyShowcasePicks):
                return p
    except Exception as exc:
        log.warning("Showcase crew failed: %s", exc)
    return None


def get_or_refresh_daily_showcase_tickers() -> tuple[
    list[dict[str, str | None]], str, str | None
]:
    """
    Return (picks, source, refreshed_at_iso).

    ``refreshed_at_iso`` is when the global snapshot was last written (crew, fallback,
    or prior cache write) — not the current HTTP request time.

    ``source`` is 'cache', 'crew', or 'fallback'.
    """
    snap = get_showcase_snapshot()
    if snap and not _snapshot_stale(snap.get("refreshed_at")):
        try:
            data = json.loads(snap["tickers_json"])
            picks = data.get("picks") if isinstance(data, dict) else None
            if isinstance(picks, list) and len(picks) >= 1:
                ra = snap.get("refreshed_at")
                return picks, str(snap.get("source") or "cache"), str(ra) if ra else None
        except (json.JSONDecodeError, TypeError):
            pass

    with _showcase_lock:
        snap = get_showcase_snapshot()
        if snap and not _snapshot_stale(snap.get("refreshed_at")):
            try:
                data = json.loads(snap["tickers_json"])
                picks = data.get("picks") if isinstance(data, dict) else None
                if isinstance(picks, list) and len(picks) >= 1:
                    ra = snap.get("refreshed_at")
                    return picks, str(snap.get("source") or "cache"), str(ra) if ra else None
            except (json.JSONDecodeError, TypeError):
                pass

        pyd = _run_showcase_crew()
        now_iso = utc_now().isoformat()
        if pyd is not None:
            rows = _picks_to_rows(pyd)
            if len(rows) == 5:
                payload = json.dumps({"picks": rows})
                upsert_showcase_snapshot(payload, now_iso, "crew")
                return rows, "crew", now_iso

        rows = list(SHOWCASE_FALLBACK)
        payload = json.dumps({"picks": rows})
        upsert_showcase_snapshot(payload, now_iso, "fallback")
        return rows, "fallback", now_iso
