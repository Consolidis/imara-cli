import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer } from '../../indexer/project-indexer';
import { ToolDefinition } from '../agent.types';

export class WorkspaceIndexTool {
  static definition: ToolDefinition = {
    name: 'workspace_index',
    description: 'Recherche instantanément des symboles (classes, fonctions, interfaces) ou des fichiers dans l\'index du projet pour éviter d\'explorer les dossiers.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Le terme ou symbole à rechercher (ex: "ContextWindow")' },
        symbolOnly: { type: 'boolean', description: 'Si vrai, limite la recherche aux symboles exportés uniquement', default: false }
      },
      required: ['query']
    }
  };

  static async run(args: { query: string; symbolOnly?: boolean }): Promise<string> {
    const symbolOnly = !!args.symbolOnly;
    const indexDir = path.join(process.cwd(), '.imara');
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }

    const indexPath = path.join(indexDir, 'index-cache.json');
    const indexer = new ProjectIndexer(indexPath);

    // Scan workspace root recursively (using standard ProjectIndexer exclusions)
    indexer.scan(process.cwd(), ['']);

    const results = indexer.search(args.query, symbolOnly);
    if (results.length === 0) {
      return `Aucun résultat trouvé pour "${args.query}" (symbolOnly: ${symbolOnly}).`;
    }

    // Format output
    let output = `--- Workspace Index Results for "${args.query}" ---\n`;
    results.forEach((r, idx) => {
      const typeStr = r.type ? ` [${r.type}]` : '';
      const symStr = r.symbol ? ` -> ${r.symbol}${typeStr}` : '';
      output += `${idx + 1}. ${r.path}:${r.line}${symStr} (score: ${r.score})\n`;
    });
    output += `--- End of Results ---`;

    return output;
  }
}
