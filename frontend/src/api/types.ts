export type UserOut = {
  id: string
  email: string | null
  email_verified: boolean | null
  name: string | null
  given_name: string | null
  family_name: string | null
  picture_url: string | null
  provider: string | null
  provider_subject: string | null
  created_at: string
  updated_at: string
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
  recommended_ticker: string
  created_at: string
  expires_at: string
  session_id: string | null
}

export type ResearchRunDetail = Record<string, unknown>

export type DevLoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type WsServerMessage =
  | { type: "replay"; events: unknown[] }
  | { type: "heartbeat" }
  | { type: string; [key: string]: unknown }
