import { readFileSync, statSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join, relative, extname } from 'path';
import { IndexedDocument, SymbolEntry, InvertedIndex, SearchResult, MatchType } from './index-types';

// Extensions indexables : tous les langages du projet
export const EXTENSIONS_INDEXABLES = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rb', '.php', '.java', '.kt', '.swift', '.rs', '.cs',
  '.vue', '.svelte', '.md', '.json', '.yaml', '.yml', '.toml',
  '.sql', '.sh', '.css', '.scss', '.html', '.xml',
]);

const MAX_FILE_SIZE = 500 * 1024; // 500 KB
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.pdf', '.zip', '.gz', '.tar', '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.class', '.jar',
]);

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
        const loaded = Object.entries(parsed.docs || {}) as Array<[string, IndexedDocument]>;
        // Normalisation des cles legacy (backslashes Windows -> forward slashes)
        this.docs = new Map<string, IndexedDocument>();
        for (const [k, doc] of loaded) {
          const normKey = k.split('\\').join('/');
          this.docs.set(normKey, doc);
          if (!Array.isArray(doc.dependencies)) doc.dependencies = [];
        }
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
      const rel = relative(rootDir, file).split('\\').join('/');
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(file);
      } catch {
        continue; // Fichier supprimé entre le scan et la lecture
      }
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_SIZE) continue;
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
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'build' || ent.name.startsWith('.')) {
          continue;
        }
        this.collectFiles(full, out);
      } else if (ent.isFile()) {
        const ext = extname(ent.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;
        if (EXTENSIONS_INDEXABLES.has(ext)) out.push(full);
      }
    }
  }

  private indexFile(root: string, relPath: string, absPath: string): void {
    const content = readFileSync(absPath, 'utf-8');
    const symbols = this.extractSymbols(absPath, content);
    const dependencies = this.extractDependencies(root, relPath, absPath, content);
    const doc: IndexedDocument = {
      path: relPath,
      content,
      lastModified: statSync(absPath).mtimeMs,
      symbols,
      dependencies,
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

  // ── Extracteurs de symboles par famille de langage ────────────────────
  private extractSymbols(absPath: string, content: string): SymbolEntry[] {
    const ext = extname(absPath).toLowerCase();
    const symbols: SymbolEntry[] = [];
    const lines = content.split('\n');
    const patterns = this.symbolPatterns(ext);
    for (let i = 0; i < lines.length; i++) {
      for (const p of patterns) {
        const match = p.re.exec(lines[i]);
        if (match) {
          const name = match[p.group];
          if (!name) continue;
          symbols.push({
            name,
            type: p.type,
            line: i + 1,
            column: lines[i].indexOf(name) + 1,
          });
          break;
        }
      }
    }
    return symbols;
  }

  private symbolPatterns(ext: string): Array<{ re: RegExp; group: number; type: SymbolEntry['type'] }> {
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)) {
      return [
        { re: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/, group: 1, type: 'function' },
        { re: /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/, group: 1, type: 'class' },
        { re: /^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/, group: 1, type: 'interface' },
        { re: /^(?:export\s+)?type\s+([A-Za-z0-9_$]+)/, group: 1, type: 'interface' },
        { re: /^(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/, group: 1, type: 'other' },
        { re: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/, group: 1, type: 'variable' },
      ];
    }
    if (ext === '.py') {
      return [
        { re: /^(?:async\s+)?def\s+([A-Za-z0-9_]+)/, group: 1, type: 'function' },
        { re: /^class\s+([A-Za-z0-9_]+)/, group: 1, type: 'class' },
      ];
    }
    if (ext === '.go') {
      return [
        { re: /^func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/, group: 1, type: 'function' },
        { re: /^type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/, group: 1, type: 'class' },
        { re: /^type\s+([A-Za-z0-9_]+)\s*=/, group: 1, type: 'other' },
        { re: /^(?:const|var)\s+([A-Za-z0-9_]+)/, group: 1, type: 'variable' },
      ];
    }
    if (ext === '.rb') {
      return [
        { re: /^\s*def\s+(?:self\.)?([A-Za-z0-9_!?]+)/, group: 1, type: 'function' },
        { re: /^\s*class\s+([A-Za-z0-9_:]+)/, group: 1, type: 'class' },
        { re: /^\s*module\s+([A-Za-z0-9_:]+)/, group: 1, type: 'other' },
      ];
    }
    if (ext === '.php') {
      return [
        { re: /^function\s+([A-Za-z0-9_]+)/, group: 1, type: 'function' },
        { re: /^(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/, group: 1, type: 'class' },
        { re: /^interface\s+([A-Za-z0-9_]+)/, group: 1, type: 'interface' },
      ];
    }
    if (['.java', '.kt', '.cs'].includes(ext)) {
      return [
        { re: /^(?:public|private|protected|static|final|abstract|sealed)?\s*(?:class|interface|enum|record|struct)\s+([A-Za-z0-9_]+)/, group: 1, type: 'class' },
        { re: /^\s*(?:public|private|protected|static|final|async)?\s*(?:[A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*\(/, group: 1, type: 'function' },
      ];
    }
    if (ext === '.swift') {
      return [
        { re: /^func\s+([A-Za-z0-9_]+)/, group: 1, type: 'function' },
        { re: /^(?:final\s+)?class\s+([A-Za-z0-9_]+)/, group: 1, type: 'class' },
        { re: /^(?:public\s+|internal\s+)?struct\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
        { re: /^(?:public\s+|internal\s+)?enum\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
        { re: /^protocol\s+([A-Za-z0-9_]+)/, group: 1, type: 'interface' },
      ];
    }
    if (ext === '.rs') {
      return [
        { re: /^(?:pub\s+)?fn\s+([A-Za-z0-9_]+)/, group: 1, type: 'function' },
        { re: /^(?:pub\s+)?struct\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
        { re: /^(?:pub\s+)?enum\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
        { re: /^(?:pub\s+)?trait\s+([A-Za-z0-9_]+)/, group: 1, type: 'interface' },
        { re: /^(?:pub\s+)?impl\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
        { re: /^(?:pub\s+)?const\s+([A-Za-z0-9_]+)/, group: 1, type: 'variable' },
      ];
    }
    if (ext === '.sh') {
      return [
        { re: /^([A-Za-z0-9_]+)\s*\(\)\s*\{/, group: 1, type: 'function' },
        { re: /^function\s+([A-Za-z0-9_]+)/, group: 1, type: 'function' },
      ];
    }
    if (ext === '.sql') {
      return [
        { re: /^CREATE\s+(?:TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX)\s+([A-Za-z0-9_."]+)/i, group: 1, type: 'other' },
      ];
    }
    return [
      { re: /^(?:export\s+)?(?:function|class|interface|const|let|var|type)\s+([A-Za-z0-9_]+)/, group: 1, type: 'other' },
    ];
  }

  // ── Graphe de dépendances : imports/requires par langage ──────────────
  private extractDependencies(root: string, relPath: string, absPath: string, content: string): string[] {
    const ext = extname(absPath).toLowerCase();
    const deps = new Set<string>();
    const dir = extname(relPath) ? relPath.slice(0, relPath.lastIndexOf('/')) : relPath;
    const resolveLocal = (spec: string): string | null => {
      if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // module externe
      let candidate = spec;
      if (candidate.startsWith('.')) {
        candidate = join(dir, spec);
      } else {
        candidate = spec.replace(/^\//, '');
      }
      const candidates = [
        candidate,
        candidate + '.ts', candidate + '.tsx', candidate + '.js', candidate + '.jsx', candidate + '.mjs', candidate + '.cjs',
        candidate + '.py', candidate + '.go', candidate + '.rb', candidate + '.php', candidate + '.java',
        candidate + '.kt', candidate + '.swift', candidate + '.rs', candidate + '.cs',
        candidate + '.vue', candidate + '.svelte', candidate + '.md', candidate + '.json',
        candidate + '.yaml', candidate + '.yml', candidate + '.toml', candidate + '.sql', candidate + '.sh',
        candidate + '.css', candidate + '.scss', candidate + '.html', candidate + '.xml',
        join(candidate, 'index.ts'), join(candidate, 'index.js'), join(candidate, 'index.py'),
      ];
      for (const c of candidates) {
        const normalized = c.split('\\').join('/').replace(/\.\.\//g, '');
        const full = join(root, normalized);
        if (existsSync(full) && statSync(full).isFile()) {
          return normalized;
        }
      }
      return null;
    };

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)) {
      const importRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
      const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(content)) !== null) {
        const resolved = resolveLocal(m[1]);
        if (resolved) deps.add(resolved);
      }
      while ((m = requireRe.exec(content)) !== null) {
        const resolved = resolveLocal(m[1]);
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.py') {
      const re = /^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const spec = (m[1] || m[2] || '').replace(/\./g, '/');
        const resolved = resolveLocal('.' + spec);
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.go') {
      const re = /^\s*"([^"]+)"/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const resolved = resolveLocal(m[1]);
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.rb') {
      const re = /^\s*require(?:_relative)?\s*['"]([^'"]+)['"]/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const spec = m[1].startsWith('.') ? m[1] : './' + m[1];
        const resolved = resolveLocal(spec);
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.php') {
      const re = /(?:require|include)(?:_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const resolved = resolveLocal(m[1]);
        if (resolved) deps.add(resolved);
      }
    } else if (['.java', '.kt', '.cs', '.swift'].includes(ext)) {
      const re = /^import\s+([\w.]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const resolved = resolveLocal(m[1].replace(/\./g, '/'));
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.rs') {
      const re = /^(?:use|mod)\s+([\w:]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const resolved = resolveLocal(m[1].split(':')[0].replace(/\./g, '/'));
        if (resolved) deps.add(resolved);
      }
    } else if (ext === '.sh') {
      const re = /^\s*source\s+['"]?([^'"\s]+)['"]?/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const resolved = resolveLocal(m[1]);
        if (resolved) deps.add(resolved);
      }
    }
    return Array.from(deps);
  }

  search(query: string, symbolOnly = false): SearchResult[] {
    const term = query.toLowerCase();
    const scores = new Map<string, SearchResult>();
    for (const [relPath, doc] of this.docs.entries()) {
      // 1. Search symbols (DEFINITION > USAGE)
      for (const sym of doc.symbols) {
        const symNameLower = sym.name.toLowerCase();
        if (symNameLower.includes(term)) {
          const key = `${relPath}:${sym.line}:${sym.name}`;
          let score = 10;
          let matchType: MatchType = 'USAGE';
          if (symNameLower === term) { score = 100; matchType = 'DEFINITION'; }
          else if (symNameLower.startsWith(term)) { score = 50; matchType = 'DEFINITION'; }
          scores.set(key, {
            path: relPath,
            line: sym.line,
            symbol: sym.name,
            type: sym.type,
            score,
            matchType,
          });
        }
      }
      // 2. Search file path
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
              score,
              matchType: 'TEXTE',
            });
          }
        }
      }
      // 3. Imports contenant le terme (IMPORT)
      if (!symbolOnly) {
        const lines = doc.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(term) && /^\s*(import|from|require|use|include)\b/.test(lines[i])) {
            const key = `${relPath}:${i + 1}:import`;
            if (!scores.has(key)) {
              scores.set(key, {
                path: relPath,
                line: i + 1,
                score: 8,
                matchType: 'IMPORT',
              });
            }
          }
        }
      }
    }
    // 4. Fallback/combine with inverted index word hits (TEXTE)
    if (!symbolOnly) {
      const hits = this.inverted[term] || [];
      for (const hit of hits) {
        const key = hit.symbol ? `${hit.path}:${hit.line}:${hit.symbol}` : `${hit.path}:${hit.line}`;
        if (!scores.has(key)) {
          scores.set(key, {
            path: hit.path,
            line: hit.line,
            symbol: hit.symbol,
            score: 2,
            matchType: 'TEXTE',
          });
        }
      }
    }
    return Array.from(scores.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.path.localeCompare(b.path);
    });
  }

  private save(): void {
    const payload = {
      docs: Object.fromEntries(this.docs),
      inverted: this.inverted,
      dependencies: this.buildDependencyGraph(),
      updatedAt: Date.now(),
    };
    writeFileSync(this.indexPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  docCount(): number {
    return this.docs.size;
  }

  termCount(): number {
    return Object.keys(this.inverted).length;
  }

  // ── Accès au graphe de dépendances ────────────────────────────────────
  getDependencies(relPath: string): string[] {
    return this.docs.get(relPath)?.dependencies || [];
  }

  getDependents(relPath: string): string[] {
    const dependents: string[] = [];
    for (const [path, doc] of this.docs.entries()) {
      if (doc.dependencies.includes(relPath)) dependents.push(path);
    }
    return dependents.sort();
  }

  /** Construit le graphe complet path -> Set<deps> pour la persistance */
  private buildDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    for (const [path, doc] of this.docs.entries()) {
      graph[path] = doc.dependencies;
    }
    return graph;
  }

  /** Statistiques des langages indexés (extension -> nb fichiers) */
  getLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [path] of this.docs.entries()) {
      const ext = extname(path).toLowerCase().replace('.', '') || 'inconnu';
      stats[ext] = (stats[ext] || 0) + 1;
    }
    return stats;
  }

  /** Top N fichiers par taille (octets) */
  getLargestFiles(n: number): Array<{ path: string; bytes: number }> {
    return Array.from(this.docs.entries())
      .map(([path, doc]) => ({ path, bytes: Buffer.byteLength(doc.content, 'utf-8') }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, n);
  }
  /** Modules avec le plus de dependants (impact maximal) */
  getMostDependentFiles(n: number): Array<{ path: string; dependents: number }> {
    const counts = new Map<string, number>();
    for (const [, doc] of this.docs.entries()) {
      for (const dep of doc.dependencies) {
        counts.set(dep, (counts.get(dep) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([path, dependents]) => ({ path, dependents }))
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, n);
  }
  /** Liste des chemins relatifs indexés */
  getPaths(): string[] {
    return Array.from(this.docs.keys());
  }
}
