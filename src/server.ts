import Fastify, { type FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from './config/env.js';
import { getSupabaseClient } from './lib/supabase.js';
import { registerWhatsappWebhook } from './routes/whatsappWebhook.js';
import { registerVapiWebhook } from './routes/vapiWebhook.js';

export function buildServer(): FastifyInstance {
  const env = loadEnv();
  const supabase = getSupabaseClient(env);
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  registerWhatsappWebhook(app, {
    supabase,
    anthropic,
    env,
    orgId: process.env.DEFAULT_ORG_ID ?? '',
    orgName: process.env.DEFAULT_ORG_NAME ?? 'the agency',
  });

  registerVapiWebhook(app, { supabase, env });

  return app;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const app = buildServer();
  const env = loadEnv();
  app.listen({ port: env.PORT, host: '0.0.0.0' });
}
