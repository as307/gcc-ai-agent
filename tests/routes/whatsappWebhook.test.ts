import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../../src/services/sessionService.js', () => ({
  findOrCreateSession: vi.fn().mockResolvedValue({
    id: 'sess-1',
    orgId: 'org-1',
    customerPhone: '96890000000',
    channel: 'whatsapp',
    createdAt: 'now',
  }),
}));
vi.mock('../../src/services/knowledgeService.js', () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../src/services/llmService.js', () => ({
  generateReply: vi.fn().mockResolvedValue({ text: 'يا هلا والله الغالي' }),
}));
vi.mock('../../src/services/whatsappService.js', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
}));

const { registerWhatsappWebhook } = await import('../../src/routes/whatsappWebhook.js');
const { sendWhatsAppMessage } = await import('../../src/services/whatsappService.js');
const { searchKnowledgeBase } = await import('../../src/services/knowledgeService.js');
const { generateReply } = await import('../../src/services/llmService.js');

function buildApp() {
  const app = Fastify();
  registerWhatsappWebhook(app, {
    supabase: {} as any,
    anthropic: {} as any,
    env: { WHATSAPP_VERIFY_TOKEN: 'verify-me' } as any,
    orgId: 'org-1',
    orgName: 'Al Mouj Luxury Realty',
  });
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /webhooks/whatsapp', () => {
  it('echoes the challenge when the verify token matches', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345',
    });
    expect(response.body).toBe('12345');
  });

  it('rejects a mismatched verify token', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345',
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('POST /webhooks/whatsapp', () => {
  it('runs the full pipeline and sends the generated reply back', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: {
        entry: [
          { changes: [{ value: { messages: [{ from: '96890000000', text: { body: 'أبحث عن فيلا' } }] } }] },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok', sessionId: 'sess-1' });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(expect.anything(), '96890000000', 'يا هلا والله الغالي');
    expect(searchKnowledgeBase).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'org-1',
      'أبحث عن فيلا'
    );
    expect(generateReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Al Mouj Luxury Realty'),
      [],
      [],
      'أبحث عن فيلا'
    );
  });

  it('ignores payloads with no text message (e.g. delivery receipts)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: { entry: [{ changes: [{ value: {} }] }] },
    });

    expect(JSON.parse(response.body)).toEqual({ status: 'ignored' });
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});
