"""In-memory research job registry (job_id → WebSocket stream + status)."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

import asyncio


@dataclass
class ResearchJob:
    job_id: str
    user_id: str
    sector: str
    session_id: str | None
    claims: dict[str, Any]
    queue: asyncio.Queue
    lock: threading.Lock = field(default_factory=threading.Lock)
    event_log: list[dict[str, Any]] = field(default_factory=list)
    status: str = "pending"  # pending | running | completed | failed
    run_id: str | None = None
    recommended_ticker: str | None = None
    report_markdown: str | None = None
    error: str | None = None
    reserved_free_daily_slot: bool = False


_registry: dict[str, ResearchJob] = {}
_registry_lock = threading.Lock()


def create_research_job(
    user_id: str,
    sector: str,
    session_id: str | None,
    claims: dict[str, Any],
    *,
    queue_maxsize: int = 256,
    reserved_free_daily_slot: bool = False,
) -> ResearchJob:
    job_id = str(uuid.uuid4())
    job = ResearchJob(
        job_id=job_id,
        user_id=user_id,
        sector=sector,
        session_id=session_id,
        claims=dict(claims),
        queue=asyncio.Queue(maxsize=queue_maxsize),
        reserved_free_daily_slot=reserved_free_daily_slot,
    )
    with _registry_lock:
        _registry[job_id] = job
    return job


def get_research_job(job_id: str) -> ResearchJob | None:
    with _registry_lock:
        return _registry.get(job_id)
