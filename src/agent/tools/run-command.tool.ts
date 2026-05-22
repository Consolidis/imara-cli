import { exec } from 'child_process';
import * as path from 'path';
import { ToolDefinition } from '../agent.types';

const BLACKLISTED_COMMANDS = [
  // Unix
  'rm -rf /', 'rm -rf ~', 'sudo rm', 'dd if=/dev/zero', '> /dev/sda', 'mkfs',
  // Windows
  'format c:', 'del /s /q c:\\', 'rd /s /q c:\\',
  'Remove-Item -Recurse -Force C:\\',
];

export class RunCommandTool {
  static definition: ToolDefinition = {
    name: 'run_command',
    description: 'Exécute une commande shell. Vous pouvez spécifier le répertoire de travail (cwd) pour cibler un sous-répertoire ou un sous-dépôt Git spécifique.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'La commande à exécuter' },
        cwd: { type: 'string', description: 'Le répertoire de travail dans lequel exécuter la commande (optionnel, doit être confiné dans le workspace du projet)' }
      },
      required: ['command']
    }
  };

  static async run(args: { command: string; cwd?: string }): Promise<string> {
    const cmd = args.command.toLowerCase();
    
    if (BLACKLISTED_COMMANDS.some(b => cmd.includes(b))) {
      throw new Error('Sécurité: Commande interdite.');
    }

    const root = process.cwd();
    let targetCwd = root;
    
    if (args.cwd) {
      const resolvedCwd = path.resolve(root, args.cwd);
      if (!resolvedCwd.startsWith(root)) {
        throw new Error('Sécurité: Le répertoire cible doit être confiné dans le workspace du projet.');
      }
      targetCwd = resolvedCwd;
    }

    return new Promise((resolve, reject) => {
      const child = exec(
        args.command,
        {
          cwd: targetCwd,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe']
        } as any,
        (error: any, stdout: any, stderr: any) => {
          const result = stdout + stderr;
          if (error && !result) {
            reject(new Error(error.message));
          } else {
            resolve(result || 'Commande exécutée (pas de sortie).');
          }
        }
      );

      if (child.stdin) {
        child.stdin.on('error', () => {
          // Ignorer silencieusement les erreurs de pipe/écriture si le flux se ferme
        });
      }

      const checkPrompts = (data: string) => {
        if (!child.stdin || !child.stdin.writable) return;

        const yNPatterns = [
          /\[y\/n\]/i,
          /\(y\/n\)/i,
          /y\/n\s*\?/i,
          /continue\?/i,
          /confirm\?/i,
          /voulez-vous continuer/i
        ];

        const enterPatterns = [
          /press enter/i,
          /appuyez sur entrée/i,
          /presser entrée/i,
          /touche entrée/i
        ];

        if (yNPatterns.some(p => p.test(data))) {
          try {
            child.stdin.write('y\n');
          } catch {
            // Échec d'écriture ignoré
          }
        } else if (enterPatterns.some(p => p.test(data))) {
          try {
            child.stdin.write('\n');
          } catch {
            // Échec d'écriture ignoré
          }
        }
      };

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          checkPrompts(chunk.toString());
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          checkPrompts(chunk.toString());
        });
      }
    });
  }
}
