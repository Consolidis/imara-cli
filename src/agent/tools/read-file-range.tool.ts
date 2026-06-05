import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class ReadFileRangeTool {
  static definition: ToolDefinition = {
    name: 'read_file_range',
    description: 'Lit une portion specifique d\'un fichier (plage de lignes). Utile pour les grands fichiers.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier a lire' },
        start_line: { type: 'number', description: 'Le numero de la ligne de debut (inclusif, par defaut 1)' },
        end_line: { type: 'number', description: 'Le numero de la ligne de fin (inclusif)' }
      },
      required: ['path', 'end_line']
    }
  };

  static async run(args: { path: string, start_line?: number, end_line: number }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    if (!isInsideCwd(fullPath)) {
      throw new Error('Securite: Acces refuse en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Securite: Ce fichier est protege et ne peut pas etre lu.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouve: ${args.path}`);
    }

    const start = args.start_line || 1;
    const end = args.end_line;
    if (start < 1) throw new Error('start_line doit etre >= 1');
    if (end < start) throw new Error('end_line doit etre >= start_line');

    // Safety limit to prevent context overflow
    if (end - start > 2000) {
      throw new Error('Plage trop grande (max 2000 lignes). Veuillez lire le fichier par morceaux plus petits.');
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Detection du type de line ending
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/[^\r]\n/g) || []).length + (content.startsWith('\n') ? 1 : 0);
    let lineEndingType = 'LF';
    if (crlfCount > 0 && lfCount > 0) {
      lineEndingType = 'MIXTE';
    } else if (crlfCount > 0) {
      lineEndingType = 'CRLF';
    }

    const slicedLines = lines.slice(start - 1, end);
    const result = slicedLines.join('\n');
    return `--- Lines ${start} to ${Math.min(end, lines.length)} of ${args.path} (line endings: ${lineEndingType}) ---\n${result}\n--- End of range ---`;
  }
}
