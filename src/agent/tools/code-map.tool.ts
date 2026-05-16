import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class CodeMapTool {
  static definition: ToolDefinition = {
    name: 'code_map',
    description: 'Extrait la structure d\'un fichier (classes, fonctions, interfaces) sans le corps des fonctions. Utile pour comprendre un fichier rapidement sans consommer trop de tokens.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à analyser' }
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
      throw new Error('Sécurité: Ce fichier est protégé.');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouvé: ${args.path}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const map: string[] = [];

    // Simple RegEx patterns for common declarations in TS/JS/Python/etc.
    const patterns = [
      // Classes & Interfaces
      /^\s*(export\s+)?(class|interface|type|enum|trait|struct)\s+(\w+)/,
      // Functions (Standard)
      /^\s*(export\s+)?(async\s+)?function\s+(\w+)\s*\(.*\)/,
      // Arrow functions (assigned to const/let)
      /^\s*(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(.*\)\s*=>/,
      // Class Methods (simple check for "name(args) {")
      /^\s*(\w+)\s*\(.*\)\s*\{/,
      // Python def
      /^\s*def\s+(\w+)\s*\(.*\)\s*:/
    ];

    lines.forEach((line, index) => {
      if (patterns.some(p => p.test(line))) {
        map.push(`${index + 1}: ${line.trim()}`);
      }
    });

    if (map.length === 0) {
      return `Aucune structure détectée dans ${args.path} (ou format non supporté).`;
    }

    return `--- Code Map for ${args.path} ---\n${map.join('\n')}\n--- End of Map ---`;
  }
}
