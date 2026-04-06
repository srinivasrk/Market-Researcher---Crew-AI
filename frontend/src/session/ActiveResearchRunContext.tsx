import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { researchWebSocketUrl } from "../api/client"
import { useUserProfile } from "./UserProfileContext"

export type LiveResearchRunInfo = {
  sector: string
  blurb: string
  jobId: string
  accessToken: string
}

type ActiveResearchRunContextValue = {
  backgroundRun: LiveResearchRunInfo | null
  deferredLiveModal: LiveResearchRunInfo | null
  beginBackgroundRun: (info: LiveResearchRunInfo) => void
  clearBackgroundRun: () => void
  requestOpenProgress: () => void
  consumeDeferredLiveModal: () => void
}

const ActiveResearchRunContext = createContext<ActiveResearchRunContextValue | null>(null)

function isTerminalPayload(data: Record<string, unknown>): boolean {
  if (data.type === "job_completed" || data.type === "job_failed") return true
  if (data.type === "replay" && Array.isArray(data.events)) {
    const last = data.events[data.events.length - 1] as Record<string, unknown> | undefined
    return last?.type === "job_completed" || last?.type === "job_failed"
  }
  return false
}

export function ActiveResearchRunProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { refreshProfile } = useUserProfile()
  const [backgroundRun, setBackgroundRun] = useState<LiveResearchRunInfo | null>(null)
  const [deferredLiveModal, setDeferredLiveModal] = useState<LiveResearchRunInfo | null>(null)
  const backgroundRunRef = useRef(backgroundRun)
  backgroundRunRef.current = backgroundRun

  useEffect(() => {
    if (!backgroundRun) return
    const { jobId, accessToken } = backgroundRun
    const url = researchWebSocketUrl(jobId, accessToken)
    const ws = new WebSocket(url)

    const finish = () => {
      setBackgroundRun(null)
      void refreshProfile()
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as Record<string, unknown>
        if (isTerminalPayload(data)) finish()
      } catch {
        /* ignore */
      }
    }

    return () => {
      ws.close()
    }
  }, [backgroundRun, refreshProfile])

  const beginBackgroundRun = useCallback((info: LiveResearchRunInfo) => {
    setBackgroundRun(info)
  }, [])

  const clearBackgroundRun = useCallback(() => {
    setBackgroundRun(null)
  }, [])

  const consumeDeferredLiveModal = useCallback(() => {
    setDeferredLiveModal(null)
  }, [])

  const requestOpenProgress = useCallback(() => {
    const br = backgroundRunRef.current
    if (br) setDeferredLiveModal({ ...br })
    setBackgroundRun(null)
    navigate("/app/sectors")
  }, [navigate])

  const value = useMemo(
    () => ({
      backgroundRun,
      deferredLiveModal,
      beginBackgroundRun,
      clearBackgroundRun,
      requestOpenProgress,
      consumeDeferredLiveModal,
    }),
    [
      backgroundRun,
      deferredLiveModal,
      beginBackgroundRun,
      clearBackgroundRun,
      requestOpenProgress,
      consumeDeferredLiveModal,
    ],
  )

  return (
    <ActiveResearchRunContext.Provider value={value}>{children}</ActiveResearchRunContext.Provider>
  )
}

export function useActiveResearchRun() {
  const ctx = useContext(ActiveResearchRunContext)
  if (!ctx) {
    throw new Error("useActiveResearchRun must be used within ActiveResearchRunProvider")
  }
  return ctx
}
