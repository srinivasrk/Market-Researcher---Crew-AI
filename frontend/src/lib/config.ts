export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "")

export const AUTH0_CONFIGURED = Boolean(
  import.meta.env.VITE_AUTH0_DOMAIN?.trim() &&
    import.meta.env.VITE_AUTH0_CLIENT_ID?.trim(),
)

export const SHOW_DEV_PASSWORD_LOGIN =
  import.meta.env.VITE_DEV_PASSWORD_LOGIN === "true" ||
  import.meta.env.VITE_DEV_PASSWORD_LOGIN === "1"

export const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE?.trim() || undefined

/** Auth0 Social connection name for Google (default in Auth0 is `google-oauth2`). */
export const AUTH0_GOOGLE_CONNECTION =
  import.meta.env.VITE_AUTH0_GOOGLE_CONNECTION?.trim() || "google-oauth2"

/**
 * Requires Auth0 SPA app: Application → Refresh Token Rotation enabled.
 * If off, /oauth/token returns 403 — leave this false unless configured in Auth0.
 */
export const AUTH0_USE_REFRESH_TOKENS =
  import.meta.env.VITE_AUTH0_USE_REFRESH_TOKENS === "true" ||
  import.meta.env.VITE_AUTH0_USE_REFRESH_TOKENS === "1"
