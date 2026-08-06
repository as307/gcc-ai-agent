import type Anthropic from '@anthropic-ai/sdk';
import type { KnowledgeChunk, LlmReply } from '../types.js';

export interface ConversationTurn {
  role: 'customer' | 'agent';
  text: string;
}

const MODEL = 'claude-sonnet-5';

/**
 * Generates Murshed's reply: grounds the model in the retrieved
 * knowledge base chunks, replays the conversation so far, and appends
 * the customer's newest message.
 */
export async function generateReply(
  anthropic: Anthropic,
  systemPrompt: string,
  knowledge: KnowledgeChunk[],
  history: ConversationTurn[],
  userMessage: string
): Promise<LlmReply> {
  const knowledgeBlock = knowledge.length
    ? `\n\nRelevant property knowledge:\n${knowledge.map((k) => `- ${k.content}`).join('\n')}`
    : '';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${systemPrompt}${knowledgeBlock}`,
    messages: [
      ...history.map((turn) => ({
        role: turn.role === 'customer' ? ('user' as const) : ('assistant' as const),
        content: turn.text,
      })),
      { role: 'user' as const, content: userMessage },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic response contained no text block');
  }

  return { text: textBlock.text };
}
