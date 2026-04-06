"""Run this from inside market_researcher/ to diagnose Langfuse setup.

  uv run python debug_observability.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

print("\n=== 1. ENV VARS ===")
pub  = os.getenv("LANGFUSE_PUBLIC_KEY")
sec  = os.getenv("LANGFUSE_SECRET_KEY")
url  = os.getenv("LANGFUSE_BASE_URL")
print(f"  LANGFUSE_PUBLIC_KEY  : {'SET ✓ (' + pub[:8] + '...)' if pub else 'MISSING ✗'}")
print(f"  LANGFUSE_SECRET_KEY  : {'SET ✓' if sec else 'MISSING ✗'}")
print(f"  LANGFUSE_BASE_URL    : {url or 'MISSING ✗ (will default to EU cloud.langfuse.com)'}")

print("\n=== 2. PACKAGE IMPORTS ===")
for pkg, imp in [
    ("opentelemetry-sdk",                   "opentelemetry.sdk.trace"),
    ("opentelemetry-exporter-otlp-proto-http", "opentelemetry.exporter.otlp.proto.http.trace_exporter"),
    ("openinference-instrumentation-crewai","openinference.instrumentation.crewai"),
    ("langfuse",                            "langfuse"),
    ("agentops",                            "agentops"),
]:
    try:
        __import__(imp)
        print(f"  {pkg:<45} OK ✓")
    except ImportError as e:
        print(f"  {pkg:<45} MISSING ✗  ({e})")

print("\n=== 3. LANGFUSE OTLP CONNECTIVITY ===")
if pub and sec and url:
    import base64, urllib.request, urllib.error
    endpoint = f"{url.rstrip('/')}/api/public/otel/v1/traces"
    auth = base64.b64encode(f"{pub}:{sec}".encode()).decode()
    req = urllib.request.Request(endpoint, method="POST",
          headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
          data=b'{}')
    try:
        urllib.request.urlopen(req, timeout=5)
        print(f"  Endpoint reachable ✓  {endpoint}")
    except urllib.error.HTTPError as e:
        # 400 Bad Request is fine — means auth passed, just bad payload
        if e.code in (400, 405, 415):
            print(f"  Endpoint reachable ✓  {endpoint}  (HTTP {e.code} — auth OK)")
        elif e.code == 401:
            print(f"  Auth FAILED ✗  HTTP 401 — check your PUBLIC/SECRET keys match the correct region")
        elif e.code == 404:
            print(f"  Endpoint NOT FOUND ✗  HTTP 404 — LANGFUSE_BASE_URL may be pointing to wrong region")
        else:
            print(f"  Unexpected HTTP {e.code} ✗  {e}")
    except Exception as e:
        print(f"  Connection FAILED ✗  {e}")
else:
    print("  Skipped — keys/URL not fully set")

print()
