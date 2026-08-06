#!/usr/bin/env bash
# Smoke-drives the gcc-ai-agent Fastify server end-to-end: writes a
# schema-valid placeholder .env if none exists, launches the dev server
# in the background, waits for readiness, exercises every endpoint that
# doesn't require genuine external credentials (Supabase/Anthropic/
# WhatsApp/Vapi), then shuts the server down.
#
# Usage: .claude/skills/run-gcc-ai-agent/smoke.sh [port]
#   port defaults to 3900 (3000 is frequently occupied in sandboxed
#   containers by something outside this script's process tree — see
#   SKILL.md Gotchas).
set -euo pipefail

cd "$(dirname "$0")/../../.."   # repo root — this file lives 3 levels under it

PORT="${1:-3900}"
LOG_FILE="/tmp/gcc-ai-agent-smoke.log"
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env found — writing schema-valid placeholder credentials."
  echo "(External calls to Supabase/Anthropic/WhatsApp/Voyage will fail with these — that's expected. See SKILL.md Gotchas.)"
  cat > "$ENV_FILE" << 'EOF'
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
ANTHROPIC_API_KEY=sk-ant-placeholder
VOYAGE_API_KEY=voyage-placeholder
WHATSAPP_TOKEN=whatsapp-placeholder-token
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=local-verify-token
VAPI_WEBHOOK_SECRET=local-vapi-secret
PORT=3000
DEFAULT_ORG_ID=demo-org
DEFAULT_ORG_NAME='Al Mouj Luxury Realty'
EOF
fi

echo "Freeing port $PORT if something is already listening on it..."
lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 || true
sleep 0.5

echo "Launching server on port $PORT..."
# The codebase has no dotenv autoloader (loadEnv() reads raw process.env
# only) — .env must be exported into the shell by hand before launch.
# NOTE: `source "$ENV_FILE"` reassigns the shell's PORT variable to
# whatever the .env file says — capture the caller's requested port
# BEFORE sourcing, or the override below silently re-exports the .env's
# stale value instead of $1.
REQUESTED_PORT="$PORT"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export PORT="$REQUESTED_PORT"   # overrides whatever PORT the .env file set

npx tsx src/server.ts > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /tmp/gcc-ai-agent-smoke.pid

cleanup() {
  lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for readiness..."
for i in $(seq 1 30); do
  curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1 && break
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server process died during startup. Log:"
    cat "$LOG_FILE"
    exit 1
  fi
  sleep 0.5
done

echo
echo "=== GET /health ==="
curl -s "http://localhost:$PORT/health"; echo

echo
echo "=== WhatsApp verify handshake, correct token (echoes challenge) ==="
curl -s "http://localhost:$PORT/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=local-verify-token&hub.challenge=smoke-test"; echo

echo
echo "=== WhatsApp verify handshake, wrong token -> expect 403 ==="
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$PORT/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=smoke-test"

echo
echo "=== Vapi webhook, no secret header -> expect 401 ==="
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:$PORT/webhooks/vapi" \
  -H "Content-Type: application/json" -d '{"message":{"toolCalls":[]}}'

echo
echo "=== Vapi webhook, correct secret, unsupported tool name ==="
curl -s -X POST "http://localhost:$PORT/webhooks/vapi" \
  -H "Content-Type: application/json" -H "x-vapi-secret: local-vapi-secret" \
  -d '{"message":{"toolCalls":[{"id":"call-1","function":{"name":"cancel_booking","arguments":{}}}]}}'; echo

echo
echo "=== WhatsApp inbound message (placeholder creds -> pipeline fails, error-handling path exercised) ==="
timeout 15 curl -s -X POST "http://localhost:$PORT/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"96890000000","text":{"body":"smoke test"}}]}}]}]}'; echo

echo
echo "=== Server log tail (structured error log from the WhatsApp failure above included) ==="
tail -20 "$LOG_FILE"

echo
echo "Smoke run complete. Server will be stopped on script exit."
