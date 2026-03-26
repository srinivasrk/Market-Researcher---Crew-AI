import type { ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getSectorTileTheme } from "../data/sectorTileThemes"
import type { ResearchRunDetail } from "../api/types"

/** For older runs saved before `company_name` was persisted. */
export function companyNameFromReport(
  markdown: string | null | undefined,
  ticker: string,
): string | null {
  if (!markdown?.trim()) return null
  const m = markdown.match(
    /##\s*Recommended:\s*\*\*([A-Za-z0-9.-]+)\*\*\s*[—–-]\s*([^\n]+)/i,
  )
  if (!m) return null
  if (m[1].toUpperCase() !== ticker.trim().toUpperCase()) return null
  const name = m[2].replace(/\s*[*_]+\s*$/, "").trim()
  return name || null
}

export const researchMarkdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="font-outfit mt-10 scroll-mt-4 border-b border-outline-ghost pb-2 text-xl font-bold text-on-surface first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-6 text-base font-bold text-on-surface">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-3 text-sm leading-relaxed text-on-surface/85 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-4 list-disc space-y-2 pl-5 text-sm text-on-surface/85">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-on-surface/85">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed marker:text-primary-container">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-on-surface">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      className="font-medium text-primary-container underline-offset-2 hover:underline"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-outline-ghost">
      <table className="min-w-full divide-y divide-outline-ghost text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-surface-container-high/80 text-xs font-semibold uppercase tracking-wide text-on-surface/80">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody className="divide-y divide-outline-ghost bg-surface-container-lowest">{children}</tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="whitespace-nowrap px-3 py-2">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-3 py-2 text-on-surface/85">{children}</td>
  ),
}

export function ResearchProcessAside() {
  return (
    <aside className="rounded-xl border border-primary-container/20 bg-primary-container/8 px-5 py-4 text-sm leading-relaxed text-on-surface/80">
      <p className="font-semibold text-on-surface">How this research was produced</p>
      <p className="mt-2">
        A <strong>market researcher</strong> agent mapped the sector and built a shortlist, a{" "}
        <strong>financial analyst</strong> compared candidates using public signals, and an{" "}
        <strong>investment strategist</strong> chose one primary ticker with thesis, risks,
        invalidation triggers, runner-up context, and how other names stacked up. The sections
        below are the saved report from that final step (newer runs include an explicit list of
        other stocks considered and why the lead pick won).
      </p>
    </aside>
  )
}

export function ResearchReportArticle({
  reportMarkdown,
  recommendedTicker,
}: {
  reportMarkdown: string | null | undefined
  recommendedTicker: string
}) {
  const reportSource = reportMarkdown?.trim() ?? ""
  const hasStructuredReport =
    reportSource.length > 0 &&
    (reportSource.includes("### Thesis") || reportSource.includes("## Recommended"))

  return (
    <article className="overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest px-5 py-6 shadow-[0_4px_20px_rgba(25,28,30,0.05)] sm:px-8 sm:py-8">
      {reportSource ? (
        <>
          {hasStructuredReport ? null : (
            <p className="mb-6 rounded-lg border border-outline-variant/60 bg-surface px-3 py-2 text-xs text-on-surface/65">
              This run was saved in a legacy format. The text below is the full stored output.
            </p>
          )}
          <div className="research-report-md max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={researchMarkdownComponents}
            >
              {reportSource}
            </ReactMarkdown>
          </div>
        </>
      ) : (
        <p className="text-sm text-on-surface/65">
          No written report was stored for this run. The recommended ticker is{" "}
          <span className="font-mono font-semibold">{recommendedTicker}</span>.
        </p>
      )}
    </article>
  )
}

/** Full-width header used on the history detail route. */
export function ResearchRunPageHeader({ data }: { data: ResearchRunDetail }) {
  const sectorTheme = getSectorTileTheme(data.sector)
  const SectorIcon = sectorTheme.Icon
  const displayCompanyName =
    data.company_name?.trim() ||
    companyNameFromReport(data.report_markdown, data.recommended_ticker)

  return (
    <header className="overflow-hidden rounded-2xl border border-outline-ghost bg-surface-container-lowest shadow-[0_4px_20px_rgba(25,28,30,0.05)]">
      <div className="border-b border-outline-ghost bg-primary-container px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-container-lowest">
          Research run
        </p>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={[
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              sectorTheme.iconWrap,
            ].join(" ")}
          >
            <SectorIcon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-outfit text-2xl font-bold text-on-surface sm:text-3xl">
              {data.sector}
            </h1>
            <p className="mt-1 text-sm tabular-nums text-on-surface/60">
              {new Date(data.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface/50">
            Primary pick
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-primary-container sm:text-3xl">
            {data.recommended_ticker || "—"}
          </p>
          {displayCompanyName ? (
            <p className="mt-1 max-w-md text-sm font-medium leading-snug text-on-surface/75 sm:ml-auto">
              {displayCompanyName}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/** Compact summary for the research modal (sector already shown in dialog title). */
export function ResearchRunModalSummary({ data }: { data: ResearchRunDetail }) {
  const displayCompanyName =
    data.company_name?.trim() ||
    companyNameFromReport(data.report_markdown, data.recommended_ticker)

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-surface-container-lowest px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-900/80">
        Result
      </p>
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="font-mono text-2xl font-bold tabular-nums text-primary-container">
          {data.recommended_ticker || "—"}
        </p>
        <p className="text-sm tabular-nums text-on-surface/55">
          {new Date(data.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      {displayCompanyName ? (
        <p className="mt-2 text-sm font-medium leading-snug text-on-surface/75">
          {displayCompanyName}
        </p>
      ) : null}
    </div>
  )
}
