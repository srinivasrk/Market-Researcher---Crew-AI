import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { API_BASE_URL } from "../lib/config"
import { APP_BRAND_NAME } from "../components/AppShell"
import { useSession } from "../session/SessionContext"
import type { DevLoginResponse } from "../api/types"

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    loginWithAuth0,
    loginWithGoogle,
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
    <div className="flex min-h-screen flex-col bg-surface">
      <header
        role="banner"
        className="shrink-0 border-b border-outline-ghost bg-surface-container-lowest shadow-[0_1px_0_rgb(25_28_30_/0.04)]"
      >
        <div className="mx-auto flex max-w-lg items-center px-6 py-5 sm:px-8">
          <div className="min-w-0 border-l-[3px] border-primary-container pl-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-container">
              Crew AI · Markets
            </p>
            <p className="font-outfit text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
              {APP_BRAND_NAME}
            </p>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(16 185 129 / 0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgb(16 185 129 / 0.06), transparent 50%)",
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-outline-ghost bg-surface-container-lowest/95 p-8 shadow-[0_12px_40px_rgba(25,28,30,0.08)] backdrop-blur-sm sm:p-9">
            <h1 className="font-outfit text-2xl font-semibold tracking-tight text-on-surface">
              Sign in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-on-surface/70">
              Use your Google account or continue with Auth0 to access research
              tools and dashboards.
            </p>

            {auth0Configured ? (
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => loginWithGoogle()}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-ghost bg-surface-container-lowest px-4 py-3.5 text-sm font-semibold text-on-surface shadow-sm transition hover:border-outline-variant/40 hover:bg-surface"
                >
                  <GoogleMark className="h-5 w-5 shrink-0" />
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => loginWithAuth0()}
                  className="w-full rounded-xl bg-primary-container px-4 py-3.5 text-sm font-semibold text-surface-container-lowest shadow-md shadow-primary-container/20 transition hover:brightness-[1.03] active:brightness-[0.97]"
                >
                  Continue with Auth0
                </button>
              </div>
            ) : (
              <p className="mt-8 rounded-xl border border-outline-ghost bg-surface/80 px-4 py-3 text-sm text-on-surface/75">
                Sign-in is not available. Ask your administrator to enable
                authentication for this app.
              </p>
            )}

            {showDevPasswordLogin ? (
              <form
                onSubmit={(e) => void onDevSubmit(e)}
                className="mt-8 space-y-4"
              >
                <div className="border-t border-outline-ghost pt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface/45">
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
                    className="mt-1.5 w-full rounded-lg border border-outline-ghost bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none ring-primary-container focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
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
                    className="mt-1.5 w-full rounded-lg border border-outline-ghost bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none ring-primary-container focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
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
                  className="w-full rounded-xl border border-outline-ghost bg-surface-container-lowest px-4 py-3.5 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface disabled:opacity-60"
                >
                  {submitting ? "Signing in…" : "Sign in (dev)"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
