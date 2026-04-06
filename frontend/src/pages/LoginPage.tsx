import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Activity, Bot, FileDown, LineChart, Trophy } from "lucide-react"
import { API_BASE_URL } from "../lib/config"
import { APP_BRAND_NAME } from "../components/AppShell"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { useSession } from "../session/SessionContext"
import type { DevLoginResponse } from "../api/types"

const FEATURES = [
  {
    icon: Bot,
    title: "Specialist research pipeline",
    body: "Multiple AI roles work in order—gathering public-market context and producing a structured view of the sector.",
  },
  {
    icon: Trophy,
    title: "Ranked top three",
    body: "Clear podium-style results with comparative reasoning and a deeper write-up on the leading name.",
  },
  {
    icon: Activity,
    title: "Live run status",
    body: "Follow each stage of a research job as it progresses so you know what is running and when it finishes.",
  },
  {
    icon: LineChart,
    title: "Outcome tracking",
    body: "Review earlier recommendations alongside simple 30 / 60 / 90-day price performance for context.",
  },
  {
    icon: FileDown,
    title: "Report export",
    body: "Pro members can download any completed report as a PDF from history.",
  },
] as const

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
    loginWithGoogle,
    loginWithDevToken,
    auth0Configured,
    showDevPasswordLogin,
  } = useSession()

  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("admin")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
        <LoadingIndicator layout="stacked" message="Loading…" size="lg" />
      </div>
    )
  }

  if (isAuthenticated) {
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

  const btnFocus =
    "outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest"

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-surface text-on-surface">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 0% -25%, rgb(16 185 129 / 0.1), transparent 52%), radial-gradient(ellipse 70% 50% at 100% 0%, rgb(16 185 129 / 0.06), transparent 48%)",
        }}
      />

      <header
        role="banner"
        className="relative shrink-0 border-b border-outline-ghost bg-surface-container-lowest/90 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0 border-l-[3px] border-primary-container pl-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-container">
              Crew AI · Markets
            </p>
            <p className="font-outfit text-xl font-semibold tracking-tight sm:text-2xl">
              {APP_BRAND_NAME}
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-10 sm:px-8 lg:flex-row lg:items-stretch lg:gap-16 lg:py-16">
        <section
          className="animate-login-fade-up flex min-w-0 flex-1 flex-col lg:max-w-[28rem] lg:justify-center"
          style={{ animationDelay: "30ms" }}
          aria-labelledby="login-hero-heading"
        >
          <h1
            id="login-hero-heading"
            className="font-outfit text-[1.65rem] font-semibold leading-snug tracking-tight sm:text-4xl sm:leading-tight"
          >
            Sector research, ranked ideas, and a clear record of what came next.
          </h1>
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-on-surface/70 sm:text-base">
            Choose a sector, run a guided research workflow, and review results
            in one place—including exports and historical performance for your
            own analysis.
          </p>

          <ul className="mt-9 space-y-0 sm:max-w-xl">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="animate-login-fade-up flex gap-3.5 border-t border-outline-ghost py-4 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[2.75rem_1fr] sm:items-start sm:gap-x-1"
                style={{ animationDelay: `${80 + i * 40}ms` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/[0.09] text-primary-container">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-on-surface">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-on-surface/62">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-prose border-t border-outline-ghost pt-6 text-xs leading-relaxed text-on-surface/50">
            This product is for research and educational use only. It does not
            provide personalized investment, legal, or tax advice. Market data
            can be incomplete or delayed; verify material facts independently
            before making decisions.
          </p>
        </section>

        <section
          className="animate-login-fade-up flex w-full shrink-0 lg:w-[min(100%,400px)] lg:items-center"
          style={{ animationDelay: "120ms" }}
          aria-label="Sign in"
        >
          <div className="w-full rounded-2xl border border-outline-ghost bg-surface-container-lowest p-7 shadow-[0_16px_48px_-12px_rgba(25,28,30,0.12)] sm:p-8">
            <h2 className="font-outfit text-xl font-semibold tracking-tight sm:text-[1.35rem]">
              Sign in with Google
            </h2>

            {auth0Configured ? (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => loginWithGoogle()}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl border border-outline-ghost bg-surface-container-lowest px-4 py-3.5 text-sm font-semibold text-on-surface shadow-sm transition duration-150 hover:border-on-surface/18 hover:bg-surface hover:shadow active:scale-[0.99] ${btnFocus}`}
                >
                  <GoogleMark className="h-5 w-5 shrink-0" />
                  Sign in with Google
                </button>
              </div>
            ) : (
              <p className="mt-8 rounded-xl border border-outline-ghost bg-surface px-4 py-3.5 text-sm text-on-surface/70">
                Sign-in is not configured for this deployment. Contact your
                administrator if you need access.
              </p>
            )}

            {showDevPasswordLogin ? (
              <form
                onSubmit={(e) => void onDevSubmit(e)}
                className="mt-8 space-y-4 rounded-xl border border-amber-200/90 bg-amber-50/50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/75">
                  Development only
                </p>
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
                    className="mt-1.5 w-full rounded-lg border border-outline-ghost bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none ring-primary-container transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
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
                    className="mt-1.5 w-full rounded-lg border border-outline-ghost bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none ring-primary-container transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/25"
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
                  className={`w-full rounded-xl border border-outline-ghost bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface shadow-sm transition duration-150 hover:bg-surface active:scale-[0.99] disabled:opacity-60 ${btnFocus}`}
                >
                  {submitting ? "Signing in…" : "Sign in (development)"}
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </main>

      <footer
        className="relative mt-auto border-t border-outline-ghost bg-surface-container-lowest/80 py-4 text-center text-[11px] text-on-surface/45 backdrop-blur-sm"
        role="contentinfo"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          © {new Date().getFullYear()} {APP_BRAND_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
