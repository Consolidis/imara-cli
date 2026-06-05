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

interface JsxTagIssue {
  type: 'unclosed' | 'unopened' | 'mismatch';
  tagName: string;
  line: number;
  description: string;
}

export class SmartReadTool {
  static definition: ToolDefinition = {
    name: 'smart_read',
    description: 'Lit un fichier volumineux de maniere optimisee en extrayant sa structure (outline) ou en condensant les blocs volumineux (summary) pour economiser des tokens.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Le chemin du fichier a lire semantiquement' },
        mode: {
          type: 'string',
          enum: ['outline', 'summary', 'jsx'],
          description: 'outline (signatures uniquement), summary (condense les blocs > 15 lignes) ou jsx (preserve les paires {...} et detecte les balises non fermees)',
          default: 'summary'
        }
      },
      required: ['path']
    }
  };

  static async run(args: { path: string; mode?: 'outline' | 'summary' | 'jsx' }): Promise<string> {
    const fullPath = path.resolve(process.cwd(), args.path);
    const mode = args.mode || 'summary';
    if (!isInsideCwd(fullPath)) {
      throw new Error('Securite: Acces refuse en dehors du projet.');
    }
    if (isProtectedFile(fullPath)) {
      throw new Error('Securite: Ce fichier est protege.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouve: ${args.path}`);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(fullPath).toLowerCase();
    const lines = content.split('\n');
    const bracePairs = ext === '.py' ? this.getIndentationBlocks(content) : this.getBracePairs(content);
    const blockTree = this.buildBlockTree(bracePairs, lines);
    if (mode === 'outline') {
      return this.serializeOutline(lines, blockTree);
    } else if (mode === 'jsx') {
      return this.serializeJSX(lines, blockTree, ext);
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
        if (char === "'") { inSingleQuote = true; colIdx++; continue; }
        if (char === '"') { inDoubleQuote = true; colIdx++; continue; }
        if (char === '`') { inTemplate = true; colIdx++; continue; }
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

  /**
   * Mode JSX : preserve les paires {...} et detecte les balises non fermees.
   */
  private static serializeJSX(lines: string[], nodes: BlockNode[], ext: string): string {
    const issues: JsxTagIssue[] = [];
    const resultLines: string[] = [];

    // 1. Appliquer le resume de base (comme summary)
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

    // 2. Preserver les lignes avec expressions JSX {...} ou balises JSX
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\{[^}]{3,}\}/.test(line) || /<[A-Z]\w*/.test(line) || /<\w+\s+/.test(line)) {
        lineActions[i].skipped = false;
        lineActions[i].placeholder = null;
      }
    }

    // 3. Analyser les balises JSX
    this.analyzeJSXTags(lines, issues);

    // 4. Construction de la sortie
    for (let i = 0; i < lineActions.length; i++) {
      const action = lineActions[i];
      if (action.skipped) continue;
      if (action.placeholder !== null) {
        const indent = action.content.match(/^\s*/)?.[0] || '  ';
        resultLines.push(indent + action.placeholder);
      } else {
        resultLines.push(action.content);
      }
    }

    // 5. Rapport des problemes JSX
    if (issues.length > 0) {
      resultLines.push('');
      resultLines.push('--- Problemes JSX detectes ---');
      for (const issue of issues) {
        const label = issue.type === 'unclosed' ? 'Balise non fermee'
          : issue.type === 'unopened' ? 'Balise fermante sans ouverture'
          : 'Mismatch de balise';
        resultLines.push(`  Ligne ${issue.line + 1}: ${label} <${issue.tagName}> - ${issue.description}`);
      }
    }

    // 6. Stats JSX
    const jsxExprCount = lines.filter(l => /\{[^}]{1,}\}/.test(l)).length;
    const jsxTagCount = lines.filter(l => /<\/?\w+[^>]*>/.test(l)).length;
    resultLines.push('');
    resultLines.push(`--- Stats JSX: ${jsxExprCount} expressions {...}, ${jsxTagCount} balises, ${issues.length} probleme(s) ---`);

    return resultLines.join('\n');
  }

  private static analyzeJSXTags(lines: string[], issues: JsxTagIssue[]): void {
    const tagStack: Array<{ name: string; line: number; selfClosing: boolean }> = [];
    const selfClosingTagRegex = /<([A-Z]\w*|[a-z]\w*)\b[^>]*\/\s*>/g;
    const closeTagRegex = /<\/([A-Z]\w*|[a-z]\w*)\s*>/g;
    const openTagRegex = /<([A-Z]\w*|[a-z]\w*)\b[^>]*>/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        continue;
      }
      // Closing tags
      const closeRegex = new RegExp(closeTagRegex.source, 'g');
      let match;
      while ((match = closeRegex.exec(line)) !== null) {
        const tagName = match[1];
        let found = false;
        for (let i = tagStack.length - 1; i >= 0; i--) {
          if (tagStack[i].name === tagName && !tagStack[i].selfClosing) {
            tagStack.splice(i);
            found = true;
            break;
          }
        }
        if (!found) {
          issues.push({
            type: 'unopened',
            tagName,
            line: lineIdx,
            description: `Fermeture </${tagName}> sans ouverture correspondante`
          });
        }
      }
      // Opening tags
      const openRegex = new RegExp(openTagRegex.source, 'g');
      while ((match = openRegex.exec(line)) !== null) {
        const tagName = match[1];
        const fullMatch = match[0];
        if (fullMatch.endsWith('/>')) continue;
        tagStack.push({ name: tagName, line: lineIdx, selfClosing: false });
      }
    }

    for (const tag of tagStack) {
      if (!tag.selfClosing) {
        issues.push({
          type: 'unclosed',
          tagName: tag.name,
          line: tag.line,
          description: `Balise <${tag.name}> ouverte ligne ${tag.line + 1} sans fermeture`
        });
      }
    }
  }
}
