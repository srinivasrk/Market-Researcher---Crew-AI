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


def _ensure_users_username_column(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "username" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN username TEXT")


def _ensure_users_plan_column(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "plan" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'")


def _ensure_users_waitlist_columns(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "waitlist_joined" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN waitlist_joined INTEGER NOT NULL DEFAULT 0")
    if "waitlist_joined_at" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN waitlist_joined_at TEXT")


def init_db(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
            -- NOTE: 'plan' column added via _ensure_users_plan_column migration below
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
        _ensure_users_username_column(conn)
        _ensure_users_plan_column(conn)
        _ensure_users_waitlist_columns(conn)
        legacy = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='research_runs'"
        ).fetchone()
        if legacy:
            cols = {
                r[1] for r in conn.execute("PRAGMA table_info(research_runs)").fetchall()
            }
            if "sector_normalized" not in cols or "company_name" not in cols:
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
                company_name TEXT,
                report_markdown TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_runs_exclusions
                ON research_runs (user_id, sector_normalized, expires_at);

            CREATE INDEX IF NOT EXISTS idx_runs_user_created
                ON research_runs (user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS sector_cache (
                sector_normalized  TEXT PRIMARY KEY,
                source_run_id      TEXT NOT NULL,
                recommended_ticker TEXT NOT NULL,
                cached_at          TEXT NOT NULL,
                valid_until        TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS price_snapshots (
                run_id        TEXT PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
                ticker        TEXT NOT NULL,
                pick_date     TEXT NOT NULL,
                pick_price    REAL,
                d30_price     REAL,
                d60_price     REAL,
                d90_price     REAL,
                current_price REAL,
                last_refreshed TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ticker_quotes (
                ticker         TEXT PRIMARY KEY,
                last_close     REAL,
                change_pct     REAL,
                name           TEXT,
                last_refreshed TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS showcase_snapshots (
                id             TEXT PRIMARY KEY,
                tickers_json   TEXT NOT NULL,
                refreshed_at   TEXT NOT NULL,
                source         TEXT NOT NULL DEFAULT 'crew'
            );

            CREATE TABLE IF NOT EXISTS free_daily_research_slot (
                user_id      TEXT NOT NULL,
                day_utc      TEXT NOT NULL,
                reserved_at  TEXT NOT NULL,
                PRIMARY KEY (user_id, day_utc)
            );
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
    username: str | None
    given_name: str | None
    family_name: str | None
    picture_url: str | None
    provider: str | None
    provider_subject: str | None
    created_at: str
    updated_at: str
    plan: str = "free"            # "free" | "pro"
    waitlist_joined: bool = False
    waitlist_joined_at: str | None = None


def _str_claim(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _claim_flat_or_namespaced(
    claims: dict[str, Any],
    *flat_keys: str,
) -> str | None:
    for k in flat_keys:
        s = _str_claim(claims.get(k))
        if s is not None:
            return s
    if not flat_keys:
        return None
    tails = {k.lower() for k in flat_keys}
    for k, v in claims.items():
        if not isinstance(k, str) or "/" not in k:
            continue
        if k.rsplit("/", 1)[-1].lower() in tails:
            s = _str_claim(v)
            if s is not None:
                return s
    return None


def _normalize_profile_from_claims(claims: dict[str, Any]) -> dict[str, Any]:
    """Map JWT / OIDC / Auth0-style claims onto user columns."""
    email = _claim_flat_or_namespaced(claims, "email")
    given = _claim_flat_or_namespaced(claims, "given_name")
    family = _claim_flat_or_namespaced(claims, "family_name")
    name = _claim_flat_or_namespaced(claims, "name")
    username = _claim_flat_or_namespaced(
        claims, "preferred_username", "nickname", "username"
    )
    picture = _claim_flat_or_namespaced(
        claims, "picture", "picture_url", "avatar", "photo_url"
    )

    composed = " ".join(x for x in (given, family) if x).strip() or None
    if not name and composed:
        name = composed
    if not name and username:
        name = username
    if not name and email and "@" in email:
        name = email.split("@", 1)[0]

    ev_raw = claims.get("email_verified")
    email_verified: int | None = None
    if ev_raw is True:
        email_verified = 1
    elif ev_raw is False:
        email_verified = 0

    provider = _str_claim(claims.get("provider"))
    iss = claims.get("iss")
    if iss is not None and not provider:
        provider = str(iss)

    return {
        "email": email,
        "email_verified": email_verified,
        "name": name,
        "username": username,
        "given_name": given,
        "family_name": family,
        "picture_url": picture,
        "provider": provider,
    }


def _fallback_display_name_from_sub(sub: Any) -> str | None:
    """When IdP claims have no name, derive a short sidebar label from Auth0-style sub."""
    if not isinstance(sub, str) or "|" not in sub:
        return None
    conn_id = sub.split("|", 1)[0].lower()
    if "google" in conn_id:
        return "Google account"
    if "github" in conn_id:
        return "GitHub account"
    if "linkedin" in conn_id:
        return "LinkedIn account"
    if "windowslive" in conn_id or "microsoft" in conn_id:
        return "Microsoft account"
    return "Signed in"


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
        prof = _normalize_profile_from_claims(claims)
        sub_raw = claims.get("sub")
        provider_subject = str(sub_raw) if sub_raw is not None else None

        prev = conn.execute(
            "SELECT email, email_verified, name, username, given_name, family_name, picture_url "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if prev is not None:

            def _prefer_new_str(new: str | None, old: str | None) -> str | None:
                if new is not None and str(new).strip():
                    return str(new).strip()
                return old

            prof["email"] = _prefer_new_str(prof["email"], prev["email"])
            prof["name"] = _prefer_new_str(prof["name"], prev["name"])
            prof["username"] = _prefer_new_str(prof["username"], prev["username"])
            prof["given_name"] = _prefer_new_str(prof["given_name"], prev["given_name"])
            prof["family_name"] = _prefer_new_str(prof["family_name"], prev["family_name"])
            prof["picture_url"] = _prefer_new_str(prof["picture_url"], prev["picture_url"])
            if prof["email_verified"] is None and prev["email_verified"] is not None:
                prof["email_verified"] = prev["email_verified"]

        if not prof["name"] or not str(prof["name"]).strip():
            fb = _fallback_display_name_from_sub(claims.get("sub"))
            if fb:
                prof["name"] = fb

        raw_json = json.dumps(claims, default=str, sort_keys=True)[:8000]

        conn.execute(
            """
            INSERT INTO users (
                id, email, email_verified, name, username, given_name, family_name,
                picture_url, provider, provider_subject, raw_claims_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                email_verified = excluded.email_verified,
                name = excluded.name,
                username = excluded.username,
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
                prof["email"],
                prof["email_verified"],
                prof["name"],
                prof["username"],
                prof["given_name"],
                prof["family_name"],
                prof["picture_url"],
                prof["provider"],
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
    keys = set(row.keys())
    plan = str(row["plan"]) if "plan" in keys else "free"
    waitlist_joined = bool(row["waitlist_joined"]) if "waitlist_joined" in keys else False
    waitlist_joined_at = row["waitlist_joined_at"] if "waitlist_joined_at" in keys else None
    return UserRecord(
        id=row["id"],
        email=row["email"],
        email_verified=email_verified,
        name=row["name"],
        username=row["username"],
        given_name=row["given_name"],
        family_name=row["family_name"],
        picture_url=row["picture_url"],
        provider=row["provider"],
        provider_subject=row["provider_subject"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        plan=plan,
        waitlist_joined=waitlist_joined,
        waitlist_joined_at=waitlist_joined_at,
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


def count_user_runs_today(user_id: str, conn: sqlite3.Connection | None = None) -> int:
    """Count research_runs created on today's UTC date for this user."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        # ISO date prefix e.g. "2026-04-04" — created_at is stored as ISO8601
        today_prefix = utc_now().date().isoformat()
        row = conn.execute(
            """
            SELECT COUNT(*) FROM research_runs
            WHERE user_id = ? AND created_at >= ?
            """,
            (user_id, today_prefix),
        ).fetchone()
        return int(row[0]) if row else 0
    finally:
        if own:
            conn.close()


def has_free_daily_research_slot_reserved(
    user_id: str, conn: sqlite3.Connection | None = None
) -> bool:
    """True if this user has reserved today's free-tier slot (in-flight real job)."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        today = utc_now().date().isoformat()
        row = conn.execute(
            """
            SELECT 1 FROM free_daily_research_slot
            WHERE user_id = ? AND day_utc = ?
            """,
            (user_id, today),
        ).fetchone()
        return row is not None
    finally:
        if own:
            conn.close()


def try_reserve_free_daily_research_slot(user_id: str) -> bool:
    """Insert today's slot row. Returns True if this call reserved it, False if already taken."""
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        today = utc_now().date().isoformat()
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO free_daily_research_slot (user_id, day_utc, reserved_at)
            VALUES (?, ?, ?)
            """,
            (user_id, today, _iso(utc_now())),
        )
        inserted = cur.rowcount > 0
        conn.commit()
        return inserted
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def release_free_daily_research_slot(
    user_id: str, conn: sqlite3.Connection | None = None
) -> None:
    """Remove today's reservation (after job completes or fails). No-op if none."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        today = utc_now().date().isoformat()
        conn.execute(
            "DELETE FROM free_daily_research_slot WHERE user_id = ? AND day_utc = ?",
            (user_id, today),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def runs_today_for_api(user_id: str, plan: str) -> int:
    """Runs counted toward free daily quota: persisted rows plus in-flight reservation."""
    c = count_user_runs_today(user_id)
    if plan == "pro":
        return c
    if c >= 1:
        return c
    return 1 if has_free_daily_research_slot_reserved(user_id) else 0


def set_waitlist_joined(user_id: str, conn: sqlite3.Connection | None = None) -> None:
    """Mark a user as having joined the Pro waitlist (idempotent)."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        now = _iso(utc_now())
        conn.execute(
            """
            UPDATE users
            SET waitlist_joined = 1,
                waitlist_joined_at = CASE
                    WHEN waitlist_joined = 0 THEN ?
                    ELSE waitlist_joined_at
                END
            WHERE id = ?
            """,
            (now, user_id),
        )
        conn.commit()
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
    company_name: str | None = None,
    conn: sqlite3.Connection | None = None,
) -> str:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        run_id = str(uuid.uuid4())
        created = utc_now()
        expires = created + RESEARCH_TTL
        cn = company_name.strip() if company_name else None
        conn.execute(
            """
            INSERT INTO research_runs (
                id, user_id, session_id, sector, sector_normalized,
                recommended_ticker, company_name, report_markdown, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                user_id,
                session_id,
                sector,
                sector_normalized,
                recommended_ticker.upper().strip(),
                cn,
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
            SELECT id, sector, sector_normalized, recommended_ticker, company_name,
                   created_at, expires_at, session_id
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


# ---------------------------------------------------------------------------
# Sector cache — shared result per sector, valid for 24 h across all users
# ---------------------------------------------------------------------------

SECTOR_CACHE_TTL = timedelta(hours=24)


def get_sector_cache(sector_normalized: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    """Return a fresh cache entry for the sector, or None if stale/missing."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        now = _iso(utc_now())
        row = conn.execute(
            """
            SELECT source_run_id, recommended_ticker, cached_at, valid_until
            FROM sector_cache
            WHERE sector_normalized = ? AND valid_until > ?
            """,
            (sector_normalized, now),
        ).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def upsert_sector_cache(
    sector_normalized: str,
    run_id: str,
    recommended_ticker: str,
    conn: sqlite3.Connection | None = None,
) -> None:
    """Insert or replace the sector cache entry with a fresh 24-hour window."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        now = utc_now()
        conn.execute(
            """
            INSERT INTO sector_cache (sector_normalized, source_run_id, recommended_ticker, cached_at, valid_until)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(sector_normalized) DO UPDATE SET
                source_run_id      = excluded.source_run_id,
                recommended_ticker = excluded.recommended_ticker,
                cached_at          = excluded.cached_at,
                valid_until        = excluded.valid_until
            """,
            (sector_normalized, run_id, recommended_ticker.upper().strip(), _iso(now), _iso(now + SECTOR_CACHE_TTL)),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def get_run_by_id(run_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    """Fetch a research run by id with no user_id filter (used by cache clone)."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM research_runs WHERE id = ?", (run_id,)
        ).fetchone()
        return {k: row[k] for k in row.keys()} if row else None
    finally:
        if own:
            conn.close()


def clone_run_for_user(
    source_run_id: str,
    user_id: str,
    conn: sqlite3.Connection | None = None,
) -> str | None:
    """Copy a cached research run into the target user's history. Returns the new run_id."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        src = get_run_by_id(source_run_id, conn)
        if not src:
            return None
        new_id = str(uuid.uuid4())
        created = utc_now()
        expires = created + RESEARCH_TTL
        conn.execute(
            """
            INSERT INTO research_runs (
                id, user_id, session_id, sector, sector_normalized,
                recommended_ticker, company_name, report_markdown, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id,
                user_id,
                src.get("session_id"),
                src["sector"],
                src["sector_normalized"],
                src["recommended_ticker"],
                src.get("company_name"),
                src.get("report_markdown"),
                _iso(created),
                _iso(expires),
            ),
        )
        conn.commit()
        return new_id
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Price snapshots (track-record feature)
# ---------------------------------------------------------------------------

def get_price_snapshot(run_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    """Return cached price snapshot for a run, or None if not yet fetched."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM price_snapshots WHERE run_id = ?", (run_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def upsert_price_snapshot(run_id: str, data: dict[str, Any], conn: sqlite3.Connection | None = None) -> None:
    """Insert or replace a price snapshot row."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO price_snapshots
                (run_id, ticker, pick_date, pick_price,
                 d30_price, d60_price, d90_price, current_price, last_refreshed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id) DO UPDATE SET
                pick_price     = excluded.pick_price,
                d30_price      = excluded.d30_price,
                d60_price      = excluded.d60_price,
                d90_price      = excluded.d90_price,
                current_price  = excluded.current_price,
                last_refreshed = excluded.last_refreshed
            """,
            (
                run_id,
                data.get("ticker"),
                data.get("pick_date"),
                data.get("pick_price"),
                data.get("d30_price"),
                data.get("d60_price"),
                data.get("d90_price"),
                data.get("current_price"),
                data.get("last_refreshed"),
            ),
        )
        if own:
            conn.commit()
    finally:
        if own:
            conn.close()


def get_ticker_quote_row(ticker: str, conn: sqlite3.Connection | None = None) -> dict[str, Any] | None:
    """Return the cached ticker_quotes row for `ticker`, or None if absent."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute(
            "SELECT ticker, last_close, change_pct, name, last_refreshed FROM ticker_quotes WHERE ticker = ?",
            (ticker.upper().strip(),),
        ).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def upsert_ticker_quote_row(
    ticker: str,
    last_close: float | None,
    change_pct: float | None,
    name: str | None,
    conn: sqlite3.Connection | None = None,
) -> None:
    """Insert or replace a ticker_quotes row with a fresh last_refreshed timestamp."""
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO ticker_quotes (ticker, last_close, change_pct, name, last_refreshed)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
                last_close     = excluded.last_close,
                change_pct     = excluded.change_pct,
                name           = excluded.name,
                last_refreshed = excluded.last_refreshed
            """,
            (ticker.upper().strip(), last_close, change_pct, name, _iso(utc_now())),
        )
        if own:
            conn.commit()
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Global daily showcase (dashboard — shared across users)
# ---------------------------------------------------------------------------

SHOWCASE_SNAPSHOT_ID = "global"


def get_showcase_snapshot(
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any] | None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM showcase_snapshots WHERE id = ?",
            (SHOWCASE_SNAPSHOT_ID,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def upsert_showcase_snapshot(
    tickers_json: str,
    refreshed_at_iso: str,
    source: str = "crew",
    conn: sqlite3.Connection | None = None,
) -> None:
    own = conn is None
    if conn is None:
        conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO showcase_snapshots (id, tickers_json, refreshed_at, source)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                tickers_json = excluded.tickers_json,
                refreshed_at = excluded.refreshed_at,
                source       = excluded.source
            """,
            (SHOWCASE_SNAPSHOT_ID, tickers_json, refreshed_at_iso, source),
        )
        if own:
            conn.commit()
    finally:
        if own:
            conn.close()
