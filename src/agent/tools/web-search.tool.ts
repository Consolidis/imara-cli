import { ToolDefinition } from '../agent.types';

/**
 * Effectue une recherche web via DuckDuckGo (gratuit, sans cle API).
 * Fallback sur l'API Imara si DuckDuckGo est indisponible.
 */

// Definition du type pour les resultats duckduckgo-search
interface DuckDuckGoResult {
  title: string;
  description: string;
  url: string;
}

export class WebSearchTool {
  static definition: ToolDefinition = {
    name: 'web_search',
    description: 'Recherche des informations sur le web via DuckDuckGo (gratuit). En cas d\'echec, utilise le backend Imara comme fallback.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La requete de recherche' },
        max_results: { type: 'number', description: 'Nombre maximum de resultats a retourner (defaut: 5, max: 10)', default: 5 }
      },
      required: ['query']
    }
  };

  static async run(args: { query: string; max_results?: number }): Promise<string> {
    const query = args.query.trim();
    const maxResults = Math.min(args.max_results || 5, 10);
    if (!query) {
      throw new Error('La requete de recherche est vide.');
    }

    // Tentative 1 : DuckDuckGo (gratuit, aucune cle requise)
    const ddgErrorMsg: string[] = [];
    try {
      const results = await this.searchDuckDuckGo(query, maxResults);
      if (results.length > 0) {
        return this.formatResults(results, query, 'DuckDuckGo');
      } else {
        ddgErrorMsg.push('DuckDuckGo n\'a retourne aucun resultat');
      }
    } catch (ddgError) {
      const msg = ddgError instanceof Error ? ddgError.message : String(ddgError);
      ddgErrorMsg.push(`DuckDuckGo: ${msg.substring(0, 100)}`);
    }

    // Tentative 2 : Fallback via API Imara (backend) - tentative reelle
    try {
      const imaraUrl = process.env.IMARA_API_URL || 'https://api.imara.consolidis.com';
      const apiKey = process.env.IMARA_API_KEY;
      if (apiKey) {
        const response = await fetch(`${imaraUrl}/v1/agent/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, max_results: maxResults })
        });
        if (response.ok) {
          const data = await response.json() as { results?: Array<{title: string; description: string; url: string}> };
          if (data && Array.isArray(data.results) && data.results.length > 0) {
            return this.formatResults(data.results, query, 'Imara');
          }
        }
      }
    } catch (apiError) {
      const msg = apiError instanceof Error ? apiError.message : String(apiError);
      ddgErrorMsg.push(`Imara: ${msg.substring(0, 100)}`);
    }

    // Fallback total : retourner une erreur informative au lieu d'un message creux
    throw new Error(
      `Recherche web indisponible pour "${query}". ` +
      `Causes: ${ddgErrorMsg.join('; ')}. ` +
      `Verifiez votre connexion internet ou reessayez plus tard.`
    );
  }

  /**
   * Recherche via DuckDuckGo en utilisant l'import dynamique du package duckduckgo-search.
   */
  private static async searchDuckDuckGo(query: string, maxResults: number): Promise<DuckDuckGoResult[]> {
    // Import dynamique du package ESM-only
    const ddg: any = await import('duckduckgo-search');
    // Le package expose: search(query) -> AsyncIterable<{title, description, url}>
    const results: DuckDuckGoResult[] = [];
    if (typeof ddg.search === 'function') {
      // API moderne: search() retourne un AsyncGenerator
      let count = 0;
      for await (const result of ddg.search(query)) {
        if (count >= maxResults) break;
        if (result.title && result.url) {
          results.push({
            title: result.title || '',
            description: result.description || '',
            url: result.url || ''
          });
          count++;
        }
      }
    } else if (typeof ddg.default?.search === 'function') {
      let count = 0;
      for await (const result of ddg.default.search(query)) {
        if (count >= maxResults) break;
        if (result.title && result.url) {
          results.push({
            title: result.title || '',
            description: result.description || '',
            url: result.url || ''
          });
          count++;
        }
      }
    } else if (typeof ddg.text === 'function') {
      // API alternative: text() retourne un tableau
      const rawResults = await ddg.text(query);
      if (Array.isArray(rawResults)) {
        for (const r of rawResults.slice(0, maxResults)) {
          results.push({
            title: r.title || '',
            description: r.description || '',
            url: r.url || ''
          });
        }
      }
    } else {
      throw new Error('API duckduckgo-search non reconnue');
    }
    return results;
  }

  /**
   * Formate les resultats en texte lisible.
   */
  private static formatResults(results: DuckDuckGoResult[], query: string, source: string): string {
    let output = `Recherche web (${source}) pour: "${query}"\n`;
    output += `\n${results.length} resultat(s) trouve(s):\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      output += `${i + 1}. ${r.title}\n`;
      if (r.description) {
        output += `   ${r.description.substring(0, 200)}${r.description.length > 200 ? '...' : ''}\n`;
      }
      output += `   URL: ${r.url}\n`;
      if (i < results.length - 1) output += '\n';
    }
    return output;
  }
}
