import { useEffect, useRef, useState } from "react"
import { researchWebSocketUrl } from "../api/client"
import type { WsServerMessage } from "../api/types"

type Props = {
  jobId: string
  accessToken: string
  sector: string
  onClose: () => void
  onDone?: () => void
}

export function ResearchProgressPanel({
  jobId,
  accessToken,
  sector,
  onClose,
  onDone,
}: Props) {
  const [lines, setLines] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const url = researchWebSocketUrl(jobId, accessToken)
    const ws = new WebSocket(url)
    wsRef.current = ws

    const append = (msg: string) => {
      setLines((prev) => [...prev.slice(-200), msg])
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as WsServerMessage
        if (data.type === "replay" && Array.isArray(data.events)) {
          append(`[replay] ${data.events.length} events`)
          for (const e of data.events) {
            append(typeof e === "object" ? JSON.stringify(e) : String(e))
          }
          return
        }
        if (data.type === "heartbeat") {
          append("· heartbeat")
          return
        }
        append(JSON.stringify(data))
        if (
          data.type === "job_completed" ||
          data.type === "job_failed"
        ) {
          onDoneRef.current?.()
        }
      } catch {
        append(String(ev.data))
      }
    }

    ws.onerror = () => {
      append("[ws error]")
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [jobId, accessToken])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded border border-outline-ghost bg-surface-container-lowest shadow-[0_24px_48px_rgba(25,28,30,0.12)]">
        <div className="flex items-start justify-between border-b border-outline-ghost px-5 py-4">
          <div>
            <h2
              id="research-modal-title"
              className="text-lg font-semibold text-on-surface"
            >
              Research run
            </h2>
            <p className="mt-0.5 text-sm text-on-surface/65">Sector: {sector}</p>
            <p className="mt-1 font-mono text-xs text-on-surface/50">{jobId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-on-surface/60 transition hover:bg-surface hover:text-on-surface"
          >
            Close
          </button>
        </div>
        <div className="min-h-[200px] flex-1 overflow-auto px-5 py-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-on-surface/85">
            {lines.length === 0 ? "Connecting…" : lines.join("\n")}
          </pre>
        </div>
      </div>
    </div>
  )
}
