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
      exec(args.command, { cwd: targetCwd, timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const result = stdout + stderr;
        if (error && !result) {
          reject(new Error(error.message));
        } else {
          resolve(result || 'Commande exécutée (pas de sortie).');
        }
      });
    });
  }
}
