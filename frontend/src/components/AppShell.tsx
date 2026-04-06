import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart2,
  History,
  LayoutDashboard,
  Layers,
  Loader2,
  LogOut,
  Sparkles,
  Zap,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { useActiveResearchRun } from "../session/ActiveResearchRunContext"
import { useSession } from "../session/SessionContext"
import { useUserProfile } from "../session/UserProfileContext"

/** Shown in the top banner, sidebar, and browser title (see `index.html`). */
export const APP_BRAND_NAME = "Market Researcher"

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "group flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary-container/12 text-on-surface shadow-sm ring-1 ring-primary-container/25"
      : "text-on-surface/70 hover:bg-surface hover:text-on-surface",
  ].join(" ")

export function AppShell() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { me, profileLoading, refreshProfile } = useUserProfile()
  const { backgroundRun, requestOpenProgress } = useActiveResearchRun()
  const skipNextPathRefresh = useRef(true)

  useEffect(() => {
    if (skipNextPathRefresh.current) {
      skipNextPathRefresh.current = false
      return
    }
    const t = window.setTimeout(() => void refreshProfile(), 400)
    return () => window.clearTimeout(t)
  }, [location.pathname, refreshProfile])

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface">
      <header
        role="banner"
        className="shrink-0 border-b border-outline-ghost bg-surface-container-lowest"
      >
        <div className="mx-auto flex max-w-[90rem] items-center px-4 py-2 sm:px-6 sm:py-2.5 lg:px-8">
          <div className="min-w-0 border-l-2 border-primary-container pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-container">
              Crew AI · Markets
            </p>
            <p className="truncate text-base font-semibold leading-tight text-on-surface sm:text-lg">
              {APP_BRAND_NAME}
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="flex min-h-0 w-56 shrink-0 flex-col border-r border-outline-ghost bg-surface-container-lowest shadow-[2px_0_12px_rgb(25_28_30_/0.04)]">
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-outline-ghost px-4 py-4 space-y-3">
            {/* Avatar + name row */}
            <div className="flex items-center gap-3">
              {profileLoading ? (
                <>
                  <div
                    className="h-11 w-11 shrink-0 animate-pulse rounded bg-outline-ghost/55 ring-2 ring-outline-ghost"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 max-w-[10rem] animate-pulse rounded bg-outline-ghost/50" />
                    <div className="h-3 max-w-[6rem] animate-pulse rounded bg-outline-ghost/40" />
                  </div>
                </>
              ) : me?.picture_url ? (
                <img
                  src={me.picture_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded object-cover shadow-sm ring-2 ring-outline-ghost"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-primary-container text-xs font-bold text-surface-container-lowest shadow-sm ring-2 ring-outline-ghost">
                  {(me?.name ?? me?.email ?? "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "?"}
                </div>
              )}
              {!profileLoading ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {me?.name ?? me?.username ?? me?.email ?? "Signed in"}
                  </p>
                  <p className="truncate text-xs text-on-surface/65">
                    {me?.username
                      ? `@${me.username}`
                      : (me?.email ?? "\u00a0")}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Plan badge */}
            {me && (
              me.plan === "pro" ? (
                <div className="flex items-center gap-1.5 rounded-md bg-emerald-950 px-2.5 py-1.5 ring-1 ring-primary-container/30">
                  <Zap className="h-3 w-3 shrink-0 text-primary-container" strokeWidth={2} aria-hidden />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-primary-container">
                    Pro plan
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 rounded-md border border-outline-ghost bg-surface px-2.5 py-1 ring-0">
                      <span className="text-[11px] font-semibold text-on-surface/60 uppercase tracking-wide">
                        Free plan
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-on-surface/45">
                      {me.runs_today >= 1 ? "0" : "1"} left today
                    </span>
                  </div>

                  {/* Daily usage bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-outline-ghost">
                      <div
                        className={[
                          "h-full rounded-full transition-all duration-500",
                          me.runs_today >= 1
                            ? "w-full bg-red-400/70"
                            : "w-0 bg-primary-container",
                        ].join(" ")}
                      />
                    </div>
                    <p className="text-[10px] text-on-surface/45">
                      {me.runs_today >= 1
                        ? "Daily research used · resets at midnight UTC"
                        : "1 sector research per day"}
                    </p>
                  </div>

                  {/* Upgrade CTA */}
                  <button
                    type="button"
                    onClick={() => navigate("/app/upgrade")}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary-container/30 bg-primary-container/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary-container transition hover:bg-primary-container/18"
                  >
                    <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
                    Upgrade to Pro · $2.99/mo
                  </button>
                </div>
              )
            )}
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <NavLink to="/app/dashboard" className={navClass}>
              {({ isActive }) => (
                <>
                  <LayoutDashboard
                    className={
                      isActive
                        ? "h-4 w-4 shrink-0 text-primary-container"
                        : "h-4 w-4 shrink-0 text-on-surface/40 group-hover:text-on-surface/55"
                    }
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Dashboard
                </>
              )}
            </NavLink>
            <NavLink to="/app/sectors" className={navClass}>
              {({ isActive }) => (
                <>
                  <Layers
                    className={
                      isActive
                        ? "h-4 w-4 shrink-0 text-primary-container"
                        : "h-4 w-4 shrink-0 text-on-surface/40 group-hover:text-on-surface/55"
                    }
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Sectors
                </>
              )}
            </NavLink>
            <NavLink to="/app/history" className={navClass}>
              {({ isActive }) => (
                <>
                  <History
                    className={
                      isActive
                        ? "h-4 w-4 shrink-0 text-primary-container"
                        : "h-4 w-4 shrink-0 text-on-surface/40 group-hover:text-on-surface/55"
                    }
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  History
                </>
              )}
            </NavLink>
            <NavLink to="/app/track-record" className={navClass}>
              {({ isActive }) => (
                <>
                  <BarChart2
                    className={
                      isActive
                        ? "h-4 w-4 shrink-0 text-primary-container"
                        : "h-4 w-4 shrink-0 text-on-surface/40 group-hover:text-on-surface/55"
                    }
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Track Record
                </>
              )}
            </NavLink>
          </nav>
          </div>
          <div className="shrink-0 border-t border-outline-ghost bg-surface-container-lowest p-3">
            <button
              type="button"
              onClick={() => void logout()}
              className="group flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut
                className="h-4 w-4 shrink-0 text-red-500 group-hover:text-red-600"
                strokeWidth={1.75}
                aria-hidden
              />
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-surface">
          {backgroundRun ? (
            <div
              className="sticky top-0 z-20 border-b border-amber-200/80 bg-amber-50/95 px-6 py-2.5 text-sm text-amber-950 shadow-sm backdrop-blur-sm lg:px-8"
              role="status"
              aria-live="polite"
            >
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin text-amber-700"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="font-medium text-amber-950">
                    Research running in the background:{" "}
                    <span className="text-amber-900">{backgroundRun.sector}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => requestOpenProgress()}
                  className="shrink-0 cursor-pointer rounded-lg border border-amber-300/90 bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-white"
                >
                  View progress
                </button>
              </div>
            </div>
          ) : null}
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
