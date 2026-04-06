"""Orchestrate research with SQLite exclusions and persistence."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from crewai.events.event_bus import crewai_event_bus
from crewai.events.types.crew_events import (
    CrewKickoffCompletedEvent,
    CrewKickoffFailedEvent,
    CrewKickoffStartedEvent,
)
from crewai.events.types.task_events import (
    TaskCompletedEvent,
    TaskFailedEvent,
    TaskStartedEvent,
)

from market_researcher.crew import MarketResearcher
from market_researcher.db import (
    excluded_tickers_prompt,
    normalize_sector,
    save_run,
    upsert_user_from_claims,
)
from market_researcher.schemas import InvestmentRecommendation

ProgressCallback = Callable[[dict[str, Any]], None]


@dataclass(frozen=True)
class ResearchResult:
    run_id: str
    report_markdown: str
    recommended_ticker: str
    raw_crew_output: Any


def build_research_inputs(
    sector: str,
    excluded: list[str],
    current_year: str,
) -> dict[str, str]:
    return {
        "sector": sector,
        "current_year": current_year,
        "excluded_tickers": excluded_tickers_prompt(excluded),
    }


def _task_label(task: Any) -> str:
    if task is None:
        return "unknown"
    name = getattr(task, "name", None)
    if name:
        return str(name)
    desc = getattr(task, "description", None)
    if desc:
        return str(desc)[:160]
    return "task"


def _register_progress_handlers(progress_callback: ProgressCallback) -> list[tuple[type, Any]]:
    handlers: list[tuple[type, Any]] = []

    def on_task_started(source: Any, event: TaskStartedEvent) -> None:
        progress_callback(
            {"type": "task_started", "task": _task_label(event.task)}
        )

    def on_task_completed(source: Any, event: TaskCompletedEvent) -> None:
        progress_callback(
            {"type": "task_completed", "task": _task_label(event.task)}
        )

    def on_task_failed(source: Any, event: TaskFailedEvent) -> None:
        progress_callback(
            {
                "type": "task_failed",
                "task": _task_label(event.task),
                "error": str(event.error),
            }
        )

    def on_crew_started(source: Any, event: CrewKickoffStartedEvent) -> None:
        progress_callback({"type": "crew_kickoff_started"})

    def on_crew_completed(source: Any, event: CrewKickoffCompletedEvent) -> None:
        progress_callback(
            {
                "type": "crew_kickoff_completed",
                "total_tokens": getattr(event, "total_tokens", 0),
            }
        )

    def on_crew_failed(source: Any, event: CrewKickoffFailedEvent) -> None:
        progress_callback({"type": "crew_kickoff_failed", "error": str(event.error)})

    for event_cls, fn in (
        (TaskStartedEvent, on_task_started),
        (TaskCompletedEvent, on_task_completed),
        (TaskFailedEvent, on_task_failed),
        (CrewKickoffStartedEvent, on_crew_started),
        (CrewKickoffCompletedEvent, on_crew_completed),
        (CrewKickoffFailedEvent, on_crew_failed),
    ):
        crewai_event_bus.on(event_cls)(fn)
        handlers.append((event_cls, fn))
    return handlers


def _unregister_progress_handlers(handlers: list[tuple[type, Any]]) -> None:
    for event_cls, fn in handlers:
        crewai_event_bus.off(event_cls, fn)


def run_research_for_user(
    claims: dict[str, Any],
    sector: str,
    *,
    session_id: str | None = None,
    current_year: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> ResearchResult:
    def notify(payload: dict[str, Any]) -> None:
        if progress_callback:
            progress_callback(payload)

    notify({"type": "research_preparing", "sector": sector.strip()})
    handlers: list[tuple[type, Any]] = []
    if progress_callback:
        handlers = _register_progress_handlers(notify)

    try:
        user = upsert_user_from_claims(claims)
        user_id = user.id
        norm = normalize_sector(sector)
        year = current_year or str(datetime.now().year)
        # Exclusion list removed: caching + daily limits make repeated same-sector runs
        # obsolete, so we always start fresh with no ticker exclusions.
        inputs = build_research_inputs(sector, [], year)

        notify({"type": "research_inputs_ready"})

        crew = MarketResearcher().crew(cache=False)
        output = crew.kickoff(inputs=inputs)
        from market_researcher.observability import flush_langfuse
        flush_langfuse()
        rec: InvestmentRecommendation | None = None
        if isinstance(getattr(output, "pydantic", None), InvestmentRecommendation):
            rec = output.pydantic
        else:
            for task_out in reversed(getattr(output, "tasks_output", []) or []):
                p = getattr(task_out, "pydantic", None)
                if isinstance(p, InvestmentRecommendation):
                    rec = p
                    break
        company_name: str | None = None
        if rec:
            ticker = rec.primary_ticker.strip().upper()
            report_markdown = rec.to_markdown()
            company_name = rec.company_name.strip() or None
        else:
            raw = getattr(output, "raw", None) or str(output)
            report_markdown = raw if isinstance(raw, str) else str(raw)
            ticker = "UNKNOWN"

        notify({"type": "persisting_run"})

        run_id = save_run(
            user_id=user_id,
            sector=sector.strip(),
            sector_normalized=norm,
            recommended_ticker=ticker,
            report_markdown=report_markdown,
            session_id=session_id,
            company_name=company_name,
        )
        notify({"type": "run_persisted", "run_id": run_id})
        return ResearchResult(
            run_id=run_id,
            report_markdown=report_markdown,
            recommended_ticker=ticker,
            raw_crew_output=output,
        )
    finally:
        if handlers:
            _unregister_progress_handlers(handlers)
