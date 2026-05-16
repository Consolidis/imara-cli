// src/ui/screens/welcome.ts
import chalk from 'chalk';
import { theme } from '../theme';

export function renderWelcome(config: {
  model: string;
  projectName: string;
  projectType: string;
  mode: string;
}): void {
  console.clear();
  
  // Logo stylisé compact
  console.log(chalk.hex(theme.primary).bold(`
   ___  __  __   _   ___   _      ___  ___  ___  ___ 
  |_ _|/  \\/  \\ / \\ | _ \\ / \\    / __|/ _ \\|   \\| __|
   | || || || || o || v /| o |  | (__| (_) | |) | _| 
  |___||_||_||_||_n_||_|_\\|_n_|   \\___|\\___/|___/|___|`));

  console.log(chalk.hex(theme.muted)('  Engineering Intelligence · v1.0.0\n'));

  // Compact session bar
  const sessionLine = [
    chalk.hex(theme.secondary)('◆'),
    chalk.hex(theme.muted)('Modèle'),
    chalk.hex(theme.primary).bold(config.model),
    chalk.hex(theme.muted)('·'),
    chalk.hex(theme.accent).bold(config.projectName),
    chalk.hex(theme.muted)(`(${config.projectType})`),
    chalk.hex(theme.muted)('·'),
    chalk.hex(theme.muted)('Mode'),
    chalk.hex(theme.secondary)(config.mode),
  ].join(' ');

  console.log('  ' + sessionLine);
  console.log(chalk.hex(theme.muted)('  ' + '─'.repeat(58)));
  console.log('');
}

