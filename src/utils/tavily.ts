import { ConfigManager } from '../config/config-manager';
import { Keychain } from '../auth/keychain';

export interface TavilySearchResult {
  title: string;
  url: string;
  content?: string;
}

export interface TavilyResponse {
  answer?: string;
  results?: TavilySearchResult[];
}

const TAVILY_API_URL = 'https://api.tavily.com/search';
const JINA_READER_URL = 'https://r.jina.ai/';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PAGE_CHARS = 10000;

/**
 * Resout la cle API Tavily dans l'ordre de priorite :
 * 1. Variable d'environnement TAVILY_API_KEY
 * 2. Config CLI (~/.imara/config.json -> tavilyApiKey)
 * 3. Keychain systeme (compte "tavily-key")
 * Retourne null si aucune cle n'est trouvee.
 */
export async function getTavilyKey(): Promise<string | null> {
  // 1. Environnement (priorite la plus haute)
  const fromEnv = process.env.TAVILY_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  // 2. Config CLI — recharger depuis le disque à chaque appel pour voir les
  //    écritures externes (ex: `imara config set tavilyApiKey ...` lancé
  //    pendant la session). Sans refresh(), le cache mémoire statique de
  //    ConfigManager resterait figé et la clé serait invisible.
  try {
    ConfigManager.refresh();
    const fromConfig = ConfigManager.getRaw('tavilyApiKey')?.trim();
    if (fromConfig) return fromConfig;
  } catch {
    // config illisible : on continue vers le keychain
  }

  // 3. Keychain systeme (le plus bas)
  try {
    const fromKeychain = await Keychain.getTavilyKey();
    if (fromKeychain) return fromKeychain;
  } catch {
    // keychain indisponible : on retourne null
  }

  return null;
}

/**
 * Recherche via l'API Tavily (optimisee pour les agents IA).
 * Envoie la requete en POST avec include_answer pour obtenir
 * une reponse directe synthetisee + les sources.
 */
export async function searchTavily(
  query: string,
  maxResults: number = 5
): Promise<TavilyResponse> {
  const apiKey = await getTavilyKey();
  if (!apiKey) {
    throw new Error('Aucune cle API Tavily configuree. Utilisez `imara config set tavilyApiKey <cle>` ou la variable d\'environnement TAVILY_API_KEY.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Cle API Tavily invalide ou expiree. Verifiez `imara config set tavilyApiKey <cle>`.');
      }
      if (response.status === 429) {
        throw new Error('Quota Tavily depasse (rate limit). Reessayez plus tard.');
      }
      throw new Error(`Tavily a retourne une erreur (HTTP ${response.status}): ${errBody.substring(0, 200)}`);
    }

    const data = await response.json() as TavilyResponse;
    return {
      answer: data.answer,
      results: Array.isArray(data.results) ? data.results : [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extrait le contenu textuel d'une page web via Jina Reader
 * (https://r.jina.ai/<url>). Le contenu est tronque a 10000 caracteres
 * pour eviter de saturer le contexte de l'agent.
 */
export async function fetchWithJinaReader(url: string): Promise<string> {
  const jinaUrl = `${JINA_READER_URL}${url}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain, text/markdown, text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; Imara-CLI/2.0; +https://imara.consolidis.com)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Jina Reader a retourne une erreur (HTTP ${response.status})`);
    }

    let content = await response.text();
    if (content.length > MAX_PAGE_CHARS) {
      content = content.substring(0, MAX_PAGE_CHARS) + '\n\n[... Contenu tronque a 10000 caracteres. Lisez la page originale pour la suite.]';
    }
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}
