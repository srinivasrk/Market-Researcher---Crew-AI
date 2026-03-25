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
