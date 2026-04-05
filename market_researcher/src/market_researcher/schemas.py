"""Structured outputs for CrewAI tasks."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ComparedTicker(BaseModel):
    """Another name evaluated against the primary pick."""

    ticker: str = Field(
        ...,
        description="US ticker symbol only, uppercase, no exchange prefix.",
    )
    why_primary_wins: str = Field(
        ...,
        description=(
            "One or two sentences: why the primary recommendation was preferred over "
            "this name, or what trade-off narrowed the choice."
        ),
    )


class TopPick(BaseModel):
    """One of the three finalist stocks ranked by the investment strategist."""

    rank: int = Field(
        ...,
        description="Rank of this pick: 1 = winner, 2 = second place, 3 = third place.",
    )
    ticker: str = Field(
        ...,
        description="US ticker symbol only, uppercase, no exchange prefix.",
    )
    company_name: str = Field(..., description="Full company name.")
    brief_case: str = Field(
        ...,
        description=(
            "Two to three sentences making the bull case for this stock in the sector."
        ),
    )
    edge_over_next: str = Field(
        ...,
        description=(
            "For rank 1: one or two sentences on the decisive advantage over rank 2. "
            "For rank 2: one sentence on what it lacked vs rank 1 but why it beats rank 3. "
            "For rank 3: one sentence on what it beat in the broader candidate list but lost to rank 2."
        ),
    )


class InvestmentRecommendation(BaseModel):
    """Final investment pick returned as structured output (no markdown parsing)."""

    primary_ticker: str = Field(
        ...,
        description="US stock ticker symbol only (e.g. NVDA), uppercase, no exchange prefix.",
    )
    company_name: str = Field(..., description="Full company name for the primary pick.")

    top_three: list[TopPick] = Field(
        ...,
        min_length=3,
        max_length=3,
        description=(
            "Exactly three finalist stocks ranked 1 (winner), 2 (runner-up), 3 (third). "
            "Rank 1 ticker must match primary_ticker. Each entry has a brief bull case "
            "and an explanation of its edge over the next-ranked pick."
        ),
    )

    thesis_bullets: list[str] = Field(
        ...,
        min_length=3,
        max_length=5,
        description="Three to five concise thesis bullets for the primary pick.",
    )
    risks: list[str] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly three key risks for the primary pick.",
    )
    invalidation_triggers: str = Field(
        ...,
        description="What evidence or events would invalidate this thesis.",
    )
    disclaimer: str = Field(
        ...,
        description="Short paragraph: educational research only, not personalized financial/legal/tax advice.",
    )
    runner_up_ticker: str = Field(
        ...,
        description="Ticker of the second-place stock (must match top_three rank 2).",
    )
    runner_up_rationale: str = Field(
        ...,
        description="One sentence on why the runner-up lost to the primary pick.",
    )
    exclusion_constraint_note: str | None = Field(
        None,
        description="If recent-pick exclusions forced choosing a next-best name, explain briefly; otherwise null.",
    )
    compared_tickers: list[ComparedTicker] = Field(
        ...,
        min_length=1,
        max_length=8,
        description=(
            "Other US liquid names seriously weighed for this sector (not the primary pick). "
            "Each entry explains how the primary compares or why this name was set aside."
        ),
    )

    def to_markdown(self) -> str:
        """Human-readable report for storage and API consumers that expect markdown."""
        medals = {1: "🥇", 2: "🥈", 3: "🥉"}
        labels = {1: "Winner", 2: "Runner-up", 3: "Third place"}

        lines: list[str] = [
            f"## Top Stock Pick: **{self.primary_ticker.upper().strip()}** — {self.company_name}",
            "",
            "### 🏆 Top 3 Finalists",
            "",
        ]

        sorted_picks = sorted(self.top_three, key=lambda p: p.rank)
        for pick in sorted_picks:
            medal = medals.get(pick.rank, f"#{pick.rank}")
            label = labels.get(pick.rank, f"Rank {pick.rank}")
            lines += [
                f"#### {medal} #{pick.rank} — **{pick.ticker.upper().strip()}** ({pick.company_name}) — {label}",
                "",
                pick.brief_case,
                "",
                f"*{pick.edge_over_next}*",
                "",
            ]

        lines += [
            "---",
            "",
            f"### Why {self.primary_ticker.upper().strip()} Won",
            "",
        ]

        # Extract the winner's edge over rank 2 for a clear headline
        winner = next((p for p in sorted_picks if p.rank == 1), None)
        if winner:
            lines.append(winner.edge_over_next)
            lines.append("")

        lines += [
            "### Deep Dive: Investment Thesis",
            *[f"- {b}" for b in self.thesis_bullets],
            "",
            "### Risks",
            *[f"- {r}" for r in self.risks],
            "",
            "### Invalidation Triggers",
            self.invalidation_triggers,
            "",
            "### Other Stocks Considered",
            *[
                f"- **{c.ticker.upper().strip()}**: {c.why_primary_wins}"
                for c in self.compared_tickers
            ],
        ]
        if self.exclusion_constraint_note:
            lines.extend(["", "### Note on Exclusions", self.exclusion_constraint_note])
        lines.extend(["", "---", "", "*" + self.disclaimer + "*"])
        return "\n".join(lines)


class DailyShowcasePick(BaseModel):
    """One cross-sector name for the shared daily dashboard spotlight."""

    ticker: str = Field(
        ...,
        description="US-listed ticker symbol only, uppercase, no exchange prefix.",
    )
    sector: str = Field(
        ...,
        description="Short sector or industry label (e.g. Semiconductors, Cloud Software).",
    )
    rationale: str | None = Field(
        None,
        description="One sentence: why this stock is in focus lately (news, momentum, theme).",
    )


class DailyShowcasePicks(BaseModel):
    """Exactly five liquid US equities across five different sectors for the demo widget."""

    picks: list[DailyShowcasePick] = Field(
        ...,
        min_length=5,
        max_length=5,
        description="Five distinct sectors; each ticker must be a real US equity symbol.",
    )
