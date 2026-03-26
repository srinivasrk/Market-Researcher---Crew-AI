import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { apiJson } from "../api/client"
import { MOCK_TOP_STOCKS } from "../data/mockStocks"
import { companyNameFromReport } from "../components/ResearchRunViews"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import { useSession } from "../session/SessionContext"
import type { ResearchHistoryRow, ResearchRunDetail } from "../api/types"

/** Plain summary lines from saved report markdown for dashboard preview. */
function reportSnippetFromMarkdown(
  markdown: string | null | undefined,
  maxChars = 320,
): string {
  if (!markdown?.trim()) return ""
  const thesisBlock = markdown.match(
    /###\s*Thesis\s*\n([\s\S]*?)(?=\n###\s|\n##\s|$)/i,
  )
  if (thesisBlock) {
    const lines = thesisBlock[1]
      .split("\n")
      .map((l) => l.replace(/^\s*[-*]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1").trim())
      .filter(Boolean)
    const joined = lines.slice(0, 3).join(" ")
    if (joined)
      return joined.length > maxChars ? `${joined.slice(0, maxChars - 1)}…` : joined
  }
  const plain = markdown
    .replace(/^#+\s+.*$/gm, " ")
    .replace(/^\s*[-*]\s+/gm, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!plain) return ""
  return plain.length > maxChars ? `${plain.slice(0, maxChars - 1)}…` : plain
}

/** Chips use accent + outline-variant mixes; primary matches `primary_container` */
const TICKER_CHIP_STYLES = [
  "border-primary-container/35 bg-primary-container/10 text-on-surface",
  "border-outline-variant/50 bg-surface text-on-surface",
  "border-primary-container/25 bg-primary-container/6 text-on-surface",
  "border-outline-variant/60 bg-surface-container-lowest text-on-surface",
  "border-primary-container/40 bg-primary-container/14 text-on-surface",
  "border-outline-variant/45 bg-surface text-on-surface/85",
] as const

export function DashboardPage() {
  const { getAccessToken } = useSession()
  const [history, setHistory] = useState<ResearchHistoryRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [latestDetail, setLatestDetail] = useState<ResearchRunDetail | null>(null)
  const [latestDetailStatus, setLatestDetailStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const rows = await apiJson<ResearchHistoryRow[]>("/research/history?limit=100", {
          accessToken: token,
        })
        if (!cancelled) setHistory(rows)
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load history")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  const latestRow = history?.[0] ?? null

  useEffect(() => {
    if (!latestRow?.id) {
      setLatestDetail(null)
      setLatestDetailStatus("idle")
      return
    }
    let cancelled = false
    setLatestDetail(null)
    setLatestDetailStatus("loading")
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) setLatestDetailStatus("error")
          return
        }
        const row = await apiJson<ResearchRunDetail>(`/research/${latestRow.id}`, {
          accessToken: token,
        })
        if (!cancelled) {
          setLatestDetail(row)
          setLatestDetailStatus("ok")
        }
      } catch {
        if (!cancelled) {
          setLatestDetail(null)
          setLatestDetailStatus("error")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [latestRow?.id, getAccessToken])

  const latestDisplay = useMemo(() => {
    if (!latestRow) return null
    const ticker = latestRow.recommended_ticker?.trim().toUpperCase() || "—"
    const company =
      latestRow.company_name?.trim() ||
      companyNameFromReport(latestDetail?.report_markdown ?? null, ticker) ||
      null
    const md = latestDetail?.report_markdown
    const snippet =
      latestDetailStatus === "ok" && md != null && md.trim() !== ""
        ? reportSnippetFromMarkdown(md)
        : ""
    return {
      id: latestRow.id,
      sector: latestRow.sector,
      ticker,
      company,
      createdAt: latestRow.created_at,
      snippet,
    }
  }, [latestRow, latestDetail, latestDetailStatus])

  const latestSectorTheme = useMemo(() => {
    if (!latestDisplay?.sector) return null
    return getSectorTileTheme(latestDisplay.sector)
  }, [latestDisplay?.sector])
  const LatestSectorIcon = latestSectorTheme?.Icon

  const stats = useMemo(() => {
    const rows = history ?? []
    const sectors = new Set(rows.map((r) => r.sector))
    const tickers = new Set(
      rows.map((r) => r.recommended_ticker?.toUpperCase?.() ?? "").filter(Boolean),
    )
    const last = rows[0]?.created_at ?? null
    return {
      totalRuns: rows.length,
      distinctSectors: sectors.size,
      distinctTickers: tickers.size,
      lastRunAt: last,
    }
  }, [history])

  const considered = useMemo(() => {
    const rows = history ?? []
    const tickers = [
      ...new Set(
        rows
          .map((r) => r.recommended_ticker?.trim().toUpperCase() ?? "")
          .filter(Boolean),
      ),
    ].sort()
    return tickers
  }, [history])

  return (
    <div className="space-y-10">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-container">
          <span
            className="h-2 w-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(16,185,129,0.45)]"
            aria-hidden
          />
          Summary
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-outline-ghost bg-gradient-to-br from-primary-container/12 to-surface-container-lowest p-4 shadow-sm ring-1 ring-primary-container/15">
            <p className="text-xs font-medium text-on-surface/65">
              Researches completed
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-on-surface">
              {history === null ? "—" : stats.totalRuns}
            </p>
          </div>
          <div className="rounded border border-outline-ghost bg-surface-container-lowest p-4 shadow-sm">
            <p className="text-xs font-medium text-on-surface/65">Sectors explored</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-on-surface">
              {history === null ? "—" : stats.distinctSectors}
            </p>
          </div>
          <div className="rounded border border-outline-ghost bg-surface-container-lowest p-4 shadow-sm">
            <p className="text-xs font-medium text-on-surface/65">Tickers surfaced</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-on-surface">
              {history === null ? "—" : stats.distinctTickers}
            </p>
          </div>
          <div className="rounded border border-outline-ghost bg-gradient-to-br from-primary-container/8 to-surface-container-lowest p-4 shadow-sm">
            <p className="text-xs font-medium text-on-surface/65">Last run</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {stats.lastRunAt
                ? new Date(stats.lastRunAt).toLocaleString()
                : history === null
                  ? "—"
                  : "No runs yet"}
            </p>
          </div>
        </div>

        {latestDisplay ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-primary-container/20 bg-gradient-to-br from-primary-container/10 via-surface-container-lowest to-surface-container-lowest shadow-[0_8px_28px_rgba(25,28,30,0.06)]">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
              <div className="flex min-w-0 flex-1 gap-4">
                {latestSectorTheme && LatestSectorIcon ? (
                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14",
                      latestSectorTheme.iconWrap,
                    ].join(" ")}
                  >
                    <LatestSectorIcon
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-container">
                    Latest research
                  </p>
                  <h3 className="font-outfit mt-1 text-xl font-bold text-on-surface sm:text-2xl">
                    {latestDisplay.sector}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-lg font-bold tabular-nums text-primary-container">
                      {latestDisplay.ticker}
                    </span>
                    {latestDisplay.company ? (
                      <span className="text-sm text-on-surface/75">{latestDisplay.company}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs tabular-nums text-on-surface/55">
                    {new Date(latestDisplay.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
              <Link
                to={`/app/history/${latestDisplay.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-primary-container/35 bg-primary-container/12 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-primary-container/20"
              >
                Full report
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="border-t border-outline-ghost/80 bg-surface-container-lowest/90 px-5 py-4 sm:px-6">
              {latestDetailStatus === "loading" ? (
                <p className="text-sm text-on-surface/55">Loading report preview…</p>
              ) : latestDetailStatus === "error" ? (
                <p className="text-sm text-on-surface/55">
                  Couldn&apos;t load the report preview. Use{" "}
                  <span className="font-medium text-on-surface/70">Full report</span> above.
                </p>
              ) : latestDisplay.snippet ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface/45">
                    From your report
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface/85">
                    {latestDisplay.snippet}
                  </p>
                </>
              ) : (
                <p className="text-sm text-on-surface/55">
                  No summary text found in this report. Open the full write-up for details.
                </p>
              )}
            </div>
          </div>
        ) : history !== null && history.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 py-6 text-center text-sm text-on-surface/70">
            No research runs yet. Start from <Link to="/app/sectors" className="font-semibold text-primary-container underline-offset-2 hover:underline">Sectors</Link> to see your latest summary here.
          </p>
        ) : null}

        {loadError ? (
          <p className="mt-3 text-sm text-red-600">{loadError}</p>
        ) : null}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-container">
          <span
            className="h-2 w-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(16,185,129,0.45)]"
            aria-hidden
          />
          Top picks (placeholder data)
        </h2>
        <p className="mt-1 text-sm text-on-surface/75">
          Static sample closes until your stock API is connected.
        </p>
        <div className="mt-4 overflow-hidden rounded border border-outline-ghost bg-surface-container-lowest shadow-[0_4px_20px_rgba(25,28,30,0.05)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-primary-container text-xs font-semibold uppercase tracking-wide text-surface-container-lowest">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Close</th>
                <th className="px-4 py-3 text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-ghost bg-surface-container-lowest">
              {MOCK_TOP_STOCKS.map((s, i) => (
                <tr
                  key={s.symbol}
                  className={
                    i % 2 === 0
                      ? "bg-surface-container-lowest text-on-surface"
                      : "bg-surface text-on-surface"
                  }
                >
                  <td className="px-4 py-3 font-semibold text-primary-container">
                    {s.symbol}
                  </td>
                  <td className="px-4 py-3 text-on-surface/75">{s.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface">
                    ${s.close.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${
                      s.changePct >= 0
                        ? "text-primary-container"
                        : "text-red-600"
                    }`}
                  >
                    {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary-container">
          <span
            className="h-2 w-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(16,185,129,0.45)]"
            aria-hidden
          />
          Assets from your research
        </h2>
        <p className="mt-1 text-sm text-on-surface/75">
          Unique recommended tickers from your saved runs.
        </p>
        {considered.length === 0 && history !== null ? (
          <p className="mt-4 rounded border border-dashed border-outline-variant/60 bg-primary-container/6 px-4 py-8 text-center text-sm text-on-surface/80">
            Run a sector research to see tickers here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {considered.map((t, i) => (
              <li
                key={t}
                className={`rounded border px-3 py-1.5 font-mono text-sm font-medium shadow-sm ${TICKER_CHIP_STYLES[i % TICKER_CHIP_STYLES.length]}`}
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
