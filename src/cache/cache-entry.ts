export interface CacheEntry<T> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

export interface CacheOptions {
  ttlMs: number;
  maxSize: number;
}

export const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  ttlMs: 24 * 60 * 60 * 1000,
  maxSize: 100,
};
