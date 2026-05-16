import { execSync } from 'child_process';
import { ToolDefinition } from '../agent.types';

export class GitDiffTool {
  static definition: ToolDefinition = {
    name: 'git_diff',
    description: 'Affiche les modifications non validées (staged ou non) dans le projet actuel. Utile pour vérifier ce qui a été changé.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Chemin optionnel pour limiter le diff' }
      }
    }
  };

  static async run(args: { path?: string }): Promise<string> {
    try {
      const pathArg = args.path ? ` -- "${args.path}"` : '';
      const diff = execSync(`git diff HEAD${pathArg}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (!diff || diff.trim() === '') return 'Aucune modification détectée par rapport à HEAD.';
      const lines = diff.split('\n');
      if (lines.length > 1000) {
        return `${lines.slice(0, 1000).join('\n')}\n\n[... Diff tronqué car trop volumineux (${lines.length} lignes) ...]`;
      }
      return diff;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not a git repository')) throw new Error('Erreur: Ce dossier n\'est pas un dépôt Git.');
      throw new Error(`Erreur lors de l'exécution de git diff: ${msg}`);
    }
  }
}
