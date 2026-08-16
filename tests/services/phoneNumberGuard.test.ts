import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyOmanNumber, ForeignPhoneNumberError } from '../../src/services/phoneNumberGuard.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyOmanNumber', () => {
  it('resolves with the display number when it is an Oman (+968) number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_phone_number: '+968 9000 0000' }),
      })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 'token-123', WHATSAPP_PHONE_NUMBER_ID: '999888777' })
    ).resolves.toBe('+968 9000 0000');
  });

  it('calls the Graph API with the configured phone number id and token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_phone_number: '+968 9000 0000' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await verifyOmanNumber({ WHATSAPP_TOKEN: 'token-123', WHATSAPP_PHONE_NUMBER_ID: '999888777' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/999888777?fields=display_phone_number',
      { headers: { Authorization: 'Bearer token-123' }, signal: expect.any(AbortSignal) }
    );
  });

  it('passes an abort signal (bounded timeout) to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_phone_number: '+968 9000 0000' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await verifyOmanNumber({ WHATSAPP_TOKEN: 'token-123', WHATSAPP_PHONE_NUMBER_ID: '999888777' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects with ForeignPhoneNumberError when the number is not +968', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_phone_number: '+1 555 0100' }),
      })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).rejects.toThrow(ForeignPhoneNumberError);
  });

  it('rejects when display_phone_number is missing from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).rejects.toThrow(ForeignPhoneNumberError);
  });

  it('throws when the Graph API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid token' })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 'bad', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).rejects.toThrow('Failed to verify WhatsApp phone number: 401 invalid token');
  });

  it('normalizes spaces/dashes before checking the country code prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_phone_number: '+968-9000-0000' }),
      })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).resolves.toBe('+968-9000-0000');
  });

  it('resolves a bare-digits Oman number with no + prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_phone_number: '968 9000 0000' }),
      })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).resolves.toBe('968 9000 0000');
  });

  it('still rejects a foreign number even reformatted without a leading +', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_phone_number: '+1 (555) 010-0100' }),
      })
    );

    await expect(
      verifyOmanNumber({ WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' })
    ).rejects.toThrow(ForeignPhoneNumberError);
  });
});
