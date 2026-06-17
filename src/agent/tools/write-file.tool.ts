import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import { showDiff } from '../../ui/diff-renderer';

export class WriteFileTool {
  static MAX_LINES = 200;
  static HARD_LIMIT = 1000;

  static definition: ToolDefinition = {
    name: 'write_file',
    description: 'Creer un nouveau fichier ou ecraser un fichier existant. ' +
      'Pour les gros fichiers (>200 lignes), ecrire les premieres 200 lignes, puis utiliser append_file par sections de ~150 lignes.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier' },
        content: { type: 'string', description: 'Le contenu a ecrire. Maximum 200 lignes recommandé, 1000 lignes max absolu.' }
      },
      required: ['path', 'content']
    }
  };

  static async run(args: { path: string, content: string }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    if (!isInsideCwd(fullPath)) {
      throw new Error('Securite: Acces refuse en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Securite: Ce fichier est protege et ne peut pas etre modifie.');
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Normalize escape sequences: handle literal \n from AI responses
    const normalizedContent = normalizeEscapes(args.content);
    const lineCount = normalizedContent.split('\n').length;

    // Barriere dure : refuse les contenus > 1000 lignes (protection anti-latence)
    if (lineCount > WriteFileTool.HARD_LIMIT) {
      throw new Error(
        'BLOCAGE SECURITE: Contenu trop volumineux (' + lineCount + ' lignes > ' + WriteFileTool.HARD_LIMIT + '). ' +
        'Ecrivez les premieres ' + WriteFileTool.MAX_LINES + ' lignes avec write_file, ' +
        'puis utilisez append_file par sections de ~150 lignes.'
      );
    }

    let oldContent = '';
    if (fs.existsSync(fullPath)) {
      oldContent = fs.readFileSync(fullPath, 'utf-8');
    }

    showDiff(args.path, oldContent, normalizedContent);
    fs.writeFileSync(fullPath, normalizedContent, 'utf-8');

    let response = 'Fichier ' + args.path + ' ecrit avec succes (' + lineCount + ' lignes).';

    // Avertissement si > 200 lignes
    if (lineCount > WriteFileTool.MAX_LINES) {
      response += '\n\nATTENTION: Le fichier contient ' + lineCount + ' lignes (seuil ' + WriteFileTool.MAX_LINES + ' depasse). ' +
        'Pour eviter la latence reseau, utilisez append_file par sections de ~150 lignes pour la suite.';
    }

    return response;
  }
}

/**
 * Normalizes escape sequences in content strings.
 * Handles cases where the AI sends literal backslash-n sequences
 * (e.g., "line1\\nline2") instead of actual newlines ("line1\nline2").
 */
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
