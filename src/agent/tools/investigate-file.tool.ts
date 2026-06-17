import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

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

    if (lineCount > 5000) {
      return this.buildRefusalReport(args.path, lineCount, sizeKB, lineEndingType, ext);
    }

    const hasQueryOrSections = !!(args.query || (args.sections && args.sections.length > 0));
    const effectiveStrategy = this.resolveStrategy(strategy, lineCount, hasQueryOrSections);
    const report = await this.buildReport(args.path, fullPath, lines, lineCount, sizeKB, lineEndingType, ext, effectiveStrategy, args.query, args.sections, maxLines);
    return this.formatReport(report);
  }

  private static resolveStrategy(strategy: Strategy, lineCount: number, hasQueryOrSections?: boolean): Strategy {
    if (strategy !== 'auto') return strategy;
    if (lineCount < 100) return 'deep';
    if (lineCount <= 300) return 'overview';
    // > 300 lignes : targeted si query/sections fournis, sinon overview (outline pur)
    if (hasQueryOrSections) return 'targeted';
    return 'overview';
  }

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
    const header = this.buildHeader(filePath, lineCount, sizeKB, lineEnding, ext, strategy);
    let toc = '';
    let content = '';
    let notes = '';

    if (strategy === 'deep' && lineCount <= 100) {
      content = lines.join('\n');
      toc = '(Fichier court : lecture complete)';
      notes = `Fichier entier lu (${lineCount} lignes).`;

    } else if (strategy === 'overview' || (strategy === 'targeted' && !query && !sections)) {
      // Fichiers <= 300 : resume leger avec les 5 premieres lignes de chaque bloc
      // Fichiers > 300 : outline uniquement (signatures seules)
      const showBody = lineCount <= 300 ? 5 : 0;
      const codeMap = this.getCodeMap(lines, showBody);
      toc = codeMap.toc;
      content = codeMap.summary;
      if (lineCount > 300) {
        notes = `Fichier de ${lineCount} lignes (outline seul). Utilisez query=... ou sections=[...] pour lire le contenu.`;
      } else {
        notes = `Vue d'ensemble : ${codeMap.functionCount} bloc(s) identifie(s).`;
      }

    } else if (strategy === 'targeted' && (query || sections)) {
      const codeMap = this.getCodeMap(lines, 0);
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
      const codeMap = this.getCodeMap(lines, 0);
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
   * Analyse la structure du fichier.
   * @param showBodyLines nombre de lignes du corps a afficher apres chaque signature (0 = outline pur)
   */
  private static getCodeMap(lines: string[], showBodyLines: number): { toc: string; summary: string; functionCount: number } {
    const tocLines: string[] = [];
    let functionCount = 0;

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
          tocLines.push(`  L${i + 1}: ${line.trim().substring(0, 100)}`);
          break;
        }
      }
    }

    const summaryLines: string[] = [];

    // Imports
    const imports = lines.filter(l => l.trim().startsWith('import '));
    if (imports.length > 0) {
      summaryLines.push('// Imports:');
      imports.slice(0, 10).forEach(l => summaryLines.push(l));
      if (imports.length > 10) {
        summaryLines.push(`// ... (${imports.length - 10} imports supplementaires)`);
      }
      summaryLines.push('');
    }

    // Signatures (+ corps si showBodyLines > 0)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isDeclaration = patterns.some(p => p.test(line));
      if (isDeclaration) {
        summaryLines.push(line);
        for (let j = i + 1; j < Math.min(i + 1 + showBodyLines, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine.trim() === '' || nextLine.trim().startsWith('import ')) break;
          summaryLines.push(nextLine);
        }
        if (showBodyLines > 0) summaryLines.push('');
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

    const readRanges: { start: number; end: number }[] = [];
    const contextLines = 5;

    let result = `--- Recherche de "${query}" : ${matches.length} correspondance(s) ---\n`;

    for (const match of matches) {
      const start = Math.max(0, match.line - 1 - contextLines);
      const end = Math.min(lines.length, match.line - 1 + contextLines);

      const lastRange = readRanges[readRanges.length - 1];
      if (lastRange && start <= lastRange.end + 1) {
        lastRange.end = end;
      } else {
        readRanges.push({ start, end });
      }
    }

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

  private static async readSections(lines: string[], sections: string[], fullPath: string, maxLines: number): Promise<string> {
    const results: string[] = [];
    let remainingLines = maxLines;

    for (const sectionName of sections) {
      if (remainingLines <= 0) break;

      let foundLine = -1;
      const lowerName = sectionName.toLowerCase();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes(lowerName)) {
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

      const isPythonLike = lines[foundLine].trim().endsWith(':');
      let endLine = foundLine + 1;

      if (isPythonLike) {
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
