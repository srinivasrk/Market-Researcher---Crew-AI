import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth0 } from "@auth0/auth0-react"
import {
  AUTH0_AUDIENCE,
  AUTH0_CONFIGURED,
  AUTH0_GOOGLE_CONNECTION,
  SHOW_DEV_PASSWORD_LOGIN,
} from "../lib/config"
import { setUnauthorizedHandler } from "../api/client"
import { DEV_JWT_STORAGE_KEY } from "./storage"

type SessionContextValue = {
  getAccessToken: () => Promise<string | null>
  isAuthenticated: boolean
  isLoading: boolean
  loginWithAuth0: () => void
  loginWithGoogle: () => void
  loginWithDevToken: (token: string) => void
  logout: () => Promise<void>
  devToken: string | null
  auth0Configured: boolean
  showDevPasswordLogin: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readStoredDevToken(): string | null {
  try {
    return localStorage.getItem(DEV_JWT_STORAGE_KEY)
  } catch {
    return null
  }
}

function SessionInnerWithAuth0({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0()

  const [devToken, setDevToken] = useState<string | null>(readStoredDevToken)

  const getAccessToken = useCallback(async () => {
    if (devToken) return devToken
    if (!isAuthenticated) return null
    const authorizationParams = AUTH0_AUDIENCE
      ? { audience: AUTH0_AUDIENCE }
      : undefined
    let lastError: unknown
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await getAccessTokenSilently({ authorizationParams })
      } catch (e) {
        lastError = e
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)))
      }
    }
    console.warn("getAccessTokenSilently failed after retries", lastError)
    return null
  }, [devToken, isAuthenticated, getAccessTokenSilently])

  const sharedAuthParams = useMemo(
    () => (AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : undefined),
    [AUTH0_AUDIENCE],
  )

  const loginWithAuth0 = useCallback(() => {
    loginWithRedirect({
      authorizationParams: sharedAuthParams,
    })
  }, [loginWithRedirect, sharedAuthParams])

  const loginWithGoogle = useCallback(() => {
    loginWithRedirect({
      authorizationParams: {
        ...sharedAuthParams,
        connection: AUTH0_GOOGLE_CONNECTION,
      },
    })
  }, [loginWithRedirect, sharedAuthParams, AUTH0_GOOGLE_CONNECTION])

  const loginWithDevToken = useCallback((token: string) => {
    localStorage.setItem(DEV_JWT_STORAGE_KEY, token)
    setDevToken(token)
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(DEV_JWT_STORAGE_KEY)
    setDevToken(null)
    if (isAuthenticated) {
      await auth0Logout({
        logoutParams: { returnTo: `${window.location.origin}/login` },
      })
    }
  }, [isAuthenticated, auth0Logout])

  const isAuthed = Boolean(devToken) || isAuthenticated
  const effectiveLoading = devToken ? false : isLoading

  const value = useMemo(
    () => ({
      getAccessToken,
      isAuthenticated: isAuthed,
      isLoading: effectiveLoading,
      loginWithAuth0,
      loginWithGoogle,
      loginWithDevToken,
      logout,
      devToken,
      auth0Configured: true,
      showDevPasswordLogin: SHOW_DEV_PASSWORD_LOGIN,
    }),
    [
      getAccessToken,
      isAuthed,
      effectiveLoading,
      loginWithAuth0,
      loginWithGoogle,
      loginWithDevToken,
      logout,
      devToken,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

function SessionInnerDevOnly({ children }: { children: ReactNode }) {
  const [devToken, setDevToken] = useState<string | null>(readStoredDevToken)

  const getAccessToken = useCallback(async () => devToken, [devToken])

  const loginWithAuth0 = useCallback(() => {
    /* no-op when Auth0 not configured */
  }, [])

  const loginWithGoogle = useCallback(() => {
    /* no-op when Auth0 not configured */
  }, [])

  const loginWithDevToken = useCallback((token: string) => {
    localStorage.setItem(DEV_JWT_STORAGE_KEY, token)
    setDevToken(token)
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(DEV_JWT_STORAGE_KEY)
    setDevToken(null)
  }, [])

  const value = useMemo(
    () => ({
      getAccessToken,
      isAuthenticated: Boolean(devToken),
      isLoading: false,
      loginWithAuth0,
      loginWithGoogle,
      loginWithDevToken,
      logout,
      devToken,
      auth0Configured: false,
      showDevPasswordLogin: SHOW_DEV_PASSWORD_LOGIN,
    }),
    [
      getAccessToken,
      devToken,
      loginWithAuth0,
      loginWithGoogle,
      loginWithDevToken,
      logout,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (AUTH0_CONFIGURED) {
    return <SessionInnerWithAuth0>{children}</SessionInnerWithAuth0>
  }
  return <SessionInnerDevOnly>{children}</SessionInnerDevOnly>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within SessionProvider")
  return ctx
}

export function useRegisterUnauthorizedHandler(
  onUnauthorized: (() => void) | null,
) {
  useEffect(() => {
    setUnauthorizedHandler(onUnauthorized)
    return () => setUnauthorizedHandler(null)
  }, [onUnauthorized])
}
