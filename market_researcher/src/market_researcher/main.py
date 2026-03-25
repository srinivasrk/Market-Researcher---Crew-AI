#!/usr/bin/env python
import json
import sys
import warnings
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from market_researcher.crew import MarketResearcher

# Project root: directory containing pyproject.toml
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


def _default_inputs(
    sector: str, excluded_tickers: str | None = None
) -> dict[str, str]:
    return {
        "sector": sector,
        "current_year": str(datetime.now().year),
        "excluded_tickers": excluded_tickers or "none",
    }


def run_stock_research(sector: str, excluded_tickers: str | None = None):
    """Run the stock research crew. Returns the crew kickoff result (for CLI, tests, or a future API)."""
    inputs = _default_inputs(sector, excluded_tickers)
    return MarketResearcher().crew().kickoff(inputs=inputs)


def run():
    """Run the crew with a default sector (override by calling run_stock_research)."""
    try:
        run_stock_research("AI chips")
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}") from e


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = _default_inputs("AI chips")
    try:
        MarketResearcher().crew().train(
            n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs
        )

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}") from e


def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        MarketResearcher().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}") from e


def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = _default_inputs("AI chips")

    try:
        MarketResearcher().crew().test(
            n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs
        )

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}") from e


def run_with_trigger():
    """
    Run the crew with trigger payload.
    """
    if len(sys.argv) < 2:
        raise Exception(
            "No trigger payload provided. Please provide JSON payload as argument."
        )

    try:
        trigger_payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as exc:
        raise Exception("Invalid JSON payload provided as argument") from exc

    inputs = {
        "crewai_trigger_payload": trigger_payload,
        "sector": "",
        "current_year": "",
        "excluded_tickers": "none",
    }

    try:
        result = MarketResearcher().crew().kickoff(inputs=inputs)
        return result
    except Exception as e:
        raise Exception(
            f"An error occurred while running the crew with trigger: {e}"
        ) from e
