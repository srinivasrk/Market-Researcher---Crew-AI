import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  useRegisterUnauthorizedHandler,
  useSession,
} from "../session/SessionContext"

export function UnauthorizedBridge() {
  const navigate = useNavigate()
  const { logout } = useSession()

  const handler = useCallback(() => {
    void (async () => {
      await logout()
      navigate("/login", { replace: true })
    })()
  }, [logout, navigate])

  useRegisterUnauthorizedHandler(handler)
  return null
}
