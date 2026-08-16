import Fastify, { type FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from './config/env.js';
import { getSupabaseClient } from './lib/supabase.js';
import { registerWhatsappWebhook } from './routes/whatsappWebhook.js';
import { registerVapiWebhook } from './routes/vapiWebhook.js';
import { verifyOmanNumber } from './services/phoneNumberGuard.js';

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
    orgId: env.DEFAULT_ORG_ID,
    orgName: env.DEFAULT_ORG_NAME,
  });

  registerVapiWebhook(app, { supabase, env, orgId: env.DEFAULT_ORG_ID });

  return app;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const app = buildServer();
  const env = loadEnv();
  await verifyOmanNumber(env);
  app.listen({ port: env.PORT, host: '0.0.0.0' });
}
