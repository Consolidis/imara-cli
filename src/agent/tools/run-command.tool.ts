import { exec } from 'child_process';
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
    description: 'Exécute une commande shell dans le répertoire du projet.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'La commande à exécuter' }
      },
      required: ['command']
    }
  };

  static async run(args: { command: string }) {
    const cmd = args.command.toLowerCase();
    
    if (BLACKLISTED_COMMANDS.some(b => cmd.includes(b))) {
      throw new Error('Sécurité: Commande interdite.');
    }

    return new Promise((resolve, reject) => {
      exec(args.command, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
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
