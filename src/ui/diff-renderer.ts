import chalk from 'chalk';
import * as diff from 'diff';
import { theme } from './theme';

export function showDiff(filePath: string, oldContent: string, newContent: string): void {
  const short = filePath.replace(/\\/g, '/');
  console.log(
    chalk.hex(theme.muted)('  ⎿ ') +
      chalk.hex(theme.secondary)('Diff ') +
      chalk.hex(theme.text)(short)
  );

  const differences = diff.diffLines(oldContent, newContent);
  let changeCount = 0;

  for (const part of differences) {
    const color = part.added
      ? chalk.hex(theme.accent)
      : part.removed
        ? chalk.hex(theme.error)
        : chalk.hex(theme.muted);
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';

    if (part.added || part.removed) {
      changeCount++;
      const lines = part.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l.length > 0);
      const maxLines = 24;
      const shown = lines.length > maxLines ? [...lines.slice(0, maxLines), `… (${lines.length - maxLines} more lines)`] : lines;
      for (const line of shown) {
        process.stdout.write('    ' + color(prefix + line) + '\n');
      }
    } else {
      const lines = part.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l.length > 0);
      if (lines.length > 3) {
        process.stdout.write('    ' + color(' ' + lines[0]) + '\n');
        process.stdout.write(chalk.hex(theme.muted)('    …\n'));
        process.stdout.write('    ' + color(' ' + lines[lines.length - 1]) + '\n');
      } else {
        for (const line of lines) {
          process.stdout.write('    ' + color(' ' + line) + '\n');
        }
      }
    }
  }

  if (changeCount === 0) {
    process.stdout.write(chalk.hex(theme.muted)('    (no line changes)\n'));
  }
  process.stdout.write('\n');
}
