import { describe, it, expect, vi } from 'vitest';
import { generateReply } from '../../src/services/llmService.js';

describe('generateReply', () => {
  it('sends system prompt, knowledge, and history, and returns the reply text', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'يا هلا والله الغالي، أبشر بالخير.' }],
    });
    const anthropic = { messages: { create } } as any;

    const reply = await generateReply(
      anthropic,
      'system prompt',
      [{ id: 'kb-1', orgId: 'org-1', content: 'Villa X has a golf view.', similarity: 0.9 }],
      [{ role: 'customer', text: 'مرحبا' }],
      'أبحث عن فيلا مطلة على الجولف'
    );

    expect(reply).toEqual({ text: 'يا هلا والله الغالي، أبشر بالخير.' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Villa X has a golf view.'),
        messages: [
          { role: 'user', content: 'مرحبا' },
          { role: 'user', content: 'أبحث عن فيلا مطلة على الجولف' },
        ],
      })
    );
  });

  it('throws when Anthropic returns no text block', async () => {
    const anthropic = { messages: { create: vi.fn().mockResolvedValue({ content: [] }) } } as any;

    await expect(generateReply(anthropic, 'system', [], [], 'hi')).rejects.toThrow(
      'Anthropic response contained no text block'
    );
  });
});
