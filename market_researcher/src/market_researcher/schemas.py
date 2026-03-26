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


class InvestmentRecommendation(BaseModel):
    """Final investment pick returned as structured output (no markdown parsing)."""

    primary_ticker: str = Field(
        ...,
        description="US stock ticker symbol only (e.g. NVDA), uppercase, no exchange prefix.",
    )
    company_name: str = Field(..., description="Full company name for the primary pick.")
    thesis_bullets: list[str] = Field(
        ...,
        min_length=3,
        max_length=5,
        description="Three to five concise thesis bullets.",
    )
    risks: list[str] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly three key risks.",
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
        description="One alternative ticker that did not win.",
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
        lines: list[str] = [
            f"## Recommended: **{self.primary_ticker.upper().strip()}** — {self.company_name}",
            "",
            "### Thesis",
            *[f"- {b}" for b in self.thesis_bullets],
            "",
            "### Risks",
            *[f"- {r}" for r in self.risks],
            "",
            "### Invalidation",
            self.invalidation_triggers,
            "",
            "### Runner-up",
            f"- **{self.runner_up_ticker.upper().strip()}**: {self.runner_up_rationale}",
            "",
            "### Other stocks considered",
            *[
                f"- **{c.ticker.upper().strip()}**: {c.why_primary_wins}"
                for c in self.compared_tickers
            ],
        ]
        if self.exclusion_constraint_note:
            lines.extend(["", "### Note on exclusions", self.exclusion_constraint_note])
        lines.extend(["", "### Disclaimer", self.disclaimer])
        return "\n".join(lines)
