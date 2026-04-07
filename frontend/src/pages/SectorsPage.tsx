import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Lock, Search, Sparkles, Zap } from "lucide-react"
import { apiJson, ApiError } from "../api/client"
import {
  FREE_TIER_RESEARCHABLE_SECTORS,
  RESEARCH_SECTORS,
} from "../data/sectors"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import { useActiveResearchRun } from "../session/ActiveResearchRunContext"
import { useSession } from "../session/SessionContext"
import { useUserProfile } from "../session/UserProfileContext"
import { useTrack } from "../hooks/useTrack"
import {
  ResearchProgressPanel,
  type ResearchModalConnection,
} from "../components/ResearchProgressPanel"
import { PremiumUpsellModal } from "../components/PremiumUpsellModal"
import type { ResearchJobAccepted } from "../api/types"

type CardLayout = "featured" | "wide" | "new" | "standard"

const SECTOR_BLURBS: Record<string, string> = {
  "AI chips":
    "Accelerators, foundries, and supply chains powering the inference era.",
  "Cloud infrastructure":
    "Hyperscalers, edge, and the plumbing behind modern workloads.",
  Cybersecurity: "Identity, zero trust, and threat resilience across the stack.",
  "Healthcare technology": "Devices, data, and platforms reshaping care delivery.",
  "Renewable energy": "Solar, wind, storage, and grid modernization themes.",
  "Electric vehicles": "OEMs, batteries, charging, and mobility ecosystems.",
  Semiconductors: "CapEx cycles, process nodes, and equipment exposure.",
  "Consumer staples": "Pricing power, brands, and resilient cash flows.",
  "Financial services": "Banks, payments, and market infrastructure.",
  "Defense & aerospace": "Platforms, primes, and long-cycle programs.",
  "Digital payments": "Rails, wallets, and merchant acquiring trends.",
  Biotechnology: "Clinical pipelines, platforms, and modality shifts.",
  "Data centers & REITs": "Leasing spreads, power, and AI-driven demand.",
  "Copper & industrial metals": "Cycle turns, China stimulus, and electrification.",
  "Luxury goods": "Heritage brands, China travel, and premium pricing.",
}

function getCardLayout(sector: string): CardLayout {
  if (sector === "AI chips") return "featured"
  if (sector === "Digital payments") return "wide"
  if (sector === "Electric vehicles") return "new"
  return "standard"
}

function gridSpanClass(layout: CardLayout): string {
  if (layout === "featured" || layout === "wide") {
    return "md:col-span-2"
  }
  return ""
}

export function SectorsPage() {
  const { getAccessToken } = useSession()
  const { me, refreshProfile } = useUserProfile()
  const { track } = useTrack()
  const {
    deferredLiveModal,
    consumeDeferredLiveModal,
    beginBackgroundRun,
    clearBackgroundRun,
  } = useActiveResearchRun()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [busySector, setBusySector] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [researchModal, setResearchModal] = useState<{
    sector: string
    blurb: string
    connection: ResearchModalConnection
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!cancelled) setAccessToken(token)
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  const [upsellOpen, setUpsellOpen] = useState(false)

  const isFree = !me || me.plan !== "pro"
  const isKnownFreeUser = me !== null && me.plan !== "pro"
  const hasUsedDailySlot = isKnownFreeUser && me.runs_today >= 1

  const isProOnlySector = useCallback(
    (sector: string) =>
      isKnownFreeUser &&
      !FREE_TIER_RESEARCHABLE_SECTORS.includes(sector),
    [isKnownFreeUser],
  )

  useEffect(() => {
    if (!deferredLiveModal) return
    setResearchModal({
      sector: deferredLiveModal.sector,
      blurb: deferredLiveModal.blurb,
      connection: {
        state: "live",
        jobId: deferredLiveModal.jobId,
        accessToken: deferredLiveModal.accessToken,
      },
    })
    consumeDeferredLiveModal()
  }, [deferredLiveModal, consumeDeferredLiveModal])

  const startResearch = useCallback(
    async (sector: string) => {
      setError(null)
      setBusySector(sector)
      clearBackgroundRun()
      const blurb =
        SECTOR_BLURBS[sector] ??
        "Launch a focused crew research run for this theme."
      setResearchModal({
        sector,
        blurb,
        connection: { state: "starting" },
      })
      try {
        const token = await getAccessToken()
        if (!token) {
          setResearchModal({
            sector,
            blurb,
            connection: { state: "error", message: "Not signed in" },
          })
          return
        }
        const accepted = await apiJson<ResearchJobAccepted>("/research", {
          method: "POST",
          accessToken: token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector }),
        })
        track("feature_use", "run_research", { sector })
        await refreshProfile()
        setResearchModal({
          sector,
          blurb,
          connection: {
            state: "live",
            jobId: accepted.job_id,
            accessToken: token,
          },
        })
      } catch (e) {
        // 429 = daily limit; 403 = Pro-only sector — open upsell
        if (e instanceof ApiError && (e.status === 429 || e.status === 403)) {
          setResearchModal(null)
          setUpsellOpen(true)
        } else {
          setResearchModal({
            sector,
            blurb,
            connection: {
              state: "error",
              message: e instanceof Error ? e.message : "Failed to start research",
            },
          })
        }
      } finally {
        setBusySector(null)
      }
    },
    [clearBackgroundRun, getAccessToken, refreshProfile],
  )

  const orderedSectors = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = RESEARCH_SECTORS.filter(
      (s) => !q || s.toLowerCase().includes(q),
    )
    const featured = list.filter((s) => s === "AI chips")
    const rest = list.filter((s) => s !== "AI chips")
    return [...featured, ...rest]
  }, [query])

  const anyBusy = busySector !== null

  // When the daily slot is used, clicking any tile opens the upsell instead
  const handleTileClick = useCallback(
    (sector: string) => {
      if (isProOnlySector(sector) || hasUsedDailySlot) {
        track("feature_use", "upsell_triggered", { sector })
        setUpsellOpen(true)
      } else {
        void startResearch(sector)
      }
    },
    [hasUsedDailySlot, isProOnlySector, startResearch],
  )

  return (
    <div className="space-y-10 pb-12 font-sans">
      <div className="max-w-xs">
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface/40"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search sectors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-outline-ghost bg-surface-container-lowest py-2.5 pl-10 pr-3 text-sm text-on-surface placeholder:text-on-surface/45 outline-none ring-primary-container focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
          />
        </div>
      </div>

      {/* Daily quota banner */}
      {me && isFree && (
        hasUsedDailySlot ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500 text-xs font-bold">!</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">
                You&apos;ve used your free research for today
              </p>
              <p className="mt-0.5 text-xs text-red-700/80">
                Free plan includes 1 research per day on AI chips, Cloud infrastructure, or Healthcare technology.
                Your quota resets at midnight UTC. Upgrade to Pro for all sectors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUpsellOpen(true)}
              className="shrink-0 flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-surface-container-lowest transition hover:opacity-90"
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              Upgrade · $2.99
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-outline-ghost bg-surface-container-lowest px-4 py-2.5">
            <Zap className="h-4 w-4 shrink-0 text-primary-container/60" strokeWidth={1.75} aria-hidden />
            <p className="text-xs text-on-surface/65">
              <span className="font-semibold text-on-surface/80">Free plan</span>
              {" · "}
              1 research today on AI chips, Cloud, or Healthcare. Upgrade to Pro for all sectors.
            </p>
            <button
              type="button"
              onClick={() => setUpsellOpen(true)}
              className="ml-auto shrink-0 cursor-pointer text-xs font-semibold text-primary-container hover:underline underline-offset-2"
            >
              Upgrade →
            </button>
          </div>
        )
      )}

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Bento grid */}
      {orderedSectors.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-lowest py-16 text-center text-on-surface/65">
          No sectors match “{query.trim()}”. Try another search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {orderedSectors.map((sector) => {
            const layout = getCardLayout(sector)
            const { Icon, iconWrap } = getSectorTileTheme(sector)
            const blurb =
              SECTOR_BLURBS[sector] ??
              "Launch a focused crew research run for this theme."
            const span = gridSpanClass(layout)
            const isBusyHere = busySector === sector
            const proOnlyHere = isProOnlySector(sector)
            const tileRestricted = hasUsedDailySlot || proOnlyHere

            // anyBusy → truly disabled (research in flight), no cursor change
            // tileRestricted → clickable (opens upsell); dim tile
            const baseDisabled = anyBusy
              ? "cursor-not-allowed opacity-55 grayscale-[0.3] hover:shadow-none"
              : hasUsedDailySlot
                ? "cursor-pointer opacity-60 grayscale-[0.15] hover:shadow-none"
                : proOnlyHere
                  ? "cursor-pointer opacity-60 grayscale-[0.15] hover:shadow-none"
                  : ""

            const lockBadge =
              hasUsedDailySlot || proOnlyHere ? (
                <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-surface-container-lowest/90 px-2 py-0.5 ring-1 ring-outline-ghost text-[10px] font-bold text-on-surface/60 backdrop-blur-sm">
                  <Lock className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                  Pro
                </span>
              ) : null

            if (layout === "featured") {
              return (
                <button
                  key={sector}
                  type="button"
                  disabled={anyBusy}
                  onClick={() => handleTileClick(sector)}
                  className={[
                    "group relative flex cursor-pointer flex-col gap-5 overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest p-6 text-left shadow-md shadow-[0_20px_40px_rgba(25,28,30,0.06)] transition hover:-translate-y-0.5 hover:shadow-lg md:min-h-[280px] md:p-8",
                    span,
                    anyBusy || tileRestricted ? baseDisabled : "hover:border-primary-container/30",
                  ].join(" ")}
                >
                  {lockBadge}
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-primary-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-surface-container-lowest">
                      Trending now
                    </span>
                    <Sparkles
                      className="h-5 w-5 text-primary-container/50"
                      aria-hidden
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div
                        className={[
                          "flex h-14 w-14 items-center justify-center rounded-2xl transition group-hover:scale-105",
                          iconWrap,
                        ].join(" ")}
                      >
                        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                      </div>
                      <h2 className="font-outfit mt-5 text-2xl font-bold text-on-surface sm:text-3xl">
                        {sector}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface/70">
                        {blurb}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-outline-ghost bg-surface px-3 py-1 text-xs font-semibold text-on-surface/80">
                          +24% MoM interest
                        </span>
                        <span className="rounded-full border border-primary-container/25 bg-primary-container/10 px-3 py-1 text-xs font-semibold text-primary-container">
                          Crew-ready
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-on-surface px-5 py-3 text-sm font-semibold text-surface-container-lowest transition group-hover:gap-3">
                      {isBusyHere ? "Starting…" : "Explore sector"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </button>
              )
            }

            if (layout === "wide") {
              return (
                <button
                  key={sector}
                  type="button"
                  disabled={anyBusy}
                  onClick={() => handleTileClick(sector)}
                  className={[
                    "group relative flex cursor-pointer flex-col gap-5 rounded-2xl border border-outline-ghost bg-surface-container-lowest p-6 text-left shadow-md transition hover:-translate-y-0.5 hover:border-primary-container/30 hover:shadow-lg sm:flex-row sm:items-center sm:gap-8",
                    span,
                    anyBusy || tileRestricted ? baseDisabled : "",
                  ].join(" ")}
                >
                  {lockBadge}
                  <div
                    className={[
                      "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105 sm:h-20 sm:w-20",
                      iconWrap,
                    ].join(" ")}
                  >
                    <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-outfit text-xl font-bold text-on-surface">
                      {sector}
                    </h2>
                    <p className="mt-1 text-sm text-on-surface/70">{blurb}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-xl border border-outline-ghost bg-surface p-3 text-on-surface transition group-hover:border-primary-container/35 group-hover:bg-primary-container/8">
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </span>
                </button>
              )
            }

            return (
              <button
                key={sector}
                type="button"
                disabled={anyBusy}
                onClick={() => handleTileClick(sector)}
                className={[
                  "group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-container/25 hover:shadow-md",
                  anyBusy || tileRestricted ? baseDisabled : "",
                ].join(" ")}
              >
                {lockBadge}
                {layout === "new" ? (
                  <span className="absolute right-3 top-3 rounded-md bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-surface-container-lowest">
                    New
                  </span>
                ) : null}
                <div
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:scale-105",
                    iconWrap,
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="font-outfit text-base font-bold text-on-surface">
                    {sector}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-on-surface/65">
                    {blurb}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-outline-ghost pt-3">
                  <span className="text-xs font-semibold text-primary-container">
                    {isBusyHere ? "Starting…" : "Run research"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-on-surface/35 transition group-hover:translate-x-0.5 group-hover:text-primary-container" aria-hidden />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pro upgrade CTA */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-950 px-6 py-10 sm:px-10 sm:py-12 ring-1 ring-emerald-900/60">
        <div
          className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary-container/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary-container" strokeWidth={1.75} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-container">
                Coming soon · Pro plan
              </span>
            </div>
            <h2 className="font-outfit text-xl font-bold text-emerald-50 sm:text-2xl">
              Unlock every sector, every day
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/75 sm:text-base">
              Pro gives you unlimited sector research, email reports on completion,
              weekly digests, watchlist price alerts, and PDF exports — all for $2.99/month.
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-emerald-100/80">
              {[
                "Unlimited sectors per day",
                "Email report on completion",
                "Weekly sector digest",
                "Watchlist ±5% price alerts",
                "PDF export for any report",
                "Priority research queue",
              ].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="text-primary-container font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <button
              type="button"
              onClick={() => setUpsellOpen(true)}
              className="cursor-pointer rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-surface-container-lowest shadow-lg transition hover:opacity-90"
            >
              {me?.waitlist_joined ? "You're on the waitlist ✓" : "Join the waitlist — it's free"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("")
                searchRef.current?.focus()
              }}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-white/14"
            >
              Browse all sectors
            </button>
          </div>
        </div>
      </section>

      {researchModal ? (
        <ResearchProgressPanel
          sector={researchModal.sector}
          blurb={researchModal.blurb}
          connection={researchModal.connection}
          onClose={() => setResearchModal(null)}
          onDone={() => void refreshProfile()}
          onContinueInBackground={beginBackgroundRun}
        />
      ) : null}

      {upsellOpen && (
        <PremiumUpsellModal
          onClose={() => setUpsellOpen(false)}
          accessToken={accessToken}
          waitlistJoined={me?.waitlist_joined ?? false}
          waitlistJoinedAt={me?.waitlist_joined_at ?? null}
          onWaitlistJoined={() => void refreshProfile()}
        />
      )}
    </div>
  )
}
