import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { API_BASE_URL } from "../lib/config"
import { useSession } from "../session/SessionContext"
import type { DevLoginResponse } from "../api/types"

export function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    loginWithAuth0,
    loginWithDevToken,
    auth0Configured,
    showDevPasswordLogin,
  } = useSession()

  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("admin")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }

  async function onDevSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.status === 404) {
        setError("Dev login is disabled on the API (set API_DEV_PASSWORD_LOGIN).")
        return
      }
      if (!res.ok) {
        const text = await res.text()
        setError(text || `Login failed (${res.status})`)
        return
      }
      const data = (await res.json()) as DevLoginResponse
      loginWithDevToken(data.access_token)
    } catch {
      setError("Network error — is the API running?")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded border border-outline-ghost bg-surface-container-lowest p-8 shadow-[0_8px_30px_rgba(25,28,30,0.06)]">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-on-surface/75">
          Connect to the Market Researcher API with Auth0 or a dev account.
        </p>

        {auth0Configured ? (
          <button
            type="button"
            onClick={() => loginWithAuth0()}
            className="mt-8 w-full rounded bg-primary-container px-4 py-3 text-sm font-medium text-surface-container-lowest shadow-sm transition hover:brightness-95"
          >
            Continue with Auth0
          </button>
        ) : (
          <p className="mt-6 rounded border border-outline-ghost bg-surface px-3 py-2 text-sm text-on-surface/85">
            Auth0 is not configured. Set{" "}
            <code className="rounded bg-surface-container-lowest px-1 ring-1 ring-outline-ghost">
              VITE_AUTH0_DOMAIN
            </code>{" "}
            and{" "}
            <code className="rounded bg-surface-container-lowest px-1 ring-1 ring-outline-ghost">
              VITE_AUTH0_CLIENT_ID
            </code>{" "}
            or use dev login below.
          </p>
        )}

        {showDevPasswordLogin ? (
          <form onSubmit={(e) => void onDevSubmit(e)} className="mt-8 space-y-4">
            <div className="border-t border-outline-ghost pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface/50">
                Development login
              </p>
            </div>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-on-surface/85"
              >
                Username
              </label>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                className="mt-1 w-full rounded border border-outline-ghost bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-primary-container focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-on-surface/85"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="mt-1 w-full rounded border border-outline-ghost bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-primary-container focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded border border-outline-ghost bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface shadow-sm transition hover:bg-surface disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in (dev)"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-on-surface/60">
            Dev password login is hidden. Set{" "}
            <code className="rounded bg-surface px-1 ring-1 ring-outline-ghost">
              VITE_DEV_PASSWORD_LOGIN=true
            </code>{" "}
            and enable{" "}
            <code className="rounded bg-surface px-1 ring-1 ring-outline-ghost">
              API_DEV_PASSWORD_LOGIN
            </code>{" "}
            on the API.
          </p>
        )}
      </div>
    </div>
  )
}
