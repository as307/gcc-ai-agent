import type { FastifyInstance } from 'fastify';
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import { findOrCreateSession } from '../services/sessionService.js';
import { searchKnowledgeBase } from '../services/knowledgeService.js';
import { generateReply } from '../services/llmService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { logMessage } from '../services/messageService.js';
import { buildSystemPrompt } from '../prompts/murshed.js';

interface WhatsappWebhookDeps {
  supabase: SupabaseClient;
  anthropic: Anthropic;
  env: Env;
  orgId: string;
  orgName: string;
}

interface WhatsappInboundPayload {
  entry: {
    changes: {
      value: {
        messages?: { from: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

export function registerWhatsappWebhook(app: FastifyInstance, deps: WhatsappWebhookDeps): void {
  app.get('/webhooks/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === deps.env.WHATSAPP_VERIFY_TOKEN) {
      reply.send(query['hub.challenge']);
      return;
    }
    reply.code(403).send('Verification failed');
  });

  app.post('/webhooks/whatsapp', async (request, reply) => {
    const payload = request.body as WhatsappInboundPayload;
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message?.text?.body) {
      reply.code(200).send({ status: 'ignored' });
      return;
    }

    try {
      const session = await findOrCreateSession(deps.supabase, deps.orgId, message.from, 'whatsapp');

      await logMessage(deps.supabase, {
        orgId: deps.orgId,
        sessionId: session.id,
        role: 'customer',
        body: message.text.body,
      });

      const knowledge = await searchKnowledgeBase(deps.supabase, deps.env, deps.orgId, message.text.body);
      const systemPrompt = buildSystemPrompt('ar', deps.orgName);
      const replyResult = await generateReply(deps.anthropic, systemPrompt, knowledge, [], message.text.body);

      await logMessage(deps.supabase, {
        orgId: deps.orgId,
        sessionId: session.id,
        role: 'agent',
        body: replyResult.text,
      });

      await sendWhatsAppMessage(deps.env, message.from, replyResult.text);

      reply.code(200).send({ status: 'ok', sessionId: session.id });
    } catch (err) {
      request.log.error({ err, orgId: deps.orgId, from: message.from }, 'WhatsApp pipeline failed');

      try {
        await sendWhatsAppMessage(
          deps.env,
          message.from,
          'عذراً، نواجه صعوبة تقنية حالياً وسيتواصل معك فريقنا قريباً.'
        );
      } catch {
        // best-effort fallback only; the original error is already logged above
      }

      reply.code(200).send({ status: 'error' });
    }
  });
}
