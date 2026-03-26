import { useCallback, useMemo, useRef, useState } from "react"
import { ArrowRight, Search, Sparkles } from "lucide-react"
import { apiJson } from "../api/client"
import { RESEARCH_SECTORS } from "../data/sectors"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import { useSession } from "../session/SessionContext"
import {
  ResearchProgressPanel,
  type ResearchModalConnection,
} from "../components/ResearchProgressPanel"
import type { ResearchJobAccepted } from "../api/types"

type CardLayout = "featured" | "wide" | "dark" | "new" | "standard"

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
  if (sector === "Cybersecurity") return "dark"
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
  const [query, setQuery] = useState("")
  const [busySector, setBusySector] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [researchModal, setResearchModal] = useState<{
    sector: string
    blurb: string
    connection: ResearchModalConnection
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const startResearch = useCallback(
    async (sector: string) => {
      setError(null)
      setBusySector(sector)
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
        setResearchModal({
          sector,
          blurb,
          connection: {
            state: "error",
            message:
              e instanceof Error ? e.message : "Failed to start research",
          },
        })
      } finally {
        setBusySector(null)
      }
    },
    [getAccessToken],
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

            const baseDisabled =
              anyBusy &&
              "cursor-not-allowed opacity-55 grayscale-[0.3] hover:shadow-none"

            if (layout === "featured") {
              return (
                <button
                  key={sector}
                  type="button"
                  disabled={anyBusy}
                  onClick={() => void startResearch(sector)}
                  className={[
                    "group relative flex cursor-pointer flex-col gap-5 overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest p-6 text-left shadow-md shadow-[0_20px_40px_rgba(25,28,30,0.06)] transition hover:-translate-y-0.5 hover:shadow-lg md:min-h-[280px] md:p-8",
                    span,
                    anyBusy ? baseDisabled : "hover:border-primary-container/30",
                  ].join(" ")}
                >
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
                  onClick={() => void startResearch(sector)}
                  className={[
                    "group flex cursor-pointer flex-col gap-5 rounded-2xl border border-outline-ghost bg-surface-container-lowest p-6 text-left shadow-md transition hover:-translate-y-0.5 hover:border-primary-container/30 hover:shadow-lg sm:flex-row sm:items-center sm:gap-8",
                    span,
                    anyBusy ? baseDisabled : "",
                  ].join(" ")}
                >
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

            if (layout === "dark") {
              return (
                <button
                  key={sector}
                  type="button"
                  disabled={anyBusy}
                  onClick={() => void startResearch(sector)}
                  className={[
                    "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-emerald-950 p-6 text-left text-emerald-50 shadow-xl ring-1 ring-emerald-900/50 transition hover:-translate-y-0.5 hover:ring-primary-container/40",
                    anyBusy ? baseDisabled : "",
                  ].join(" ")}
                >
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-container/15 blur-3xl"
                    aria-hidden
                  />
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                      <Icon className="h-6 w-6 text-emerald-100" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-outfit text-lg font-bold">{sector}</h2>
                      <p className="mt-1 text-sm text-emerald-100/85">{blurb}</p>
                    </div>
                  </div>
                  <span className="relative mt-6 inline-flex w-fit items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-50 backdrop-blur-sm">
                    {isBusyHere ? "Starting…" : "Run analysis"}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
              )
            }

            return (
              <button
                key={sector}
                type="button"
                disabled={anyBusy}
                onClick={() => void startResearch(sector)}
                className={[
                  "group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-container/25 hover:shadow-md",
                  anyBusy ? baseDisabled : "",
                ].join(" ")}
              >
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

      {/* Bottom CTA */}
      <section className="relative overflow-hidden rounded-2xl border border-primary-container/20 bg-gradient-to-br from-primary-container/12 via-surface-container-lowest to-surface px-6 py-10 sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute -right-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-primary-container/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-outfit text-xl font-bold text-on-surface sm:text-2xl">
              Can&apos;t find your specific niche?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-on-surface/75 sm:text-base">
              Use search above to filter sectors. More themes and custom requests
              can be wired when your API exposes them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("")
              searchRef.current?.focus()
            }}
            className="shrink-0 rounded-xl border-2 border-on-surface/15 bg-surface-container-lowest px-6 py-3 text-sm font-semibold text-on-surface shadow-sm transition hover:border-primary-container/40 hover:bg-primary-container/8"
          >
            Browse all sectors
          </button>
        </div>
      </section>

      {researchModal ? (
        <ResearchProgressPanel
          sector={researchModal.sector}
          blurb={researchModal.blurb}
          connection={researchModal.connection}
          onClose={() => setResearchModal(null)}
        />
      ) : null}
    </div>
  )
}
