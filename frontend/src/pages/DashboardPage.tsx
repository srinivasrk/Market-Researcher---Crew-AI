import { useEffect, useMemo, useState } from "react"
import { apiJson } from "../api/client"
import { MOCK_TOP_STOCKS } from "../data/mockStocks"
import { useSession } from "../session/SessionContext"
import type { ResearchHistoryRow } from "../api/types"

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
