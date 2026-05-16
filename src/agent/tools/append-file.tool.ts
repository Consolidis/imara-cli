import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

/**
 * Append content to an existing file (or create it if it doesn't exist).
 * Used by the agent to write large files in sections without truncation.
 */
export class AppendFileTool {
  static definition: ToolDefinition = {
    name: 'append_file',
    description: 'Ajoute du contenu à la fin d\'un fichier. Utiliser en combinaison avec write_file pour construire de gros fichiers section par section.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à compléter' },
        content: { type: 'string', description: 'Le contenu à ajouter à la fin du fichier. MAX 50 LIGNES STRICTEMENT.' }
      },
      required: ['path', 'content']
    }
  };

  static async run(args: { path: string, content: string }) {
    const fullPath = path.resolve(process.cwd(), args.path);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }

    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Ce fichier est protégé et ne peut pas être modifié.');
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Normalize escape sequences (same logic as write_file)
    const normalizedContent = normalizeEscapes(args.content);

    fs.appendFileSync(fullPath, normalizedContent, 'utf-8');

    const totalLines = fs.readFileSync(fullPath, 'utf-8').split('\n').length;
    return `Contenu ajouté à ${args.path}. Total : ${totalLines} lignes.`;
  }
}

function normalizeEscapes(content: string): string {
  const realNewlines = (content.match(/\n/g) || []).length;
  const literalNewlines = (content.match(/\\n/g) || []).length;

  if (literalNewlines > 0 && literalNewlines > realNewlines * 2) {
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }

  return content;
}
