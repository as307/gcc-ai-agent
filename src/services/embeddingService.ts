import type { Env } from '../config/env.js';

const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

/**
 * Converts text into a vector embedding via Voyage AI (Anthropic's
 * recommended embeddings partner — Claude has no embeddings endpoint
 * of its own). Used to turn an inbound customer message into a query
 * vector for agent_knowledge_base similarity search.
 */
export async function embedText(env: Pick<Env, 'VOYAGE_API_KEY'>, text: string): Promise<number[]> {
  const response = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-3', input: [text] }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { data: { embedding: number[] }[] };
  return payload.data[0].embedding;
}
