---
name: run-gcc-ai-agent
description: Build, run, and drive gcc-ai-agent (the "Murshed" WhatsApp/voice AI agent Fastify backend). Use when asked to start gcc-ai-agent, run its tests, build it, or smoke-test its webhooks.
---

This is a headless Fastify web server (Node/TypeScript) — no GUI. Drive it via `curl` against its HTTP endpoints. A smoke-test driver that launches the server, waits for readiness, exercises every endpoint that doesn't need genuine external credentials, and shuts it down cleanly lives at `.claude/skills/run-gcc-ai-agent/smoke.sh` — run that first.

All paths below are relative to the repo root (`~/gcc-ai-agent/`).

## Prerequisites

Node.js >= 20 (this repo was built and verified against Node 22.23.1). No OS packages beyond `curl` and `lsof`, both already present on this container.

## Setup

```bash
npm install
```

No `.env` exists until you create one. `src/config/env.ts` validates it strictly at startup (zod) — every one of these is required, there is no dotenv autoloader in this codebase, so a `.env` file on disk does **nothing** by itself. It has to be exported into the shell before launch (`set -a; source .env; set +a`) — the smoke driver does this for you.

```
SUPABASE_URL=...              # must be a valid URL, not connectivity-checked at boot
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...     # you choose this value; WhatsApp's verify handshake just echoes it back
VAPI_WEBHOOK_SECRET=...       # you choose this value; sent as the x-vapi-secret header
PORT=3000                     # optional, defaults to 3000
DEFAULT_ORG_ID=...
DEFAULT_ORG_NAME=...          # quote it if it contains spaces, e.g. DEFAULT_ORG_NAME='Al Mouj Luxury Realty'
```

For a smoke run with no real accounts, schema-valid placeholder values are enough to boot the server and exercise routing/auth/error-handling — see Run (agent path) below, which generates these for you automatically.

## Build

```bash
npm run build   # tsc -p tsconfig.json -> dist/
```

## Run (agent path)

```bash
.claude/skills/run-gcc-ai-agent/smoke.sh          # port 3900
.claude/skills/run-gcc-ai-agent/smoke.sh 4000      # or a specific port
```

What it does: writes a placeholder `.env` if none exists, frees the target port if something's already listening, launches `npx tsx src/server.ts` in the background, polls `/health` until ready, then runs through:

| request | expected result |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /webhooks/whatsapp` verify handshake, correct token | echoes back `hub.challenge` |
| `GET /webhooks/whatsapp` verify handshake, wrong token | `403` |
| `POST /webhooks/vapi`, no `x-vapi-secret` header | `401` |
| `POST /webhooks/vapi`, correct secret, unrecognized tool name | `{"results":[{"toolCallId":"...","result":"unsupported_tool"}]}` |
| `POST /webhooks/whatsapp`, real inbound message payload | with placeholder creds this fails downstream (no real Supabase) — the point is to prove the pipeline's try/catch catches it, logs a structured error, and still responds `{"status":"error"}` instead of crashing |

Server log → `/tmp/gcc-ai-agent-smoke.log`. The script stops the server (kills whatever's listening on the target port) on exit via a trap, so it cleans up even if a step fails.

To test with real behavior (an actual reply generated and sent), put genuine credentials in `.env` before running the script, or run the server manually (below) and `curl` it yourself.

## Run (human path)

```bash
npm run dev   # tsx src/server.ts, foreground, blocks
```

Requires the same env vars exported first (`set -a; source .env; set +a`) since nothing in this codebase loads `.env` automatically. Ctrl-C to stop.

## Test

```bash
npm test   # vitest run
```

45 tests across 15 files, all passing as of this writing — fully mocked, no network I/O, runs in ~2-3s.

---

## Gotchas

- **`.env` on disk does nothing by itself.** There's no dotenv package and `src/config/env.ts` reads only `process.env` directly. You must `set -a; source .env; set +a` (or equivalent) before `npm run dev` / `npx tsx src/server.ts`, or every var will read as missing and the server throws `Invalid environment configuration: ...` immediately on `loadEnv()`.
- **`source .env` clobbers your `PORT` override if you're not careful.** If you do `PORT=4000` then `source .env` where the file also sets `PORT=3000`, the source wins — your `PORT=4000` is gone. Capture the value you want *before* sourcing, then re-`export` it *after*. The smoke driver does this (`REQUESTED_PORT="$PORT"` before `source`, `export PORT="$REQUESTED_PORT"` after) — this was a real bug caught by actually running the driver, not just reading the code.
- **Port 3000 is frequently already bound to something outside this script's own process tree** in this sandboxed container (`lsof` can't even identify what's using it — likely something in a different namespace the sandbox doesn't expose). The smoke driver defaults to port 3900 instead and frees whatever's on its target port before launching. If you hit `EADDRINUSE` on 3000 running the human path manually, just pass a different `PORT`.
- **Env values with spaces need quoting in `.env`**, e.g. `DEFAULT_ORG_NAME='Al Mouj Luxury Realty'` — not `DEFAULT_ORG_NAME=Al Mouj Luxury Realty`, which breaks a plain `source` (bash tries to run `Mouj` as a command).
- **A real `POST /webhooks/whatsapp` request with placeholder credentials takes ~7-8 seconds to fail**, not instant — it's a real `fetch` to a fake Supabase URL timing out, not a local validation error. The smoke script wraps it in `timeout 15` accordingly. Don't mistake the wait for a hang.
- **`POST /webhooks/vapi` and `POST /webhooks/whatsapp` both always respond `200`** even on internal failure (by design — see the plan's fix-wave commit for the WhatsApp path, and the Vapi path's per-tool-call try/catch) — check the JSON body's `status`/`result` field or the server log, not the HTTP status code, to tell success from failure on these two routes specifically. `/health` and the GET verify handshake use real status codes normally.

## Troubleshooting

- **`Error: Invalid environment configuration: SUPABASE_URL: Required; ...` (lists every var)**: you launched `npx tsx src/server.ts` without exporting `.env` into the shell first. Run `set -a; source .env; set +a` immediately before the launch command in the same shell (or use `.claude/skills/run-gcc-ai-agent/smoke.sh`, which handles this).
- **`Error: listen EADDRINUSE: address already in use 0.0.0.0:3000`**: something else already holds port 3000 in this container. Use a different port: `PORT=3900 npx tsx src/server.ts` (after exporting the rest of `.env`), or `.claude/skills/run-gcc-ai-agent/smoke.sh 3900`.
- **`.env: line N: <word>: command not found` when manually `source`-ing**: an unquoted value containing spaces (see Gotchas above). Quote it.
