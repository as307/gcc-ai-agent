import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../../src/services/bookingService.js', () => ({
  createBooking: vi.fn().mockResolvedValue({
    id: 'book-1',
    orgId: 'org-1',
    sessionId: 'sess-1',
    scheduledAt: '2026-08-10T14:00:00.000Z',
    status: 'confirmed',
  }),
}));

const { registerVapiWebhook } = await import('../../src/routes/vapiWebhook.js');
const { createBooking } = await import('../../src/services/bookingService.js');

function buildApp() {
  const app = Fastify();
  registerVapiWebhook(app, { supabase: {} as any, env: { VAPI_WEBHOOK_SECRET: 'vapi-secret' }, orgId: 'org-1' });
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /webhooks/vapi', () => {
  it('rejects requests without the shared secret header', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      payload: { message: { toolCalls: [] } },
    });
    expect(response.statusCode).toBe(401);
  });

  it('confirms a booking for a confirm_booking tool call and returns the Vapi result shape', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      headers: { 'x-vapi-secret': 'vapi-secret' },
      payload: {
        message: {
          toolCalls: [
            {
              id: 'call-1',
              function: {
                name: 'confirm_booking',
                arguments: {
                  orgId: 'attacker-controlled-org-should-be-ignored',
                  sessionId: 'sess-1',
                  customerName: 'Ahmed',
                  scheduledAt: '2026-08-10T14:00:00.000Z',
                },
              },
            },
          ],
        },
      },
    });

    expect(createBooking).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      sessionId: 'sess-1',
      customerName: 'Ahmed',
      propertyRef: undefined,
      scheduledAt: '2026-08-10T14:00:00.000Z',
    });
    expect(JSON.parse(response.body)).toEqual({
      results: [{ toolCallId: 'call-1', result: 'Booking book-1 confirmed' }],
    });
  });

  it('returns unsupported_tool for unrecognized function names', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      headers: { 'x-vapi-secret': 'vapi-secret' },
      payload: {
        message: { toolCalls: [{ id: 'call-2', function: { name: 'cancel_booking', arguments: {} } }] },
      },
    });

    expect(JSON.parse(response.body)).toEqual({ results: [{ toolCallId: 'call-2', result: 'unsupported_tool' }] });
  });

  it('isolates a createBooking failure so the request still returns 200 with booking_failed', async () => {
    (createBooking as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db error'));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/vapi',
      headers: { 'x-vapi-secret': 'vapi-secret' },
      payload: {
        message: {
          toolCalls: [
            {
              id: 'call-3',
              function: {
                name: 'confirm_booking',
                arguments: {
                  orgId: 'org-1',
                  sessionId: 'sess-1',
                  customerName: 'Ahmed',
                  scheduledAt: '2026-08-10T14:00:00.000Z',
                },
              },
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ results: [{ toolCallId: 'call-3', result: 'booking_failed' }] });
  });
});
