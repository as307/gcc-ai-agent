import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import { createBooking } from '../services/bookingService.js';

interface VapiWebhookDeps {
  supabase: SupabaseClient;
  env: Pick<Env, 'VAPI_WEBHOOK_SECRET'>;
  orgId: string;
}

interface VapiToolCall {
  id: string;
  function: {
    name: string;
    arguments: {
      sessionId: string;
      customerName?: string;
      propertyRef?: string;
      scheduledAt: string;
    };
  };
}

interface VapiToolCallPayload {
  message: {
    toolCalls: VapiToolCall[];
  };
}

export function registerVapiWebhook(app: FastifyInstance, deps: VapiWebhookDeps): void {
  app.post('/webhooks/vapi', async (request, reply) => {
    const secret = request.headers['x-vapi-secret'];
    if (secret !== deps.env.VAPI_WEBHOOK_SECRET) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }

    const payload = request.body as VapiToolCallPayload;
    const results: { toolCallId: string; result: string }[] = [];

    for (const call of payload.message.toolCalls) {
      if (call.function.name !== 'confirm_booking') {
        results.push({ toolCallId: call.id, result: 'unsupported_tool' });
        continue;
      }

      try {
        const booking = await createBooking(deps.supabase, {
          orgId: deps.orgId,
          sessionId: call.function.arguments.sessionId,
          customerName: call.function.arguments.customerName,
          propertyRef: call.function.arguments.propertyRef,
          scheduledAt: call.function.arguments.scheduledAt,
        });

        results.push({ toolCallId: call.id, result: `Booking ${booking.id} confirmed` });
      } catch (err) {
        request.log.error({ err, toolCallId: call.id }, 'Booking creation failed');
        results.push({ toolCallId: call.id, result: 'booking_failed' });
      }
    }

    reply.code(200).send({ results });
  });
}
