# gcc-ai-agent

[![CI](https://github.com/as307/gcc-ai-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/as307/gcc-ai-agent/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**The "Murshed" lead-qualification backend** — a 24/7 WhatsApp + voice agent for a GCC luxury real estate agency. It receives inbound WhatsApp messages via Meta's WhatsApp Business Cloud API, answers prospects in Khaleeji/Omani Arabic or English with knowledge-grounded replies, and confirms property-viewing bookings through voice calls driven by Vapi.ai tool-calling.

> Module A of the GCC AI agency blueprint. This repository is the **backend service only** — no frontend, no outbound outreach pipeline.

---

## ✨ Features

- **WhatsApp inbound triage** — ingests inbound messages from the Meta WhatsApp Business Cloud API (`POST /webhooks/whatsapp`), with Meta's one-time verification handshake (`GET`).
- **Knowledge-grounded LLM replies** — answers are grounded in a pgvector knowledge base (Voyage AI `voyage-3` embeddings, Anthropic Claude) so the agent speaks accurately about the agency's listings and policies.
- **Bilingual, localized persona** — replies generated in natural Khaleeji/Omani Arabic or English, per the blueprint's persona rules.
- **Voice booking confirmation** — Vapi.ai voice agents call prospects and invoke the `confirm_booking` tool; this service executes the booking and reports back to the call.
- **Multi-tenant by design** — all state is scoped by `DEFAULT_ORG_ID` in a Supabase Postgres schema with pgvector.
- **Oman-only enforcement** — the service verifies at startup that the configured WhatsApp number is a registered Oman (+968) number and refuses to boot otherwise. No Twilio, no foreign numbers, ever.
- **Production-ready** — strict TypeScript, Zod-validated environment, Fastify, 50+ Vitest tests with zero network I/O, Docker image, CI on GitHub Actions, and a documented deploy runbook.

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                 gcc-ai-agent                  │
                    │              (Fastify, Node 22)              │
                    │                                              │
  Meta WhatsApp ───►│  GET/POST /webhooks/whatsapp                │
  Cloud API         │    ├─ verification handshake (GET)           │
                    │    └─ inbound triage → session + reply      │
                    │                                              │
  Vapi.ai ─────────►│  POST /webhooks/vapi (x-vapi-secret)         │
  voice tool-call   │    └─ confirm_booking → booking created      │
                    │                                              │
                    └──────┬───────────────────────┬───────────────┘
                           │                       │
                  ┌────────▼─────────┐     ┌───────▼──────────┐
                  │     Supabase     │     │  Anthropic Claude│
                  │  (Postgres +     │     │  Voyage AI       │
                  │   pgvector)      │     │  (embeddings)    │
                  └──────────────────┘     └──────────────────┘
```

The two webhooks share a small set of **stateless services** — session lookup/creation, knowledge-base vector search, LLM reply generation, and booking creation. Every service receives its dependencies (Supabase client, Anthropic client, env config) as explicit parameters rather than reading globals, so each is unit-testable in isolation with mocks — **no test ever touches a real network or database**.

### Project structure

```
src/
├── config/env.ts            # Zod-validated environment schema
├── routes/
│   ├── whatsappWebhook.ts   # Meta WhatsApp webhook (GET handshake + POST inbound)
│   └── vapiWebhook.ts       # Vapi.ai tool-call webhook (confirm_booking)
├── services/
│   ├── whatsappService.ts   # Outbound messages via the WhatsApp Graph API
│   ├── sessionService.ts    # Session lookup / creation
│   ├── messageService.ts    # Conversation message persistence
│   ├── knowledgeService.ts  # pgvector knowledge-base search
│   ├── embeddingService.ts  # Voyage AI embeddings
│   ├── llmService.ts        # Anthropic Claude reply generation
│   ├── bookingService.ts    # Booking creation (Supabase)
│   └── phoneNumberGuard.ts  # Startup check: WhatsApp number must be +968 (Oman)
├── lib/                     # Shared infrastructure (Supabase client, etc.)
├── prompts/                 # Persona / system prompts
├── types.ts                 # Shared domain types
└── server.ts                # Fastify app + startup
```

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 22 (ESM, `"type": "module"`) |
| Language | TypeScript, `strict: true` |
| Web framework | Fastify 5 |
| LLM | Anthropic Claude (`claude-sonnet-5`) |
| Embeddings | Voyage AI `voyage-3` (1024-dim) |
| Database | Supabase Postgres + pgvector (multi-tenant) |
| Validation | Zod (environment + payloads) |
| Tests | Vitest (50+ tests, all network I/O mocked) |
| Deploy | Docker (multi-stage, non-root) · CI: GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 22 and npm
- Accounts/credentials for: Supabase (Postgres + pgvector), Anthropic, Voyage AI, Meta WhatsApp Business Cloud API, and (for voice) Vapi.ai

### Install & run

```bash
npm ci
cp .env.example .env   # then fill in your real values
npm run dev            # starts the server on PORT (default 3000)
```

### Environment variables

All variables are validated at startup by Zod — a missing or invalid value fails fast with a readable error:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-...`) |
| `VOYAGE_API_KEY` | Voyage AI API key (`pa-...`) |
| `WHATSAPP_TOKEN` | Meta WhatsApp Business Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone-number ID — **must be an Oman (+968) number** |
| `WHATSAPP_VERIFY_TOKEN` | Arbitrary string used for Meta's webhook handshake |
| `VAPI_WEBHOOK_SECRET` | Arbitrary string sent as `x-vapi-secret` by Vapi |
| `DEFAULT_ORG_ID` | Tenant / organization ID for multi-tenancy |
| `DEFAULT_ORG_NAME` | Tenant display name |
| `PORT` | HTTP port (default `3000`) |

> ⚠️ **Oman numbers only.** The server verifies at startup that `WHATSAPP_PHONE_NUMBER_ID` resolves to a `+968` number via the Graph API, and refuses to start otherwise. This project never uses Twilio or any other WhatsApp BSP — never route around this check.

---

## 📡 API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness probe → `{"status":"ok"}` |
| `GET` | `/webhooks/whatsapp` | `hub.verify_token` | Meta webhook verification handshake |
| `POST` | `/webhooks/whatsapp` | — | Inbound WhatsApp message delivery |
| `POST` | `/webhooks/vapi` | `x-vapi-secret` header | Vapi.ai voice tool-call (booking confirmation) |

---

## 🧪 Testing

```bash
npm test        # Vitest — 50+ tests, all external calls mocked
npm run build   # Type-check & compile (tsc)
```

The suite covers webhook handshakes, inbound payload parsing, LLM fallbacks, booking creation, session/message persistence, the Oman-number guard, and the Fastify server — with `fetch`, Supabase, Anthropic, and Voyage all stubbed. No test performs real network I/O.

---

## ☁️ Deployment

The service ships as a multi-stage, non-root Docker image (`node:22-alpine`) and is deploy-ready for any container host. See **[`docs/DEPLOY.md`](docs/DEPLOY.md)** for the full runbook:

1. Set the ten environment variables as secrets.
2. Deploy the container (Fly.io runbook included; the same config works on Render or any Docker host).
3. Register the two webhooks:
   - **Meta (WhatsApp):** point the webhook at `/webhooks/whatsapp` with your `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
   - **Vapi.ai:** point the assistant's `confirm_booking` tool-call webhook at `/webhooks/vapi` with `x-vapi-secret` set to your `VAPI_WEBHOOK_SECRET`.
4. Verify: `curl https://<your-host>/health` → `{"status":"ok"}`.

A crash loop right after deploy almost always means `WHATSAPP_PHONE_NUMBER_ID` isn't an Oman (+968) number — the startup guard refuses to boot rather than silently serve a foreign number.

---

## 🧭 Scope

**In scope (Module A):** WhatsApp text triage, knowledge-grounded bilingual replies, and Vapi tool-calling for booking confirmations.

**Out of scope:** the outbound scraping/outreach pipeline (Module B), the Softr/Airtable dashboard, and Vapi's STT/TTS voice configuration itself (configured in the Vapi dashboard, outside this repo).

---

*Built as part of the GCC AI agency blueprint. See `docs/superpowers/plans/2026-08-06-whatsapp-voice-agent.md` for the original implementation plan.*
