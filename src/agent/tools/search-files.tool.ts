import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { isInsideCwd } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class SearchFilesTool {
  static definition: ToolDefinition = {
    name: 'search_files',
    description: 'Recherche un pattern dans les fichiers du projet.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Le texte ou regex à chercher' },
        filePattern: { type: 'string', description: 'Glob pattern pour filtrer les fichiers (ex: src/**/*.ts)' }
      },
      required: ['pattern']
    }
  };

  static async run(args: { pattern: string, filePattern?: string }): Promise<string> {
    const globPattern = args.filePattern || '**/*';
    const files = await fg(globPattern, {
      cwd: process.cwd(),
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      absolute: true
    });

    const results: string[] = [];
    const searchRegex = new RegExp(args.pattern, 'i');

    for (const file of files) {
      if (!isInsideCwd(file)) continue;

      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (searchRegex.test(line)) {
            const relativePath = path.relative(process.cwd(), file);
            results.push(`${relativePath}:${index + 1}: ${line.trim().substring(0, 100)}`);
          }
        });

        if (results.length > 50) break; // Cap results
      } catch {
        // Skip files that can't be read (binary, etc.)
      }
    }

    return results.length > 0 ? results.join('\n') : 'Aucun résultat trouvé.';
  }
}
