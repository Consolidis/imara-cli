import chalk from 'chalk';
import { theme, wrapText } from '../theme';

/** Affiche la saisie utilisateur (après effacement de l’écho readline) avec un fond gris uni. */
export function showUserMessage(text: string): void {
  const terminalWidth = process.stdout.columns || 80;
  const paddingLeft = 4;
  const textWidth = Math.max(10, terminalWidth - paddingLeft - 4);
  const lines = wrapText(text, textWidth);

  // Top padding line
  const topPadding = ' '.repeat(terminalWidth);
  process.stdout.write(chalk.bgHex('#262626')(topPadding) + '\n');

  lines.forEach((line, i) => {
    const isFirst = i === 0;
    const prefix = isFirst ? '  ❯ ' : '    ';
    const plainLine = prefix + line;
    const remaining = Math.max(0, terminalWidth - plainLine.length);
    const spaces = ' '.repeat(remaining);

    const coloredPrefix = isFirst
      ? chalk.hex(theme.muted)('  ❯ ')
      : '    ';
    const coloredText = chalk.hex(theme.text)(line);
    const coloredLineContent = coloredPrefix + coloredText + spaces;

    process.stdout.write(chalk.bgHex('#262626')(coloredLineContent) + '\n');
  });

  // Bottom padding line
  const bottomPadding = ' '.repeat(terminalWidth);
  process.stdout.write(chalk.bgHex('#262626')(bottomPadding) + '\n');
}

