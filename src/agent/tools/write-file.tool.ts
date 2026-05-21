import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import { showDiff } from '../../ui/diff-renderer';

export class WriteFileTool {
  static definition: ToolDefinition = {
    name: 'write_file',
    description: 'Créer un nouveau fichier ou écraser un fichier existant. Pour les très gros fichiers (>150 lignes), découper en sections avec append_file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier' },
        content: { type: 'string', description: 'Le contenu à écrire. Pour les fichiers volumineux, préférer write_file + append_file par sections (~150 lignes).' }
      },
      required: ['path', 'content']
    }
  };

  static async run(args: { path: string, content: string }): Promise<string> {
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

    let oldContent = '';
    if (fs.existsSync(fullPath)) {
      oldContent = fs.readFileSync(fullPath, 'utf-8');
    }

    // Normalize escape sequences: the AI sometimes sends literal \n, \t, \r
    // as double-backslash sequences that were not unescaped during JSON parsing.
    const normalizedContent = normalizeEscapes(args.content);

    // Always show diff in the console for user visibility
    showDiff(args.path, oldContent, normalizedContent);

    fs.writeFileSync(fullPath, normalizedContent, 'utf-8');
    return `Fichier ${args.path} écrit avec succès (${normalizedContent.split('\n').length} lignes).`;
  }
}

/**
 * Normalizes escape sequences in content strings.
 * Handles cases where the AI sends literal backslash-n sequences
 * (e.g., "line1\\nline2") instead of actual newlines ("line1\nline2").
 * Only normalizes if the content contains literal \\n patterns (not real newlines).
 */
function normalizeEscapes(content: string): string {
  // Heuristic: if content has literal "\\n" patterns but very few real newlines,
  // it's likely that the escape sequences weren't unescaped during transmission.
  const realNewlines = (content.match(/\n/g) || []).length;
  const literalNewlines = (content.match(/\\n/g) || []).length;

  if (literalNewlines > 0 && literalNewlines > realNewlines * 2) {
    // Content is likely using escaped sequences — unescape them
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }

  return content;
}

