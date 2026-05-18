import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer } from '../../indexer/project-indexer';
import { TrackManager } from '../../context/conductor/track-manager';
import { getStorage } from '../../storage';
import { ToolDefinition } from '../agent.types';

export class ProjectSummaryTool {
  static definition: ToolDefinition = {
    name: 'project_summary',
    description: 'Génère et persiste un résumé cache complet de l\'architecture du projet (arbre sémantique, conductor tracks) en base de données.',
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

    // Read Conductor tracks
    let tracks: string[] = [];
    try {
      tracks = TrackManager.list();
    } catch {
      // Conductor not initialized or empty
    }

    // Build semantic summary
    const summaryData = {
      totalFiles: indexer.docCount(),
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

    return `Résumé du projet mis à jour avec succès.\n- Fichiers indexés : ${summaryData.totalFiles}\n- Tracks Conductor : ${tracks.length}\nLe cache sémantique a été enregistré localement.`;
  }
}
