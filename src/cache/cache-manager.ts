import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { CacheEntry, CacheOptions, DEFAULT_CACHE_OPTIONS } from './cache-entry';

export class CacheManager<T> {
  private dir: string;
  private options: CacheOptions;
  private memoryMap: Map<string, CacheEntry<T>> = new Map();

  constructor(dir: string, options: Partial<CacheOptions> = {}) {
    this.dir = dir;
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.loadFromDisk();
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  private filePath(hash: string): string {
    return join(this.dir, `${hash}.json`);
  }

  private loadFromDisk(): void {
    if (!existsSync(this.dir)) return;
    const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.dir, file), 'utf-8');
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() < entry.expiresAt) {
          this.memoryMap.set(entry.key, entry);
        } else {
          unlinkSync(join(this.dir, file));
        }
      } catch {
        // skip corrupted entries
      }
    }
  }

  get(key: string): T | undefined {
    const entry = this.memoryMap.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.del(key);
      return undefined;
    }
    entry.hitCount++;
    this.memoryMap.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T): void {
    this.evictIfNeeded();
    const entry: CacheEntry<T> = {
      key,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.options.ttlMs,
      hitCount: 1,
    };
    this.memoryMap.set(key, entry);
    const hash = this.hashKey(key);
    writeFileSync(this.filePath(hash), JSON.stringify(entry), 'utf-8');
  }

  private evictIfNeeded(): void {
    if (this.memoryMap.size < this.options.maxSize) return;
    let lruKey: string | undefined;
    let lruHits = Infinity;
    for (const [k, v] of this.memoryMap.entries()) {
      if (v.hitCount < lruHits) {
        lruHits = v.hitCount;
        lruKey = k;
      }
    }
    if (lruKey) this.del(lruKey);
  }

  del(key: string): void {
    const entry = this.memoryMap.get(key);
    if (!entry) return;
    this.memoryMap.delete(key);
    const hash = this.hashKey(key);
    const path = this.filePath(hash);
    if (existsSync(path)) unlinkSync(path);
  }

  clear(): void {
    for (const key of this.memoryMap.keys()) {
      const hash = this.hashKey(key);
      const path = this.filePath(hash);
      if (existsSync(path)) unlinkSync(path);
    }
    this.memoryMap.clear();
  }

  size(): number {
    return this.memoryMap.size;
  }
}
