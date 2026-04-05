import { useEffect, useState } from "react"
import { apiJson } from "../api/client"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import { useSession } from "../session/SessionContext"

type TrackRecordRow = {
  run_id: string
  sector: string
  ticker: string
  company_name: string | null
  pick_date: string
  pick_price: number | null
  return_30d: number | null
  return_60d: number | null
  return_90d: number | null
  current_return: number | null
  days_since_pick: number
}

function ReturnCell({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(Number(value))) {
    return <span className="tabular-nums text-on-surface/30">—</span>
  }
  const n = Number(value)
  const positive = n >= 0
  return (
    <span
      className={[
        "inline-block rounded px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
        positive
          ? "bg-emerald-500/10 text-emerald-700"
          : "bg-red-500/10 text-red-700",
      ].join(" ")}
    >
      {positive ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  )
}

export function TrackRecordPage() {
  const { getAccessToken } = useSession()
  const [rows, setRows] = useState<TrackRecordRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const data = await apiJson<TrackRecordRow[]>("/research/track-record", {
          accessToken: token,
        })
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load track record")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="font-outfit text-2xl font-bold text-on-surface">
          Track Record
        </h1>
        <p className="mt-1 text-sm text-on-surface/60">
          Actual price performance of every AI pick since the research date.
          Prices refresh every 24 hours via Yahoo Finance.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          {error}
        </p>
      )}

      {/* Main table */}
      <div className="overflow-hidden rounded border border-outline-ghost bg-surface-container-lowest shadow-[0_4px_20px_rgba(25,28,30,0.05)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-primary-container text-xs font-semibold uppercase tracking-wide text-surface-container-lowest">
              <tr>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3">Pick Date</th>
                <th className="px-4 py-3 text-right">Pick Price</th>
                <th className="px-4 py-3 text-right">30d</th>
                <th className="px-4 py-3 text-right">60d</th>
                <th className="px-4 py-3 text-right">90d</th>
                <th className="px-4 py-3 text-right">Current</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-ghost">
              {(rows ?? []).map((r, i) => {
                const { Icon, iconWrap } = getSectorTileTheme(r.sector)
                const rowKey = `${r.run_id ?? "row"}-${i}`
                return (
                  <tr
                    key={rowKey}
                    className={[
                      "transition-colors",
                      i % 2 === 0
                        ? "bg-surface-container-lowest"
                        : "bg-surface",
                      "hover:bg-primary-container/[0.06]",
                    ].join(" ")}
                  >
                    {/* Sector */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded",
                            iconWrap,
                          ].join(" ")}
                        >
                          <Icon
                            className="h-5 w-5"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </div>
                        <span className="font-medium text-on-surface">
                          {r.sector}
                        </span>
                      </div>
                    </td>

                    {/* Pick */}
                    <td className="px-4 py-3 align-middle">
                      <span className="font-mono text-xs font-semibold text-on-surface">
                        {r.ticker}
                      </span>
                      {r.company_name && (
                        <p className="mt-0.5 text-xs text-on-surface/55">
                          {r.company_name}
                        </p>
                      )}
                    </td>

                    {/* Pick Date */}
                    <td className="px-4 py-3 align-middle tabular-nums text-on-surface/70">
                      {r.pick_date}
                      <p className="text-xs text-on-surface/40">
                        {typeof r.days_since_pick === "number" && !Number.isNaN(r.days_since_pick)
                          ? `${r.days_since_pick}d ago`
                          : "—"}
                      </p>
                    </td>

                    {/* Pick Price */}
                    <td className="px-4 py-3 text-right tabular-nums text-on-surface/80">
                      {r.pick_price != null
                        ? `$${r.pick_price.toFixed(2)}`
                        : <span className="text-on-surface/30">—</span>}
                    </td>

                    {/* Returns */}
                    <td className="px-4 py-3 text-right">
                      <ReturnCell value={r.return_30d} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReturnCell value={r.return_60d} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReturnCell value={r.return_90d} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReturnCell value={r.current_return} />
                    </td>
                  </tr>
                )
              })}

              {rows?.length === 0 && (
                <tr key="track-empty">
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-on-surface/55"
                  >
                    No picks yet — run a sector research first.
                  </td>
                </tr>
              )}

              {rows === null && !error && (
                <tr key="track-loading">
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-on-surface/55"
                  >
                    Loading prices…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-on-surface/40">
        Educational research only — not financial advice. Past performance does
        not guarantee future results. Prices sourced from Yahoo Finance.
      </p>
    </div>
  )
}
