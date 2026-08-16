# Deploy Runbook (Fly.io)

Everything here uses **live credentials and touches production**. Read
the whole file before running anything. Run these yourself — an
automated agent should never execute this file.

## 0. Prerequisites

- `flyctl` installed and authenticated (`fly auth login`).
- Live values ready for all ten environment variables `src/config/env.ts`
  requires: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `VOYAGE_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_VERIFY_TOKEN`, `VAPI_WEBHOOK_SECRET`, `DEFAULT_ORG_ID`,
  `DEFAULT_ORG_NAME`.
- **`WHATSAPP_PHONE_NUMBER_ID` must be an Oman-registered WhatsApp Business
  number (+968), provisioned directly through Meta's WhatsApp Business
  Platform.** This project never uses Twilio or any other WhatsApp BSP —
  don't provision the number through one. The app enforces this itself:
  it calls the Graph API at startup and refuses to boot if the configured
  number isn't +968 (see `src/services/phoneNumberGuard.ts`) — a crash
  loop right after deploy almost always means this was set wrong, not
  that something is broken.
- The Vapi.ai side (the voice line's phone number) is configured directly
  in the Vapi dashboard, outside this repo's env — that number must also
  be an Oman number, but nothing in this codebase can verify it
  automatically, since Vapi's phone-number provisioning isn't exposed
  through this app's config surface. Check it manually in the Vapi
  dashboard before going live.

## 1. First deploy (creates the Fly app)

```bash
fly launch --no-deploy --copy-config
```

Confirm it picks up `app = "gcc-ai-agent"` from `fly.toml` rather than
prompting for a new name — if it prompts, something about the existing
`fly.toml` wasn't picked up; stop and check before continuing.

## 2. Set the ten secrets

```bash
fly secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  VOYAGE_API_KEY="pa-..." \
  WHATSAPP_TOKEN="..." \
  WHATSAPP_PHONE_NUMBER_ID="..." \
  WHATSAPP_VERIFY_TOKEN="choose-a-random-string" \
  VAPI_WEBHOOK_SECRET="choose-a-random-string" \
  DEFAULT_ORG_ID="..." \
  DEFAULT_ORG_NAME="..."
```

(`PORT` is already set via `fly.toml`'s `[env]` block — don't override it
unless you also change `fly.toml`'s `internal_port`.)

## 3. Deploy

```bash
fly deploy
```

## 4. Verify it's actually up

```bash
fly status
curl https://gcc-ai-agent.fly.dev/health
# expect: {"status":"ok"}
```

If the machine is crash-looping, `fly logs` first — check specifically
for a `ForeignPhoneNumberError` message (see the WHATSAPP_PHONE_NUMBER_ID
note in Prerequisites above) before assuming it's something else.

## 5. Register the two webhooks with their providers

**Meta (WhatsApp)** — App Dashboard → WhatsApp → Configuration → Webhook:
`https://gcc-ai-agent.fly.dev/webhooks/whatsapp`, verify token = the exact
value you set as `WHATSAPP_VERIFY_TOKEN` in Step 2, subscribe to the
`messages` field.

**Vapi.ai** — in the Vapi dashboard, point the assistant's tool-call
webhook (for the `confirm_booking` function) at
`https://gcc-ai-agent.fly.dev/webhooks/vapi`, and set the
`x-vapi-secret` header value to match `VAPI_WEBHOOK_SECRET` from Step 2 —
`src/routes/vapiWebhook.ts` rejects any request where that header doesn't
match with a 401.

## Rollback

```bash
fly releases
fly deploy --image <previous-release-image>
```

or, simpler, for a fast rollback to the immediately prior release:

```bash
fly releases rollback
```
