export type UserOut = {
  id: string
  email: string | null
  email_verified: boolean | null
  name: string | null
  username: string | null
  given_name: string | null
  family_name: string | null
  picture_url: string | null
  provider: string | null
  provider_subject: string | null
  created_at: string
  updated_at: string
  /** "free" | "pro" — used to render plan badge and enforce daily limit UI */
  plan: string
  /** Number of research runs created today (UTC). Free plan allows max 1. */
  runs_today: number
  /** True if the user has joined the Pro waitlist. */
  waitlist_joined: boolean
  /** ISO timestamp of when the user joined the waitlist, or null. */
  waitlist_joined_at: string | null
}

export type ResearchJobAccepted = {
  job_id: string
}

export type ResearchJobStatus = {
  job_id: string
  status: string
  sector: string
  run_id: string | null
  recommended_ticker: string | null
  report_markdown: string | null
  error: string | null
}

export type ResearchHistoryRow = {
  id: string
  sector: string
  /** Present when API returns it (dashboard / history). */
  sector_normalized?: string
  recommended_ticker: string
  company_name: string | null
  created_at: string
  expires_at: string
  session_id: string | null
}

export type DashboardQuoteRow = {
  ticker: string
  name: string | null
  close: number | null
  change_pct: number | null
  rank?: number | string
  sector?: string | null
  sector_normalized?: string
  run_id?: string
  created_at?: string
  rationale?: string | null
}

export type DashboardTopPicksResponse = {
  latest_source_run_id: string | null
  latest_top_three: DashboardQuoteRow[]
  per_sector: DashboardQuoteRow[]
  showcase_trending: DashboardQuoteRow[]
  showcase_source: string
  /** When the global showcase snapshot was last written (crew / fallback), ISO string. */
  showcase_refreshed_at: string | null
  /** When this API response was built; not the same as showcase snapshot time. */
  as_of: string
}

export type ResearchRunDetail = {
  id: string
  user_id: string
  session_id: string | null
  sector: string
  sector_normalized: string
  recommended_ticker: string
  company_name: string | null
  report_markdown: string | null
  created_at: string
  expires_at: string
}

export type DevLoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type WsServerMessage =
  | { type: "replay"; events: unknown[] }
  | { type: "heartbeat" }
  | { type: string; [key: string]: unknown }
