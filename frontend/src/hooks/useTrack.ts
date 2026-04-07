import { useCallback } from "react"
import { apiFetch } from "../api/client"
import { useSession } from "../session/SessionContext"

export type TrackEventType = "page_view" | "feature_use" | "session_start" | "session_end"

/**
 * Lightweight analytics hook. Sends events to POST /track with the user's JWT.
 * All calls are fire-and-forget — errors are silently swallowed so tracking
 * never blocks or breaks the UI.
 */
export function useTrack() {
  const { getAccessToken } = useSession()

  const track = useCallback(
    (
      eventType: TrackEventType,
      eventName: string,
      properties?: Record<string, unknown>,
    ) => {
      // Intentionally not awaited at the call site
      ;(async () => {
        try {
          const token = await getAccessToken()
          if (!token) return
          apiFetch("/track", {
            method: "POST",
            accessToken: token,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: eventType,
              event_name: eventName,
              properties: properties ?? null,
            }),
          }).catch(() => {
            // silently discard network errors
          })
        } catch {
          // silently discard token errors
        }
      })()
    },
    [getAccessToken],
  )

  return { track }
}
