FROM python:3.12-slim

# xhtml2pdf is pure Python — no system libs needed beyond a basic slim image.
# Only install fonts so PDF text renders cleanly.
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv
RUN pip install uv --no-cache-dir

# Copy dependency files and install (cached layer — only re-runs when deps change)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy source
COPY src ./src
COPY . .

# Persistent volume mount point for SQLite (map with fly volumes or -v in Docker)
RUN mkdir -p /data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "market_researcher.api:app", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
