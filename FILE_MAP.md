# WA Control — File Map

Quick reference for editing offline. Shows every source file, what it does, and what it imports.

---

## Project Layout

```
wa-control/
├── artifacts/
│   ├── api-server/          ← Node.js/Express backend (Baileys + DB)
│   └── dashboard/           ← React frontend (Vite + Tailwind)
├── lib/
│   ├── db/                  ← Drizzle ORM schema + DB connection
│   ├── api-spec/            ← OpenAPI YAML + Orval codegen config
│   ├── api-client-react/    ← Generated React-Query hooks (do not hand-edit)
│   └── api-zod/             ← Generated Zod validators (do not hand-edit)
├── pnpm-workspace.yaml      ← Monorepo workspace definition
├── termux-install.sh        ← One-time Termux setup script
└── termux-start.sh          ← Termux startup script (PostgreSQL + pnpm dev)
```

---

## Data Flow

```
PostgreSQL
  ↑↓
lib/db  (Drizzle schema)
  ↑↓
artifacts/api-server  (Express routes, Baileys WhatsApp)
  ↑↓  (HTTP + SSE)
lib/api-spec  (openapi.yaml)  →  codegen  →  lib/api-client-react
                                                      ↓
                                           artifacts/dashboard  (React)
```

---

## lib/db — Database Schema

All tables are PostgreSQL via Drizzle ORM. Import alias: `@workspace/db`

| File | Table | Key columns |
|---|---|---|
| `src/schema/wa_messages.ts` | `wa_messages` | id, remoteJid, contactName, content, direction (inbound/outbound), isAutoReply, createdAt |
| `src/schema/wa_contacts.ts` | `wa_contacts` | jid, phoneNumber, name, messageCount, lastMessageAt |
| `src/schema/wa_auto_replies.ts` | `wa_auto_replies` | id, trigger, response, matchType (exact/contains/startsWith/regex), caseSensitive, enabled, hitCount |
| `src/schema/wa_config.ts` | `wa_config` | id (always "default"), botName, prefix, autoReplyEnabled, readReceiptsEnabled, typingIndicatorEnabled, welcomeMessage |
| `src/schema/index.ts` | — | Re-exports all four tables |
| `src/index.ts` | — | Exports `db` (Drizzle instance using `DATABASE_URL`) + all schemas |

---

## lib/api-spec — API Contract

| File | Purpose |
|---|---|
| `openapi.yaml` | Single source of truth for all API endpoints, request/response shapes |
| `orval.config.ts` | Codegen config — reads openapi.yaml, writes to `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` |

> **To add/change an endpoint:** edit `openapi.yaml` → run `pnpm --filter @workspace/api-spec run codegen` → generated files update automatically.

---

## lib/api-client-react — Generated HTTP Client

Do **not** hand-edit these files — they are regenerated from `openapi.yaml`.

| File | Purpose |
|---|---|
| `src/generated/api.ts` | All React-Query hooks (`useGetBotStatus`, `useListMessages`, etc.) |
| `src/generated/api.schemas.ts` | TypeScript types for every request/response shape |
| `src/custom-fetch.ts` | Wraps `fetch` — sets base URL and injects auth headers |
| `src/index.ts` | Re-exports everything; `setBaseUrl()` / `setAuthTokenGetter()` |

**Import in dashboard:** `import { useGetBotStatus, ... } from "@workspace/api-client-react"`

---

## lib/api-zod — Generated Zod Validators

Do **not** hand-edit. Used by the API server for request validation.

| File | Purpose |
|---|---|
| `src/generated/api.ts` | Zod validator functions for every endpoint |
| `src/generated/types/*.ts` | One Zod schema file per data type (Message, Contact, AutoReply, …) |
| `src/index.ts` | Re-exports everything |

**Import in server:** `import { ... } from "@workspace/api-zod"`

---

## artifacts/api-server — Express Backend

Entry: `src/index.ts` → `src/app.ts` → `src/routes/index.ts`

### Core files

| File | Purpose |
|---|---|
| `src/index.ts` | Reads `PORT` env var, calls `app.listen()` |
| `src/app.ts` | Creates Express app, mounts middleware (CORS, pino-http), mounts routes, serves dashboard static files from `../../dashboard/dist/public` |
| `src/lib/logger.ts` | Pino logger instance (JSON in prod, pretty in dev) |
| `src/lib/whatsapp.ts` | **Core** — Baileys socket, pairing, session persistence (`wa_auth/`), auto-reply engine, SSE broadcast, DB writes for messages + contacts |

### Routes

| File | Mount path | Endpoints |
|---|---|---|
| `src/routes/index.ts` | `/api` | Combines all sub-routers |
| `src/routes/health.ts` | `/api/health` | `GET /` — liveness probe |
| `src/routes/bot.ts` | `/api/bot` | `GET /status`, `POST /pair`, `POST /logout`, `GET /events` (SSE stream) |
| `src/routes/wa_messages.ts` | `/api/messages` | `GET /` (list + filter), `POST /send`, `GET /stats` |
| `src/routes/wa_contacts.ts` | `/api/contacts` | `GET /` (list), `GET /:jid` |
| `src/routes/wa_config.ts` | `/api/config` | `GET /` (bot config), `PUT /` (update config) |
| `src/routes/wa_config.ts` | `/api/auto-replies` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |

### Session / auth persistence

```
artifacts/api-server/wa_auth/     ← Baileys creds + keys (git-ignored)
```

### Build output

```
artifacts/api-server/dist/index.mjs    ← ESM bundle produced by build.mjs
```

---

## artifacts/dashboard — React Frontend

Entry: `index.html` → `src/main.tsx` → `src/App.tsx`

### Entry & routing

| File | Purpose |
|---|---|
| `src/main.tsx` | Mounts React root, wraps with `QueryClientProvider` + `BotEventsProvider` |
| `src/App.tsx` | Wouter `<Router>`, maps URL paths to page components inside `<Layout>` |

### Context

| File | Purpose |
|---|---|
| `src/context/bot-events-context.tsx` | **Global SSE connection** — one `EventSource` for the whole app; named-event listeners (`status`, `message`, `pairing_code`, `connected`); auto-reconnect every 5 s; broadcasts query invalidations to all pages; exports `useBotEvents()` hook returning `{ events, sseConnected }` |

### Layout

| File | Purpose |
|---|---|
| `src/components/layout.tsx` | App shell — collapsible sidebar (hamburger on mobile, persistent on desktop), mobile top bar, status dot, Disconnect button |

### Pages

| File | Route | Purpose |
|---|---|---|
| `src/pages/home.tsx` | `/` | Ops Console — Device Pairing form, pairing code display, live Event Stream terminal; reads from `useBotEvents()` |
| `src/pages/messages.tsx` | `/messages` | Message history (inbound/outbound filter), stats cards, Send Message form |
| `src/pages/contacts.tsx` | `/contacts` | Contact list with avatars, message counts, last-seen |
| `src/pages/auto-replies.tsx` | `/auto-replies` | CRUD for auto-reply rules — trigger, response, matchType, enabled toggle |
| `src/pages/settings.tsx` | `/settings` | Bot config form — name, prefix, feature toggles, welcome message |
| `src/pages/not-found.tsx` | `*` | 404 fallback |

### UI components (`src/components/ui/`)

All generated by shadcn/ui. Do **not** customise — replace via shadcn CLI.
Key ones used: `badge`, `button`, `card`, `dialog`, `form`, `input`, `scroll-area`, `select`, `separator`, `sheet`, `switch`, `textarea`, `toast/sonner`.

### Utilities & hooks

| File | Purpose |
|---|---|
| `src/lib/utils.ts` | `cn()` — merges Tailwind class names |
| `src/hooks/use-mobile.tsx` | `useIsMobile()` hook (breakpoint ≤ 768 px) |
| `src/hooks/use-toast.ts` | Low-level toast state (prefer `sonner` directly) |

### Styles

| File | Purpose |
|---|---|
| `src/index.css` | Tailwind directives + CSS custom properties (dark theme colours, sidebar variables) |
| `tailwind.config.*` / `vite.config.ts` | Tailwind + Vite config |

---

## Config files

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Lists workspace packages; **no ARM platform overrides** (Termux compat) |
| `tsconfig.base.json` | Shared TypeScript base config |
| `tsconfig.json` | Root TS config; references all packages |
| `artifacts/api-server/build.mjs` | esbuild script → produces `dist/index.mjs` |
| `artifacts/dashboard/vite.config.ts` | Vite dev server config (port from `$PORT`, proxy `/api` → API server) |
| `lib/db/drizzle.config.ts` | Drizzle Kit config (reads `DATABASE_URL`, points at schema files) |
| `termux-install.sh` | Termux one-time install (nodejs-lts, python, make, pnpm, pg) |
| `termux-start.sh` | Termux start — prod mode (single server) or `--dev` flag for hot-reload |
| `package.json` (root) | Workspace root — contains `pnpm run dev` to start both servers at once |

---

## Key environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | lib/db, api-server | PostgreSQL connection string |
| `PORT` | api-server, dashboard Vite | Replit assigns per artifact; defaults to 8080 (api) / 5173 (dashboard) |
| `API_PORT` | dashboard vite.config.ts | When set, Vite proxies `/api` to `http://localhost:$API_PORT`. Set automatically by `pnpm run dev`. |
| `NODE_ENV` | api-server | `development` or `production` |

---

## Import cheat-sheet

```ts
// From a dashboard page
import { useGetBotStatus, useListMessages } from "@workspace/api-client-react";
import { useBotEvents } from "@/context/bot-events-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// From an API server route
import { db } from "@workspace/db";
import { waMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";

// From whatsapp.ts (internal)
import { db } from "@workspace/db";
import { waMessagesTable, waContactsTable, waAutoRepliesTable, waConfigTable } from "@workspace/db";
```

---

## How to run locally (Replit)

```bash
# Install
pnpm install

# Dev (starts both api-server + dashboard)
pnpm run dev

# DB migrations
pnpm --filter @workspace/db run migrate

# Regenerate API client after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Build for production
pnpm run build
```

## How to run on Termux (Android)

```bash
bash termux-install.sh   # one time
bash termux-start.sh     # every session
```
