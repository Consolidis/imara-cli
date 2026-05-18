import * as fs from 'fs';
import * as path from 'path';
import { isInsideCwd, isProtectedFile } from '../../utils/file-utils';
import { ToolDefinition } from '../agent.types';

interface BracePair {
  openLine: number;
  openCol: number;
  closeLine: number;
  closeCol: number;
}

interface BlockNode {
  openLine: number;
  openCol: number;
  closeLine: number;
  closeCol: number;
  signature: string;
  type: 'class' | 'interface' | 'function' | 'method' | 'other';
  children: BlockNode[];
}

export class SmartReadTool {
  static definition: ToolDefinition = {
    name: 'smart_read',
    description: 'Lit un fichier volumineux de manière optimisée en extrayant sa structure (outline) ou en condensant les blocs volumineux (summary) pour économiser des tokens.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier à lire sémantiquement' },
        mode: {
          type: 'string',
          enum: ['outline', 'summary'],
          description: 'outline (signatures uniquement) ou summary (condense les blocs > 15 lignes)',
          default: 'summary'
        }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string; mode?: 'outline' | 'summary' }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    const mode = args.mode || 'summary';

    if (!isInsideCwd(fullPath)) {
      throw new Error('Sécurité: Accès refusé en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Sécurité: Ce fichier est protégé.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouvé: ${args.path}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(fullPath).toLowerCase();
    const lines = content.split('\n');

    const bracePairs = ext === '.py' ? this.getIndentationBlocks(content) : this.getBracePairs(content);
    const blockTree = this.buildBlockTree(bracePairs, lines);

    if (mode === 'outline') {
      return this.serializeOutline(lines, blockTree);
    } else {
      return this.serializeSummary(lines, blockTree, ext);
    }
  }

  private static getBracePairs(content: string): BracePair[] {
    const pairs: BracePair[] = [];
    const stack: { line: number; col: number }[] = [];
    const lines = content.split('\n');
    let inMultiLineComment = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let inSingleLineComment = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      inSingleLineComment = false;

      let colIdx = 0;
      while (colIdx < line.length) {
        const char = line[colIdx];
        const nextChar = line[colIdx + 1] || '';

        if (inMultiLineComment) {
          if (char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            colIdx += 2;
            continue;
          }
          colIdx++;
          continue;
        }

        if (inSingleLineComment) {
          break;
        }

        if (inSingleQuote) {
          if (char === "'" && line[colIdx - 1] !== '\\') inSingleQuote = false;
          colIdx++;
          continue;
        }
        if (inDoubleQuote) {
          if (char === '"' && line[colIdx - 1] !== '\\') inDoubleQuote = false;
          colIdx++;
          continue;
        }
        if (inTemplate) {
          if (char === '`' && line[colIdx - 1] !== '\\') inTemplate = false;
          colIdx++;
          continue;
        }

        // Check comments
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true;
          colIdx += 2;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true;
          colIdx += 2;
          continue;
        }

        // Check strings
        if (char === "'") { inSingleQuote = true; colIdx++; continue; }
        if (char === '"') { inDoubleQuote = true; colIdx++; continue; }
        if (char === '`') { inTemplate = true; colIdx++; continue; }

        // Braces
        if (char === '{') {
          stack.push({ line: lineIdx, col: colIdx });
        } else if (char === '}') {
          const open = stack.pop();
          if (open) {
            pairs.push({
              openLine: open.line,
              openCol: open.col,
              closeLine: lineIdx,
              closeCol: colIdx
            });
          }
        }
        colIdx++;
      }
    }
    return pairs;
  }

  private static getIndentationBlocks(content: string): BracePair[] {
    const pairs: BracePair[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('def ') || trimmed.startsWith('class ')) {
        const indent = line.match(/^\s*/)?.[0].length || 0;

        let endLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (!nextLine.trim()) continue;

          const nextIndent = nextLine.match(/^\s*/)?.[0].length || 0;
          if (nextIndent <= indent) {
            break;
          }
          endLine = j;
        }

        if (endLine > i) {
          pairs.push({
            openLine: i,
            openCol: line.indexOf(':'),
            closeLine: endLine,
            closeCol: lines[endLine].length - 1
          });
        }
      }
    }
    return pairs;
  }

  private static buildBlockTree(pairs: BracePair[], lines: string[]): BlockNode[] {
    const sorted = [...pairs].sort((a, b) => {
      if (a.openLine !== b.openLine) return a.openLine - b.openLine;
      return a.openCol - b.openCol;
    });

    const rootNodes: BlockNode[] = [];
    const stack: BlockNode[] = [];

    for (const pair of sorted) {
      const openLineText = lines[pair.openLine];
      let signature = openLineText.substring(0, pair.openCol).trim();
      if (!signature && pair.openLine > 0) {
        let prevLineIdx = pair.openLine - 1;
        while (prevLineIdx >= 0 && !lines[prevLineIdx].trim()) {
          prevLineIdx--;
        }
        if (prevLineIdx >= 0) {
          signature = lines[prevLineIdx].trim();
        }
      }

      let type: BlockNode['type'] = 'other';
      if (/\b(class|interface|enum|type|trait|struct)\b/.test(signature)) {
        type = 'class';
      } else if (/\b(function)\b/.test(signature) || signature.includes('=>') || signature.startsWith('def ')) {
        type = 'function';
      } else if (/\b(\w+)\s*\(.*\)/.test(signature)) {
        const isReserved = /\b(if|for|while|switch|catch|with|foreach)\b/.test(signature);
        if (!isReserved) {
          type = 'method';
        }
      }

      const node: BlockNode = {
        openLine: pair.openLine,
        openCol: pair.openCol,
        closeLine: pair.closeLine,
        closeCol: pair.closeCol,
        signature,
        type,
        children: []
      };

      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (pair.openLine >= top.openLine && pair.closeLine <= top.closeLine) {
          top.children.push(node);
          break;
        } else {
          stack.pop();
        }
      }

      if (stack.length === 0) {
        rootNodes.push(node);
      }

      stack.push(node);
    }

    return rootNodes;
  }

  private static serializeOutline(lines: string[], nodes: BlockNode[]): string {
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('import ')) {
        const coveredByNode = nodes.some(n => i >= n.openLine && i <= n.closeLine);
        if (!coveredByNode) {
          result.push(line);
        }
      }
    }

    if (result.length > 0) {
      result.push('');
    }

    function renderNode(node: BlockNode, indent: string): string[] {
      const linesOut: string[] = [];
      if (node.type === 'class') {
        const sigLine = lines[node.openLine];
        const sig = sigLine.substring(0, node.openCol + 1).trim();
        linesOut.push(indent + sig);

        for (const child of node.children) {
          if (child.type === 'method' || child.type === 'class') {
            linesOut.push(...renderNode(child, indent + '  '));
          }
        }

        linesOut.push(indent + '}');
      } else if (node.type === 'method' || node.type === 'function') {
        const sigLine = lines[node.openLine];
        const sig = sigLine.substring(0, node.openCol).trim();
        linesOut.push(indent + sig + ' {}');
      }
      return linesOut;
    }

    for (const node of nodes) {
      if (node.type === 'class' || node.type === 'function') {
        result.push(...renderNode(node, ''));
        result.push('');
      }
    }

    return result.join('\n').trim();
  }

  private static serializeSummary(lines: string[], nodes: BlockNode[], ext: string): string {
    const lineActions = lines.map((content) => ({
      content,
      skipped: false,
      placeholder: null as string | null
    }));

    function processNode(node: BlockNode) {
      const lineCount = node.closeLine - node.openLine + 1;
      if ((node.type === 'function' || node.type === 'method' || node.type === 'class') && lineCount > 15) {
        for (let i = node.openLine + 1; i < node.closeLine; i++) {
          lineActions[i].skipped = true;
        }
        if (node.openLine + 1 < node.closeLine) {
          lineActions[node.openLine + 1].skipped = false;
          lineActions[node.openLine + 1].placeholder = SmartReadTool.getCommentStyle(ext, node.type, lineCount, node.signature);
        }
      } else {
        for (const child of node.children) {
          processNode(child);
        }
      }
    }

    for (const node of nodes) {
      processNode(node);
    }

    const resultLines: string[] = [];
    for (const action of lineActions) {
      if (action.skipped) continue;
      if (action.placeholder !== null) {
        const indent = action.content.match(/^\s*/)?.[0] || '  ';
        resultLines.push(indent + action.placeholder);
      } else {
        resultLines.push(action.content);
      }
    }

    return resultLines.join('\n');
  }

  private static getCommentStyle(ext: string, nodeType: string, lineCount: number, signature: string): string {
    const cleanSig = signature.replace(/\s+/g, ' ').substring(0, 40).trim();
    const label = nodeType === 'method' || nodeType === 'function' ? 'Méthode' : nodeType === 'class' ? 'Classe' : 'Bloc';
    const text = `${label} de ${lineCount} lignes: ${cleanSig}`;

    // FUTURE PLACEHOLDERS & TODO:
    // Expand to other exotic/future languages here.
    if (ext === '.py') {
      return `# [${text}]`;
    } else if (ext === '.html') {
      return `<!-- [${text}] -->`;
    } else if (ext === '.css') {
      return `/* [${text}] */`;
    } else {
      return `// [${text}]`;
    }
  }
}
