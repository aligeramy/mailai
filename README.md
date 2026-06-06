# MailAI — Smart Email Assistant

MailAI is a Next.js 16 app that drafts AI email replies inside an Outlook add-in and on the web. It uses [Convex](https://convex.dev) for the backend, OpenAI for reply generation, and Microsoft Graph / MSAL for mailbox access.

## Prerequisites

- **Node.js** 20+ (developed on Node 25)
- **pnpm** 10+ (`npm install -g pnpm`)
- An **OpenAI API key** (for server-side reply generation)
- A **Convex** account (`npx convex dev` provisions a free dev deployment)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# then fill in the values (see "Environment variables" below)

# 3. Start the Convex backend (first run provisions a dev deployment
#    and prints NEXT_PUBLIC_CONVEX_URL / CONVEX_URL — copy them into .env.local)
npx convex dev
```

## Running the app

Run the Convex backend (`npx convex dev`) in one terminal, and the Next.js dev server in another.

```bash
# Standard dev server (web UI) — http://localhost:3000
pnpm dev

# HTTPS dev server — https://localhost:3000
# Required for Outlook add-in development: Office only loads taskpanes over HTTPS.
pnpm dev:https
```

> **Outlook add-in:** use `pnpm dev:https`. The first run generates a local
> dev certificate you may need to trust. The taskpane is served at
> `https://localhost:3000/taskpane`, which matches the SPA redirect URI in your
> Entra app registration.

### Production build

```bash
pnpm build   # build for production
pnpm start   # serve the production build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values. Highlights:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-side reply generation (`/api/generate-reply`) |
| `OPENAI_MODEL` | No | Model override (default `gpt-5.4`) |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL (client) — printed by `npx convex dev` |
| `CONVEX_URL` | Yes | Same value, server-only (no `NEXT_PUBLIC_` prefix) |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Add-in | Entra app (client) ID for MSAL.js in the taskpane |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Add-in | Tenant ID (leave blank for multi-tenant `/common`) |
| `RESEND_API_KEY` | No | Support form email (`POST /api/support`) |
| `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_*` | No | NextAuth web sign-in (optional) |

See the comments in `.env.example` for full Entra app-registration setup steps.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server on `http://localhost:3000` |
| `pnpm dev:https` | Dev server over HTTPS (needed for Outlook add-in) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm check` / `pnpm fix` | Ultracite (Biome) lint check / autofix |
| `pnpm test` | Run Vitest once (`test:watch`, `test:coverage` also available) |
| `pnpm validate:manifest` | Validate `public/manifest.xml` (Office add-in) |
| `pnpm generate:store-icons` | Generate Partner Center store icons |
| `pnpm package:addin` | Build the Outlook add-in submission zip |

## Project layout

- `app/` — Next.js App Router (web pages + API routes, including the taskpane)
- `convex/` — Convex schema and server functions (context, TSP-RR sync, users)
- `components/` — shared React components
- `lib/` — site config and helpers
- `public/manifest.xml` — Outlook add-in manifest
- `docs/` — deployment / Microsoft Marketplace notes

## Branding

The app uses `public/logo.png` for the site logo and favicon assets.
