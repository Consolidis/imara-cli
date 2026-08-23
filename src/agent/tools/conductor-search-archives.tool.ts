import { ToolDefinition } from '../agent.types';
import { searchConductorArchives, formatConductorSearchResults } from '../../utils/conductor-search';

interface SearchArchivesArgs {
  query: string;
  max_results?: number;
}

export class ConductorSearchArchivesTool {
  static definition: ToolDefinition = {
    name: 'conductor_search_archives',
    description: 'Recherche dans les archives et tracks Conductor pour verifier si une tache similaire a deja ete traitee. A utiliser AVANT de creer un nouveau track ou de traiter une tache complexe.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Le sujet a rechercher (ex: "accent", "cors", "paiement")' },
        max_results: { type: 'number', description: 'Nombre maximum de tracks retournes (defaut 5)', default: 5 }
      },
      required: ['query']
    }
  };

  static async run(args: SearchArchivesArgs): Promise<string> {
    const query = (args.query || '').trim();
    if (!query) throw new Error('Le parametre query est requis.');
    const maxResults = args.max_results || 5;
    const hits = searchConductorArchives(query, maxResults);
    return formatConductorSearchResults(query, hits);
  }
}
