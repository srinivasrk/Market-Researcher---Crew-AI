import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { Auth0Provider } from "@auth0/auth0-react"
import { BrowserRouter, useNavigate } from "react-router-dom"
import App from "./App.tsx"
import "./index.css"
import {
  AUTH0_AUDIENCE,
  AUTH0_CONFIGURED,
  AUTH0_USE_REFRESH_TOKENS,
} from "./lib/config"
import { SessionProvider } from "./session/SessionContext"

const appTree = (
  <SessionProvider>
    <App />
  </SessionProvider>
)

function Auth0ProviderWithNavigation({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN!}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
      }}
      cacheLocation="localstorage"
      useRefreshTokens={AUTH0_USE_REFRESH_TOKENS}
      onRedirectCallback={(appState) => {
        const returnTo =
          appState && typeof appState === "object" && "returnTo" in appState
            ? String((appState as { returnTo?: string }).returnTo || "")
            : ""
        navigate(returnTo || "/app/dashboard", { replace: true })
      }}
    >
      {children}
    </Auth0Provider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {AUTH0_CONFIGURED ? (
        <Auth0ProviderWithNavigation>{appTree}</Auth0ProviderWithNavigation>
      ) : (
        appTree
      )}
    </BrowserRouter>
  </StrictMode>,
)
