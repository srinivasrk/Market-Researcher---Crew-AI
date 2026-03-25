import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Auth0Provider } from "@auth0/auth0-react"
import App from "./App.tsx"
import "./index.css"
import { AUTH0_AUDIENCE, AUTH0_CONFIGURED } from "./lib/config"
import { SessionProvider } from "./session/SessionContext"

const appTree = (
  <SessionProvider>
    <App />
  </SessionProvider>
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {AUTH0_CONFIGURED ? (
      <Auth0Provider
        domain={import.meta.env.VITE_AUTH0_DOMAIN!}
        clientId={import.meta.env.VITE_AUTH0_CLIENT_ID!}
        authorizationParams={{
          redirect_uri: window.location.origin,
          ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
        }}
        cacheLocation="localstorage"
      >
        {appTree}
      </Auth0Provider>
    ) : (
      appTree
    )}
  </StrictMode>,
)
