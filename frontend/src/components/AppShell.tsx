import { NavLink, Outlet } from "react-router-dom"
import { History, LayoutDashboard, Layers, LogOut } from "lucide-react"
import { useSession } from "../session/SessionContext"
import { useEffect, useState } from "react"
import { apiJson } from "../api/client"
import type { UserOut } from "../api/types"

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
  const { getAccessToken, logout } = useSession()
  const [me, setMe] = useState<UserOut | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token) return
      try {
        const profile = await apiJson<UserOut>("/me", {
          accessToken: token,
        })
        if (!cancelled) setMe(profile)
      } catch {
        if (!cancelled) setMe(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  return (
    <div className="flex min-h-screen flex-col bg-surface">
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
        <aside className="flex w-56 shrink-0 flex-col border-r border-outline-ghost bg-surface-container-lowest shadow-[2px_0_12px_rgb(25_28_30_/0.04)]">
          <div className="border-b border-outline-ghost px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-primary-container text-xs font-bold text-surface-container-lowest shadow-sm ring-2 ring-outline-ghost">
                MR
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {me?.name ?? me?.email ?? "Signed in"}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-container">
                  {APP_BRAND_NAME}
                </p>
              </div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
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
          </nav>
          <div className="border-t border-outline-ghost p-3">
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
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
