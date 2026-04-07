import { useEffect, useState } from "react"
import { Shield, Users, Activity, TrendingUp, Zap, AlertCircle, RefreshCw } from "lucide-react"
import { ApiError, apiJson } from "../api/client"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { useSession } from "../session/SessionContext"
import type {
  AnalyticsSummary,
  AnalyticsCountRow,
  AnalyticsApiCallRow,
  AnalyticsDayRow,
  AnalyticsUserRow,
} from "../api/types"

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface/50">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-on-surface/40">{sub}</p>}
    </div>
  )
}

/** Simple horizontal bar chart rendered with CSS widths. */
function BarList({ rows, maxCount }: { rows: AnalyticsCountRow[]; maxCount: number }) {
  if (!rows.length) return <p className="text-sm text-on-surface/40">No data yet.</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-right text-xs text-on-surface/70" title={r.name}>
            {r.name}
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div className="h-2 rounded-full bg-primary-container/30 flex-1">
              <div
                className="h-2 rounded-full bg-primary-container"
                style={{ width: `${Math.round((r.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium text-on-surface/60">{r.count}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** API calls bar list with error highlighting. */
function ApiCallList({ rows }: { rows: AnalyticsApiCallRow[] }) {
  if (!rows.length) return <p className="text-sm text-on-surface/40">No data yet.</p>
  const maxCount = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const errPct = r.count > 0 ? Math.round((r.error_count / r.count) * 100) : 0
        return (
          <li key={r.name} className="flex items-center gap-3">
            <span className="w-48 shrink-0 truncate text-right text-xs text-on-surface/70" title={r.name}>
              {r.name}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 rounded-full bg-primary-container/20 flex-1">
                <div
                  className="h-2 rounded-full bg-primary-container"
                  style={{ width: `${Math.round((r.count / maxCount) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-on-surface/60">
                {r.count}
              </span>
              {r.error_count > 0 && (
                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-400">
                  {errPct}% err
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Tiny sparkline-style day chart. */
function DaySparkline({ rows, label }: { rows: AnalyticsDayRow[]; label: string }) {
  if (!rows.length) return <p className="text-xs text-on-surface/40">No data.</p>
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div>
      <p className="mb-1 text-xs text-on-surface/40">{label}</p>
      <div className="flex h-12 items-end gap-0.5">
        {rows.map((r) => (
          <div
            key={r.date}
            title={`${r.date}: ${r.count}`}
            className="flex-1 rounded-t bg-primary-container/60 hover:bg-primary-container transition-colors cursor-default min-w-[2px]"
            style={{ height: `${Math.max(4, Math.round((r.count / max) * 48))}px` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-on-surface/30">
        <span>{rows.at(0)?.date?.slice(5)}</span>
        <span>{rows.at(-1)?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

/** Top users table. */
function TopUsersTable({ users }: { users: AnalyticsUserRow[] }) {
  if (!users.length) return <p className="text-sm text-on-surface/40">No activity yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-on-surface/40">
            <th className="pb-2 pr-4 font-medium">User</th>
            <th className="pb-2 pr-4 font-medium">Email</th>
            <th className="pb-2 pr-4 font-medium text-right">Events</th>
            <th className="pb-2 font-medium text-right">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.user_id}
              className="border-b border-white/5 text-on-surface/80 hover:bg-white/3"
            >
              <td className="py-2 pr-4 font-medium">{u.name ?? "—"}</td>
              <td className="py-2 pr-4 text-on-surface/60">{u.email ?? "—"}</td>
              <td className="py-2 pr-4 text-right font-medium">{u.event_count}</td>
              <td className="py-2 text-right text-on-surface/50 text-xs">
                {u.last_seen ? u.last_seen.slice(0, 16).replace("T", " ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const WINDOW_OPTIONS = [7, 14, 30, 90] as const

export function AdminAnalyticsPage() {
  const { getAccessToken } = useSession()
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [days, setDays] = useState<number>(30)

  const fetchData = async (windowDays: number) => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError("Not signed in")
        return
      }
      const result = await apiJson<AnalyticsSummary>(`/admin/analytics?days=${windowDays}`, {
        accessToken: token,
      })
      setData(result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true)
      } else {
        setError(e instanceof Error ? e.message : "Failed to load analytics")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(days)
  }, [days])

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Shield className="h-10 w-10 text-red-400/70" />
        <p className="text-lg font-semibold text-on-surface/70">Admin access required</p>
        <p className="text-sm text-on-surface/40">
          Your account is not listed in <code className="text-xs">ADMIN_EMAILS</code>.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingIndicator />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-red-400/70" />
        <p className="text-sm text-on-surface/60">{error}</p>
        <button
          onClick={() => void fetchData(days)}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-on-surface/60 hover:text-on-surface transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const pageViewMax = Math.max(...data.page_views.map((r) => r.count), 1)
  const featureMax = Math.max(...data.feature_uses.map((r) => r.count), 1)

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-primary-container" />
          <h1 className="text-xl font-semibold text-on-surface">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={[
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                days === w
                  ? "bg-primary-container/20 text-on-surface shadow-sm ring-1 ring-primary-container/25"
                  : "text-on-surface/50 hover:text-on-surface",
              ].join(" ")}
            >
              {w}d
            </button>
          ))}
          <button
            onClick={() => void fetchData(days)}
            className="ml-2 rounded p-1.5 text-on-surface/40 hover:text-on-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total users"
          value={data.total_users}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="DAU"
          value={data.dau}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub="last 24 h"
        />
        <StatCard
          label="WAU"
          value={data.wau}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub="last 7 days"
        />
        <StatCard
          label="MAU"
          value={data.mau}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub="last 30 days"
        />
        <StatCard
          label="Events"
          value={data.total_events}
          icon={<Zap className="h-3.5 w-3.5" />}
          sub={`last ${data.window_days}d`}
        />
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-on-surface/70">Activity over time</p>
          <DaySparkline rows={data.events_by_day} label="Events per day" />
        </div>
        <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-on-surface/70">New signups</p>
          <DaySparkline rows={data.new_users_by_day} label="New users per day" />
        </div>
      </div>

      {/* Page views + Feature usage */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-on-surface/70">Page views</p>
          <BarList rows={data.page_views} maxCount={pageViewMax} />
        </div>
        <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-on-surface/70">Feature usage</p>
          <BarList rows={data.feature_uses} maxCount={featureMax} />
        </div>
      </div>

      {/* API calls */}
      <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium text-on-surface/70">API calls (top endpoints)</p>
        <ApiCallList rows={data.api_calls} />
      </div>

      {/* Top users */}
      <div className="rounded-xl border border-white/10 bg-surface/60 p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium text-on-surface/70">
          Most active users — last {data.window_days}d
        </p>
        <TopUsersTable users={data.top_users} />
      </div>
    </div>
  )
}
