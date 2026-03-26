import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { apiJson } from "../api/client"
import {
  ResearchProcessAside,
  ResearchReportArticle,
  ResearchRunPageHeader,
} from "../components/ResearchRunViews"
import { useSession } from "../session/SessionContext"
import type { ResearchRunDetail } from "../api/types"

export function HistoryDetailPage() {
  const { runId } = useParams()
  const { getAccessToken } = useSession()
  const [data, setData] = useState<ResearchRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        const row = await apiJson<ResearchRunDetail>(`/research/${runId}`, {
          accessToken: token,
        })
        if (!cancelled) setData(row)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load run")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runId, getAccessToken])

  return (
    <div className="space-y-6 pb-12">
      <Link
        to="/app/history"
        className="inline-flex items-center gap-1.5 rounded border border-outline-ghost bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-primary-container shadow-sm transition hover:bg-primary-container/10 hover:text-on-surface"
      >
        ← Back to history
      </Link>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          {error}
        </p>
      ) : null}

      {!data && !error ? (
        <p className="rounded border border-outline-ghost bg-surface px-4 py-8 text-center text-sm text-on-surface/65">
          Loading…
        </p>
      ) : null}

      {data ? (
        <>
          <ResearchRunPageHeader data={data} />
          <ResearchProcessAside />
          <ResearchReportArticle
            reportMarkdown={data.report_markdown}
            recommendedTicker={data.recommended_ticker}
          />
        </>
      ) : null}
    </div>
  )
}
