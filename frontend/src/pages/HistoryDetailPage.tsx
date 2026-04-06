import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Lock } from "lucide-react"
import { apiJson } from "../api/client"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { PremiumUpsellModal } from "../components/PremiumUpsellModal"
import {
  ResearchProcessAside,
  ResearchReportArticle,
  ResearchRunPageHeader,
} from "../components/ResearchRunViews"
import { API_BASE_URL } from "../lib/config"
import { useSession } from "../session/SessionContext"
import type { ResearchRunDetail, UserOut } from "../api/types"

export function HistoryDetailPage() {
  const { runId } = useParams()
  const { getAccessToken } = useSession()
  const [data, setData] = useState<ResearchRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [me, setMe] = useState<UserOut | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [upsellOpen, setUpsellOpen] = useState(false)

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token) return
        if (!cancelled) setAccessToken(token)
        try {
          const profile = await apiJson<UserOut>("/me", { accessToken: token })
          if (!cancelled) setMe(profile)
        } catch {
          if (!cancelled) setMe(null)
        }
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

  const isPro = me?.plan === "pro"

  const handleDownloadPdf = async () => {
    const token = await getAccessToken()
    if (!token || !runId) return
    if (!isPro) {
      setUpsellOpen(true)
      return
    }
    setPdfLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/research/${runId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        setUpsellOpen(true)
        return
      }
      if (!res.ok) throw new Error(`PDF generation failed: ${res.statusText}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      // Use a descriptive filename from the report data if available
      const ticker = data?.recommended_ticker ?? runId
      const date = data?.created_at?.slice(0, 10) ?? ""
      a.download = `${ticker}_research_${date}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("PDF download failed", e)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/app/history"
          className="inline-flex items-center gap-1.5 rounded border border-outline-ghost bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-primary-container shadow-sm transition hover:bg-primary-container/10 hover:text-on-surface"
        >
          ← Back to history
        </Link>

        {data && (
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded border border-primary-container/40 bg-primary-container/12 px-3 py-1.5 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-primary-container/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isPro ? (
              <>
                <Lock className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                PDF · Pro
              </>
            ) : pdfLoading ? (
              <LoadingIndicator
                message="Generating…"
                size="sm"
                className="text-on-surface"
              />
            ) : (
              "↓ Download PDF"
            )}
          </button>
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          {error}
        </p>
      ) : null}

      {!data && !error ? (
        <div className="flex justify-center rounded border border-outline-ghost bg-surface px-4 py-12">
          <LoadingIndicator layout="stacked" message="Loading…" />
        </div>
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

      {upsellOpen && (
        <PremiumUpsellModal
          onClose={() => setUpsellOpen(false)}
          accessToken={accessToken}
          waitlistJoined={me?.waitlist_joined ?? false}
          waitlistJoinedAt={me?.waitlist_joined_at ?? null}
          onWaitlistJoined={(updatedMe) => setMe(updatedMe)}
        />
      )}
    </div>
  )
}
