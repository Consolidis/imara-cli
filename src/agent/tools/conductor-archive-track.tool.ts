import { ToolDefinition } from '../agent.types';
import { TrackManager } from '../../context/conductor/track-manager';
import * as fs from 'fs';
import * as path from 'path';

export class ConductorArchiveTrackTool {
  static definition: ToolDefinition = {
    name: 'conductor_archive_track',
    description: 'Archive le track actif une fois terminé. Déplace le dossier vers archive/ et met à jour le registre.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Bref résumé de ce qui a été accompli' }
      }
    }
  };

  static async run(args: { reason?: string }) {
    const track = TrackManager.getActive();
    if (!track) return 'Erreur : Aucun track actif.';

    try {
      const conductorDir = TrackManager.getConductorDir();
      const archiveDir = path.join(conductorDir, 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      const dest = path.join(archiveDir, track.id);
      fs.renameSync(track.dir, dest);
      
      TrackManager.clearActive();

      // Update tracks.md
      const tracksMd = path.join(conductorDir, 'tracks.md');
      if (fs.existsSync(tracksMd)) {
        let content = fs.readFileSync(tracksMd, 'utf-8');
        // Simple update: move from "In Progress" to "Archived"
        // This is a bit naive but works for a first version
        content = content.replace(new RegExp(`- \\*\\*${track.id}\\*\\*.*\\n`, 'g'), '');
        content += `- **${track.id}**: [x] 100% (${args.reason || 'Terminé'})\n`;
        fs.writeFileSync(tracksMd, content, 'utf-8');
      }

      return `Succès : Track "${track.id}" archivé dans ${path.relative(process.cwd(), dest)}.`;
    } catch (error: any) {
      return `Erreur lors de l'archivage : ${error.message}`;
    }
  }
}
