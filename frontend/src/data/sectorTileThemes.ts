import type { LucideIcon } from "lucide-react"
import {
  Cloud,
  Cpu,
  CircuitBoard,
  Factory,
  FlaskConical,
  Gem,
  HeartPulse,
  Landmark,
  LayoutGrid,
  Plane,
  Server,
  Shield,
  ShoppingBasket,
  Sun,
  Wallet,
  Zap,
} from "lucide-react"

/** Visual theme for a sector tile (icon + Tailwind classes). */
export type SectorTileTheme = {
  Icon: LucideIcon
  iconWrap: string
  card: string
  hover: string
  sub: string
}

const HUES: Record<string, Pick<SectorTileTheme, "iconWrap" | "card" | "hover" | "sub">> = {
  violet: {
    iconWrap:
      "bg-violet-100 text-violet-700 ring-1 ring-violet-200/80 shadow-sm shadow-violet-200/30",
    card: "border-violet-200/90 bg-gradient-to-br from-violet-50/95 to-white ring-1 ring-violet-100/50",
    hover:
      "hover:border-violet-400/70 hover:shadow-lg hover:shadow-violet-200/35 group-hover:ring-violet-200/80",
    sub: "text-violet-700/80",
  },
  sky: {
    iconWrap:
      "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 shadow-sm shadow-sky-200/30",
    card: "border-sky-200/90 bg-gradient-to-br from-sky-50/95 to-white ring-1 ring-sky-100/50",
    hover:
      "hover:border-sky-400/70 hover:shadow-lg hover:shadow-sky-200/35 group-hover:ring-sky-200/80",
    sub: "text-sky-700/80",
  },
  slate: {
    iconWrap:
      "bg-slate-200/90 text-slate-800 ring-1 ring-slate-300/80 shadow-sm shadow-slate-300/25",
    card: "border-slate-200/90 bg-gradient-to-br from-slate-50/95 to-white ring-1 ring-slate-100/60",
    hover:
      "hover:border-slate-400/60 hover:shadow-lg hover:shadow-slate-200/40 group-hover:ring-slate-200/80",
    sub: "text-slate-600",
  },
  rose: {
    iconWrap:
      "bg-rose-100 text-rose-700 ring-1 ring-rose-200/80 shadow-sm shadow-rose-200/30",
    card: "border-rose-200/90 bg-gradient-to-br from-rose-50/95 to-white ring-1 ring-rose-100/50",
    hover:
      "hover:border-rose-400/70 hover:shadow-lg hover:shadow-rose-200/35 group-hover:ring-rose-200/80",
    sub: "text-rose-700/80",
  },
  emerald: {
    iconWrap:
      "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 shadow-sm shadow-emerald-200/30",
    card: "border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 to-white ring-1 ring-emerald-100/50",
    hover:
      "hover:border-emerald-400/70 hover:shadow-lg hover:shadow-emerald-200/35 group-hover:ring-emerald-200/80",
    sub: "text-emerald-700/80",
  },
  amber: {
    iconWrap:
      "bg-amber-100 text-amber-800 ring-1 ring-amber-200/80 shadow-sm shadow-amber-200/30",
    card: "border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white ring-1 ring-amber-100/50",
    hover:
      "hover:border-amber-400/70 hover:shadow-lg hover:shadow-amber-200/35 group-hover:ring-amber-200/80",
    sub: "text-amber-800/85",
  },
  indigo: {
    iconWrap:
      "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200/80 shadow-sm shadow-indigo-200/30",
    card: "border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 to-white ring-1 ring-indigo-100/50",
    hover:
      "hover:border-indigo-400/70 hover:shadow-lg hover:shadow-indigo-200/35 group-hover:ring-indigo-200/80",
    sub: "text-indigo-800/85",
  },
  orange: {
    iconWrap:
      "bg-orange-100 text-orange-800 ring-1 ring-orange-200/80 shadow-sm shadow-orange-200/30",
    card: "border-orange-200/90 bg-gradient-to-br from-orange-50/95 to-white ring-1 ring-orange-100/50",
    hover:
      "hover:border-orange-400/70 hover:shadow-lg hover:shadow-orange-200/35 group-hover:ring-orange-200/80",
    sub: "text-orange-800/85",
  },
  blue: {
    iconWrap:
      "bg-blue-100 text-blue-800 ring-1 ring-blue-200/80 shadow-sm shadow-blue-200/30",
    card: "border-blue-200/90 bg-gradient-to-br from-blue-50/95 to-white ring-1 ring-blue-100/50",
    hover:
      "hover:border-blue-400/70 hover:shadow-lg hover:shadow-blue-200/35 group-hover:ring-blue-200/80",
    sub: "text-blue-800/85",
  },
  teal: {
    iconWrap:
      "bg-teal-100 text-teal-800 ring-1 ring-teal-200/80 shadow-sm shadow-teal-200/30",
    card: "border-teal-200/90 bg-gradient-to-br from-teal-50/95 to-white ring-1 ring-teal-100/50",
    hover:
      "hover:border-teal-400/70 hover:shadow-lg hover:shadow-teal-200/35 group-hover:ring-teal-200/80",
    sub: "text-teal-800/85",
  },
  fuchsia: {
    iconWrap:
      "bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200/80 shadow-sm shadow-fuchsia-200/30",
    card: "border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-50/95 to-white ring-1 ring-fuchsia-100/50",
    hover:
      "hover:border-fuchsia-400/70 hover:shadow-lg hover:shadow-fuchsia-200/35 group-hover:ring-fuchsia-200/80",
    sub: "text-fuchsia-800/85",
  },
  cyan: {
    iconWrap:
      "bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200/80 shadow-sm shadow-cyan-200/30",
    card: "border-cyan-200/90 bg-gradient-to-br from-cyan-50/95 to-white ring-1 ring-cyan-100/50",
    hover:
      "hover:border-cyan-400/70 hover:shadow-lg hover:shadow-cyan-200/35 group-hover:ring-cyan-200/80",
    sub: "text-cyan-800/85",
  },
  stone: {
    iconWrap:
      "bg-stone-200/90 text-stone-800 ring-1 ring-stone-300/80 shadow-sm shadow-stone-300/25",
    card: "border-stone-200/90 bg-gradient-to-br from-stone-50/95 to-white ring-1 ring-stone-100/60",
    hover:
      "hover:border-stone-400/60 hover:shadow-lg hover:shadow-stone-200/40 group-hover:ring-stone-200/80",
    sub: "text-stone-700",
  },
}

const DEFAULT_HUE = HUES.slate!

const SECTOR_META: Record<string, { Icon: LucideIcon; hue: keyof typeof HUES }> = {
  "AI chips": { Icon: Cpu, hue: "violet" },
  "Cloud infrastructure": { Icon: Cloud, hue: "sky" },
  Cybersecurity: { Icon: Shield, hue: "slate" },
  "Healthcare technology": { Icon: HeartPulse, hue: "rose" },
  "Renewable energy": { Icon: Sun, hue: "emerald" },
  "Electric vehicles": { Icon: Zap, hue: "amber" },
  Semiconductors: { Icon: CircuitBoard, hue: "indigo" },
  "Consumer staples": { Icon: ShoppingBasket, hue: "orange" },
  "Financial services": { Icon: Landmark, hue: "blue" },
  "Defense & aerospace": { Icon: Plane, hue: "stone" },
  "Digital payments": { Icon: Wallet, hue: "teal" },
  Biotechnology: { Icon: FlaskConical, hue: "fuchsia" },
  "Data centers & REITs": { Icon: Server, hue: "cyan" },
  "Copper & industrial metals": { Icon: Factory, hue: "orange" },
  "Luxury goods": { Icon: Gem, hue: "violet" },
}

const CANONICAL_SECTOR_KEYS = Object.keys(SECTOR_META)

function normalizeSectorLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Letters/digits-only slug for fuzzy containment (e.g. "data centers" ⊂ "data centers reits"). */
function sectorSlug(s: string): string {
  return normalizeSectorLabel(s)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const NORMALIZED_KEY_BY_LABEL = new Map<string, string>()
for (const key of CANONICAL_SECTOR_KEYS) {
  NORMALIZED_KEY_BY_LABEL.set(normalizeSectorLabel(key), key)
}

/** API/crew/user labels that do not exactly match our curated list */
const SECTOR_LABEL_ALIASES: Record<string, string> = {
  biomedical: "Biotechnology",
  biotech: "Biotechnology",
  pharmaceuticals: "Biotechnology",
  pharma: "Biotechnology",
  "life sciences": "Biotechnology",
  datacenter: "Data centers & REITs",
  datacenters: "Data centers & REITs",
  "data center": "Data centers & REITs",
  "data centers": "Data centers & REITs",
  reits: "Data centers & REITs",
  "cloud & infrastructure": "Cloud infrastructure",
  "ai / chips": "AI chips",
  "ai chips and semiconductors": "AI chips",
  fintech: "Financial services",
  "financials & banking": "Financial services",
}

/**
 * Map a stored or displayed sector string to a canonical `SECTOR_META` key, or null.
 */
export function resolveSectorThemeKey(sector: string): string | null {
  const raw = sector.trim()
  if (!raw) return null
  if (SECTOR_META[raw]) return raw

  const n = normalizeSectorLabel(raw)
  const byNorm = NORMALIZED_KEY_BY_LABEL.get(n)
  if (byNorm) return byNorm

  const aliasTarget = SECTOR_LABEL_ALIASES[n]
  if (aliasTarget && SECTOR_META[aliasTarget]) return aliasTarget

  const slug = sectorSlug(raw)
  if (slug) {
    for (const key of CANONICAL_SECTOR_KEYS) {
      const kslug = sectorSlug(key)
      if (slug === kslug) return key
    }
    for (const key of CANONICAL_SECTOR_KEYS) {
      const kslug = sectorSlug(key)
      const shorter = slug.length <= kslug.length ? slug : kslug
      const longer = slug.length > kslug.length ? slug : kslug
      if (shorter.length < 8) continue
      if (longer.includes(shorter)) return key
    }
  }

  return null
}

export function getSectorTileTheme(sector: string): SectorTileTheme {
  const key = resolveSectorThemeKey(sector)
  const meta =
    key && SECTOR_META[key]
      ? SECTOR_META[key]
      : { Icon: LayoutGrid, hue: "slate" as const }
  const hue = HUES[meta.hue] ?? DEFAULT_HUE
  return {
    Icon: meta.Icon,
    iconWrap: hue.iconWrap,
    card: hue.card,
    hover: hue.hover,
    sub: hue.sub,
  }
}
