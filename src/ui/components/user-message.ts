import chalk from 'chalk';
import { theme } from '../theme';

/** Affiche la saisie utilisateur (après effacement de l’écho readline). */
export function showUserMessage(text: string): void {
  const width = Math.min(72, (process.stdout.columns || 80) - 6);
  const lines = text.split('\n');
  const prefix = chalk.hex(theme.muted)('  ❯ ');

  lines.forEach((line, i) => {
    const display = line.length > width ? line.slice(0, width - 1) + '…' : line;
    const lead = i === 0 ? prefix : chalk.hex(theme.muted)('    ');
    process.stdout.write(lead + chalk.hex(theme.text)(display) + '\n');
  });
}
