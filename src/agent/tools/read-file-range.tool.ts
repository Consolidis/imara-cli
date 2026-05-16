import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class ReadFileRangeTool {
  static definition: ToolDefinition = {
    name: 'read_file_range',
    description: 'Lit une portion spécifique d\'un fichier (plage de lignes). Utile pour les grands fichiers.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à lire' },
        start_line: { type: 'number', description: 'Le numéro de la ligne de début (inclusif, par défaut 1)' },
        end_line: { type: 'number', description: 'Le numéro de la ligne de fin (inclusif)' }
      },
      required: ['path', 'end_line']
    }
  };

  static async run(args: { path: string, start_line?: number, end_line: number }) {
    const fullPath = path.resolve(process.cwd(), args.path);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }

    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Ce fichier est protégé et ne peut pas être lu.');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouvé: ${args.path}`);
    }

    const start = args.start_line || 1;
    const end = args.end_line;

    if (start < 1) throw new Error('start_line doit être >= 1');
    if (end < start) throw new Error('end_line doit être >= start_line');
    
    // Safety limit to prevent context overflow (e.g., 1000 lines)
    if (end - start > 1000) {
      throw new Error('Plage trop grande (max 1000 lignes). Veuillez lire le fichier par morceaux plus petits.');
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    const slicedLines = lines.slice(start - 1, end);
    const result = slicedLines.join('\n');

    return `--- Lines ${start} to ${Math.min(end, lines.length)} of ${args.path} ---\n${result}\n--- End of range ---`;
  }
}
