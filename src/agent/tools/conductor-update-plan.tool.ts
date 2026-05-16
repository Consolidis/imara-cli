import { ToolDefinition } from '../agent.types';
import { TrackManager } from '../../context/conductor/track-manager';
import * as fs from 'fs';
import * as path from 'path';

export class ConductorUpdatePlanTool {
  static definition: ToolDefinition = {
    name: 'conductor_update_plan',
    description: 'Met à jour le statut des tâches dans le plan.md du track actif. Permet de cocher [x] ou de marquer en cours [~].',
    parameters: {
      type: 'object',
      properties: {
        taskName: { type: 'string', description: 'Le texte de la tâche à mettre à jour (partiel ou complet)' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Le nouveau statut de la tâche' }
      },
      required: ['taskName', 'status']
    }
  };

  static async run(args: { taskName: string; status: 'todo' | 'in_progress' | 'done' }) {
    const track = TrackManager.getActive();
    if (!track) return 'Erreur : Aucun track actif.';

    const planPath = path.join(track.dir, 'plan.md');
    if (!fs.existsSync(planPath)) return `Erreur : Fichier plan.md introuvable dans ${track.dir}`;

    let plan = fs.readFileSync(planPath, 'utf-8');
    const lines = plan.split('\n');
    
    let found = false;
    const newStatusIcon = args.status === 'done' ? '[x]' : args.status === 'in_progress' ? '[~]' : '[ ]';
    
    const updatedLines = lines.map(line => {
      if (line.toLowerCase().includes(args.taskName.toLowerCase()) && line.match(/^\s*- \[[ x~]\]/)) {
        found = true;
        return line.replace(/\[[ x~]\]/, newStatusIcon);
      }
      return line;
    });

    if (!found) return `Erreur : Tâche "${args.taskName}" non trouvée dans le plan.`;

    fs.writeFileSync(planPath, updatedLines.join('\n'), 'utf-8');
    return `Succès : La tâche "${args.taskName}" est maintenant marquée comme ${args.status}.`;
  }
}
