import type { Env } from '../config/env.js';

/**
 * Sends a text message back to a customer via the WhatsApp Business
 * Cloud API. `to` must already be a full international number
 * (no leading +), as required by the Graph API.
 */
export async function sendWhatsAppMessage(
  env: Pick<Env, 'WHATSAPP_TOKEN' | 'WHATSAPP_PHONE_NUMBER_ID'>,
  to: string,
  body: string
): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
  }
}
