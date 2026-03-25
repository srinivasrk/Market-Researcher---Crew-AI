import { Navigate } from "react-router-dom"
import { useSession } from "../session/SessionContext"

export function IndexRedirect() {
  const { isAuthenticated, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
