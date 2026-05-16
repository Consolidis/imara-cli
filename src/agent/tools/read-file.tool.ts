import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class ReadFileTool {
  static definition: ToolDefinition = {
    name: 'read_file',
    description: 'Lit le contenu d\'un fichier spécifié.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à lire' }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string }) {
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

    const stats = fs.statSync(fullPath);
    if (stats.size > 500000) { // 500KB limit
      throw new Error('Fichier trop volumineux. Utilisez search_files pour extraire des informations spécifiques.');
    }

    return fs.readFileSync(fullPath, 'utf-8');
  }
}
