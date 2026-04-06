import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ApiError, apiJson } from "../api/client"
import type { UserOut } from "../api/types"
import { useSession } from "./SessionContext"

type UserProfileContextValue = {
  me: UserOut | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isAuthenticated } = useSession()
  const [me, setMe] = useState<UserOut | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const profileEverLoaded = useRef(false)
  const loadGen = useRef(0)

  useEffect(() => {
    const gen = ++loadGen.current
    let cancelled = false

    ;(async () => {
      try {
        const token = await getAccessToken()
        if (cancelled || gen !== loadGen.current) return
        if (!token) {
          // Concurrent pages (e.g. History) also call getAccessToken; Auth0 can briefly yield null
          // while still authenticated. Don't wipe an already-loaded sidebar in that case.
          if (!isAuthenticated) {
            setMe(null)
            profileEverLoaded.current = false
          } else if (!profileEverLoaded.current) {
            setMe(null)
          }
          return
        }
        if (!profileEverLoaded.current) setProfileLoading(true)
        try {
          const profile = await apiJson<UserOut>("/me", { accessToken: token })
          if (cancelled || gen !== loadGen.current) return
          setMe(profile)
          profileEverLoaded.current = true
        } catch (e) {
          if (cancelled || gen !== loadGen.current) return
          if (e instanceof ApiError && e.status === 401) {
            setMe(null)
            profileEverLoaded.current = false
          }
          // Keep prior profile on transient errors so the sidebar (avatar, plan) stays stable.
        }
      } finally {
        // Rapid route changes cancel older runs; only the latest gen used to clear loading,
        // which could leave profileLoading stuck true. Once we have any profile, stop showing skeleton.
        if (profileEverLoaded.current || gen === loadGen.current) {
          setProfileLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getAccessToken, isAuthenticated])

  const refreshProfile = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      if (!isAuthenticated) {
        setMe(null)
        profileEverLoaded.current = false
      }
      setProfileLoading(false)
      return
    }
    if (!profileEverLoaded.current) setProfileLoading(true)
    try {
      const profile = await apiJson<UserOut>("/me", { accessToken: token })
      setMe(profile)
      profileEverLoaded.current = true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null)
        profileEverLoaded.current = false
      }
    } finally {
      setProfileLoading(false)
    }
  }, [getAccessToken, isAuthenticated])

  const value = useMemo(
    () => ({ me, profileLoading, refreshProfile }),
    [me, profileLoading, refreshProfile],
  )

  return (
    <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext)
  if (!ctx) throw new Error("useUserProfile must be used within UserProfileProvider")
  return ctx
}
