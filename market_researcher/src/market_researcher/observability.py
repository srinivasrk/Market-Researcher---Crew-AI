"""
Observability setup — AgentOps + Langfuse (via openinference-instrumentation-crewai).

Call setup_observability() once at application startup (api.py lifespan).
Both crews are instrumented automatically — no per-crew code needed.

Per official Langfuse docs (https://langfuse.com/integrations/frameworks/crewai):
  - langfuse.get_client() initialises the Langfuse SDK and wires up OTel internally
  - CrewAIInstrumentor().instrument() patches CrewAI to emit OTel spans
  - langfuse.flush() must be called after each crew.kickoff() to send buffered spans

Environment variables required:
  AGENTOPS_API_KEY      — AgentOps free tier (app.agentops.ai)
  LANGFUSE_PUBLIC_KEY   — Langfuse project public key
  LANGFUSE_SECRET_KEY   — Langfuse project secret key
  LANGFUSE_BASE_URL     — e.g. https://us.cloud.langfuse.com (defaults to EU)

All keys are optional — if absent the respective tool is silently skipped.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Module-level reference so services can call langfuse_client.flush()
langfuse_client = None


def _setup_langfuse() -> bool:
    global langfuse_client

    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    if not public_key or not secret_key:
        logger.info("Langfuse: LANGFUSE_PUBLIC_KEY / SECRET_KEY not set — skipping.")
        return False

    try:
        from langfuse import get_client
        from openinference.instrumentation.crewai import CrewAIInstrumentor

        # get_client() reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
        # from env and wires up the OTel TracerProvider internally
        langfuse_client = get_client()

        if not langfuse_client.auth_check():
            logger.warning("Langfuse: auth check failed — verify your keys and LANGFUSE_BASE_URL.")
            return False

        # Patches CrewAI to emit OTel spans automatically on every kickoff()
        CrewAIInstrumentor().instrument(skip_dep_check=True)

        logger.info(
            "Langfuse: instrumentation active → %s",
            os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"),
        )
        return True

    except ImportError as e:
        logger.warning("Langfuse: missing dependency (%s) — skipping.", e)
        return False
    except Exception as e:
        logger.warning("Langfuse: setup failed (%s) — skipping.", e)
        return False


def _setup_agentops() -> bool:
    api_key = os.getenv("AGENTOPS_API_KEY")
    if not api_key:
        logger.info("AgentOps: AGENTOPS_API_KEY not set — skipping.")
        return False

    try:
        import agentops
        agentops.init(api_key=api_key, skip_auto_end_session=True)
        logger.info("AgentOps: initialised successfully.")
        return True

    except ImportError:
        logger.warning("AgentOps: package not installed — skipping.")
        return False
    except Exception as e:
        logger.warning("AgentOps: init failed (%s) — skipping.", e)
        return False


def setup_observability() -> None:
    """Call once at application startup to enable all configured observability tools."""
    langfuse_ok = _setup_langfuse()
    agentops_ok = _setup_agentops()

    if not langfuse_ok and not agentops_ok:
        logger.info(
            "Observability: no keys configured — running without tracing. "
            "Set LANGFUSE_PUBLIC_KEY / AGENTOPS_API_KEY to enable."
        )


def flush_langfuse() -> None:
    """Flush buffered Langfuse spans. Call this after every crew.kickoff()."""
    if langfuse_client is not None:
        langfuse_client.flush()
