import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';

const requiredEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  VOYAGE_API_KEY: 'voyage-test',
  WHATSAPP_TOKEN: 'whatsapp-token',
  WHATSAPP_PHONE_NUMBER_ID: '1234567890',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  VAPI_WEBHOOK_SECRET: 'vapi-secret',
  DEFAULT_ORG_ID: 'org-1',
  DEFAULT_ORG_NAME: 'Test Agency',
  PORT: '3000',
};

describe('server', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    Object.assign(process.env, requiredEnv);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('responds to GET /health', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });

  it('registers the WhatsApp verification handshake route', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=999',
    });
    expect(response.body).toBe('999');
  });

  it('registers the Vapi webhook route (rejecting an unauthenticated call)', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      payload: { message: { toolCalls: [] } },
    });
    expect(response.statusCode).toBe(401);
  });
});
