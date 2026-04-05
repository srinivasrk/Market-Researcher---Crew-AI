import { useState } from "react"
import { X, Sparkles, Zap, Check } from "lucide-react"
import type { UserOut } from "../api/types"

const PRO_FEATURES = [
  { emoji: "♾️", label: "Unlimited sectors per day", desc: "Research all curated sectors any time — free tier is limited to three" },
  { emoji: "📧", label: "Email on completion", desc: "Report summary delivered to your inbox" },
  { emoji: "📬", label: "Weekly sector digest", desc: "Top pick per sector every Monday" },
  { emoji: "📈", label: "Watchlist alerts", desc: "Notify when a recommended ticker moves ±5%" },
  { emoji: "📄", label: "PDF export", desc: "Download any report as a formatted PDF" },
  { emoji: "⚡", label: "Priority queue", desc: "Always-on machine — no cold start delays" },
]

type Props = {
  onClose: () => void
  accessToken: string | null
  waitlistJoined: boolean
  waitlistJoinedAt: string | null
  onWaitlistJoined: (updatedMe: UserOut) => void
}

export function PremiumUpsellModal({
  onClose,
  accessToken,
  waitlistJoined,
  waitlistJoinedAt,
  onWaitlistJoined,
}: Props) {
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function handleJoinWaitlist() {
    if (!accessToken || waitlistJoined) return
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me/waitlist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Request failed")
      const updated: UserOut = await res.json()
      onWaitlistJoined(updated)
    } catch {
      setJoinError("Something went wrong. Please try again.")
    } finally {
      setJoining(false)
    }
  }

  const joinedDate = waitlistJoinedAt
    ? new Date(waitlistJoinedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Pro"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-emerald-950 shadow-2xl ring-1 ring-emerald-900/60">
        {/* Glow blob */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-container/20 blur-3xl"
          aria-hidden
        />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-emerald-200 transition hover:bg-white/20 cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pb-8">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary-container" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary-container">
              Coming soon · Pro plan
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-outfit text-2xl font-bold text-emerald-50 sm:text-3xl">
            Unlock every sector,<br className="hidden sm:block" /> every day
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
            You've used your free research for today. Upgrade to Pro for unlimited access,
            email reports, and more — for just $2.99/month.
          </p>

          {/* Enrolled state */}
          {waitlistJoined && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-primary-container/15 px-4 py-3 ring-1 ring-primary-container/30">
              <Check className="h-4 w-4 shrink-0 text-primary-container" strokeWidth={2.5} />
              <div>
                <p className="text-sm font-semibold text-emerald-50">You're on the waitlist!</p>
                {joinedDate && (
                  <p className="text-[11px] text-emerald-100/60 mt-0.5">Joined {joinedDate} — we'll email you when Pro launches.</p>
                )}
              </div>
            </div>
          )}

          {/* Feature grid */}
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRO_FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3 rounded-xl bg-white/6 px-3 py-2.5 ring-1 ring-white/8">
                <span className="text-base leading-none mt-0.5" aria-hidden>{f.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-50">{f.label}</p>
                  <p className="text-[11px] text-emerald-100/60 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {waitlistJoined ? (
              <button
                type="button"
                disabled
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container/40 px-5 py-3 text-sm font-bold text-emerald-50/60 cursor-default"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Enrolled in waitlist
              </button>
            ) : (
              <button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={joining}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-surface-container-lowest shadow-lg transition hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
                {joining ? "Joining…" : "Join the waitlist — it's free"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-white/14"
            >
              Maybe later
            </button>
          </div>

          {joinError && (
            <p className="mt-2 text-center text-[11px] text-red-400">{joinError}</p>
          )}

          {!waitlistJoined && (
            <p className="mt-3 text-center text-[10px] text-emerald-100/40">
              No payment required to join the waitlist. You'll be notified when Pro launches.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
