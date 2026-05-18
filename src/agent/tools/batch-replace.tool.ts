import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import { showDiff } from '../../ui/diff-renderer';

export class BatchReplaceTool {
  static definition: ToolDefinition = {
    name: 'batch_replace',
    description: 'Applique plusieurs remplacements textuels non contigus en un seul appel atomique avec vérification de cohérence et rollback.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à modifier' },
        replacements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              old_text: { type: 'string', description: 'Le texte exact à remplacer' },
              new_text: { type: 'string', description: 'Le nouveau texte de remplacement' }
            },
            required: ['old_text', 'new_text']
          },
          description: 'Liste des blocs à remplacer'
        },
        allowMultiple: {
          type: 'boolean',
          description: 'Si vrai, autorise le remplacement de toutes les occurrences pour chaque bloc',
          default: false
        }
      },
      required: ['path', 'replacements']
    }
  };

  static async run(args: {
    path: string;
    replacements: Array<{ old_text: string; new_text: string }>;
    allowMultiple?: boolean;
  }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    const allowMultiple = !!args.allowMultiple;

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
    const normalizedContent = content.replace(/\r\n/g, '\n');
    let workingContent = normalizedContent;

    // 1. Validation phase (Atomic Rollback Guard)
    for (const rep of args.replacements) {
      const normalizedOld = rep.old_text.replace(/\r\n/g, '\n');
      const occurrences = workingContent.split(normalizedOld).length - 1;

      if (occurrences === 0) {
        throw new Error(`Remplacement échoué: Le texte "${rep.old_text}" n'a pas été trouvé. Aucune modification n'a été appliquée.`);
      }

      if (occurrences > 1 && !allowMultiple) {
        throw new Error(`Remplacement échoué: Le texte "${rep.old_text}" apparaît plusieurs fois (${occurrences} fois). Activez allowMultiple pour autoriser les remplacements multiples.`);
      }
    }

    // 2. Execution phase (Apply all in memory)
    for (const rep of args.replacements) {
      const normalizedOld = rep.old_text.replace(/\r\n/g, '\n');
      const normalizedNew = rep.new_text.replace(/\r\n/g, '\n');

      if (allowMultiple) {
        workingContent = workingContent.split(normalizedOld).join(normalizedNew);
      } else {
        workingContent = workingContent.replace(normalizedOld, normalizedNew);
      }
    }

    fs.writeFileSync(fullPath, workingContent, 'utf8');

    // Render visual terminal diff
    showDiff(args.path, content, workingContent);

    return `Fichier ${args.path} modifié avec succès. ${args.replacements.length} blocs de texte ont été remplacés de façon atomique.`;
  }
}
