# Stock Analyst — Frontend

Single-page app for the Stock Analyst / Market Researcher project: dashboard, sector research, run history, and live research progress. It talks to the companion **FastAPI** backend over HTTP and WebSockets.

## Stack

| Layer | Technology |
| --- | --- |
| UI | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite 8](https://vite.dev/) with [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite` |
| Routing | [React Router v7](https://reactrouter.com/) |
| Auth | [Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react) (optional) + dev JWT in `localStorage` |
| Icons | [Lucide React](https://lucide.dev/) |

## Prerequisites

- **Node.js** (LTS recommended)
- **npm** (ships with Node)

The backend should be running when you use live API features; set `VITE_API_BASE_URL` to match its base URL (no trailing slash). Use the **same host** you use in the browser where practical (e.g. `http://127.0.0.1:8000` vs `http://localhost:8000` are different origins for cookies/CORS even though they often point to the same machine).

## Setup

```bash
cd frontend
npm install
```

Create a **`.env`** in this folder (see [`.env.example`](.env.example)). Only variables prefixed with `VITE_` are exposed to the browser; see [Vite env docs](https://vite.dev/guide/env-and-mode.html). **Restart `npm run dev`** after changing `.env`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Base URL of the Market Researcher FastAPI (default: `http://127.0.0.1:8000`). No trailing slash. |
| `VITE_AUTH0_DOMAIN` | For Auth0 | Auth0 tenant domain, e.g. `dev-xxxx.us.auth0.com` (no `https://`). |
| `VITE_AUTH0_CLIENT_ID` | For Auth0 | **Auth0 SPA** application Client ID (Dashboard → Applications → your SPA → Settings). **Not** the Google Cloud OAuth client ID. |
| `VITE_AUTH0_AUDIENCE` | **Yes for this API** | **Auth0 API Identifier** — must match **`JWT_AUDIENCE`** in the backend `.env` **exactly**. If omitted, Auth0 issues **opaque** access tokens; the FastAPI app only accepts **JWT** access tokens and will return **401**. |
| `VITE_AUTH0_GOOGLE_CONNECTION` | No | Auth0 Social connection name for Google (default `google-oauth2`). |
| `VITE_AUTH0_USE_REFRESH_TOKENS` | No | Set `true` only after enabling **Refresh Token Rotation** on the Auth0 SPA app. Leave unset by default; otherwise **`POST .../oauth/token`** may return **403 Forbidden** during login. |
| `VITE_DEV_PASSWORD_LOGIN` | No | If `true` or `1`, shows the dev password form. The **API** must set `API_DEV_PASSWORD_LOGIN=true`. |

Config helpers live in [`src/lib/config.ts`](src/lib/config.ts).

Full Auth0 + Google Cloud steps: [repo root `README.md`](../README.md#authentication-auth0-oidc--optional-google).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server (default **port 3000** per `vite.config.ts`). |
| `npm run build` | Typecheck (`tsc -b`) then production build to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint on the project. |

## Routes

| Path | Notes |
| --- | --- |
| `/` | Redirects to `/app/dashboard` if authenticated, else `/login`. |
| `/login` | **Continue with Google** (Auth0 `google-oauth2` connection) and **Continue with Auth0** (Universal Login); optional dev password login. |
| `/app` | Protected layout (`AppShell`); nested routes: |
| `/app/dashboard` | Dashboard. |
| `/app/sectors` | Sector tiles and research entry. |
| `/app/history` | Past runs list. |
| `/app/history/:runId` | Single run detail. |

## API usage

- [`src/api/client.ts`](src/api/client.ts): `apiFetch` / `apiJson` prepend `VITE_API_BASE_URL` and set `Authorization: Bearer <token>` when a token is provided. **401** triggers the global handler **only if a Bearer token was sent** (avoids logging you out when a request raced before the token was available after OAuth redirect).
- [`researchWebSocketUrl`](src/api/client.ts): builds `ws:` / `wss:` URL for `/research/ws/{job_id}?token=...`.

Types: [`src/api/types.ts`](src/api/types.ts).

## Authentication (implementation details)

- **`main.tsx`**: `BrowserRouter` wraps the app; when Auth0 env is set, `Auth0Provider` uses `redirect_uri: window.location.origin`, optional **`useRefreshTokens`** (env-gated), and **`onRedirectCallback`** navigates to `/app/dashboard` after login.
- **`SessionContext`**: `getAccessTokenSilently` is retried a few times after login so API calls don’t fire **before** the access token exists.
- **`ProtectedRoute`**: waits for Auth0 `isLoading` before rendering protected routes.
- **Profile in the shell**: [`AppShell`](src/components/AppShell.tsx) loads `GET /me` for name, `username`, avatar (`picture_url`).

### Auth0 dashboard (SPA application)

| Setting | Typical local value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000`, `http://localhost:3000/` |
| Allowed Logout URLs | Include `http://localhost:3000/login` or logout fails with **returnTo … not allowed**. |
| Allowed Web Origins | `http://localhost:3000` |

If **`VITE_AUTH0_AUDIENCE`** changes, **sign out and sign in again** so new tokens include the correct `aud`.

## Troubleshooting (frontend)

| Symptom | Cause / fix |
| --- | --- |
| **`invalid_request: Unknown client: ...apps.googleusercontent.com`** | You put the **Google** OAuth client ID in `VITE_AUTH0_CLIENT_ID`. Use the **Auth0 SPA** Client ID only; Google credentials go in Auth0 → Social → Google. |
| **`POST .../oauth/token` 403** | **`useRefreshTokens`** without **Refresh Token Rotation** enabled on the SPA in Auth0. Keep `VITE_AUTH0_USE_REFRESH_TOKENS` unset **or** enable rotation in Auth0 and then set it to `true`. |
| **`access_denied` / `Service not found: https://…`** | Auth0 has **no API** with that **Identifier**. Create the API in Dashboard → APIs, or change `VITE_AUTH0_AUDIENCE` (and backend `JWT_AUDIENCE`) to match an existing API Identifier **exactly**. |
| **401 on `/me` then sent to `/login`** | Usually **opaque token** (no audience) or **audience / issuer mismatch** on the API. Set **`VITE_AUTH0_AUDIENCE`** = **`JWT_AUDIENCE`**, configure **`JWT_JWKS_URL`** and **`JWT_ISSUER`** on the API, restart both, re-login. Details: [`market_researcher/README.md`](../market_researcher/README.md#auth0--jwt-troubleshooting). |
| **`redirect_uri_mismatch` (Google)** | In **Google Cloud**, Authorized redirect URIs must be **`https://<YOUR_AUTH0_DOMAIN>/login/callback`**, not `localhost:3000`. |
| **Profile empty in UI but login works** | Access token JWT may not include email/name; the **backend** can merge **Auth0 `/userinfo`** (see [`market_researcher/README.md`](../market_researcher/README.md)). Optional: Auth0 **Post-Login Action** to add claims to the access token. |

## Project layout

```
frontend/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx              # BrowserRouter + optional Auth0Provider
│   ├── App.tsx               # Routes (no nested BrowserRouter)
│   ├── index.css
│   ├── api/
│   ├── components/
│   ├── data/
│   ├── lib/config.ts
│   ├── pages/
│   ├── routes/
│   └── session/SessionContext.tsx
└── ...
```

## Production build

Run `npm run build` and deploy **`dist/`**. Add your production origin to Auth0 **Callback**, **Logout**, and **Web Origins**.

## Linting

ESLint: [`eslint.config.js`](eslint.config.js). See [typescript-eslint](https://typescript-eslint.io/getting-started/) and [ESLint React](https://github.com/Rel1cx/eslint-react).
