import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer } from '../../indexer/project-indexer';
import { TrackManager } from '../../context/conductor/track-manager';
import { getStorage } from '../../storage';
import { ToolDefinition } from '../agent.types';

export class ProjectSummaryTool {
  static definition: ToolDefinition = {
    name: 'project_summary',
    description: 'Génère et persiste un résumé cache complet de l\'architecture du projet (arborescence, graphe de dépendances, conductor tracks) en base de données.',
    parameters: {
      type: 'object',
      properties: {
        forceRefresh: { type: 'boolean', description: 'Force la réindexation complète de l\'architecture', default: false }
      }
    }
  };

  static async run(args: { forceRefresh?: boolean }): Promise<string> {
    const forceRefresh = !!args.forceRefresh;
    const indexDir = path.join(process.cwd(), '.imara');
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
    const indexPath = path.join(indexDir, 'index-cache.json');
    if (forceRefresh && fs.existsSync(indexPath)) {
      fs.unlinkSync(indexPath);
    }
    const indexer = new ProjectIndexer(indexPath);
    indexer.scan(process.cwd(), ['']);

    // Read Conductor tracks (actifs + archives)
    let tracks: Array<{ id: string; title: string; status: string }> = [];
    try {
      const all = TrackManager.getAllTracks();
      tracks = all.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
      }));
    } catch {
      // Conductor not initialized or empty
    }

    // Arborescence des dossiers cles (2-3 niveaux)
    const tree = this.buildTree(indexer, 3);

    // Top fichiers par taille
    const largest = indexer.getLargestFiles(8).map(f => ({ path: f.path, kb: Math.round(f.bytes / 1024) }));

    // Modules avec le plus de dependants
    const hubs = indexer.getMostDependentFiles(8);

    // Langages detectes
    const languages = indexer.getLanguageStats();

    const summaryData = {
      totalFiles: indexer.docCount(),
      languages,
      tree,
      largest,
      dependencyHubs: hubs,
      tracks,
      timestamp: Date.now()
    };

    const summaryContent = JSON.stringify(summaryData, null, 2);

    // Save in SQLite database if persistence is enabled
    const db = getStorage();
    if (db) {
      try {
        db.saveSummary({
          sessionId: 'global_project_summary',
          content: summaryContent,
          tokenCount: 0,
          createdAt: Date.now(),
          version: Date.now()
        });
      } catch {
        // Fallback silently if DB is in memory or write fails
      }
    }

    // Sortie console enrichie
    const langStr = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .map(([ext, n]) => `${ext}(${n})`)
      .join(', ');

    let out = `Résumé du projet mis à jour avec succès.\n`;
    out += `- Fichiers indexés : ${summaryData.totalFiles}\n`;
    out += `- Langages détectés : ${langStr || 'aucun'}\n`;
    out += `- Tracks Conductor : ${tracks.length}\n`;
    out += `\nARBORESCENCE (3 niveaux) :\n${tree.slice(0, 40).join('\n')}`;
    if (largest.length > 0) {
      out += `\n\nTOP FICHIERS PAR TAILLE :\n`;
      largest.forEach((f, i) => out += `${i + 1}. ${f.path} (${f.kb} KB)\n`);
    }
    if (hubs.length > 0) {
      out += `\nMODULES LES PLUS IMPORTES (impact) :\n`;
      hubs.forEach((h, i) => out += `${i + 1}. ${h.path} (${h.dependents} dependants)\n`);
    }
    out += `\nTRACKS RÉCENTS :\n`;
    tracks.slice(0, 10).forEach(t => out += `- [${t.status}] ${t.id} — ${t.title}\n`);
    out += `\nLe cache sémantique a été enregistré localement.`;
    return out;
  }

  /** Construit une arborescence texte des dossiers (N niveaux max) */
  private static buildTree(indexer: ProjectIndexer, maxDepth: number): string[] {
    const roots = new Map<string, Set<string>>();
    const filesByDir = new Map<string, number>();
    const paths = indexer.getPaths();
    for (const rel of paths) {
      const parts = rel.split('/');
      const dir = parts.slice(0, Math.min(maxDepth, parts.length - 1)).join('/');
      if (!dir) continue;
      if (!roots.has(dir)) roots.set(dir, new Set());
      roots.get(dir)!.add(parts[Math.min(maxDepth - 1, parts.length - 2)] || rel);
      filesByDir.set(dir, (filesByDir.get(dir) || 0) + 1);
    }
    const lines: string[] = [];
    const sorted = Array.from(roots.keys()).sort();
    for (const dir of sorted.slice(0, 60)) {
      const count = filesByDir.get(dir) || 0;
      const depth = dir.split('/').length;
      const indent = '  '.repeat(depth - 1);
      lines.push(`${indent}${dir.split('/').pop()}/ (${count} fichiers)`);
    }
    return lines;
  }
}
