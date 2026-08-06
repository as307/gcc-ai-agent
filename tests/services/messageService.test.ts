import { describe, it, expect } from 'vitest';
import { logMessage } from '../../src/services/messageService.js';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

describe('logMessage', () => {
  it('inserts a chat_messages row with the given role and body', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () => Promise.resolve({ data: { id: 'msg-1' }, error: null });

    await logMessage(supabase as any, {
      orgId: 'org-1',
      sessionId: 'sess-1',
      role: 'customer',
      body: 'أبحث عن فيلا',
    });

    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      session_id: 'sess-1',
      role: 'customer',
      body: 'أبحث عن فيلا',
    });
  });

  it('throws a readable error when the insert fails', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () => Promise.resolve({ data: null, error: { message: 'constraint violation' } });

    await expect(
      logMessage(supabase as any, { orgId: 'org-1', sessionId: 'sess-1', role: 'agent', body: 'hi' })
    ).rejects.toThrow('Failed to log message: constraint violation');
  });
});
