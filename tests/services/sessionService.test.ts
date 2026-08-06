import { describe, it, expect } from 'vitest';
import { findOrCreateSession } from '../../src/services/sessionService.js';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

describe('findOrCreateSession', () => {
  it('returns the existing open session when one is found', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () =>
      Promise.resolve({
        data: {
          id: 'sess-1',
          org_id: 'org-1',
          customer_phone: '96890000000',
          channel: 'whatsapp',
          status: 'open',
          created_at: '2026-08-06T10:00:00.000Z',
        },
        error: null,
      });

    const session = await findOrCreateSession(supabase as any, 'org-1', '96890000000', 'whatsapp');

    expect(session).toEqual({
      id: 'sess-1',
      orgId: 'org-1',
      customerPhone: '96890000000',
      channel: 'whatsapp',
      createdAt: '2026-08-06T10:00:00.000Z',
    });
  });

  it('creates a new session when none is open', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () => Promise.resolve({ data: null, error: null });
    supabase.single = () =>
      Promise.resolve({
        data: {
          id: 'sess-2',
          org_id: 'org-1',
          customer_phone: '96890000001',
          channel: 'whatsapp',
          status: 'open',
          created_at: '2026-08-06T10:05:00.000Z',
        },
        error: null,
      });

    const session = await findOrCreateSession(supabase as any, 'org-1', '96890000001', 'whatsapp');

    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      customer_phone: '96890000001',
      channel: 'whatsapp',
      status: 'open',
    });
    expect(session.id).toBe('sess-2');
  });

  it('throws a readable error when the lookup query fails', async () => {
    const supabase = createSupabaseMock();
    supabase.maybeSingle = () => Promise.resolve({ data: null, error: { message: 'connection reset' } });

    await expect(findOrCreateSession(supabase as any, 'org-1', '96890000002', 'whatsapp')).rejects.toThrow(
      'Failed to look up chat session: connection reset'
    );
  });
});
