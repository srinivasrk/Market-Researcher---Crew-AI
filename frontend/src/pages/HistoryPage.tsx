import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { apiJson } from "../api/client"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import { useSession } from "../session/SessionContext"
import type { ResearchHistoryRow } from "../api/types"

export function HistoryPage() {
  const { getAccessToken } = useSession()
  const [rows, setRows] = useState<ResearchHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const data = await apiJson<ResearchHistoryRow[]>("/research/history?limit=100", {
          accessToken: token,
        })
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load history")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded border border-outline-ghost bg-surface-container-lowest shadow-[0_4px_20px_rgba(25,28,30,0.05)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-primary-container text-xs font-semibold uppercase tracking-wide text-surface-container-lowest">
            <tr>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3">Pick</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-ghost">
            {(rows ?? []).map((r, i) => {
              const { Icon, iconWrap } = getSectorTileTheme(r.sector)
              return (
                <tr
                  key={r.id}
                  className={[
                    "group transition-colors",
                    i % 2 === 0
                      ? "bg-surface-container-lowest text-on-surface"
                      : "bg-surface text-on-surface",
                    "hover:bg-primary-container/[0.06]",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded transition-transform duration-200 group-hover:scale-105",
                          iconWrap,
                        ].join(" ")}
                      >
                        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                      </div>
                      <span className="font-semibold text-on-surface">{r.sector}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-0 max-w-xs flex-col gap-0.5">
                      <span className="inline-block w-fit rounded border border-primary-container/35 bg-primary-container/10 px-2 py-1 font-mono text-xs font-semibold text-on-surface">
                        {r.recommended_ticker || "—"}
                      </span>
                      {r.company_name ? (
                        <span className="text-xs leading-snug text-on-surface/65">
                          {r.company_name}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-on-surface/70">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/app/history/${r.id}`}
                      className="inline-flex rounded border border-primary-container/40 bg-primary-container/12 px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-primary-container/20"
                    >
                      Open report
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows?.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="bg-primary-container/6 px-4 py-12 text-center text-sm text-on-surface/75"
                >
                  No runs yet. Start from Sectors.
                </td>
              </tr>
            ) : null}
            {rows === null && !error ? (
              <tr>
                <td
                  colSpan={4}
                  className="bg-surface px-4 py-12 text-center text-sm text-on-surface/65"
                >
                  <div className="flex justify-center">
                    <LoadingIndicator message="Loading…" />
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
