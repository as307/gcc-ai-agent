import { describe, it, expect, vi } from 'vitest';
import { createSupabaseMock } from '../helpers/supabaseMock.js';

vi.mock('../../src/services/embeddingService.js', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const { searchKnowledgeBase } = await import('../../src/services/knowledgeService.js');

describe('searchKnowledgeBase', () => {
  it('embeds the query and returns mapped knowledge chunks', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'kb-1', org_id: 'org-1', content: 'Villa X has 4 bedrooms.', similarity: 0.91 }],
      error: null,
    });

    const results = await searchKnowledgeBase(
      supabase as any,
      { VOYAGE_API_KEY: 'test' },
      'org-1',
      'أبحث عن فيلا',
      5
    );

    expect(supabase.rpc).toHaveBeenCalledWith('match_knowledge_base', {
      p_org_id: 'org-1',
      p_query_embedding: [0.1, 0.2, 0.3],
      p_match_count: 5,
    });
    expect(results).toEqual([{ id: 'kb-1', orgId: 'org-1', content: 'Villa X has 4 bedrooms.', similarity: 0.91 }]);
  });

  it('throws when the RPC call errors', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(
      searchKnowledgeBase(supabase as any, { VOYAGE_API_KEY: 'test' }, 'org-1', 'query')
    ).rejects.toThrow('Knowledge base search failed: timeout');
  });
});
