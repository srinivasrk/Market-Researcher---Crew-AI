# Stock Analyst — Frontend

Single-page app for the Stock Analyst / Market Researcher project: dashboard, sector research, run history, and live research progress. It talks to the companion **FastAPI** backend over HTTP and WebSockets.

## Stack

| Layer | Technology |
| --- | --- |
| UI | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite 8](https://vite.dev/) with [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite` |
| Routing | [React Router v7](https://reactrouter.com/) |
| Auth | [Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react) (optional) + dev JWT stored in `localStorage` |
| Icons | [Lucide React](https://lucide.dev/) |

## Prerequisites

- **Node.js** (LTS recommended)
- **npm** (ships with Node)

The backend should be running when you use live API features; set `VITE_API_BASE_URL` to match its base URL (no trailing slash).

## Setup

```bash
cd frontend
npm install
```

Create a **`.env`** in this folder (you can start from the repo’s example if present). Only variables prefixed with `VITE_` are exposed to the browser; see [Vite env docs](https://vite.dev/guide/env-and-mode.html).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Base URL of the Market Researcher FastAPI (default: `http://127.0.0.1:8000`). No trailing slash. |
| `VITE_AUTH0_DOMAIN` | For Auth0 | Auth0 tenant domain (e.g. `your-tenant.auth0.com`). |
| `VITE_AUTH0_CLIENT_ID` | For Auth0 | Auth0 SPA application client ID. If **both** domain and client ID are set, the app wraps the tree in `Auth0Provider`. |
| `VITE_AUTH0_AUDIENCE` | No | API identifier; must match the backend’s JWT audience when validating access tokens. |
| `VITE_DEV_PASSWORD_LOGIN` | No | If `true` or `1`, shows the dev password login UI. The **API** must allow dev login (e.g. `API_DEV_PASSWORD_LOGIN=true` on the server—see backend docs). |

`src/lib/config.ts` centralizes reads for API URL, Auth0 detection, and dev-login visibility.

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
| `/login` | Login (Auth0 and/or dev password flow). |
| `/app` | Protected layout (`AppShell`); nested routes: |
| `/app/dashboard` | Dashboard. |
| `/app/sectors` | Sector tiles and research entry. |
| `/app/history` | Past runs list. |
| `/app/history/:runId` | Single run detail. |

Unknown paths redirect to `/`.

## API usage

- **`src/api/client.ts`**: `apiFetch` / `apiJson` prepend `VITE_API_BASE_URL` and attach `Authorization: Bearer <token>` when the session supplies an access token. **401** responses trigger a global handler (session cleanup / redirect) via `setUnauthorizedHandler`.
- **`researchWebSocketUrl(jobId, accessToken)`**: Builds a `ws:` or `wss:` URL for `/research/ws/{jobId}` with a `token` query string for progress streaming.

Types shared with the API live in **`src/api/types.ts`**.

## Authentication

- **Auth0**: When `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` are both non-empty, `main.tsx` mounts `Auth0Provider` and the session layer uses `getAccessTokenSilently` (with optional audience).
- **Dev token**: If not using Auth0, or in addition to it, a dev JWT can be stored under the key defined in `src/session/storage.ts` and used as the bearer token (see `SessionContext`).

Protected UI is wrapped by **`ProtectedRoute`**; **`UnauthorizedBridge`** coordinates 401 handling from the API client.

## Project layout

```
frontend/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx              # Root render; optional Auth0Provider
│   ├── App.tsx               # Route definitions
│   ├── index.css             # Global styles / Tailwind entry
│   ├── api/                  # HTTP client, types
│   ├── components/           # AppShell, research progress UI, etc.
│   ├── data/                 # Static sector data, themes, mocks
│   ├── lib/                  # config (env helpers)
│   ├── pages/                # Login, Dashboard, Sectors, History, …
│   ├── routes/               # ProtectedRoute, redirects, 401 bridge
│   └── session/              # SessionContext, storage keys
└── ...
```

## Production build

Run `npm run build` and deploy the **`dist/`** directory behind any static host or reverse proxy. Ensure the deployed origin is allowed in your Auth0 SPA **Allowed Callback URLs** and **Allowed Web Origins** if you use Auth0.

## Linting

ESLint is configured in `eslint.config.js`. For stricter type-aware rules or React-specific plugins, see the [typescript-eslint](https://typescript-eslint.io/getting-started/) and [ESLint React](https://github.com/Rel1cx/eslint-react) documentation.
