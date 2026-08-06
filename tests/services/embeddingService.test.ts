import { describe, it, expect, vi, afterEach } from 'vitest';
import { embedText } from '../../src/services/embeddingService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('embedText', () => {
  it('returns the embedding vector from Voyage AI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const embedding = await embedText({ VOYAGE_API_KEY: 'test-key' }, 'أبحث عن فيلا مطلة على الجولف');

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.voyageai.com/v1/embeddings',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the Voyage API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' })
    );

    await expect(embedText({ VOYAGE_API_KEY: 'bad-key' }, 'test')).rejects.toThrow(
      'Voyage embeddings request failed: 401 unauthorized'
    );
  });
});
