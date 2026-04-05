"""FastAPI app: JWT auth, user upsert, research with SQLite TTL exclusions."""

from __future__ import annotations

import asyncio
import io
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from market_researcher.db import (
    clone_run_for_user,
    count_user_runs_today,
    get_run,
    get_sector_cache,
    init_db,
    list_runs_for_user,
    normalize_sector,
    set_waitlist_joined,
    upsert_sector_cache,
    upsert_user_from_claims,
)
from market_researcher.services.dashboard_service import build_dashboard_top_picks
from market_researcher.services.pdf_service import run_to_pdf_bytes
from market_researcher.services.price_service import get_track_record
from market_researcher.services.research_jobs import ResearchJob, create_research_job, get_research_job
from market_researcher.services.research_service import run_research_for_user

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

security = HTTPBearer(auto_error=False)


def _auth_skipped_for_local_testing() -> bool:
    """When true, JWT is not required—synthetic claims are used. Never enable in production."""
    val = os.getenv("API_DEV_SKIP_AUTH", "").strip().lower()
    return val in ("1", "true", "yes", "on")


def _synthetic_dev_claims() -> dict[str, Any]:
    """Claims used when API_DEV_SKIP_AUTH is set (Postman / local testing without IdP)."""
    return {
        "sub": os.getenv("API_DEV_USER_SUB", "dev-user-postman"),
        "email": os.getenv("API_DEV_USER_EMAIL", "dev@localhost"),
        "name": os.getenv("API_DEV_USER_NAME", "Postman Dev"),
        "email_verified": True,
        "provider": "dev",
    }


def _dev_password_login_enabled() -> bool:
    val = os.getenv("API_DEV_PASSWORD_LOGIN", "").strip().lower()
    return val in ("1", "true", "yes", "on")


_JWT_LEEWAY = int(os.getenv("JWT_LEEWAY_SECONDS", "60"))


class NonJwtBearerTokenError(Exception):
    """Auth0 returns opaque access tokens when no API audience is requested (SPA-only)."""

    pass


def _bearer_looks_like_jwt(token: str) -> bool:
    parts = token.strip().split(".")
    return len(parts) == 3 and all(parts)


def _issuer_arg_and_verify(
    token: str, issuer_env: str | None
) -> tuple[str | None, bool]:
    """Match JWT_ISSUER to token `iss` with or without trailing slash; PyJWT needs exact iss from token."""
    unverified = jwt.decode(token, options={"verify_signature": False})
    token_iss = unverified.get("iss")
    token_s = str(token_iss).strip() if token_iss else None
    env = issuer_env.strip() if issuer_env else None
    if env:
        if not token_s or token_s.rstrip("/") != env.rstrip("/"):
            raise jwt.InvalidIssuerError(
                f"Token iss {token_s!r} does not match JWT_ISSUER {env!r}"
            )
        return token_s, True
    return None, False


def _decode_jwt(token: str) -> dict[str, Any]:
    audience = os.getenv("JWT_AUDIENCE")
    issuer = os.getenv("JWT_ISSUER")

    if not _bearer_looks_like_jwt(token):
        # Auth0 SPAs without an API "audience" get opaque tokens — JWKS cannot verify them.
        raise NonJwtBearerTokenError(
            "Access token is not a JWT. Create an API in Auth0 (Dashboard → Applications → APIs), "
            "copy its Identifier, set the same value as VITE_AUTH0_AUDIENCE in the frontend .env and "
            "JWT_AUDIENCE in the API .env, restart both apps, and sign in again."
        )

    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise

    alg = (header.get("alg") or "").upper()
    secret = os.getenv("JWT_SECRET")
    jwks_url = os.getenv("JWT_JWKS_URL")

    iss_arg, verify_iss = _issuer_arg_and_verify(token, issuer)
    aud = audience if audience else None
    aud_opts: dict[str, Any] = {"verify_aud": bool(audience), "verify_iss": verify_iss}

    # HS256 dev / password-login tokens verify with JWT_SECRET even when JWKS is set (e.g. Auth0).
    if alg == "HS256" and secret:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=aud,
            issuer=iss_arg,
            options=aud_opts,
            leeway=_JWT_LEEWAY,
        )

    if jwks_url:
        algorithms_env = os.getenv("JWT_ALGORITHMS", "RS256 ES256")
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=algorithms_env.split(),
            audience=aud,
            issuer=iss_arg,
            options=aud_opts,
            leeway=_JWT_LEEWAY,
        )

    if not secret:
        raise RuntimeError("Set JWT_SECRET (HS256 dev) or JWT_JWKS_URL (OIDC)")
    algo = os.getenv("JWT_ALGORITHM", "HS256")
    return jwt.decode(
        token,
        secret,
        algorithms=[algo],
        audience=aud,
        issuer=iss_arg,
        options=aud_opts,
        leeway=_JWT_LEEWAY,
    )


_USERINFO_PROFILE_KEYS = frozenset(
    {
        "email",
        "email_verified",
        "name",
        "given_name",
        "family_name",
        "picture",
        "nickname",
        "preferred_username",
        "locale",
    }
)


def _enrich_claims_from_auth0_userinfo(
    claims: dict[str, Any],
    raw_access_token: str,
) -> dict[str, Any]:
    """Fill missing profile fields from Auth0 OIDC /userinfo when the access JWT has no email/name."""
    val = os.getenv("AUTH0_USERINFO_ENRICH", "true").strip().lower()
    if val in ("0", "false", "no", "off"):
        return claims

    email = claims.get("email")
    name = claims.get("name")
    if email and str(email).strip() and name and str(name).strip():
        return claims

    iss = claims.get("iss")
    if not iss or "auth0.com" not in str(iss).lower():
        return claims

    aud = claims.get("aud")
    aud_list: list[str]
    if isinstance(aud, str):
        aud_list = [aud]
    elif isinstance(aud, list):
        aud_list = [str(a) for a in aud]
    else:
        aud_list = []
    scope = str(claims.get("scope") or "")
    has_userinfo_aud = any(
        a.rstrip("/").lower().endswith("userinfo") for a in aud_list
    )
    if aud_list and not has_userinfo_aud and "openid" not in scope:
        return claims

    base = str(iss).rstrip("/")
    url = f"{base}/userinfo"
    try:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {raw_access_token}",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            ui = json.loads(resp.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError):
        return claims

    if not isinstance(ui, dict):
        return claims

    merged: dict[str, Any] = dict(claims)
    for key in _USERINFO_PROFILE_KEYS:
        if key not in ui or ui[key] is None:
            continue
        cur = merged.get(key)
        if cur is None or (isinstance(cur, str) and not cur.strip()):
            merged[key] = ui[key]
    return merged


async def get_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if _auth_skipped_for_local_testing():
        return _synthetic_dev_claims()

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    try:
        raw = credentials.credentials
        claims = _decode_jwt(raw)
        return await run_in_threadpool(
            _enrich_claims_from_auth0_userinfo, claims, raw
        )
    except NonJwtBearerTokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except jwt.PyJWTError as exc:
        detail = "Invalid token"
        if os.getenv("JWT_DEBUG_ERRORS", "").strip().lower() in ("1", "true", "yes"):
            detail = f"Invalid token: {type(exc).__name__}: {exc}"
        raise HTTPException(status_code=401, detail=detail) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class UserOut(BaseModel):
    id: str
    email: str | None = None
    email_verified: bool | None = None
    name: str | None = None
    username: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    picture_url: str | None = None
    provider: str | None = None
    provider_subject: str | None = None
    created_at: str
    updated_at: str
    # Plan & quota — used by the frontend to render the free/pro badge and daily limit UI
    plan: str = "free"                    # "free" | "pro"
    runs_today: int = 0                   # research runs created today (UTC)
    waitlist_joined: bool = False         # has the user joined the Pro waitlist?
    waitlist_joined_at: str | None = None # ISO timestamp of when they joined


# ---------------------------------------------------------------------------
# Allowed sectors — must stay in sync with frontend/src/data/sectors.ts
# Free tier subset: _FREE_TIER_SECTORS (see frontend FREE_TIER_RESEARCHABLE_SECTORS).
# Stored as lowercase normalized strings (whitespace-collapsed) for matching.
# ---------------------------------------------------------------------------
_ALLOWED_SECTORS: frozenset[str] = frozenset(
    {
        "ai chips",
        "cloud infrastructure",
        "cybersecurity",
        "healthcare technology",
        "renewable energy",
        "electric vehicles",
        "semiconductors",
        "consumer staples",
        "financial services",
        "defense & aerospace",
        "digital payments",
        "biotechnology",
        "data centers & reits",
        "copper & industrial metals",
        "luxury goods",
    }
)

# Free plan: only these sectors (normalized). Pro unlocks the full curated list.
_FREE_TIER_SECTORS: frozenset[str] = frozenset(
    {
        "ai chips",
        "cloud infrastructure",
        "healthcare technology",
    }
)


class ResearchRequest(BaseModel):
    sector: str = Field(..., min_length=1, max_length=200)
    session_id: str | None = Field(None, max_length=128)

    @field_validator("sector")
    @classmethod
    def sector_must_be_allowed(cls, v: str) -> str:
        normalized = " ".join(v.strip().split()).lower()
        if normalized not in _ALLOWED_SECTORS:
            raise ValueError(
                f"Sector {v!r} is not supported. "
                f"Allowed sectors: {', '.join(sorted(_ALLOWED_SECTORS))}."
            )
        # Return the stripped original casing (display names preserved)
        return v.strip()


class ResearchJobAccepted(BaseModel):
    job_id: str


class ResearchJobStatus(BaseModel):
    job_id: str
    status: str
    sector: str
    run_id: str | None = None
    recommended_ticker: str | None = None
    report_markdown: str | None = None
    error: str | None = None


class DevLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=256)
    password: str = Field(..., min_length=1, max_length=512)


class DevTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


async def _run_research_job_lifecycle(job: ResearchJob) -> None:
    loop = asyncio.get_event_loop()

    def on_progress(payload: dict[str, Any]) -> None:
        with job.lock:
            job.event_log.append(payload)
            if len(job.event_log) > 500:
                job.event_log = job.event_log[-500:]

        def put() -> None:
            try:
                job.queue.put_nowait(payload)
            except asyncio.QueueFull:
                pass

        loop.call_soon_threadsafe(put)

    job.status = "running"
    on_progress(
        {"type": "job_started", "job_id": job.job_id, "sector": job.sector}
    )
    try:
        result = await run_in_threadpool(
            run_research_for_user,
            job.claims,
            job.sector,
            session_id=job.session_id,
            progress_callback=on_progress,
        )
    except Exception as exc:
        with job.lock:
            job.status = "failed"
            job.error = str(exc)
        on_progress({"type": "job_failed", "error": str(exc)})
        return

    with job.lock:
        job.status = "completed"
        job.run_id = result.run_id
        job.recommended_ticker = result.recommended_ticker
        job.report_markdown = result.report_markdown

    # Populate shared sector cache so subsequent requests serve this result instantly
    upsert_sector_cache(
        normalize_sector(job.sector),
        result.run_id,
        result.recommended_ticker,
    )

    on_progress(
        {
            "type": "job_completed",
            "run_id": result.run_id,
            "recommended_ticker": result.recommended_ticker,
        }
    )


async def _ws_resolve_claims(websocket: WebSocket) -> dict[str, Any] | None:
    if _auth_skipped_for_local_testing():
        return _synthetic_dev_claims()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token query param (use ?token=JWT)")
        return None
    try:
        claims = _decode_jwt(token)
        return _enrich_claims_from_auth0_userinfo(claims, token)
    except NonJwtBearerTokenError:
        await websocket.close(code=4401, reason="Opaque token: set Auth0 API audience")
        return None
    except jwt.PyJWTError:
        await websocket.close(code=4401, reason="Invalid token")
        return None
    except RuntimeError:
        await websocket.close(code=500, reason="JWT not configured")
        return None


def create_app() -> FastAPI:
    app = FastAPI(title="Market Researcher API", version="0.1.0")

    origins = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.get("/health")
    def health() -> dict[str, str]:
        payload: dict[str, str] = {"status": "ok"}
        if _auth_skipped_for_local_testing():
            payload["auth"] = "dev_skip_jwt"
        return payload

    @app.post("/auth/dev-login", response_model=DevTokenOut)
    def auth_dev_login(body: DevLoginRequest) -> DevTokenOut:
        if not _dev_password_login_enabled():
            raise HTTPException(status_code=404, detail="Not found")
        expected_user = os.getenv("DEV_LOGIN_USER", "admin")
        expected_pass = os.getenv("DEV_LOGIN_PASSWORD", "admin")
        if body.username != expected_user or body.password != expected_pass:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise HTTPException(
                status_code=500,
                detail="JWT_SECRET is required for dev-login token minting",
            )

        ttl = int(os.getenv("DEV_LOGIN_TOKEN_TTL_SECONDS", str(8 * 3600)))
        now = datetime.now(timezone.utc)
        exp = now + timedelta(seconds=ttl)
        sub = os.getenv("DEV_LOGIN_SUB", "dev-admin")
        dev_username = os.getenv("DEV_LOGIN_USERNAME", "").strip()
        claims: dict[str, Any] = {
            "sub": sub,
            "email": os.getenv("DEV_LOGIN_EMAIL", "admin@localhost"),
            "name": os.getenv("DEV_LOGIN_NAME", "Dev Admin"),
            "email_verified": True,
            "provider": "dev_password",
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        if dev_username:
            claims["preferred_username"] = dev_username
        audience = os.getenv("JWT_AUDIENCE")
        issuer = os.getenv("JWT_ISSUER")
        if audience:
            claims["aud"] = audience
        if issuer:
            claims["iss"] = issuer

        token = jwt.encode(claims, secret, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return DevTokenOut(access_token=token, token_type="bearer", expires_in=ttl)

    @app.get("/me", response_model=UserOut)
    def me(claims: dict[str, Any] = Depends(get_claims)) -> UserOut:
        user = upsert_user_from_claims(claims)
        runs_today = count_user_runs_today(user.id)
        return UserOut(
            id=user.id,
            email=user.email,
            email_verified=user.email_verified,
            name=user.name,
            username=user.username,
            given_name=user.given_name,
            family_name=user.family_name,
            picture_url=user.picture_url,
            provider=user.provider,
            provider_subject=user.provider_subject,
            created_at=user.created_at,
            updated_at=user.updated_at,
            plan=user.plan,
            runs_today=runs_today,
            waitlist_joined=user.waitlist_joined,
            waitlist_joined_at=user.waitlist_joined_at,
        )

    @app.post("/me/waitlist", response_model=UserOut)
    def join_waitlist(claims: dict[str, Any] = Depends(get_claims)) -> UserOut:
        """Idempotent — mark the authenticated user as having joined the Pro waitlist."""
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub")
        user = upsert_user_from_claims(claims)
        set_waitlist_joined(user.id)
        # Re-fetch so waitlist_joined_at is populated from the DB
        user = upsert_user_from_claims(claims)
        runs_today = count_user_runs_today(user.id)
        return UserOut(
            id=user.id,
            email=user.email,
            email_verified=user.email_verified,
            name=user.name,
            username=user.username,
            given_name=user.given_name,
            family_name=user.family_name,
            picture_url=user.picture_url,
            provider=user.provider,
            provider_subject=user.provider_subject,
            created_at=user.created_at,
            updated_at=user.updated_at,
            plan=user.plan,
            runs_today=runs_today,
            waitlist_joined=user.waitlist_joined,
            waitlist_joined_at=user.waitlist_joined_at,
        )

    @app.post("/research", response_model=ResearchJobAccepted)
    async def research(
        body: ResearchRequest,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> ResearchJobAccepted:
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub")

        user = upsert_user_from_claims(claims)
        sector = body.sector.strip()
        sector_norm = normalize_sector(sector)

        if user.plan != "pro" and sector_norm not in _FREE_TIER_SECTORS:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "pro_sector_required",
                    "message": (
                        "This sector is available on Pro. "
                        "The free plan includes AI chips, Cloud infrastructure, "
                        "and Healthcare technology only."
                    ),
                },
            )

        # ── 1. Daily limit (free) — must run before sector cache so cache hits
        #     cannot bypass the one-run-per-day cap.
        if user.plan != "pro" and count_user_runs_today(user_id) >= 1:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "daily_limit_reached",
                    "message": "Free plan allows 1 sector research per day. Upgrade to Pro for unlimited access.",
                    "upgrade_url": "https://stocks.srini.fyi/upgrade",
                },
            )

        # ── 2. Shared sector cache hit → return instantly, no CrewAI ────────────
        cached = get_sector_cache(sector_norm)
        if cached:
            new_run_id = clone_run_for_user(cached["source_run_id"], user_id)
            if new_run_id:
                job = create_research_job(user_id, sector, body.session_id, claims)
                with job.lock:
                    job.status = "completed"
                    job.run_id = new_run_id
                    job.recommended_ticker = cached["recommended_ticker"]
                    job.event_log = [
                        {"type": "research_preparing", "sector": sector},
                        {"type": "job_started", "job_id": job.job_id, "sector": sector},
                        {
                            "type": "job_completed",
                            "run_id": new_run_id,
                            "recommended_ticker": cached["recommended_ticker"],
                            "from_cache": True,
                        },
                    ]
                return ResearchJobAccepted(job_id=job.job_id)

        # ── 3. Launch real CrewAI job (cache is written after completion) ──────
        job = create_research_job(user_id, sector, body.session_id, claims)
        asyncio.create_task(_run_research_job_lifecycle(job))
        return ResearchJobAccepted(job_id=job.job_id)

    @app.get("/research/jobs/{job_id}", response_model=ResearchJobStatus)
    def research_job_status(
        job_id: str,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> ResearchJobStatus:
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        job = get_research_job(job_id)
        if job is None or job.user_id != user_id:
            raise HTTPException(status_code=404, detail="Job not found")
        with job.lock:
            return ResearchJobStatus(
                job_id=job.job_id,
                status=job.status,
                sector=job.sector,
                run_id=job.run_id,
                recommended_ticker=job.recommended_ticker,
                report_markdown=job.report_markdown,
                error=job.error,
            )

    @app.websocket("/research/ws/{job_id}")
    async def research_ws(websocket: WebSocket, job_id: str) -> None:
        claims = await _ws_resolve_claims(websocket)
        if claims is None:
            return
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            await websocket.close(code=4401, reason="Token missing sub")
            return
        upsert_user_from_claims(claims)
        job = get_research_job(job_id)
        if job is None or job.user_id != user_id:
            await websocket.close(code=4403, reason="Job not found or forbidden")
            return

        await websocket.accept()
        with job.lock:
            replay = list(job.event_log)
        if replay:
            await websocket.send_json({"type": "replay", "events": replay})
            if replay[-1].get("type") in ("job_completed", "job_failed"):
                return

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(job.queue.get(), timeout=45.0)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "heartbeat"})
                    with job.lock:
                        st = job.status
                        if st == "completed":
                            await websocket.send_json(
                                {
                                    "type": "job_completed",
                                    "run_id": job.run_id,
                                    "recommended_ticker": job.recommended_ticker,
                                }
                            )
                            break
                        if st == "failed":
                            await websocket.send_json(
                                {"type": "job_failed", "error": job.error}
                            )
                            break
                    continue
                await websocket.send_json(msg)
                if msg.get("type") in ("job_completed", "job_failed"):
                    break
        except WebSocketDisconnect:
            return

    @app.get("/research/history")
    def research_history(
        limit: int = 20,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> list[dict[str, Any]]:
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        return list_runs_for_user(sub, limit=min(limit, 100))

    @app.get("/research/track-record")
    def research_track_record(
        claims: dict[str, Any] = Depends(get_claims),
    ) -> list[dict[str, Any]]:
        """Return all runs for the authenticated user enriched with 30/60/90-day price returns."""
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        return get_track_record(sub)

    @app.get("/research/dashboard-top-picks")
    async def research_dashboard_top_picks(
        claims: dict[str, Any] = Depends(get_claims),
    ) -> dict[str, Any]:
        """Latest run top 3, per-sector winners, global AI showcase — with cached yfinance quotes."""
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        return await run_in_threadpool(build_dashboard_top_picks, sub)

    # NOTE: this route MUST be registered before /research/{run_id} so FastAPI
    # does not interpret "pdf" as a run_id value.
    @app.get("/research/{run_id}/pdf")
    def research_get_pdf(
        run_id: str,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> StreamingResponse:
        """Generate and stream a PDF of the research report for the given run."""
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
        user = upsert_user_from_claims(claims)
        if user.plan != "pro":
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "pro_pdf_required",
                    "message": "PDF export is a Pro feature. Upgrade to download reports as PDF.",
                },
            )
        row = get_run(run_id, sub)
        if not row:
            raise HTTPException(status_code=404, detail="Run not found")

        try:
            pdf_bytes = run_to_pdf_bytes(row)
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"PDF generation failed: {exc}"
            ) from exc

        ticker = (row.get("recommended_ticker") or "report").upper().strip()
        sector = (row.get("sector") or "sector").replace(" ", "_")
        date_str = (row.get("created_at") or "")[:10]
        filename = f"{ticker}_{sector}_{date_str}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.get("/research/{run_id}")
    def research_get(
        run_id: str,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> dict[str, Any]:
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        row = get_run(run_id, sub)
        if not row:
            raise HTTPException(status_code=404, detail="Run not found")
        return row

    return app


app = create_app()


def main() -> None:
    import uvicorn

    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("market_researcher.api:app", host=host, port=port, reload=False)
