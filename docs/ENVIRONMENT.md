# MailAI environment variables

Create a file named `.env.local` in the project root (Next.js loads it automatically in development). Do not commit `.env.local`.

## Required for production API

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Secret key from [OpenAI API keys](https://platform.openai.com/api-keys). Used by `POST /api/generate-reply` when the add-in does not send a key. |

## Optional

| Variable | Description |
|----------|-------------|
| `OPENAI_MODEL` | Chat model id. Default: `gpt-5.4`. Alternatives include `gpt-5.4-mini`, `gpt-5-chat-latest`, or other models your account supports. |
| `OPENAI_BASE_URL` | Override API base URL if your organization uses a proxy or regional endpoint. |
| `OPENAI_REASONING_EFFORT` | For supported models: `low`, `medium`, or `high`. Lower values can reduce latency and reasoning-token cost. |

## Phase 1 (current) vs later phases

- **Phase 1:** Users may paste an API key in the task pane; it is sent to **your** Next.js server on each generate request, then forwarded to OpenAI. The server does not persist the key. Alternatively, set `OPENAI_API_KEY` in `.env.local` and leave the task pane key empty.
- **Phase 2 (planned):** Sign-in, per-user secrets, and no client-sent keys.

## Local HTTPS (recommended for Outlook)

Outlook often requires `https://` add-in URLs. Run:

```bash
pnpm dev:https
```

`public/manifest.xml` is configured for production (`https://smartreply.space`). For local sideloading, replace those URLs in a copy of the manifest (or temporarily edit) to match your dev origin, e.g. `https://localhost:3000`.

## Quick start

1. Copy `.env.example` to `.env.example` reference only; manually create `.env.local`.
2. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
3. `pnpm dev` or `pnpm dev:https`
4. Sideload `public/manifest.xml` in Outlook (see Microsoft’s “Sideload Outlook add-ins” documentation).
