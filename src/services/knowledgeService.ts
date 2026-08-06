import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import type { KnowledgeChunk } from '../types.js';
import { embedText } from './embeddingService.js';

interface KnowledgeRow {
  id: string;
  org_id: string;
  content: string;
  similarity: number;
}

/**
 * Embeds the customer's message and finds the org's most relevant
 * knowledge base entries via pgvector cosine similarity (see
 * match_knowledge_base in src/db/schema.sql).
 */
export async function searchKnowledgeBase(
  supabase: SupabaseClient,
  env: Pick<Env, 'VOYAGE_API_KEY'>,
  orgId: string,
  queryText: string,
  matchCount = 5
): Promise<KnowledgeChunk[]> {
  const queryEmbedding = await embedText(env, queryText);

  const { data, error } = await supabase.rpc('match_knowledge_base', {
    p_org_id: orgId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error(`Knowledge base search failed: ${error.message}`);
  }

  return ((data ?? []) as KnowledgeRow[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    content: row.content,
    similarity: row.similarity,
  }));
}
