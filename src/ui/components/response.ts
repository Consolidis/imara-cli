import chalk from 'chalk';
import { theme, wrapText } from '../theme';

/** Assistant reply — clean prose block (Claude Code–style, minimal chrome). */
export function showResponse(text: string): void {
  if (!text?.trim()) return;

  const cleanedText = text.replace(/\*\*/g, '');
  const width = Math.min(78, (process.stdout.columns || 80) - 4);
  const lines = wrapText(cleanedText.trim(), width);

  process.stdout.write('\n');
  for (const line of lines) {
    process.stdout.write('  ' + chalk.hex(theme.text)(line) + '\n');
  }
  process.stdout.write('\n');
}
