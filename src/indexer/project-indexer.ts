import { readFileSync, statSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join, relative, extname } from 'path';
import { IndexedDocument, SymbolEntry, InvertedIndex, SearchResult } from './index-types';

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

export class ProjectIndexer {
  private indexPath: string;
  private docs: Map<string, IndexedDocument> = new Map();
  private inverted: InvertedIndex = {};

  constructor(indexPath: string) {
    this.indexPath = indexPath;
    if (existsSync(indexPath)) {
      try {
        const raw = readFileSync(indexPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.docs = new Map(Object.entries(parsed.docs || {}));
        this.inverted = parsed.inverted || {};
      } catch {
        this.docs = new Map();
        this.inverted = {};
      }
    }
  }

  scan(rootDir: string, includePatterns: string[] = ['src']): void {
    const files: string[] = [];
    for (const pat of includePatterns) {
      const full = join(rootDir, pat);
      if (existsSync(full)) this.collectFiles(full, files);
    }
    for (const file of files) {
      const rel = relative(rootDir, file);
      const stat = statSync(file);
      const existing = this.docs.get(rel);
      if (existing && existing.lastModified >= stat.mtimeMs) continue;
      this.indexFile(rootDir, rel, file);
    }
    this.save();
  }

  private collectFiles(dir: string, out: string[]): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules' && !ent.name.startsWith('.')) {
        this.collectFiles(full, out);
      } else if (ent.isFile() && EXTENSIONS.has(extname(ent.name))) {
        out.push(full);
      }
    }
  }

  private indexFile(root: string, relPath: string, absPath: string): void {
    const content = readFileSync(absPath, 'utf-8');
    const symbols = this.extractSymbols(content);
    const doc: IndexedDocument = {
      path: relPath,
      content,
      lastModified: statSync(absPath).mtimeMs,
      symbols,
    };
    this.docs.set(relPath, doc);
    // update inverted index
    for (const sym of symbols) {
      const term = sym.name.toLowerCase();
      if (!Array.isArray(this.inverted[term])) this.inverted[term] = [];
      this.inverted[term].push({ path: relPath, line: sym.line, symbol: sym.name });
    }
    // index words for full-text
    const words = content.split(/\W+/).filter(w => w.length > 2);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    for (const word of uniqueWords) {
      if (!Array.isArray(this.inverted[word])) this.inverted[word] = [];
      if (!this.inverted[word].some(e => e.path === relPath)) {
        this.inverted[word].push({ path: relPath, line: 1 });
      }
    }
  }

  private extractSymbols(content: string): SymbolEntry[] {
    const symbols: SymbolEntry[] = [];
    const lines = content.split('\n');
    // naive regex for common patterns
    const re = /^(export\s+)?(?:function|class|interface|const|let|var|type)\s+([A-Za-z0-9_]+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = re.exec(lines[i]);
      if (match) {
        const type = match[1] ? match[1].trim() : 'other';
        symbols.push({
          name: match[2],
          type: this.inferType(match[0]),
          line: i + 1,
          column: lines[i].indexOf(match[2]) + 1,
        });
      }
    }
    return symbols;
  }

  private inferType(src: string): SymbolEntry['type'] {
    if (src.includes('function')) return 'function';
    if (src.includes('class')) return 'class';
    if (src.includes('interface')) return 'interface';
    if (src.includes('import')) return 'import';
    if (src.includes('const') || src.includes('let') || src.includes('var')) return 'variable';
    return 'other';
  }

  search(query: string, symbolOnly = false): SearchResult[] {
    const term = query.toLowerCase();
    const scores = new Map<string, SearchResult>();

    for (const [relPath, doc] of this.docs.entries()) {
      // 1. Search symbols
      for (const sym of doc.symbols) {
        const symNameLower = sym.name.toLowerCase();
        if (symNameLower.includes(term)) {
          const key = `${relPath}:${sym.line}:${sym.name}`;
          let score = 10;
          if (symNameLower === term) score = 100;
          else if (symNameLower.startsWith(term)) score = 50;

          scores.set(key, {
            path: relPath,
            line: sym.line,
            symbol: sym.name,
            type: sym.type,
            score
          });
        }
      }

      // 2. Search file path (if not symbolOnly)
      if (!symbolOnly) {
        const pathLower = relPath.toLowerCase();
        if (pathLower.includes(term)) {
          const key = `${relPath}:1`;
          let score = 5;
          if (pathLower === term) score = 80;
          else if (pathLower.endsWith(term)) score = 40;

          if (!scores.has(key)) {
            scores.set(key, {
              path: relPath,
              line: 1,
              score
            });
          }
        }
      }
    }

    // 3. Fallback/combine with inverted index word hits
    if (!symbolOnly) {
      const hits = this.inverted[term] || [];
      for (const hit of hits) {
        const key = hit.symbol ? `${hit.path}:${hit.line}:${hit.symbol}` : `${hit.path}:${hit.line}`;
        if (!scores.has(key)) {
          scores.set(key, {
            path: hit.path,
            line: hit.line,
            symbol: hit.symbol,
            score: 2
          });
        }
      }
    }

    return Array.from(scores.values()).sort((a, b) => b.score - a.score);
  }

  private save(): void {
    const payload = {
      docs: Object.fromEntries(this.docs),
      inverted: this.inverted,
    };
    writeFileSync(this.indexPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  docCount(): number {
    return this.docs.size;
  }

  termCount(): number {
    return Object.keys(this.inverted).length;
  }
}
