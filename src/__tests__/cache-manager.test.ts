import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { CacheManager } from '../cache/cache-manager';

const TEST_DIR = join(process.cwd(), '.test-cache');

describe('CacheManager', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('stores and retrieves a value', () => {
    const cache = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 5 });
    cache.set('q1', 'answer-1');
    expect(cache.get('q1')).toBe('answer-1');
  });

  it('returns undefined for cache miss', () => {
    const cache = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 5 });
    expect(cache.get('unknown')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new CacheManager<string>(TEST_DIR, { ttlMs: 150, maxSize: 5 });
    cache.set('q1', 'answer-1');
    expect(cache.get('q1')).toBe('answer-1');
    // wait for expiry
    const start = Date.now();
    while (Date.now() - start < 300) { /* busy wait */ }
    expect(cache.get('q1')).toBeUndefined();
  });

  it('evicts LRU when max size reached', () => {
    const cache = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 3 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a'); // hit on a
    cache.set('d', '4'); // evicts b (LRU)
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('persists across instances', () => {
    const cache1 = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 5 });
    cache1.set('persist', 'value');
    const cache2 = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 5 });
    expect(cache2.get('persist')).toBe('value');
  });

  it('tracks size correctly', () => {
    const cache = new CacheManager<string>(TEST_DIR, { ttlMs: 10000, maxSize: 5 });
    expect(cache.size()).toBe(0);
    cache.set('x', '1');
    expect(cache.size()).toBe(1);
    cache.del('x');
    expect(cache.size()).toBe(0);
  });
});
