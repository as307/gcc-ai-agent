import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendWhatsAppMessage } from '../../src/services/whatsappService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendWhatsAppMessage', () => {
  it('POSTs a text message to the Graph API with the configured phone number id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendWhatsAppMessage(
      { WHATSAPP_TOKEN: 'token-123', WHATSAPP_PHONE_NUMBER_ID: '999888777' },
      '96890000000',
      'يا هلا والله الغالي'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/999888777/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '96890000000',
          type: 'text',
          text: { body: 'يا هلا والله الغالي' },
        }),
      })
    );
  });

  it('throws when the Graph API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid recipient' })
    );

    await expect(
      sendWhatsAppMessage({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' }, 'bad-number', 'hi')
    ).rejects.toThrow('WhatsApp send failed: 400 invalid recipient');
  });
});
