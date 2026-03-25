"""SQLite persistence: users (OAuth profile) and research_runs (1-day TTL exclusions + history)."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

RESEARCH_TTL = timedelta(days=1)


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def get_db_path() -> Path:
    raw = os.getenv("MARKET_RESEARCHER_DB")
    if raw:
        return Path(raw).expanduser()
    data_dir = _project_root() / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "app.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                email_verified INTEGER,
                name TEXT,
                given_name TEXT,
                family_name TEXT,
                picture_url TEXT,
                provider TEXT,
                provider_subject TEXT,
                raw_claims_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        legacy = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='research_runs'"
        ).fetchone()
        if legacy:
            cols = {
                r[1] for r in conn.execute("PRAGMA table_info(research_runs)").fetchall()
            }
            if "sector_normalized" not in cols:
                conn.execute("DROP TABLE research_runs")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS research_runs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_id TEXT,
                sector TEXT NOT NULL,
                sector_normalized TEXT NOT NULL,
                recommended_ticker TEXT NOT NULL,
                report_markdown TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_runs_exclusions
                ON research_runs (user_id, sector_normalized, expires_at);

            CREATE INDEX IF NOT EXISTS idx_runs_user_created
                ON research_runs (user_id, created_at DESC);
            """
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def normalize_sector(sector: str) -> str:
    return " ".join(sector.strip().split()).lower()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


@dataclass(frozen=True)
class UserRecord:
    id: str
    email: str | None
    email_verified: bool | None
    name: str | None
    given_name: str | None
    family_name: str | None
    picture_url: str | None
    provider: str | None
    provider_subject: str | None
    created_at: str
    updated_at: str


def upsert_user_from_claims(claims: dict[str, Any], conn: sqlite3.Connection | None = None) -> UserRecord:
    """Persist or refresh user row from verified JWT/OIDC claims (never from client body)."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        init_db(conn)
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            raise ValueError("JWT must include sub or user_id")

        now = _iso(utc_now())
        email = claims.get("email")
        if email is not None:
            email = str(email)
        ev = claims.get("email_verified")
        email_verified: int | None = None
        if ev is True:
            email_verified = 1
        elif ev is False:
            email_verified = 0

        name = claims.get("name")
        if name is not None:
            name = str(name)
        given = claims.get("given_name")
        if given is not None:
            given = str(given)
        family = claims.get("family_name")
        if family is not None:
            family = str(family)
        picture = claims.get("picture")
        if picture is not None:
            picture = str(picture)
        provider = claims.get("provider")
        if provider is not None:
            provider = str(provider)
        iss = claims.get("iss")
        if iss is not None and not provider:
            provider = str(iss)
        sub_raw = claims.get("sub")
        provider_subject = str(sub_raw) if sub_raw is not None else None

        raw_json = json.dumps(claims, default=str, sort_keys=True)[:8000]

        conn.execute(
            """
            INSERT INTO users (
                id, email, email_verified, name, given_name, family_name,
                picture_url, provider, provider_subject, raw_claims_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                email_verified = excluded.email_verified,
                name = excluded.name,
                given_name = excluded.given_name,
                family_name = excluded.family_name,
                picture_url = excluded.picture_url,
                provider = excluded.provider,
                provider_subject = excluded.provider_subject,
                raw_claims_json = excluded.raw_claims_json,
                updated_at = excluded.updated_at
            """,
            (
                user_id,
                email,
                email_verified,
                name,
                given,
                family,
                picture,
                provider,
                provider_subject,
                raw_json,
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        assert row is not None
        return _row_to_user(row)
    finally:
        if own:
            conn.close()


def _row_to_user(row: sqlite3.Row) -> UserRecord:
    ev = row["email_verified"]
    email_verified: bool | None = None
    if ev == 1:
        email_verified = True
    elif ev == 0:
        email_verified = False
    return UserRecord(
        id=row["id"],
        email=row["email"],
        email_verified=email_verified,
        name=row["name"],
        given_name=row["given_name"],
        family_name=row["family_name"],
        picture_url=row["picture_url"],
        provider=row["provider"],
        provider_subject=row["provider_subject"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def get_user(user_id: str, conn: sqlite3.Connection | None = None) -> UserRecord | None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _row_to_user(row) if row else None
    finally:
        if own:
            conn.close()


def get_active_exclusions(
    user_id: str,
    sector_normalized: str,
    conn: sqlite3.Connection | None = None,
) -> list[str]:
    """Tickers still within TTL for this user + sector (unique, uppercase)."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        now = _iso(utc_now())
        rows = conn.execute(
            """
            SELECT DISTINCT recommended_ticker FROM research_runs
            WHERE user_id = ?
              AND sector_normalized = ?
              AND expires_at > ?
            """,
            (user_id, sector_normalized, now),
        ).fetchall()
        return sorted({r[0].upper() for r in rows})
    finally:
        if own:
            conn.close()


def excluded_tickers_prompt(tickers: list[str]) -> str:
    if not tickers:
        return "none"
    return ", ".join(tickers)


def save_run(
    user_id: str,
    sector: str,
    sector_normalized: str,
    recommended_ticker: str,
    report_markdown: str | None,
    session_id: str | None = None,
    conn: sqlite3.Connection | None = None,
) -> str:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        run_id = str(uuid.uuid4())
        created = utc_now()
        expires = created + RESEARCH_TTL
        conn.execute(
            """
            INSERT INTO research_runs (
                id, user_id, session_id, sector, sector_normalized,
                recommended_ticker, report_markdown, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                user_id,
                session_id,
                sector,
                sector_normalized,
                recommended_ticker.upper().strip(),
                report_markdown,
                _iso(created),
                _iso(expires),
            ),
        )
        conn.commit()
        return run_id
    finally:
        if own:
            conn.close()


def list_runs_for_user(
    user_id: str,
    limit: int = 20,
    conn: sqlite3.Connection | None = None,
) -> list[dict[str, Any]]:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, sector, recommended_ticker, created_at, expires_at, session_id
            FROM research_runs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
        return [{k: r[k] for k in r.keys()} for r in rows]
    finally:
        if own:
            conn.close()


def get_run(run_id: str, user_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT * FROM research_runs WHERE id = ? AND user_id = ?
            """,
            (run_id, user_id),
        ).fetchone()
        return {k: row[k] for k in row.keys()} if row else None
    finally:
        if own:
            conn.close()
