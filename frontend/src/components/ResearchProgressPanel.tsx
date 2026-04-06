import { useEffect, useId, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { apiJson, researchWebSocketUrl } from "../api/client"
import type { ResearchRunDetail } from "../api/types"
import type { LiveResearchRunInfo } from "../session/ActiveResearchRunContext"
import {
  ResearchProcessAside,
  ResearchReportArticle,
  ResearchRunModalSummary,
} from "./ResearchRunViews"

export type ResearchModalConnection =
  | { state: "starting" }
  | { state: "error"; message: string }
  | { state: "live"; jobId: string; accessToken: string }

type Props = {
  sector: string
  blurb: string
  connection: ResearchModalConnection
  onClose: () => void
  onDone?: () => void
  /** When the user closes the dialog while the job is still running, keep tracking in the shell. */
  onContinueInBackground?: (run: LiveResearchRunInfo) => void
}

type TimelineVariant = "neutral" | "accent" | "ok" | "bad"

type TimelineEntry = {
  id: number
  variant: TimelineVariant
  title: string
  subtitle?: string
  meta?: string
}

function shortenJobId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function describeWsPayload(data: Record<string, unknown>): Omit<TimelineEntry, "id"> {
  const t = String(data.type ?? "event")

  switch (t) {
    case "job_started":
      return {
        variant: "accent",
        title: "Research job started",
        subtitle: `Sector: ${String(data.sector ?? sectorPlaceholder)}`,
      }
    case "research_preparing":
      return {
        variant: "neutral",
        title: "Preparing pipeline",
        subtitle: `Setting up analysis for ${String(data.sector ?? "this theme")}.`,
      }
    case "research_inputs_ready": {
      const ex = data.excluded_tickers
      const n = Array.isArray(ex) ? ex.length : 0
      return {
        variant: "neutral",
        title: "Inputs ready",
        subtitle:
          n > 0
            ? `${n} ticker${n === 1 ? "" : "s"} excluded from this run (already in your history).`
            : "No ticker exclusions — full universe for this sector.",
      }
    }
    case "crew_kickoff_started":
      return {
        variant: "accent",
        title: "Crew is running",
        subtitle: "Agents are executing tasks sequentially.",
      }
    case "crew_kickoff_completed":
      return {
        variant: "ok",
        title: "Crew finished",
        subtitle: `Approximate token usage: ${String(data.total_tokens ?? 0)}`,
      }
    case "crew_kickoff_failed":
      return {
        variant: "bad",
        title: "Crew stopped with an error",
        subtitle: String(data.error ?? "Unknown error"),
      }
    case "task_started":
      return {
        variant: "neutral",
        title: "Task in progress",
        subtitle: humanizeTaskName(String(data.task ?? "")),
      }
    case "task_completed":
      return {
        variant: "ok",
        title: "Task done",
        subtitle: humanizeTaskName(String(data.task ?? "")),
      }
    case "task_failed":
      return {
        variant: "bad",
        title: "Task failed",
        subtitle: `${humanizeTaskName(String(data.task ?? ""))}${data.error ? ` — ${String(data.error)}` : ""}`,
      }
    case "persisting_run":
      return {
        variant: "neutral",
        title: "Saving your report",
        subtitle: "Writing results to history…",
      }
    case "run_persisted":
      return {
        variant: "ok",
        title: "Report saved",
        meta: data.run_id ? String(data.run_id) : undefined,
        subtitle: "You can open the full write-up from History anytime.",
      }
    case "job_completed":
      return {
        variant: "ok",
        title: "Research complete",
        subtitle: data.recommended_ticker
          ? `Lead pick: ${String(data.recommended_ticker).toUpperCase()}`
          : "Results are ready.",
        meta: data.run_id ? String(data.run_id) : undefined,
      }
    case "job_failed":
      return {
        variant: "bad",
        title: "Research failed",
        subtitle: String(data.error ?? "Something went wrong."),
      }
    default:
      return {
        variant: "neutral",
        title: humanizeTypeLabel(t),
        subtitle: summarizeUnknownPayload(data),
      }
  }
}

const sectorPlaceholder = "this sector"

function humanizeTaskName(raw: string): string {
  const s = raw.trim()
  if (!s || s === "unknown") return "Unnamed task"
  if (s.length > 220) return `${s.slice(0, 217)}…`
  return s
}

function humanizeTypeLabel(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function summarizeUnknownPayload(data: Record<string, unknown>): string | undefined {
  const keys = Object.keys(data).filter((k) => k !== "type")
  if (keys.length === 0) return undefined
  const parts: string[] = []
  for (const k of keys.slice(0, 4)) {
    const v = data[k]
    if (v === null || v === undefined) continue
    if (typeof v === "object") {
      try {
        parts.push(`${k}: ${JSON.stringify(v)}`)
      } catch {
        parts.push(`${k}: [object]`)
      }
    } else {
      parts.push(`${k}: ${String(v)}`)
    }
  }
  const joined = parts.join(" · ")
  return joined.length > 280 ? `${joined.slice(0, 277)}…` : joined
}

function variantStyles(v: TimelineVariant): {
  ring: string
  icon: string
  bg: string
} {
  switch (v) {
    case "accent":
      return {
        ring: "ring-primary-container/35",
        icon: "text-primary-container",
        bg: "bg-primary-container/10",
      }
    case "ok":
      return {
        ring: "ring-emerald-500/30",
        icon: "text-emerald-700",
        bg: "bg-emerald-500/10",
      }
    case "bad":
      return {
        ring: "ring-red-400/35",
        icon: "text-red-700",
        bg: "bg-red-500/10",
      }
    default:
      return {
        ring: "ring-outline-variant/50",
        icon: "text-on-surface/55",
        bg: "bg-surface-container-high/80",
      }
  }
}

function TimelineIcon({ variant }: { variant: TimelineVariant }) {
  const cls = "h-4 w-4 shrink-0"
  if (variant === "ok") return <CheckCircle2 className={cls} strokeWidth={2} aria-hidden />
  if (variant === "bad") return <AlertCircle className={cls} strokeWidth={2} aria-hidden />
  if (variant === "accent") return <Sparkles className={cls} strokeWidth={2} aria-hidden />
  return <Info className={cls} strokeWidth={2} aria-hidden />
}

export function ResearchProgressPanel({
  sector,
  blurb,
  connection,
  onClose,
  onDone,
  onContinueInBackground,
}: Props) {
  const titleId = useId()
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [lastPulse, setLastPulse] = useState<string | null>(null)
  const [runReachedTerminal, setRunReachedTerminal] = useState(false)
  const [finalRunId, setFinalRunId] = useState<string | null>(null)
  const [completedDetail, setCompletedDetail] = useState<ResearchRunDetail | null>(null)
  const [reportPhase, setReportPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  )
  const [reportError, setReportError] = useState<string | null>(null)
  const nextId = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const append = (raw: Omit<TimelineEntry, "id">) => {
    const id = nextId.current++
    setEntries((prev) => {
      const next = [...prev, { ...raw, id }]
      return next.length > 400 ? next.slice(-400) : next
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries.length])

  const liveJobId = connection.state === "live" ? connection.jobId : null
  const liveToken = connection.state === "live" ? connection.accessToken : null

  useEffect(() => {
    if (connection.state !== "live" || !liveJobId || !liveToken) {
      setWsConnected(false)
      return
    }

    const jobId = liveJobId
    const accessToken = liveToken
    setEntries([])
    setFinalRunId(null)
    setCompletedDetail(null)
    setReportPhase("idle")
    setReportError(null)
    nextId.current = 0
    setLastPulse(null)
    setRunReachedTerminal(false)

    const url = researchWebSocketUrl(jobId, accessToken)
    const ws = new WebSocket(url)

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)

    const handlePayload = (data: Record<string, unknown>) => {
      if (data.type === "heartbeat") {
        setLastPulse(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
        return
      }
      if (data.type === "replay" && Array.isArray(data.events)) {
        append({
          variant: "neutral",
          title: "Caught up on progress",
          subtitle: `Loaded ${data.events.length} earlier event${data.events.length === 1 ? "" : "s"} from this run.`,
        })
        for (const e of data.events) {
          if (e && typeof e === "object" && !Array.isArray(e)) {
            const row = describeWsPayload(e as Record<string, unknown>)
            append(row)
            if ((e as Record<string, unknown>).type === "job_completed") {
              const rid = (e as Record<string, unknown>).run_id
              if (typeof rid === "string") setFinalRunId(rid)
            }
          } else {
            append({
              variant: "neutral",
              title: "Event",
              subtitle: String(e),
            })
          }
        }
        const last = data.events[data.events.length - 1] as Record<string, unknown> | undefined
        if (last?.type === "job_completed" || last?.type === "job_failed") {
          setRunReachedTerminal(true)
          onDoneRef.current?.()
        }
        return
      }

      const row = describeWsPayload(data)
      append(row)

      if (data.type === "job_completed") {
        if (typeof data.run_id === "string") setFinalRunId(data.run_id)
        setRunReachedTerminal(true)
        onDoneRef.current?.()
      }
      if (data.type === "job_failed") {
        setRunReachedTerminal(true)
        onDoneRef.current?.()
      }
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as Record<string, unknown>
        handlePayload(data)
      } catch {
        append({
          variant: "neutral",
          title: "Message",
          subtitle: String(ev.data),
        })
      }
    }

    ws.onerror = () => {
      append({
        variant: "bad",
        title: "Connection issue",
        subtitle: "WebSocket reported an error. Progress may still complete on the server.",
      })
    }

    return () => {
      ws.close()
    }
  }, [connection.state, liveJobId, liveToken])

  useEffect(() => {
    if (!finalRunId || !liveToken || connection.state !== "live") {
      if (!finalRunId) {
        setCompletedDetail(null)
        setReportPhase("idle")
        setReportError(null)
      }
      return
    }
    let cancelled = false
    setReportPhase("loading")
    setReportError(null)
    ;(async () => {
      try {
        const row = await apiJson<ResearchRunDetail>(`/research/${finalRunId}`, {
          accessToken: liveToken,
        })
        if (!cancelled) {
          setCompletedDetail(row)
          setReportPhase("ready")
        }
      } catch (e) {
        if (!cancelled) {
          setCompletedDetail(null)
          setReportPhase("error")
          setReportError(e instanceof Error ? e.message : "Failed to load report")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [finalRunId, liveToken, connection.state])

  const handleRequestClose = () => {
    if (
      connection.state === "live" &&
      !runReachedTerminal &&
      onContinueInBackground
    ) {
      onContinueInBackground({
        sector,
        blurb,
        jobId: connection.jobId,
        accessToken: connection.accessToken,
      })
    }
    onClose()
  }

  const showStarting = connection.state === "starting"
  const showError = connection.state === "error"
  const liveMeta =
    connection.state === "live"
      ? { jobId: connection.jobId, token: connection.accessToken }
      : null

  const showLiveReport =
    connection.state === "live" &&
    reportPhase === "ready" &&
    completedDetail !== null
  const showReportLoading =
    connection.state === "live" && finalRunId && reportPhase === "loading"
  const showReportError =
    connection.state === "live" && finalRunId && reportPhase === "error"
  const showTimeline =
    connection.state === "live" &&
    !showReportLoading &&
    !showLiveReport &&
    (entries.length > 0 || (finalRunId === null && wsConnected))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose()
      }}
    >
      <div
        className={[
          "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest shadow-[0_28px_64px_rgba(25,28,30,0.14)]",
          showLiveReport ? "max-w-3xl" : "max-w-2xl",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-ghost bg-surface-container-lowest px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-container">
              Sector research
            </p>
            <h2 id={titleId} className="font-outfit mt-1 text-xl font-bold text-on-surface sm:text-2xl">
              {sector}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-on-surface/70">{blurb}</p>
            {liveMeta ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-on-surface/55">
                <span className="rounded-md border border-outline-ghost bg-surface px-2 py-1 font-mono tabular-nums">
                  Job {shortenJobId(liveMeta.jobId)}
                </span>
                {showLiveReport ? (
                  <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-800">
                    Complete
                  </span>
                ) : wsConnected ? (
                  <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-800">
                    Live updates
                  </span>
                ) : showStarting || showError ? null : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 px-2 py-1 text-on-surface/60">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Connecting…
                  </span>
                )}
                {lastPulse ? (
                  <span className="text-on-surface/45">Heartbeat {lastPulse}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="rounded-lg p-2 text-on-surface/50 transition hover:bg-surface hover:text-on-surface"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {showStarting ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-container" aria-hidden />
              <div>
                <p className="font-medium text-on-surface">Starting research…</p>
                <p className="mt-1 text-sm text-on-surface/65">
                  Securing a job slot and opening a live feed.
                </p>
              </div>
            </div>
          ) : null}

          {showError ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              <p className="font-semibold">Could not start research</p>
              <p className="mt-1 text-red-800/90">{connection.message}</p>
            </div>
          ) : null}

          {showReportLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-container" aria-hidden />
              <div>
                <p className="font-medium text-on-surface">Loading your report…</p>
                <p className="mt-1 text-sm text-on-surface/65">
                  Fetching the same write-up you would see in History.
                </p>
              </div>
            </div>
          ) : null}

          {showLiveReport && completedDetail ? (
            <div className="space-y-5">
              <ResearchRunModalSummary data={completedDetail} />
              <ResearchProcessAside />
              <ResearchReportArticle
                reportMarkdown={completedDetail.report_markdown}
                recommendedTicker={completedDetail.recommended_ticker}
              />
              <Link
                to={`/app/history/${completedDetail.id}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-container hover:underline"
                onClick={handleRequestClose}
              >
                Open this run in History
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : null}

          {showReportError && finalRunId ? (
            <div className="space-y-4">
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                role="alert"
              >
                <p className="font-semibold">Could not load the saved report</p>
                <p className="mt-1 text-red-800/90">{reportError}</p>
              </div>
              <Link
                to={`/app/history/${finalRunId}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-container hover:underline"
                onClick={handleRequestClose}
              >
                Try opening in History
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : null}

          {connection.state === "live" &&
          entries.length === 0 &&
          wsConnected &&
          !finalRunId ? (
            <p className="py-6 text-center text-sm text-on-surface/55">
              Connected. Waiting for the crew to emit progress…
            </p>
          ) : null}

          {showTimeline && entries.length > 0 ? (
            <div className="relative">
              <div
                className="absolute bottom-0 left-[15px] top-2 w-px bg-outline-variant/60"
                aria-hidden
              />
              <ul className="relative space-y-4">
                {entries.map((e) => {
                  const st = variantStyles(e.variant)
                  return (
                    <li key={e.id} className="relative flex gap-4 pl-1">
                      <div
                        className={[
                          "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2",
                          st.bg,
                          st.ring,
                          st.icon,
                        ].join(" ")}
                      >
                        <TimelineIcon variant={e.variant} />
                      </div>
                      <div className="min-w-0 flex-1 pb-1 pt-0.5">
                        <p className="text-sm font-semibold text-on-surface">{e.title}</p>
                        {e.subtitle ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-on-surface/70">
                            {e.subtitle}
                          </p>
                        ) : null}
                        {e.meta ? (
                          <p className="mt-1 font-mono text-xs text-on-surface/45">{e.meta}</p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div ref={bottomRef} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
