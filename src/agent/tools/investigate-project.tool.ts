import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer } from '../../indexer/project-indexer';
import { ToolDefinition } from '../agent.types';

type Depth = 'rapide' | 'standard' | 'approfondi';

interface InvestigateArgs {
  concept: string;
  depth?: Depth;
  max_results?: number;
  include_archives?: boolean;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'was',
  'are', 'not', 'but', 'les', 'des', 'une', 'pour', 'dans', 'avec', 'est',
  'que', 'qui', 'pas', 'sur', 'get', 'set', 'new', 'return', 'null',
]);

export class InvestigateProjectTool {
  static definition: ToolDefinition = {
    name: 'investigate_project',
    description: 'Investigue un CONCEPT transverse dans tout le projet en un seul appel : carte de localisation (fichiers + lignes + extraits + score) + relations d\'imports des fichiers centraux. Multi-langages (TS, JS, Python, Go, Ruby, PHP, Java, Rust, SQL...).',
    parameters: {
      type: 'object',
      properties: {
        concept: { type: 'string', description: 'Le concept ou fonctionnalite a localiser (ex: "paiement", "auth", "wallet")' },
        depth: {
          type: 'string',
          enum: ['rapide', 'standard', 'approfondi'],
          description: 'rapide: 10 resultats / 3 lignes / pas de graphe. standard: 20 / 6 / graphe top 5. approfondi: 40 / 12 / graphe complet',
          default: 'standard'
        },
        max_results: { type: 'number', description: 'Nombre maximum de resultats (defaut selon depth)', default: 20 },
        include_archives: { type: 'boolean', description: 'Si vrai, inclut aussi les archives Conductor dans la recherche (defaut false)', default: false }
      },
      required: ['concept']
    }
  };

  static async run(args: InvestigateArgs): Promise<string> {
    const concept = (args.concept || '').trim();
    if (!concept) throw new Error('Le parametre concept est requis.');
    const depth: Depth = args.depth || 'standard';
    const cfg = depthConfig(depth);
    const maxResults = args.max_results || cfg.maxResults;
    const includeArchives = !!args.include_archives;

    // 1. Assurer l'index (scan incremental)
    const indexDir = path.join(process.cwd(), '.imara');
    if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
    const indexPath = path.join(indexDir, 'index-cache.json');
    const indexer = new ProjectIndexer(indexPath);
    indexer.scan(process.cwd(), ['']);

    // 2. Recherche du concept
    const results = indexer.search(concept, false)
      .filter(r => !isFalsePositive(concept, r.path))
      .filter(r => includeArchives || !isConductorPath(r.path))
      .slice(0, maxResults);

    if (results.length === 0) {
      return `VUE D'ENSEMBLE\nAucun resultat pour le concept "${concept}".\n\nNOTES\n- Verifiez l'orthographe ou essayez un terme plus court.\n- L'index couvre ${indexer.docCount()} fichiers (multi-langages).`;
    }

    // 3. Carte de localisation groupee par fichier
    const byFile = new Map<string, typeof results>();
    for (const r of results) {
      if (!byFile.has(r.path)) byFile.set(r.path, []);
      byFile.get(r.path)!.push(r);
    }

    // 4. Extraits de contexte
    const contexts = buildContexts(indexer, byFile, cfg.contextLines, concept);

    // 5. Relations pour les fichiers centraux (top N)
    const centralFiles = Array.from(byFile.keys()).slice(0, cfg.graphTop);
    const relations = buildRelations(indexer, centralFiles);

    // 6. Rapport structure
    let out = `VUE D'ENSEMBLE\n`;
    out += `Concept : "${concept}" (depth: ${depth}, max_results: ${maxResults})\n`;
    out += `Fichiers indexes : ${indexer.docCount()} | Resultats trouves : ${results.length} | Fichiers touches : ${byFile.size}\n`;
    if (includeArchives) {
      out += `Archives Conductor : incluses dans la recherche.\n`;
    }

    out += `\nCARTE DE LOCALISATION\n`;
    let rank = 0;
    for (const [file, hits] of byFile) {
      const best = Math.max(...hits.map(h => h.score));
      const types = Array.from(new Set(hits.map(h => h.matchType || 'TEXTE'))).join('/');
      out += `${++rank}. ${file} (score: ${best}, matches: ${hits.length}, types: ${types})\n`;
      for (const h of hits.slice(0, 8)) {
        const sym = h.symbol ? ` -> ${h.symbol}` : '';
        const t = h.matchType ? ` [${h.matchType}]` : '';
        out += `     L${h.line}${sym}${t}\n`;
      }
    }

    out += `\nEXTRAITS\n`;
    for (const ctx of contexts) {
      out += `--- ${ctx.path} ---\n`;
      for (const line of ctx.lines) {
        out += `${line}\n`;
      }
      out += '\n';
    }

    if (relations.length > 0) {
      out += `RELATIONS (graphe d'imports des fichiers centraux)\n`;
      for (const rel of relations) {
        out += `--- ${rel.path} ---\n`;
        if (rel.imports.length > 0) {
          out += `Importe : ${rel.imports.join(', ')}\n`;
        }
        if (rel.importedBy.length > 0) {
          out += `Importe par : ${rel.importedBy.join(', ')}\n`;
        }
        if (rel.imports.length === 0 && rel.importedBy.length === 0) {
          out += `(aucune relation locale detectee)\n`;
        }
      }
    }

    out += `\nNOTES\n`;
    out += `- La profondeur d'extrait est de ${cfg.contextLines} lignes (depth: ${depth}).\n`;
    out += `- Utilisez conductor_search_archives pour verifier si une tache similaire a deja ete traitee.\n`;
    return out;
  }
}

function depthConfig(depth: Depth): { maxResults: number; contextLines: number; graphTop: number } {
  switch (depth) {
    case 'rapide': return { maxResults: 10, contextLines: 3, graphTop: 0 };
    case 'approfondi': return { maxResults: 40, contextLines: 12, graphTop: 100 };
    default: return { maxResults: 20, contextLines: 6, graphTop: 5 };
  }
}

function isFalsePositive(concept: string, relPath: string): boolean {
  const term = concept.toLowerCase();
  if (STOPWORDS.has(term)) return false; // ne pas filtrer si le terme est un stopword (l'utilisateur sait ce qu'il cherche)
  const pathLower = relPath.toLowerCase().split('\\').join('/');
  // Fichiers de configuration ou build a faible valeur pour un concept
  if (/\.(lock|min\.js|min\.css)$/.test(relPath)) return true;
  if (pathLower.includes('node_modules') || pathLower.includes('/dist/') || pathLower.includes('/build/')) return true;
  return false;
}

/** Fichiers internes du framework Conductor (tracks, archives, registre) */
function isConductorPath(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return lower.includes('/conductor/') ||
    lower.includes('\\conductor\\') ||
    lower.endsWith('/tracks.md') ||
    lower.endsWith('\\tracks.md');
}

interface ContextBlock { path: string; lines: string[]; }

function buildContexts(
  indexer: ProjectIndexer,
  byFile: Map<string, Array<{ line: number }>>,
  contextLines: number,
  concept: string
): ContextBlock[] {
  const contexts: ContextBlock[] = [];
  for (const [file, hits] of byFile) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
    const content = fs.readFileSync(full, 'utf-8');
    const allLines = content.split('\n');
    const seen = new Set<number>();
    const out: string[] = [];
    for (const h of hits.slice(0, 6)) {
      const center = h.line - 1;
      const start = Math.max(0, center - contextLines);
      const end = Math.min(allLines.length, center + contextLines + 1);
      for (let i = start; i < end; i++) {
        if (seen.has(i)) continue;
        seen.add(i);
        const marker = i === center ? ' >>' : '   ';
        out.push(`${marker} L${i + 1}: ${allLines[i]}`);
      }
      out.push('');
    }
    if (out.length > 0) contexts.push({ path: file, lines: out });
  }
  return contexts;
}

interface RelationBlock { path: string; imports: string[]; importedBy: string[]; }

function buildRelations(indexer: ProjectIndexer, centralFiles: string[]): RelationBlock[] {
  return centralFiles.map(file => ({
    path: file,
    imports: indexer.getDependencies(file),
    importedBy: indexer.getDependents(file).slice(0, 15),
  }));
}
