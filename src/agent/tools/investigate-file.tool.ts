import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

// Types internes pour le rapport d'investigation
interface InvestigationReport {
  header: string;
  toc: string;
  content: string;
  notes: string;
}

type Strategy = 'auto' | 'overview' | 'targeted' | 'deep';

interface InvestigateArgs {
  path: string;
  strategy?: Strategy;
  query?: string;
  sections?: string[];
  max_lines?: number;
}

export class InvestigateFileTool {
  static definition: ToolDefinition = {
    name: 'investigate_file',
    description: 'Explore un fichier de maniere intelligente et progressive pour economiser des tokens. ' +
      'Detecte automatiquement la taille du fichier et applique la strategie adaptative : ' +
      '- Fichiers < 100 lignes : lecture complete. ' +
      '- 100-300 lignes : resume intelligent (smart_read). ' +
      '- 300-1000 lignes : outline + code_map + sections cles. ' +
      '- > 1000 lignes : outline uniquement, ciblage obligatoire. ' +
      '- > 5000 lignes : refuse et oriente vers search_files. ' +
      'Utilisez les parametres query et sections pour cibler le contenu pertinent.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier a investiguer' },
        strategy: {
          type: 'string',
          enum: ['auto', 'overview', 'targeted', 'deep'],
          description: "Strategie d'investigation : auto (defaut), overview (vue d'ensemble), targeted (ciblage par query/sections), deep (lecture approfondie jusqu'a max_lines)",
          default: 'auto'
        },
        query: { type: 'string', description: 'Terme de recherche pour cibler les zones pertinentes du fichier' },
        sections: {
          type: 'array',
          items: { type: 'string' },
          description: "Noms des fonctions/classes/sections a lire en detail (ex: ['ClassA', 'maFonction'])"
        },
        max_lines: {
          type: 'number',
          description: 'Nombre maximum de lignes a retourner (defaut: 200)',
          default: 200
        }
      },
      required: ['path']
    }
  };

  static async run(args: InvestigateArgs): Promise<string> {
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

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      throw new Error(`Erreur: ${args.path} est un dossier. Utilisez list_directory.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const lineCount = lines.length;
    const sizeKB = (stats.size / 1024).toFixed(2);

    // Detection du type de line ending
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/[^\r]\n/g) || []).length + (content.startsWith('\n') ? 1 : 0);
    let lineEndingType = 'LF';
    if (crlfCount > 0 && lfCount > 0) {
      lineEndingType = 'MIXTE (CRLF + LF)';
    } else if (crlfCount > 0) {
      lineEndingType = 'CRLF';
    }

    const ext = path.extname(fullPath).toLowerCase();
    const maxLines = args.max_lines || 200;
    const strategy = args.strategy || 'auto';

    // Barriere > 5000 lignes
    if (lineCount > 5000) {
      return this.buildRefusalReport(args.path, lineCount, sizeKB, lineEndingType, ext);
    }

    // Determination de la strategie effective selon la taille
    const effectiveStrategy = this.resolveStrategy(strategy, lineCount);

    // Construction du rapport
    const report = await this.buildReport(args.path, fullPath, lines, lineCount, sizeKB, lineEndingType, ext, effectiveStrategy, args.query, args.sections, maxLines);
    return this.formatReport(report);
  }

  /**
   * Resout la strategie effective en fonction de la taille du fichier et du choix utilisateur.
   */
  private static resolveStrategy(strategy: Strategy, lineCount: number): Strategy {
    if (strategy !== 'auto') return strategy;
    if (lineCount < 100) return 'deep';
    if (lineCount <= 300) return 'overview';
    if (lineCount <= 1000) return 'targeted';
    return 'overview';
  }

  /**
   * Construit un rapport de refus pour les fichiers > 5000 lignes.
   */
  private static buildRefusalReport(filePath: string, lineCount: number, sizeKB: string, lineEnding: string, ext: string): string {
    let report = '=== RAPPORT D\'INVESTIGATION (REFUSE) ===\n';
    report += `Fichier : ${filePath}\n`;
    report += `Taille : ${sizeKB} KB\n`;
    report += `Lignes : ${lineCount} lignes\n`;
    report += `Extension : ${ext}\n`;
    report += `Line endings : ${lineEnding}\n\n`;
    report += '--- NOTES ---\n';
    report += `Fichier trop volumineux (${lineCount} lignes > 5000). `;
    report += "Pour explorer ce fichier, utilisez search_files avec un pattern cible, ";
    report += "ou investigate_file avec query et sections pour cibler des zones precises.\n";
    return report;
  }

  /**
   * Construit le rapport d'investigation complet.
   */
  private static async buildReport(
    filePath: string,
    fullPath: string,
    lines: string[],
    lineCount: number,
    sizeKB: string,
    lineEnding: string,
    ext: string,
    strategy: Strategy,
    query?: string,
    sections?: string[],
    maxLines?: number
  ): Promise<InvestigationReport> {
    // HEADER: metadonnees
    const header = this.buildHeader(filePath, lineCount, sizeKB, lineEnding, ext, strategy);

    // TOC & CONTENT selon la strategie
    let toc = '';
    let content = '';
    let notes = '';

    if (strategy === 'deep' && lineCount <= 100) {
      // Lecture complete : delegue a read_file
      content = lines.join('\n');
      toc = '(Fichier court : lecture complete)';
      notes = `Fichier entier lu (${lineCount} lignes).`;
    } else if (strategy === 'overview' || (strategy === 'targeted' && !query && !sections)) {
      // Vue d'ensemble : outline + code_map
      const codeMap = await this.getCodeMap(fullPath, lines);
      toc = codeMap.toc;
      content = codeMap.summary;
      if (lineCount > 300) {
        notes = `Fichier de ${lineCount} lignes. Utilisez query=... ou sections=[...] pour cibler le contenu.`;
      } else {
        notes = `Vue d'ensemble : ${codeMap.functionCount} bloc(s) identifie(s).`;
      }
    } else if (strategy === 'targeted' && (query || sections)) {
      // Ciblage par query et/ou sections
      const codeMap = await this.getCodeMap(fullPath, lines);
      toc = codeMap.toc;
      let targetedContent = '';

      if (query) {
        targetedContent += await this.searchAndRead(lines, query, fullPath, maxLines || 200);
      }

      if (sections && sections.length > 0) {
        const sectionContent = await this.readSections(lines, sections, fullPath, maxLines || 200);
        if (targetedContent) targetedContent += '\n\n';
        targetedContent += sectionContent;
      }

      content = targetedContent || '(Aucun contenu cible trouve)';
      notes = `Recherche ciblee${query ? ' (query: "' + query + '")' : ''}${sections ? ' (sections: ' + sections.join(', ') + ')' : ''}.`;
    } else if (strategy === 'deep') {
      // Lecture approfondie : jusqu'a maxLines lignes
      const codeMap = await this.getCodeMap(fullPath, lines);
      toc = codeMap.toc;
      const linesToRead = Math.min(lineCount, maxLines || 200);
      content = lines.slice(0, linesToRead).join('\n');
      let truncated = '';
      if (linesToRead < lineCount) {
        truncated = ` (tronque de ${lineCount - linesToRead} lignes)`;
      }
      notes = `Lecture approfondie : ${linesToRead} lignes affichees${truncated}.`;
    }

    return { header, toc, content, notes };
  }

  /**
   * Construit le header du rapport.
   */
  private static buildHeader(filePath: string, lineCount: number, sizeKB: string, lineEnding: string, ext: string, strategy: string): string {
    let h = '=== RAPPORT D\'INVESTIGATION ===\n';
    h += `Fichier : ${filePath}\n`;
    h += `Taille : ${sizeKB} KB\n`;
    h += `Lignes : ${lineCount}\n`;
    h += `Extension : ${ext}\n`;
    h += `Line endings : ${lineEnding}\n`;
    h += `Strategie : ${strategy}\n`;
    return h;
  }

  /**
   * Formate le rapport final.
   */
  private static formatReport(report: InvestigationReport): string {
    let output = '';
    output += report.header;
    output += '\n--- STRUCTURE (TOC) ---\n';
    output += report.toc;
    output += '\n\n--- CONTENU ---\n';
    output += report.content;
    output += '\n\n--- NOTES ---\n';
    output += report.notes;
    return output;
  }

  /**
   * Analyse la structure du fichier et retourne un TOC + un resume.
   */
  private static getCodeMap(fullPath: string, lines: string[]): { toc: string; summary: string; functionCount: number } {
    const tocLines: string[] = [];
    let functionCount = 0;

    // Patterns pour detecter les declarations
    const patterns = [
      /^\s*(export\s+)?(class|interface|type|enum|trait|struct)\s+(\w+)/,
      /^\s*(export\s+)?(async\s+)?function\s+(\w+)\s*\(.*\)/,
      /^\s*(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(.*\)\s*=>/,
      /^\s*(\w+)\s*\(.*\)\s*\{/,
      /^\s*def\s+(\w+)\s*\(.*\)\s*:/,
      /^\s*(public|private|protected|static|async)\s+\w+\s*\(/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of patterns) {
        const m = line.match(p);
        if (m) {
          functionCount++;
          // Extraire le nom significatif pour affichage
          const name = m[3] || m[1] || m[0].trim();
          tocLines.push(`  L${i + 1}: ${line.trim().substring(0, 100)}`);
          break;
        }
      }
    }

    // Generer un resume : import + signatures
    const summaryLines: string[] = [];
    const imports = lines.filter(l => l.trim().startsWith('import '));
    if (imports.length > 0) {
      summaryLines.push('// Imports:');
      imports.slice(0, 10).forEach(l => summaryLines.push(l));
      if (imports.length > 10) {
        summaryLines.push(`// ... (${imports.length - 10} imports supplementaires)`);
      }
      summaryLines.push('');
    }

    // Afficher les signatures des fonctions/classes (5 premieres lignes de chaque bloc)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isDeclaration = patterns.some(p => p.test(line));
      if (isDeclaration) {
        // Signature + 5 premieres lignes du corps
        summaryLines.push(line);
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine.trim() === '' || nextLine.trim().startsWith('import ')) break;
          summaryLines.push(nextLine);
        }
        summaryLines.push('');
      }
    }

    if (tocLines.length === 0) {
      tocLines.push('  Aucune structure significative detectee.');
    }

    return {
      toc: tocLines.join('\n'),
      summary: summaryLines.join('\n') || '(Contenu non structure)',
      functionCount
    };
  }

  /**
   * Recherche un terme dans le fichier et lit les plages pertinentes.
   */
  private static async searchAndRead(lines: string[], query: string, fullPath: string, maxLines: number): Promise<string> {
    const matches: { line: number; text: string }[] = [];
    const q = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ line: i + 1, text: lines[i].trim().substring(0, 120) });
      }
    }

    if (matches.length === 0) {
      return `[Recherche "${query}": aucune correspondance]`;
    }

    // Lire les plages autour des matchs (contexte de 5 lignes avant/apres)
    const readRanges: { start: number; end: number }[] = [];
    const contextLines = 5;

    let result = `--- Recherche de "${query}" : ${matches.length} correspondance(s) ---\n`;

    for (const match of matches) {
      const start = Math.max(0, match.line - 1 - contextLines);
      const end = Math.min(lines.length, match.line - 1 + contextLines);

      // Fusionner les plages qui se chevauchent
      const lastRange = readRanges[readRanges.length - 1];
      if (lastRange && start <= lastRange.end + 1) {
        lastRange.end = end;
      } else {
        readRanges.push({ start, end });
      }
    }

    // Limiter le nombre total de lignes lues
    let totalLinesRead = 0;
    for (const range of readRanges) {
      const rangeSize = range.end - range.start;
      if (totalLinesRead + rangeSize > maxLines) {
        const allowed = maxLines - totalLinesRead;
        if (allowed > 0) {
          range.end = range.start + allowed;
        } else {
          break;
        }
      }
      totalLinesRead += range.end - range.start;
    }

    for (const range of readRanges) {
      if (range.end <= range.start) continue;
      result += `\n--- Lignes ${range.start + 1}-${range.end} ---\n`;
      for (let i = range.start; i < range.end && i < lines.length; i++) {
        const marker = matches.some(m => m.line === i + 1) ? ' >>' : '   ';
        result += `${marker} ${lines[i]}\n`;
      }
    }

    if (totalLinesRead < matches.length * (contextLines * 2 + 1)) {
      result += `\n[Limite de ${maxLines} lignes atteinte. ${matches.length} correspondances trouvees, ${totalLinesRead} lignes lues.]\n`;
    }

    return result;
  }

  /**
   * Lit des sections specifiques du fichier (par nom de fonction/classe).
   */
  private static async readSections(lines: string[], sections: string[], fullPath: string, maxLines: number): Promise<string> {
    const results: string[] = [];
    let remainingLines = maxLines;

    for (const sectionName of sections) {
      if (remainingLines <= 0) break;

      // Chercher la declaration de la section
      let foundLine = -1;
      const lowerName = sectionName.toLowerCase();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes(lowerName)) {
          // Verifier que c'est bien une declaration (class, function, interface, etc.)
          const pattern = new RegExp(
            `(class|interface|type|enum|function|const|let|var|def)\\s+${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
          );
          if (pattern.test(lines[i])) {
            foundLine = i;
            break;
          }
        }
      }

      if (foundLine === -1) {
        results.push(`[Section "${sectionName}" non trouvee]`);
        continue;
      }

      // Trouver la fin du bloc en comptant les accolades ou l'indentation
      const isPythonLike = lines[foundLine].trim().endsWith(':');
      let endLine = foundLine + 1;

      if (isPythonLike) {
        // Indentation-based (Python)
        const baseIndent = lines[foundLine].match(/^\s*/)?.[0].length || 0;
        for (let i = foundLine + 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const indent = lines[i].match(/^\s*/)?.[0].length || 0;
          if (indent <= baseIndent) {
            endLine = i;
            break;
          }
          endLine = i + 1;
        }
      } else {
        // Brace-based (JS/TS/C#/Java)
        let braceCount = 0;
        let started = false;
        for (let i = foundLine; i < lines.length; i++) {
          for (const ch of lines[i]) {
            if (ch === '{') {
              started = true;
              braceCount++;
            } else if (ch === '}') {
              braceCount--;
            }
          }
          if (started && braceCount === 0) {
            endLine = i + 1;
            break;
          }
        }
      }

      // Lire la section
      const sectionLines: string[] = [];
      for (let i = foundLine; i < endLine && i < lines.length; i++) {
        if (sectionLines.length >= remainingLines) {
          sectionLines.push(`// ... (tronque, limite de ${maxLines} lignes atteinte)`);
          break;
        }
        sectionLines.push(lines[i]);
      }

      results.push(`--- Section "${sectionName}" (lignes ${foundLine + 1}-${Math.min(endLine, lines.length)}) ---\n${sectionLines.join('\n')}`);
      remainingLines -= sectionLines.length;
    }

    return results.join('\n\n');
  }
}
