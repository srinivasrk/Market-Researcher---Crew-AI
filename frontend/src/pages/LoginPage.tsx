import { Fragment, useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  ExternalLink,
  Eye,
  Server,
  Shield,
  Zap,
} from "lucide-react"
import { API_BASE_URL } from "../lib/config"
import { APP_BRAND_NAME } from "../components/AppShell"
import { LoadingIndicator } from "../components/LoadingIndicator"
import { useSession } from "../session/SessionContext"
import type { DevLoginResponse } from "../api/types"

// ─── Agent pipeline ───────────────────────────────────────────────────────────

const AGENTS = [
  {
    step: 1,
    name: "Market Researcher",
    role: "Runs Serper web search to gather public-market context and recent news for the sector.",
    badge: "Search & Context",
  },
  {
    step: 2,
    name: "Financial Analyst",
    role: "Scores financial signals, fundamentals, and sector momentum from the gathered context.",
    badge: "Signal Scoring",
  },
  {
    step: 3,
    name: "Investment Strategist",
    role: "Synthesises all findings into a ranked top-3 recommendation as a structured Pydantic JSON.",
    badge: "Structured Output",
  },
] as const

// ─── Production engineering callouts ─────────────────────────────────────────

const PROD_FEATURES = [
  {
    icon: Shield,
    title: "Auth0 OAuth2",
    body: "RS256 JWTs in production; HS256 dev tokens for local work. WebSocket routes are JWT-gated.",
  },
  {
    icon: Eye,
    title: "LLM Observability",
    body: "Self-hosted Langfuse via Docker Compose + AgentOps for full session replay and cost tracking.",
  },
  {
    icon: Server,
    title: "Backend Deployment",
    body: "Dockerized FastAPI on Fly.io with a persistent SQLite volume and 24-hour sector-level cache.",
  },
  {
    icon: Zap,
    title: "Real-time Streaming",
    body: "WebSocket event stream with late-join replay buffer — clients that connect mid-run catch up automatically.",
  },
] as const

// ─── Tech stack pills ─────────────────────────────────────────────────────────

const TECH_STACK = [
  "CrewAI 1.11",
  "FastAPI",
  "React 19",
  "Gemini 2.5 Flash",
  "Auth0",
  "Langfuse",
  "AgentOps",
  "Docker",
  "Fly.io",
  "SQLite",
] as const

// ─── Google mark SVG ──────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 0% -25%, rgb(16 185 129 / 0.1), transparent 52%), radial-gradient(ellipse 70% 50% at 100% 0%, rgb(16 185 129 / 0.06), transparent 48%)",
        }}
      />

      {/* ── Header ── */}
      <header
        role="banner"
        className="relative shrink-0 border-b border-outline-ghost bg-surface-container-lowest/90 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0 border-l-[3px] border-primary-container pl-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-container">
              Crew AI · Markets
            </p>
            <p className="font-outfit text-xl font-semibold tracking-tight sm:text-2xl">
              {APP_BRAND_NAME}
            </p>
          </div>

          {/* Portfolio badge */}
          <span className="hidden sm:inline-flex items-center rounded-full border border-primary-container/30 bg-primary-container/[0.08] px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-container">
            Portfolio Project · Built by Srini
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:gap-16 lg:py-16">

        {/* ── Left column ── */}
        <section
          className="animate-login-fade-up flex min-w-0 flex-1 flex-col"
          style={{ animationDelay: "30ms" }}
          aria-labelledby="login-hero-heading"
        >
          {/* Agentic framework pill */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-ghost bg-surface-container-lowest px-3 py-1 text-xs font-medium text-on-surface/60">
              <Bot className="h-3.5 w-3.5 text-primary-container" aria-hidden />
              Agentic Framework · Production Demo
            </span>
          </div>

          {/* Hero headline */}
          <h1
            id="login-hero-heading"
            className="font-outfit mt-4 text-[1.65rem] font-semibold leading-snug tracking-tight sm:text-4xl sm:leading-tight"
          >
            A production-grade multi-agent stock research system.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-on-surface/70 sm:text-base">
            Built to showcase a fully productionalized CrewAI workflow — three specialized AI agents,
            a real-time WebSocket API, Auth0 authentication, and self-hosted LLM observability —
            all deployed and running live.
          </p>

          {/* ── Agent Pipeline ── */}
          <div
            className="animate-login-fade-up mt-10"
            style={{ animationDelay: "80ms" }}
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">
              Agent Pipeline · Sequential Process
            </p>

            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0">
              {AGENTS.map(({ step, name, role, badge }, i) => (
                <Fragment key={name}>
                  <div className="flex-1 min-w-0 rounded-xl border border-outline-ghost bg-surface-container-lowest p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-container/60">
                        Step {step}
                      </span>
                      <span className="rounded-full bg-primary-container/[0.08] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-primary-container/80">
                        {badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-tight text-on-surface">{name}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-on-surface/55">{role}</p>
                  </div>

                  {i < AGENTS.length - 1 && (
                    <div className="flex items-center justify-center py-1 text-on-surface/25 sm:px-2 sm:py-0">
                      <ArrowRight
                        className="h-4 w-4 rotate-90 sm:rotate-0"
                        aria-hidden
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>

            <p className="mt-3 text-xs text-on-surface/40">
              Powered by Gemini 2.5 Flash · Serper Search · Structured JSON output via Pydantic
            </p>
          </div>

          {/* ── Production Engineering ── */}
          <div
            className="animate-login-fade-up mt-10"
            style={{ animationDelay: "140ms" }}
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">
              Production Engineering
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROD_FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border border-outline-ghost bg-surface-container-lowest p-4"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-container/[0.09] text-primary-container">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="text-sm font-semibold text-on-surface">{title}</p>
                  </div>
                  <p className="pl-[2.375rem] text-xs leading-relaxed text-on-surface/60">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-8 max-w-2xl border-t border-outline-ghost pt-6 text-xs leading-relaxed text-on-surface/45">
            This product is for research and educational use only. It does not provide personalized
            investment, legal, or tax advice. Market data can be incomplete or delayed; verify
            material facts independently before making decisions.
          </p>
        </section>

        {/* ── Right column ── */}
        <section
          className="animate-login-fade-up flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-16 lg:w-[min(100%,380px)]"
          style={{ animationDelay: "120ms" }}
          aria-label="Sign in"
        >
          {/* Sign-in card */}
          <div className="w-full rounded-2xl border border-outline-ghost bg-surface-container-lowest p-7 shadow-[0_16px_48px_-12px_rgba(25,28,30,0.12)] sm:p-8">
            <h2 className="font-outfit text-xl font-semibold tracking-tight sm:text-[1.35rem]">
              Try the live demo
            </h2>
            <p className="mt-1.5 text-sm text-on-surface/60">
              Free tier: 1 research run per day. Results are sector-cached for speed.
            </p>

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

          {/* Tech stack pills */}
          <div className="rounded-2xl border border-outline-ghost bg-surface-container-lowest/70 px-5 py-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-outline-ghost bg-surface px-2.5 py-0.5 text-[11px] font-medium text-on-surface/70"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative mt-auto border-t border-outline-ghost bg-surface-container-lowest/80 py-4 backdrop-blur-sm"
        role="contentinfo"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 text-[11px] text-on-surface/45 sm:px-8">
          <span>© {new Date().getFullYear()} {APP_BRAND_NAME}. All rights reserved.</span>
          {/* TODO: update href with your actual GitHub URL */}
          <a
            href="https://github.com/srinivasrk92"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-on-surface/80"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
