import { ToolDefinition } from '../agent.types';
import { TrackManager } from '../../context/conductor/track-manager';

export class ConductorValidatePlanTool {
  static definition: ToolDefinition = {
    name: 'conductor_validate_plan',
    description: 'Marque le plan du track actif comme validé. À utiliser UNIQUEMENT après que l\'utilisateur a donné son accord explicite.',
    parameters: {
      type: 'object',
      properties: {
        confirmation: { type: 'boolean', description: 'Confirmation que l\'utilisateur a validé le plan' }
      },
      required: ['confirmation']
    }
  };

  static async run(args: { confirmation: boolean }) {
    if (!args.confirmation) return 'Validation annulée.';
    
    const track = TrackManager.getActive();
    if (!track) return 'Erreur : Aucun track actif.';

    TrackManager.validateTrack();
    return `Succès : Le plan du track "${track.id}" est maintenant validé. Vous pouvez commencer l'exécution (Phase 3).`;
  }
}
