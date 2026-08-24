import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeQuery, getCachedSearch, setCachedSearch, purgeSearchCache } from '../utils/search-cache';
import { getTavilyKey, searchTavily } from '../utils/tavily';
import { WebSearchTool } from '../agent/tools/web-search.tool';
import { ConfigManager } from '../config/config-manager';
import { Keychain } from '../auth/keychain';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('../auth/keychain', () => ({
  Keychain: {
    getTavilyKey: vi.fn(),
    saveTavilyKey: vi.fn(),
    deleteTavilyKey: vi.fn(),
  },
}));

describe('search-cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    purgeSearchCache();
  });

  describe('normalizeQuery', () => {
    it('minuscules, sans accents, sans ponctuation, espaces uniques', () => {
      expect(normalizeQuery('  Bonjour,  Monde!  ')).toBe('bonjour monde');
      expect(normalizeQuery('DÉJÀ-VU')).toBe('deja vu');
      expect(normalizeQuery('café crème')).toBe('cafe creme');
      expect(normalizeQuery('   ')).toBe('');
    });
  });

  describe('cache hit/miss/expiration', () => {
    it('set puis get retourne le resultat (hit)', () => {
      setCachedSearch('Quelle est la capitale du Japon ?', 'Tokyo');
      expect(getCachedSearch('quelle est la capitale du japon')).toBe('Tokyo');
    });

    it('miss si requete differente', () => {
      setCachedSearch('Paris', 'Ville lumière');
      expect(getCachedSearch('Londres')).toBeNull();
    });

    it('expiration apres 24h', () => {
      // Mock Date.now pour simuler le vieillissement
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      setCachedSearch('requete', 'resultat');
      vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60 * 1000); // +25h
      expect(getCachedSearch('requete')).toBeNull();
    });

    it('eviction FIFO a 200 entrees', () => {
      // Note : chaque set reecrit le fichier JSON complet ; sur Windows avec
      // antivirus, 210 writes peuvent depasser le timeout par defaut (5s).
      for (let i = 0; i < 210; i++) {
        setCachedSearch(`requete-${i}`, `resultat-${i}`);
      }
      // Les plus anciennes (0-9) doivent etre evincees
      expect(getCachedSearch('requete-0')).toBeNull();
      expect(getCachedSearch('requete-209')).toBe('resultat-209');
    }, 30000);

    it('fichier corrompu -> purge silencieuse', () => {
      // Ecrire un fichier JSON invalide
      const cachePath = path.join(homedir(), '.imara', 'search-cache.json');
      fs.writeFileSync(cachePath, '{corrompu!!!');
      expect(getCachedSearch('nimporte quoi')).toBeNull();
      // Apres lecture du fichier corrompu, un set doit re-creer un fichier sain
      setCachedSearch('ok', 'valeur');
      expect(getCachedSearch('ok')).toBe('valeur');
    });
  });
});

describe('tavily key resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TAVILY_API_KEY;
    ConfigManager.set({ tavilyApiKey: '' });
  });

  it('priorite env > config > keychain', async () => {
    // 1. env seulement
    process.env.TAVILY_API_KEY = 'cle-env';
    vi.mocked(Keychain.getTavilyKey).mockResolvedValue('cle-keychain');
    ConfigManager.set({ tavilyApiKey: 'cle-config' });
    expect(await getTavilyKey()).toBe('cle-env');

    // 2. sans env : config
    delete process.env.TAVILY_API_KEY;
    expect(await getTavilyKey()).toBe('cle-config');

    // 3. sans env ni config : keychain
    ConfigManager.set({ tavilyApiKey: '' });
    expect(await getTavilyKey()).toBe('cle-keychain');

    // 4. rien du tout : null
    vi.mocked(Keychain.getTavilyKey).mockResolvedValue(null);
    expect(await getTavilyKey()).toBeNull();
  });
});

describe('searchTavily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TAVILY_API_KEY;
    ConfigManager.set({ tavilyApiKey: '' });
    vi.mocked(Keychain.getTavilyKey).mockResolvedValue(null);
  });

  it('appelle l\'API Tavily et retourne answer + results', async () => {
    process.env.TAVILY_API_KEY = 'cle-test';
    const mockResponse = {
      answer: 'La capitale du Japon est Tokyo.',
      results: [
        { title: 'Tokyo — Wikipedia', url: 'https://fr.wikipedia.org/wiki/Tokyo', content: 'Tokyo est la capitale du Japon...' },
        { title: 'Japon — Wikipedia', url: 'https://fr.wikipedia.org/wiki/Japon', content: 'Le Japon est un pays...' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchTavily('capitale du japon', 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer cle-test');
    const body = JSON.parse(init.body);
    expect(body.query).toBe('capitale du japon');
    expect(body.include_answer).toBe(true);
    expect(result.answer).toBe('La capitale du Japon est Tokyo.');
    expect(result.results).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('erreur si aucune cle', async () => {
    await expect(searchTavily('test')).rejects.toThrow('Aucune cle API Tavily');
  });

  it('erreur 429 -> message quota', async () => {
    process.env.TAVILY_API_KEY = 'cle-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }));
    await expect(searchTavily('test')).rejects.toThrow('Quota Tavily depasse');
    vi.unstubAllGlobals();
  });
});

describe('WebSearchTool fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TAVILY_API_KEY;
    ConfigManager.set({ tavilyApiKey: '' });
    vi.mocked(Keychain.getTavilyKey).mockResolvedValue(null);
    purgeSearchCache();
  });

  it('sans cle : retourne un message d\'indisponibilite (pas de throw)', async () => {
    const result = await WebSearchTool.run({ query: 'meteo paris' });
    expect(result).toContain('indisponible');
    expect(result).toContain('Tavily');
  });

  it('quand Tavily echoue : fallback message indisponible', async () => {
    process.env.TAVILY_API_KEY = 'cle-test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }));
    const result = await WebSearchTool.run({ query: 'recherche qui echoue' });
    expect(result).toContain('indisponible');
    vi.unstubAllGlobals();
  });

  it('recherche reussie : resultat formatte puis cache (hit au second appel sans fetch)', async () => {
    process.env.TAVILY_API_KEY = 'cle-test';
    const mockResponse = {
      answer: 'Reponse directe.',
      results: [
        { title: 'Titre 1', url: 'https://exemple.com/1', content: 'Extrait 1...' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await WebSearchTool.run({ query: 'question cachee' });
    expect(first).toContain('Reponse directe');
    expect(first).toContain('Titre 1');

    // Second appel : cache hit, aucun nouvel appel fetch
    const second = await WebSearchTool.run({ query: 'question cachee' });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
