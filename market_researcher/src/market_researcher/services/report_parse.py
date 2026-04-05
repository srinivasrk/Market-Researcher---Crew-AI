"""Parse structured fragments from persisted report markdown."""

from __future__ import annotations

import re

# e.g. #### 🥇 #1 — **NVDA** (NVIDIA Corp.) — Winner
_TOP_FINALIST_LINE = re.compile(
    r"####\s+.+\s+#(\d+)\s*[—\-]\s*\*\*([A-Z0-9.\-]+)\*\*\s*\(([^)]+)\)",
    re.IGNORECASE | re.MULTILINE,
)


def top_three_from_report_markdown(
    md: str | None,
    recommended_ticker: str,
    company_name: str | None,
) -> list[dict[str, str]]:
    """
    Extract up to three {rank, ticker, company_name} from the Top 3 Finalists section.
    Falls back to a single row from recommended_ticker when parsing fails.
    """
    tick = recommended_ticker.strip().upper() or "UNKNOWN"
    fallback_name = (company_name or "").strip()
    if not md or "### 🏆 Top 3 Finalists" not in md:
        return [{"rank": "1", "ticker": tick, "company_name": fallback_name}]

    start = md.index("### 🏆 Top 3 Finalists")
    chunk = md[start : start + 12000]
    found: list[tuple[int, str, str]] = []
    for m in _TOP_FINALIST_LINE.finditer(chunk):
        rank = int(m.group(1))
        sym = m.group(2).strip().upper()
        co = m.group(3).strip()
        if 1 <= rank <= 3 and sym:
            found.append((rank, sym, co))
    if not found:
        return [{"rank": "1", "ticker": tick, "company_name": fallback_name}]

    found.sort(key=lambda x: x[0])
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for rank, sym, co in found:
        if sym in seen:
            continue
        seen.add(sym)
        out.append({"rank": str(rank), "ticker": sym, "company_name": co})
        if len(out) >= 3:
            break
    return out if out else [{"rank": "1", "ticker": tick, "company_name": fallback_name}]
