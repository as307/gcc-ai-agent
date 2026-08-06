import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const validEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  VOYAGE_API_KEY: 'voyage-test',
  WHATSAPP_TOKEN: 'whatsapp-token',
  WHATSAPP_PHONE_NUMBER_ID: '1234567890',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  VAPI_WEBHOOK_SECRET: 'vapi-secret',
  PORT: '3000',
};

describe('loadEnv', () => {
  it('parses a complete, valid environment', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3000);
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('throws a readable error when a required variable is missing', () => {
    const { SUPABASE_URL, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/SUPABASE_URL/);
  });

  it('defaults PORT to 3000 when not set', () => {
    const { PORT, ...rest } = validEnv;
    const env = loadEnv(rest);
    expect(env.PORT).toBe(3000);
  });
});
