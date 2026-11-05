import { describe, expect, it } from 'vitest';
import { ToolCache } from '../cache/tool-cache';

describe('ToolCache key generation', () => {
  it('distinguishes calls with different query arguments', () => {
    const cache = new ToolCache();

    const first = cache.makeKey('inspect_file', { path: 'src/app.ts', query: 'Agent' });
    const second = cache.makeKey('inspect_file', { path: 'src/app.ts', query: 'Cache' });

    expect(first).not.toBe(second);
  });

  it('produces the same key regardless of argument property order', () => {
    const cache = new ToolCache();

    expect(cache.makeKey('inspect_file', { path: 'src/app.ts', query: 'Agent' }))
      .toBe(cache.makeKey('inspect_file', { query: 'Agent', path: 'src/app.ts' }));
  });

  it('invalidates cached calls for a modified path', () => {
    const cache = new ToolCache();
    const key = cache.makeKey('inspect_file', { path: 'src/app.ts', query: 'Agent' });
    cache.set(key, 'old result');

    cache.invalidatePath('src/app.ts');

    expect(cache.get(key)).toBeNull();
  });
});
