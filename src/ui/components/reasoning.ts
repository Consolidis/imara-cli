import chalk from 'chalk';
import { theme, wrapText } from '../theme';

/** Reasoning block — dimmed/italicized process. */
export function showReasoning(text: string): void {
  if (!text?.trim()) return;

  const width = Math.min(78, (process.stdout.columns || 80) - 6);
  const lines = wrapText(text.trim(), width);

  process.stdout.write('\n');
  process.stdout.write('  ' + chalk.hex(theme.muted).bold('🧠 Pensée :') + '\n');
  for (const line of lines) {
    process.stdout.write('    ' + chalk.hex(theme.muted).italic(line) + '\n');
  }
  process.stdout.write('\n');
}
