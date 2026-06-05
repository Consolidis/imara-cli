import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import { showDiff } from '../../ui/diff-renderer';

export class AtomicSectionReplaceTool {
  static definition: ToolDefinition = {
    name: 'atomic_section_replace',
    description: 'Remplace le contenu entre deux marqueurs dans un fichier, sans avoir a matcher le contenu intermediaire. Ideal pour les gros fichiers (JSX, config, etc.).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier a modifier' },
        start_marker: {
          type: 'string',
          description: 'Le texte marquant le debut de la section a remplacer (inclus). La section commence APRES ce marqueur sur la meme ligne ou a la ligne suivante.'
        },
        end_marker: {
          type: 'string',
          description: 'Le texte marquant la fin de la section a remplacer (inclus). La section s\'arrete AVANT ce marqueur.'
        },
        new_content: {
          type: 'string',
          description: 'Le nouveau contenu qui remplacera tout le texte entre start_marker et end_marker (les marqueurs sont preserves).'
        },
        inclusive: {
          type: 'boolean',
          description: 'Si true, remplace AUSSI les marqueurs eux-memes. Si false (defaut), preserve les marqueurs.',
          default: false
        }
      },
      required: ['path', 'start_marker', 'end_marker', 'new_content']
    }
  };

  static async run(args: {
    path: string;
    start_marker: string;
    end_marker: string;
    new_content: string;
    inclusive?: boolean;
  }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    const inclusive = !!args.inclusive;

    if (!isInsideCwd(fullPath)) {
      throw new Error('Securite: Acces refuse en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Securite: Fichier protege.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Le fichier n'existe pas: ${args.path}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedStart = args.start_marker.replace(/\r\n/g, '\n');
    const normalizedEnd = args.end_marker.replace(/\r\n/g, '\n');

    // 1. Trouver la position du start_marker
    const startIdx = normalizedContent.indexOf(normalizedStart);
    if (startIdx === -1) {
      throw new Error(`start_marker introuvable: "${args.start_marker}"`);
    }

    // 2. Trouver la position du end_marker APRES le start_marker
    const searchFrom = startIdx + normalizedStart.length;
    const endIdx = normalizedContent.indexOf(normalizedEnd, searchFrom);
    if (endIdx === -1) {
      throw new Error(`end_marker introuvable apres le start_marker: "${args.end_marker}"`);
    }

    // 3. Decouper le contenu en trois parties
    let beforeSection: string;
    let sectionContent: string;
    let afterSection: string;

    if (inclusive) {
      // Remplacer des marqueurs inclus : tout de start_marker a end_marker inclus
      beforeSection = normalizedContent.substring(0, startIdx);
      const endOfEndMarker = endIdx + normalizedEnd.length;
      sectionContent = normalizedContent.substring(startIdx, endOfEndMarker);
      afterSection = normalizedContent.substring(endOfEndMarker);
    } else {
      // Preserver les marqueurs : remplacer seulement ce qui est ENTRE start_marker et end_marker
      beforeSection = normalizedContent.substring(0, startIdx + normalizedStart.length);
      sectionContent = normalizedContent.substring(startIdx + normalizedStart.length, endIdx);
      afterSection = normalizedContent.substring(endIdx);
    }

    const newContent = args.new_content;
    const finalContent = beforeSection + newContent + afterSection;

    // 4. Afficher le diff
    showDiff(args.path, content, finalContent);

    // 5. Ecrire le fichier
    fs.writeFileSync(fullPath, finalContent, 'utf8');

    const startLine = normalizedContent.substring(0, startIdx).split('\n').length;
    const endLine = normalizedContent.substring(0, endIdx).split('\n').length;
    const oldLines = sectionContent.split('\n').length;
    const newLines = newContent.split('\n').length;

    return `Section remplacee avec succes dans ${args.path} (lignes ${startLine}-${endLine}, ${oldLines} lignes -> ${newLines} lignes).`;
  }
}
