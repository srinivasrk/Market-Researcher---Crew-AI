"""Assemble dashboard top-picks payload (personalized + global showcase + quotes)."""

from __future__ import annotations

from typing import Any

from market_researcher.db import get_run, list_runs_for_user, utc_now
from market_researcher.services.price_service import get_or_refresh_quotes
from market_researcher.services.report_parse import top_three_from_report_markdown
from market_researcher.services.showcase_service import get_or_refresh_daily_showcase_tickers


def _quotes_by_ticker(quotes: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(q["ticker"]).upper(): q for q in quotes}


def _merge_quote(
    ticker: str,
    display_name: str | None,
    qmap: dict[str, dict[str, Any]],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    t = ticker.upper().strip()
    q = qmap.get(t, {})
    name = (display_name or "").strip() or q.get("name")
    row: dict[str, Any] = {
        "ticker": t,
        "name": name or None,
        "close": q.get("last_close"),
        "change_pct": q.get("change_pct"),
    }
    if extra:
        row.update(extra)
    return row


def build_dashboard_top_picks(user_id: str) -> dict[str, Any]:
    runs = list_runs_for_user(user_id, limit=100)
    latest_source_run_id: str | None = None
    raw_latest_three: list[dict[str, str]] = []

    if runs:
        latest_source_run_id = runs[0]["id"]
        full = get_run(latest_source_run_id, user_id)
        if full:
            raw_latest_three = top_three_from_report_markdown(
                full.get("report_markdown"),
                str(full.get("recommended_ticker") or "UNKNOWN"),
                full.get("company_name"),
            )

    per_sector_raw: list[dict[str, Any]] = []
    seen_norm: set[str] = set()
    for r in runs:
        norm = (r.get("sector_normalized") or "").strip()
        if not norm or norm in seen_norm:
            continue
        seen_norm.add(norm)
        per_sector_raw.append(
            {
                "sector": r["sector"],
                "sector_normalized": norm,
                "run_id": r["id"],
                "ticker": r["recommended_ticker"],
                "company_name": r.get("company_name"),
                "created_at": r["created_at"],
            }
        )

    showcase_raw, showcase_source, showcase_refreshed_at = (
        get_or_refresh_daily_showcase_tickers()
    )

    symbols: list[str] = []
    for row in raw_latest_three:
        symbols.append(row["ticker"])
    for row in per_sector_raw:
        symbols.append(str(row["ticker"]))
    for row in showcase_raw:
        symbols.append(str(row["ticker"]))

    quotes = get_or_refresh_quotes(symbols)
    qmap = _quotes_by_ticker(quotes)

    latest_top_three = [
        _merge_quote(
            row["ticker"],
            row.get("company_name"),
            qmap,
            {"rank": int(row["rank"]) if row["rank"].isdigit() else row["rank"]},
        )
        for row in raw_latest_three
    ]

    per_sector = [
        _merge_quote(
            str(row["ticker"]),
            row.get("company_name"),
            qmap,
            {
                "sector": row["sector"],
                "sector_normalized": row["sector_normalized"],
                "run_id": row["run_id"],
                "created_at": row["created_at"],
            },
        )
        for row in per_sector_raw
    ]

    showcase_trending = [
        _merge_quote(
            str(row["ticker"]),
            None,
            qmap,
            {
                "sector": row.get("sector"),
                "rationale": row.get("rationale"),
            },
        )
        for row in showcase_raw
    ]

    return {
        "latest_source_run_id": latest_source_run_id,
        "latest_top_three": latest_top_three,
        "per_sector": per_sector,
        "showcase_trending": showcase_trending,
        "showcase_source": showcase_source,
        "showcase_refreshed_at": showcase_refreshed_at,
        "as_of": utc_now().isoformat(),
    }
