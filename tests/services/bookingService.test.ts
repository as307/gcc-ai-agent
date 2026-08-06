import { describe, it, expect, vi } from 'vitest';
import { createBooking } from '../../src/services/bookingService.js';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

describe('createBooking', () => {
  it('inserts a confirmed booking and returns the mapped row', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () =>
      Promise.resolve({
        data: {
          id: 'book-1',
          org_id: 'org-1',
          session_id: 'sess-1',
          customer_name: 'Ahmed',
          property_ref: 'villa-golf-12',
          scheduled_at: '2026-08-10T14:00:00.000Z',
          status: 'confirmed',
        },
        error: null,
      });

    const booking = await createBooking(supabase as any, {
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: 'villa-golf-12',
      scheduledAt: '2026-08-10T14:00:00.000Z',
    });

    expect(supabase.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      session_id: 'sess-1',
      customer_name: 'Ahmed',
      property_ref: 'villa-golf-12',
      scheduled_at: '2026-08-10T14:00:00.000Z',
      status: 'confirmed',
    });
    expect(booking).toEqual({
      id: 'book-1',
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: 'villa-golf-12',
      scheduledAt: '2026-08-10T14:00:00.000Z',
      status: 'confirmed',
    });
  });

  it('throws a readable error when the insert fails', async () => {
    const supabase = createSupabaseMock();
    supabase.single = () => Promise.resolve({ data: null, error: { message: 'constraint violation' } });

    await expect(
      createBooking(supabase as any, { orgId: 'org-1', sessionId: 'sess-1', scheduledAt: '2026-08-10T14:00:00.000Z' })
    ).rejects.toThrow('Failed to create booking: constraint violation');
  });
});
