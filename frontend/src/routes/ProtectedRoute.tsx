import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { useSession } from "../session/SessionContext"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <LoadingIndicator layout="stacked" message="Loading…" size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
