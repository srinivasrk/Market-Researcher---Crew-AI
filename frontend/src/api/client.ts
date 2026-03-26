import { API_BASE_URL } from "../lib/config"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export async function apiFetch(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<Response> {
  const { accessToken, ...rest } = init
  const headers = new Headers(rest.headers)
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`
  const res = await fetch(url, { ...rest, headers })
  if (res.status === 401 && accessToken) {
    onUnauthorized?.()
  }
  return res
}

export async function apiJson<T>(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || res.statusText)
  }
  return res.json() as Promise<T>
}

export function researchWebSocketUrl(jobId: string, accessToken: string): string {
  const base = new URL(API_BASE_URL)
  const wsScheme = base.protocol === "https:" ? "wss:" : "ws:"
  const token = encodeURIComponent(accessToken)
  return `${wsScheme}//${base.host}/research/ws/${jobId}?token=${token}`
}
