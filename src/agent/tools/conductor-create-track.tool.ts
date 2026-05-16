import { ToolDefinition } from '../agent.types';
import { TrackManager } from '../../context/conductor/track-manager';

export class ConductorCreateTrackTool {
  static definition: ToolDefinition = {
    name: 'conductor_create_track',
    description: 'Crée un nouveau track de développement selon la méthodologie Conductor. Cela génère les dossiers et fichiers (index.md, plan.md, spec.md) nécessaires.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Le titre explicite du track (ex: "Implémentation de l\'authentification JWT")' }
      },
      required: ['title']
    }
  };

  static async run(args: { title: string }): Promise<string> {
    try {
      const track = TrackManager.newTrack(args.title);
      return `Succès : Track "${track.id}" créé avec succès.\nVous devez maintenant :\n1. Rédiger les spécifications dans ${track.id}/spec.md\n2. Définir les étapes dans ${track.id}/plan.md\n3. Demander l'approbation de l'utilisateur avant de commencer à coder.`;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      return `Erreur : ${err}`;
    }
  }
}
