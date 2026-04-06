import { useEffect, useState } from "react"
import { Sparkles, Zap, Check } from "lucide-react"
import { apiJson } from "../api/client"
import { useSession } from "../session/SessionContext"
import { useUserProfile } from "../session/UserProfileContext"

const PRO_FEATURES = [
  {
    emoji: "♾️",
    label: "Unlimited sectors per day",
    desc: "Research any curated sector any time — no daily cap; the free plan is limited to three sectors.",
  },
  {
    emoji: "📧",
    label: "Email report on completion",
    desc: "Get the full investment thesis and ticker recommendation delivered to your inbox when research finishes.",
  },
  {
    emoji: "📬",
    label: "Weekly sector digest",
    desc: "Every Monday, receive the top pick across all curated sectors from the past week in one clean email.",
  },
  {
    emoji: "📈",
    label: "Watchlist price alerts",
    desc: "We track your recommended tickers and notify you when one moves ±5% in a single session.",
  },
  {
    emoji: "📄",
    label: "PDF export",
    desc: "Download any research report as a formatted PDF — share with your team or keep for your records.",
  },
  {
    emoji: "⚡",
    label: "Priority research queue",
    desc: "Your research runs on an always-on machine — no cold start, no 15-second wait.",
  },
  {
    emoji: "🗂",
    label: "Full track record history",
    desc: "Compare this week's recommendation against last week's, track which picks outperformed.",
  },
]

export function UpgradePage() {
  const { getAccessToken } = useSession()
  const { me, refreshProfile } = useUserProfile()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!cancelled) setAccessToken(token ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  async function handleJoinWaitlist() {
    if (!accessToken || me?.waitlist_joined) return
    setJoining(true)
    setJoinError(null)
    try {
      await apiJson("/me/waitlist", {
        method: "POST",
        accessToken,
      })
      await refreshProfile()
    } catch {
      setJoinError("Something went wrong. Please try again.")
    } finally {
      setJoining(false)
    }
  }

  const waitlistJoined = me?.waitlist_joined ?? false
  const joinedDate = me?.waitlist_joined_at
    ? new Date(me.waitlist_joined_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-950 px-6 py-12 sm:px-12 sm:py-16 ring-1 ring-emerald-900/60">
        <div
          className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-primary-container/15 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary-container" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary-container">
              Coming soon · Pro plan
            </span>
          </div>
          <h1 className="font-outfit text-3xl font-bold text-emerald-50 sm:text-4xl">
            Unlock every sector,<br className="hidden sm:block" /> every day
          </h1>
          <p className="mt-4 text-base leading-relaxed text-emerald-100/70 max-w-xl">
            The free plan gives you one research per day on AI chips, Cloud infrastructure, or Healthcare technology.
            Pro removes the cap entirely and adds email reports, alerts, and more — for just $2.99/month.
          </p>

          {/* Enrolled confirmation */}
          {waitlistJoined && (
            <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-primary-container/15 px-4 py-3 ring-1 ring-primary-container/30">
              <Check className="h-4 w-4 shrink-0 text-primary-container" strokeWidth={2.5} />
              <div>
                <p className="text-sm font-semibold text-emerald-50">You're on the waitlist!</p>
                {joinedDate && (
                  <p className="text-[11px] text-emerald-100/60 mt-0.5">
                    Joined {joinedDate} — we'll email you when Pro launches.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {waitlistJoined ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container/40 px-6 py-3 text-sm font-bold text-emerald-50/60 cursor-default"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Enrolled in waitlist
              </button>
            ) : (
              <button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={joining || !accessToken}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-surface-container-lowest shadow-lg transition hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
                {joining ? "Joining…" : "Join the waitlist — it's free"}
              </button>
            )}
            {!waitlistJoined && (
              <p className="text-xs text-emerald-100/45 sm:ml-2">
                No payment needed. You'll be notified when Pro launches.
              </p>
            )}
          </div>
          {joinError && (
            <p className="mt-2 text-xs text-red-400">{joinError}</p>
          )}
        </div>
      </section>

      {/* Pricing card */}
      <section className="flex flex-col items-center gap-2">
        <div className="w-full max-w-sm rounded-2xl border border-primary-container/25 bg-surface-container-lowest p-8 text-center shadow-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">Pro plan</p>
          <p className="mt-3 font-outfit text-5xl font-bold text-on-surface">
            $2.99
            <span className="text-base font-normal text-on-surface/50">/mo</span>
          </p>
          <p className="mt-2 text-sm text-on-surface/60">Billed monthly · cancel any time</p>
          {waitlistJoined ? (
            <div className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container/15 px-5 py-3 ring-1 ring-primary-container/25">
              <Check className="h-4 w-4 text-primary-container" strokeWidth={2.5} aria-hidden />
              <span className="text-sm font-semibold text-on-surface/80">You're on the waitlist</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleJoinWaitlist}
              disabled={joining || !accessToken}
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-surface-container-lowest transition hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {joining ? "Joining…" : "Join waitlist"}
            </button>
          )}
        </div>
      </section>

      {/* Feature list */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary-container mb-6">
          Everything in Pro
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRO_FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex gap-4 rounded-xl border border-outline-ghost bg-surface-container-lowest p-5"
            >
              <span className="text-2xl leading-none mt-0.5 shrink-0" aria-hidden>
                {f.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary-container" strokeWidth={2.5} aria-hidden />
                  {f.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
