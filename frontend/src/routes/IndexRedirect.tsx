import { Navigate } from "react-router-dom"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { useSession } from "../session/SessionContext"

export function IndexRedirect() {
  const { isAuthenticated, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <LoadingIndicator layout="stacked" message="Loading…" size="lg" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
