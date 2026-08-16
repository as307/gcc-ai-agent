import type { Env } from '../config/env.js';

const OMAN_COUNTRY_CODE = '+968';

/**
 * Thrown when the configured WHATSAPP_PHONE_NUMBER_ID resolves to a
 * number outside Oman. This project is scoped to Oman numbers only --
 * never Twilio or any other foreign-number provider -- so this is
 * always a configuration error, never a code path to route around.
 */
export class ForeignPhoneNumberError extends Error {
  constructor(displayNumber: string) {
    super(
      `WHATSAPP_PHONE_NUMBER_ID resolves to "${displayNumber}", not an Oman number (${OMAN_COUNTRY_CODE}). ` +
        'This project is scoped to Oman numbers only -- never Twilio or any other foreign-number ' +
        'provider. Point WHATSAPP_PHONE_NUMBER_ID at an Oman-registered WhatsApp Business number.'
    );
    this.name = 'ForeignPhoneNumberError';
  }
}

/**
 * Fetches the configured WhatsApp Business number's display number from
 * the Graph API and asserts it is an Oman number (+968). Called once at
 * process startup only (see server.ts's isMainModule branch) -- never
 * from buildServer(), so tests that build the server in-process never
 * make a real network call.
 *
 * This is the project's one enforced guardrail against ever routing
 * through a foreign number or a different provider: the module only
 * ever calls Meta's WhatsApp Business Cloud API directly, and this
 * check is what keeps a misconfigured or foreign WHATSAPP_PHONE_NUMBER_ID
 * from going live silently.
 */
export async function verifyOmanNumber(
  env: Pick<Env, 'WHATSAPP_TOKEN' | 'WHATSAPP_PHONE_NUMBER_ID'>
): Promise<string> {
  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify WhatsApp phone number: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { display_phone_number?: string };
  const displayNumber = body.display_phone_number ?? '';
  const normalized = displayNumber.replace(/[\s-]/g, '');

  if (!normalized.startsWith(OMAN_COUNTRY_CODE)) {
    throw new ForeignPhoneNumberError(displayNumber);
  }

  return displayNumber;
}
