"""Convert a research run's markdown report to a PDF via xhtml2pdf.

xhtml2pdf is pure Python with no system library dependencies, so it works
on Windows, macOS, and Linux without installing GTK or cairo.

Usage:
    from market_researcher.services.pdf_service import run_to_pdf_bytes
    pdf_bytes = run_to_pdf_bytes(run_dict)
"""

from __future__ import annotations

import html
import io
import logging
from datetime import datetime

import markdown as md_lib
from xhtml2pdf import pisa

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTML template
# xhtml2pdf supports a subset of CSS 2.1 — avoid flexbox / grid / nth-child.
# ---------------------------------------------------------------------------

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: A4;
    margin: 2cm 2.2cm;
    @frame footer {{
      -pdf-frame-content: footer_content;
      bottom: 1cm;
      margin-left: 2.2cm;
      margin-right: 2.2cm;
      height: 1cm;
    }}
  }}

  body {{
    font-family: Times New Roman, serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
  }}

  /* ---- Page header ---- */
  .report-header {{
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 8pt;
    margin-bottom: 16pt;
  }}
  .report-label {{
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: #555;
    font-family: Arial, sans-serif;
  }}
  .report-ticker {{
    font-family: Courier New, monospace;
    font-size: 26pt;
    font-weight: bold;
    color: #0f172a;
    margin: 3pt 0 2pt;
  }}
  .report-meta {{
    font-size: 9pt;
    color: #555;
    font-family: Arial, sans-serif;
  }}

  /* ---- Headings ---- */
  h2 {{
    font-size: 14pt;
    border-bottom: 1px solid #ddd;
    padding-bottom: 3pt;
    margin-top: 20pt;
    margin-bottom: 5pt;
  }}
  h3 {{
    font-size: 12pt;
    margin-top: 13pt;
    margin-bottom: 3pt;
  }}
  h4 {{
    font-size: 11pt;
    margin-top: 10pt;
    margin-bottom: 2pt;
  }}

  /* ---- Body elements ---- */
  p {{ margin: 0 0 7pt; }}
  ul, ol {{ padding-left: 1.3em; margin: 0 0 7pt; }}
  li {{ margin-bottom: 3pt; }}
  hr {{
    border-top: 1px solid #ddd;
    margin: 14pt 0;
  }}
  em {{ color: #444; }}
  strong {{ color: #0f172a; }}
  code {{
    font-family: Courier New, monospace;
    font-size: 9pt;
    background: #f3f4f6;
    padding: 1pt 3pt;
  }}

  /* ---- Tables ---- */
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin: 8pt 0 12pt;
  }}
  th {{
    background: #f0f0f0;
    padding: 4pt 7pt;
    text-align: left;
    font-family: Arial, sans-serif;
    font-size: 9pt;
    border: 1px solid #ccc;
  }}
  td {{
    padding: 4pt 7pt;
    border: 1px solid #ddd;
    vertical-align: top;
  }}

  /* ---- Footer ---- */
  #footer_content {{
    text-align: right;
    font-size: 8pt;
    color: #888;
    font-family: Arial, sans-serif;
  }}
</style>
</head>
<body>

<div id="footer_content">
  Stock Analyst Report &mdash; {ticker} &mdash; Page <pdf:pagenumber /> of <pdf:pagecount />
</div>

<div class="report-header">
  <div class="report-label">Stock Analyst &mdash; AI Research Report</div>
  <div class="report-ticker">{ticker}</div>
  <div class="report-meta">
    Sector: <strong>{sector}</strong>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    Research date: {generated_at}
  </div>
</div>

{body_html}

</body>
</html>
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_to_pdf_bytes(run: dict) -> bytes:
    """
    Convert a research run dict (as returned by db.get_run) to PDF bytes.

    Args:
        run: dict containing at minimum:
               recommended_ticker, sector, created_at, report_markdown

    Returns:
        Raw PDF bytes suitable for streaming to the client.

    Raises:
        RuntimeError: if xhtml2pdf reports a conversion error.
    """
    ticker = (run.get("recommended_ticker") or "UNKNOWN").upper().strip()
    sector = html.escape(run.get("sector") or "")

    created_at_raw = run.get("created_at") or ""
    try:
        dt = datetime.fromisoformat(created_at_raw)
        generated_at = dt.strftime("%B %d, %Y")
    except ValueError:
        generated_at = html.escape(created_at_raw[:10])

    report_md = (
        run.get("report_markdown")
        or "_No report content was saved for this run._"
    )

    # Convert markdown → HTML
    body_html = md_lib.markdown(
        report_md,
        extensions=["tables", "fenced_code", "nl2br"],
    )

    full_html = _HTML_TEMPLATE.format(
        ticker=html.escape(ticker),
        sector=sector,
        generated_at=generated_at,
        body_html=body_html,
    )

    output = io.BytesIO()
    status = pisa.CreatePDF(full_html, dest=output, encoding="utf-8")

    if status.err:
        raise RuntimeError(
            f"xhtml2pdf PDF generation failed with {status.err} error(s)"
        )

    return output.getvalue()
