"""FastAPI app: JWT auth, user upsert, research with SQLite TTL exclusions."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from market_researcher.db import get_run, init_db, list_runs_for_user, upsert_user_from_claims
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


def _decode_jwt(token: str) -> dict[str, Any]:
    jwks_url = os.getenv("JWT_JWKS_URL")
    audience = os.getenv("JWT_AUDIENCE")
    issuer = os.getenv("JWT_ISSUER")
    algorithms_env = os.getenv("JWT_ALGORITHMS", "RS256 ES256")

    if jwks_url:
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=algorithms_env.split(),
            audience=audience if audience else None,
            issuer=issuer if issuer else None,
            options={"verify_aud": bool(audience)},
        )

    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("Set JWT_SECRET (HS256 dev) or JWT_JWKS_URL (OIDC)")
    algo = os.getenv("JWT_ALGORITHM", "HS256")
    return jwt.decode(
        token,
        secret,
        algorithms=[algo],
        audience=audience if audience else None,
        issuer=issuer if issuer else None,
        options={"verify_aud": bool(audience)},
    )


async def get_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if _auth_skipped_for_local_testing():
        return _synthetic_dev_claims()

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    try:
        return _decode_jwt(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class UserOut(BaseModel):
    id: str
    email: str | None = None
    email_verified: bool | None = None
    name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    picture_url: str | None = None
    provider: str | None = None
    provider_subject: str | None = None
    created_at: str
    updated_at: str


class ResearchRequest(BaseModel):
    sector: str = Field(..., min_length=1, max_length=500)
    session_id: str | None = Field(None, max_length=128)


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
        return _decode_jwt(token)
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

    @app.get("/me", response_model=UserOut)
    def me(claims: dict[str, Any] = Depends(get_claims)) -> UserOut:
        user = upsert_user_from_claims(claims)
        return UserOut(
            id=user.id,
            email=user.email,
            email_verified=user.email_verified,
            name=user.name,
            given_name=user.given_name,
            family_name=user.family_name,
            picture_url=user.picture_url,
            provider=user.provider,
            provider_subject=user.provider_subject,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @app.post("/research", response_model=ResearchJobAccepted)
    async def research(
        body: ResearchRequest,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> ResearchJobAccepted:
        user_id = str(claims.get("sub") or claims.get("user_id") or "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub")
        upsert_user_from_claims(claims)
        job = create_research_job(
            user_id, body.sector.strip(), body.session_id, claims
        )
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
        return list_runs_for_user(sub, limit=min(limit, 100))

    @app.get("/research/{run_id}")
    def research_get(
        run_id: str,
        claims: dict[str, Any] = Depends(get_claims),
    ) -> dict[str, Any]:
        sub = str(claims.get("sub") or claims.get("user_id") or "")
        if not sub:
            raise HTTPException(status_code=401, detail="Token missing sub")
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
