# Stock analyst — Crew AI

This repository hosts an **agentic stock / sector research** system built with [CrewAI](https://docs.crewai.com). A multi-agent crew researches a user-chosen **sector**, uses **web search** for current public information, and produces a **structured investment recommendation** (with appropriate research-only framing).

## What's in this repo

The runnable application lives in **`market_researcher/`** (Python package `market-researcher`). That subproject includes:

- **CrewAI pipeline:** three sequential agents (market researcher → financial analyst → investment strategist), YAML-defined roles/tasks, **Serper** for search, and **Google Gemini** as the LLM.
- **FastAPI service:** async research jobs, WebSocket progress, SQLite persistence, JWT auth options, and sector-level ticker exclusion (see the subproject README for detail).

For setup, environment variables, CLI vs API usage, and architecture diagrams, see [`market_researcher/README.md`](market_researcher/README.md).

## UI

