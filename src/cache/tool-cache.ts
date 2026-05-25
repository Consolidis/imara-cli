/**
 * ToolCache — Cache LRU avec TTL pour les résultats d'outils purs (lecture seule).
 * Invalidation par path pour les outils d'écriture.
 */

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class ToolCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 100, ttlMs = 30_000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /** Construit la clé de cache à partir du nom de l'outil et des arguments */
  makeKey(toolName: string, args: Record<string, unknown>): string {
    const path = args.path ?? args.paths ?? '';
    const normalized = typeof path === 'string' ? path : JSON.stringify(path);
    return `${toolName}:${normalized}`;
  }

  /** Récupère une entrée si elle existe et n'a pas expiré */
  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // LRU: déplacer la clé à la fin (plus récemment utilisée)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /** Stocke un résultat dans le cache */
  set(key: string, value: string): void {
    // Évincer la plus vieille entrée si on dépasse la taille max
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Invalide toutes les entrées contenant un chemin donné */
  invalidatePath(path: string): void {
    if (!path) return;
    const normalizedPath = path.replace(/\\/g, '/');
    for (const key of this.cache.keys()) {
      const [, keyPath] = key.split(':', 2);
      if (keyPath && keyPath.includes(normalizedPath)) {
        this.cache.delete(key);
      }
    }
  }

  /** Invalide tout le cache */
  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/** Instance singleton partagée par le ToolExecutor */
export const toolCache = new ToolCache();
