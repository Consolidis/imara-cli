import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

export class InspectFileTool {
  static definition: ToolDefinition = {
    name: 'inspect_file',
    description: 'Inspecte un fichier pour obtenir ses métadonnées (nombre de lignes, taille) et optionnellement chercher un terme pour localiser ses numéros de ligne précis.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin relatif du fichier à inspecter' },
        query: { type: 'string', description: 'Terme de recherche optionnel (sensible à la casse) pour localiser des fonctions, variables ou chaînes' }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string, query?: string }): Promise<string> {
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

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      throw new Error(`Erreur: ${args.path} est un dossier. Utilisez list_directory.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const lineCount = lines.length;
    const sizeBytes = stats.size;

    let response = `=== Inspection de ${args.path} ===\n`;
    response += `Taille : ${(sizeBytes / 1024).toFixed(2)} KB (${sizeBytes} octets)\n`;
    response += `Lignes : ${lineCount} lignes\n`;

    if (args.query) {
      const q = args.query.trim();
      response += `\n--- Recherche de "${q}" ---\n`;
      let matchCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(q)) {
          matchCount++;
          if (matchCount > 50) {
            response += `... (plus de 50 correspondances trouvées, affichage limité) ...\n`;
            break;
          }
          response += `Ligne ${i + 1} : ${line.trim()}\n`;
        }
      }

      if (matchCount === 0) {
        response += `Aucune correspondance trouvée.\n`;
      } else if (matchCount <= 50) {
        response += `Total : ${matchCount} correspondance(s) trouvée(s).\n`;
      }
    }

    response += `=== Fin d'inspection ===`;
    return response;
  }
}
