import * as path from 'path';
import fg from 'fast-glob';
import { isInsideCwd } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class ListDirectoryTool {
  static definition: ToolDefinition = {
    name: 'list_directory',
    description: 'Liste les fichiers d\'un répertoire (récursif par défaut).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du répertoire (défaut: root)' },
        recursive: { type: 'boolean', description: 'Lister récursivement' }
      }
    }
  };

  static async run(args: { path?: string, recursive?: boolean }) {
    const relativePath = args.path || '.';
    const fullPath = path.resolve(process.cwd(), relativePath);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }

    const recursive = args.recursive !== false;
    const pattern = recursive ? '**/*' : '*';

    const entries = await fg(pattern, {
      cwd: fullPath,
      onlyFiles: false,
      markDirectories: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**', '**/__pycache__/**'],
      deep: recursive ? 5 : 1
    });

    return entries.join('\n');
  }
}
