import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import { showDiff } from '../../ui/diff-renderer';

export class ReplaceInFileTool {
  static definition: ToolDefinition = {
    name: 'replace_in_file',
    description: 'Recherche et remplace un bloc de texte précis dans un fichier existant. Idéal pour modifier un gros fichier sans avoir à tout réécrire.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à modifier' },
        old_text: { type: 'string', description: 'Le texte exact à rechercher et remplacer (doit correspondre parfaitement, espaces compris)' },
        new_text: { type: 'string', description: 'Le nouveau texte qui viendra remplacer l\'ancien' }
      },
      required: ['path', 'old_text', 'new_text']
    }
  };

  static async run(args: { path: string, old_text: string, new_text: string }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Modification de fichiers protégés interdite.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Le fichier n'existe pas: ${args.path}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Normaliser les retours à la ligne pour faciliter la correspondance
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedOldText = args.old_text.replace(/\r\n/g, '\n');

    if (!normalizedContent.includes(normalizedOldText)) {
      throw new Error(`Le texte exact "old_text" n'a pas été trouvé dans le fichier. Veuillez vérifier la correspondance exacte (espaces, retours à la ligne).`);
    }

    const newContent = normalizedContent.replace(normalizedOldText, args.new_text);
    fs.writeFileSync(fullPath, newContent, 'utf8');

    // Optionnel: afficher le diff dans l'UI du terminal
    showDiff(args.path, content, newContent);

    return `Fichier ${args.path} modifié avec succès. Le texte a été remplacé.`;
  }
}
