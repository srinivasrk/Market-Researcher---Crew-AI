FROM python:3.12-slim

# xhtml2pdf → svglib → rlpycairo → pycairo: compiler + Cairo headers at build time.
# fonts-liberation: readable PDF text.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libcairo2-dev \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install uv --no-cache-dir

# Install deps + local package in one layer after full source is present (avoids
# `uv run` rebuilding the editable install on every machine start).
COPY pyproject.toml uv.lock ./
COPY src ./src
RUN uv sync --frozen --no-dev

RUN mkdir -p /data

EXPOSE 8000

# Run uvicorn from the baked venv — do not use `uv run` in prod here;
# it re-syncs the project and can exceed Fly health-check windows on cold start.
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "market_researcher.api:app", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
