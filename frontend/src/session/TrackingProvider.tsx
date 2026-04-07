import { useEffect, useRef, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { useTrack } from "../hooks/useTrack"
import { useSession } from "./SessionContext"

/**
 * Mounts inside the authenticated app shell. Automatically fires:
 *   - `session_start` once when the user first authenticates
 *   - `page_view` on every route change
 *
 * Must be rendered inside both <SessionProvider> and <BrowserRouter>.
 */
export function TrackingProvider({ children }: { children: ReactNode }) {
  const { track } = useTrack()
  const { isAuthenticated } = useSession()
  const location = useLocation()
  const sessionStarted = useRef(false)

  // Fire session_start once per authenticated session
  useEffect(() => {
    if (isAuthenticated && !sessionStarted.current) {
      sessionStarted.current = true
      track("session_start", "app")
    }
  }, [isAuthenticated, track])

  // Fire page_view on every route change (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return
    track("page_view", location.pathname)
  }, [location.pathname, isAuthenticated, track])

  return <>{children}</>
}
