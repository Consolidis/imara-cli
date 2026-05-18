import * as fs from 'fs';
import * as path from 'path';
import * as diff from 'diff';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class DiffPreviewTool {
  static definition: ToolDefinition = {
    name: 'diff_preview',
    description: 'Calcule et retourne une prévisualisation de type Diff Git Unifié du fichier avant de l\'écrire définitivement.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à comparer' },
        proposed_content: { type: 'string', description: 'Le nouveau contenu proposé' }
      },
      required: ['path', 'proposed_content']
    }
  };

  static async run(args: { path: string; proposed_content: string }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Fichier protégé.');
    }

    const oldContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
    const newContent = args.proposed_content;

    const differences = diff.diffLines(oldContent, newContent);
    let diffOutput = `=== Diff Preview for ${args.path} ===\n`;

    differences.forEach((part) => {
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const lines = part.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (part.added || part.removed) {
        lines.forEach(l => {
          diffOutput += `${prefix}${l}\n`;
        });
      } else {
        if (lines.length > 6) {
          lines.slice(0, 3).forEach(l => {
            diffOutput += ` ${l}\n`;
          });
          diffOutput += `...\n`;
          lines.slice(-3).forEach(l => {
            diffOutput += ` ${l}\n`;
          });
        } else {
          lines.forEach(l => {
            diffOutput += ` ${l}\n`;
          });
        }
      }
    });

    diffOutput += `=== End of Diff ===`;
    return diffOutput;
  }
}
