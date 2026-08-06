import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/prompts/murshed.js';

describe('buildSystemPrompt', () => {
  it('builds the Arabic Khaleeji prompt with persona grounding and guardrails', () => {
    const prompt = buildSystemPrompt('ar', 'العقارات الفاخرة');
    expect(prompt).toContain('مرشد');
    expect(prompt).toContain('يمنع منعاً باتاً الإجابة على أي أسئلة سياسية');
  });

  it('builds the English prompt with the same persona and guardrails', () => {
    const prompt = buildSystemPrompt('en', 'Luxury Real Estate Co.');
    expect(prompt).toContain('Murshed');
    expect(prompt).toContain('Strictly forbid answering political');
    expect(prompt).toContain('Luxury Real Estate Co.');
  });
});
