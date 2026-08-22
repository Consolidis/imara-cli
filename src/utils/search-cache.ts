import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.imara');
const CACHE_PATH = join(CACHE_DIR, 'search-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  /** Requete normalisee (cle) */
  query: string;
  /** Resultat formate (texte retourne a l'agent) */
  result: string;
  /** Timestamp de creation (ms epoch) */
  timestamp: number;
}

interface CacheFile {
  entries: CacheEntry[];
}

/** Normalise une requete : minuscules, sans accents, ponctuation remplacee par espace, espaces multiples -> un seul. */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Suppression des accents
    .replace(/[^a-z0-9\s]/g, ' ') // Ponctuation -> espace (mieux que suppression pour matcher)
    .replace(/\s+/g, ' ') // Espaces multiples -> un seul
    .trim(); // Espace final eventuel
}

/** Lit le fichier de cache. Retourne [] si absent ou corrompu. */
function readCacheFile(): CacheEntry[] {
  if (!existsSync(CACHE_PATH)) return [];
  try {
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    const data = JSON.parse(raw) as CacheFile;
    if (!data || !Array.isArray(data.entries)) return [];
    return data.entries.filter(
      (e) => e && typeof e.query === 'string' && typeof e.result === 'string' && typeof e.timestamp === 'number'
    );
  } catch {
    // Fichier corrompu : purge silencieuse
    return [];
  }
}

/** Ecrit le fichier de cache. En cas d'echec, ignore silencieusement (le cache est best-effort). */
function writeCacheFile(entries: CacheEntry[]): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    const data: CacheFile = { entries };
    writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Echec d'ecriture silencieux : le cache est optionnel
  }
}

/**
 * Retourne le resultat en cache pour une requete si elle est encore fraiche
 * (moins de 24h). Sinon retourne null.
 */
export function getCachedSearch(query: string): string | null {
  const normalized = normalizeQuery(query);
  const entries = readCacheFile();
  const now = Date.now();
  const entry = entries.find((e) => e.query === normalized);
  if (!entry) return null;
  if (now - entry.timestamp > CACHE_TTL_MS) return null;
  return entry.result;
}

/**
 * Enregistre le resultat d'une recherche dans le cache.
 * Limite a 200 entrees avec eviction FIFO (les plus anciennes sortent d'abord).
 */
export function setCachedSearch(query: string, result: string): void {
  const normalized = normalizeQuery(query);
  const entries = readCacheFile();

  // Supprime une eventuelle entree existante pour la meme requete (mise a jour)
  const filtered = entries.filter((e) => e.query !== normalized);

  const newEntry: CacheEntry = {
    query: normalized,
    result,
    timestamp: Date.now(),
  };

  const updated = [newEntry, ...filtered];

  // Eviction FIFO si depassement de la limite
  if (updated.length > CACHE_MAX_ENTRIES) {
    updated.length = CACHE_MAX_ENTRIES;
  }

  writeCacheFile(updated);
}

/** Purge complete du cache (supprime le fichier). */
export function purgeSearchCache(): void {
  writeCacheFile([]);
}
