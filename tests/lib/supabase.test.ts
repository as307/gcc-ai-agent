import { describe, it, expect, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ mocked: true }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const { getSupabaseClient } = await import('../../src/lib/supabase.js');

describe('getSupabaseClient', () => {
  it('creates a client with the configured URL and service role key', () => {
    const client = getSupabaseClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      { auth: { persistSession: false } }
    );
    expect(client).toEqual({ mocked: true });
  });
});
