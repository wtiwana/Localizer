import { describe, expect, it } from 'vitest';
import { loadEmbeddedRegistry } from './commands/pull.js';

describe('cli registry', () => {
  it('loads embedded registry manifest', async () => {
    const registry = await loadEmbeddedRegistry();
    expect(registry.tiers.micro.engine).toBe('transformers');
    expect(registry.nlp.summarize.hfModelId).toContain('distilbart-cnn');
  });
});
