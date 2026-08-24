import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';
import {
  MAX_DOCUMENT_SIZE,
  detectDocumentKind,
  extractDocumentText,
  formatBinaryRefusal,
  formatDocumentOutput,
  readFileHeader,
} from '../../utils/document-extractor';

const MAX_TEXT_SIZE = 1_500_000; // 1.5 Mo pour les fichiers texte

export class ReadFileTool {
  static definition: ToolDefinition = {
    name: 'read_file',
    description: 'Lit le contenu d\'un fichier spécifié. Supporte les fichiers texte (md, code, json...) ainsi que les documents PDF et Word (.docx) : le texte est extrait automatiquement.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à lire' }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Ce fichier est protégé et ne peut pas être lu.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouvé: ${args.path}`);
    }
    const stats = fs.statSync(fullPath);

    // Detection du type par magic bytes (en-tete seul, sans charger tout le fichier)
    const header = readFileHeader(fullPath, 512);
    const kind = detectDocumentKind(header, path.extname(fullPath));

    if (kind === 'pdf' || kind === 'docx') {
      if (stats.size > MAX_DOCUMENT_SIZE) {
        throw new Error(`Document trop volumineux (>25 Mo). Extraction impossible: ${args.path}`);
      }
      const buffer = fs.readFileSync(fullPath);
      const extracted = await extractDocumentText(fullPath, buffer);
      return formatDocumentOutput(extracted);
    }

    if (kind === 'doc' || kind === 'zip' || kind === 'binary') {
      return formatBinaryRefusal(kind, fullPath, stats.size);
    }

    // Chemin texte classique (md, code, json, txt, rtf...)
    if (stats.size > MAX_TEXT_SIZE) {
      throw new Error('Fichier trop volumineux (>1.5 Mo). Utilisez read_file_range ou code_map.');
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }
}
