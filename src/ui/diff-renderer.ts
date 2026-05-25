import chalk from 'chalk';
import * as diff from 'diff';
import { theme } from './theme';

interface DiffLine {
  kind: 'added' | 'removed' | 'context';
  oldLine: number | '';
  newLine: number | '';
  content: string;
}

const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  sep: '├', sepEnd: '┴',
};

function padNum(n: number | '', w: number): string {
  if (n === '') return ' '.repeat(w);
  return String(n).padStart(w);
}

function buildHunkLines(differences: diff.Change[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const part of differences) {
    const partLines = part.value.replace(/\n$/, '').split('\n');
    if (part.added) {
      for (const line of partLines) {
        lines.push({ kind: 'added', oldLine: '', newLine: ++newLine, content: line });
      }
    } else if (part.removed) {
      for (const line of partLines) {
        lines.push({ kind: 'removed', oldLine: ++oldLine, newLine: '', content: line });
      }
    } else {
      for (const line of partLines) {
        lines.push({ kind: 'context', oldLine: ++oldLine, newLine: ++newLine, content: line });
      }
    }
  }
  return lines;
}

function getCharWidth(): number {
  return Math.min(100, (process.stdout.columns || 80) - 2);
}

function renderDiffBox(filePath: string, diffLines: DiffLine[]): void {
  const width = getCharWidth();
  const lnWidth = 4; // largeur colonne numéros de ligne
  const shortPath = filePath.replace(/\\/g, '/');

  // --- HEADER ---
  console.log(chalk.hex(theme.muted)(`  ${BOX.tl}${BOX.h.repeat(width - 2)}${BOX.tr}`));
  const headerContent = `  diff --git a/${shortPath} b/${shortPath}  `;
  const headerPad = width - 2 - headerContent.length;
  const headerLine = headerContent + (headerPad > 0 ? BOX.h.repeat(headerPad) : '');
  process.stdout.write(chalk.hex(theme.muted)(`  ${BOX.v}`));
  process.stdout.write(chalk.hex(theme.secondary).bold(headerContent));
  if (headerPad > 0) process.stdout.write(chalk.hex(theme.muted)(BOX.h.repeat(headerPad)));
  process.stdout.write(chalk.hex(theme.muted)(`${BOX.v}\n`));

  // --- SEPARATOR ---
  const sepLine = `  ${BOX.sep}${BOX.h.repeat(lnWidth * 2 + 2)}${BOX.sepEnd}${BOX.h.repeat(width - lnWidth * 2 - 6)}${BOX.sep}`;
  console.log(chalk.hex(theme.muted)(sepLine));
  const colHeader = `  ${BOX.v} ${'OLD'.padStart(lnWidth)} ${'NEW'.padStart(lnWidth)} | `;
  const colRest = `Changements`;
  const colPad = width - 3 - lnWidth * 2 - 3 - 13;
  process.stdout.write(chalk.hex(theme.muted)(colHeader));
  process.stdout.write(chalk.hex(theme.muted).bold(colRest));
  if (colPad > 0) process.stdout.write(chalk.hex(theme.muted)(' '.repeat(colPad)));
  process.stdout.write(chalk.hex(theme.muted)(`${BOX.v}\n`));

  const sep2 = `  ${BOX.sep}${BOX.h.repeat(lnWidth * 2 + 2)}${BOX.sepEnd}${BOX.h.repeat(width - lnWidth * 2 - 6)}${BOX.sep}`;
  console.log(chalk.hex(theme.muted)(sep2));

  // --- CONTENT ---
  const maxVisible = 36;
  const linesToShow = diffLines.length > maxVisible
    ? [...diffLines.slice(0, maxVisible)]
    : diffLines;

  for (const dl of linesToShow) {
    const oldStr = padNum(dl.oldLine, lnWidth);
    const newStr = padNum(dl.newLine, lnWidth);
    const prefix = dl.kind === 'added' ? '+' : dl.kind === 'removed' ? '-' : ' ';
    const content = dl.content.length > width - lnWidth * 2 - 8
      ? dl.content.slice(0, width - lnWidth * 2 - 11) + '...'
      : dl.content;

    const color = dl.kind === 'added'
      ? chalk.hex('#4caf50')
      : dl.kind === 'removed'
        ? chalk.hex('#f44336')
        : chalk.hex(theme.text);

    const bg = dl.kind === 'added'
      ? chalk.bgHex('#1a3a1a')
      : dl.kind === 'removed'
        ? chalk.bgHex('#3a1a1a')
        : (s: string) => s;

    const lineNumColor = dl.kind === 'added'
      ? chalk.hex('#81c784')
      : dl.kind === 'removed'
        ? chalk.hex('#e57373')
        : chalk.hex(theme.muted);

    const line = `  ${BOX.v} ${lineNumColor(oldStr)} ${lineNumColor(newStr)} ${color(prefix)}${bg(' ' + content)}`;
    const remaining = width - lnWidth * 2 - 8 - content.length;
    const padding = remaining > 0 ? ' '.repeat(remaining) : '';
    process.stdout.write(line + padding + chalk.hex(theme.muted)(`${BOX.v}\n`));
  }

  if (diffLines.length > maxVisible) {
    const remaining = diffLines.length - maxVisible;
    const msg = `  ... ${remaining} ligne(s) supplémentaire(s) tronquée(s)`;
    process.stdout.write(`  ${BOX.v} ${chalk.hex(theme.muted)(msg)}`);
    const padRest = width - 2 - msg.length;
    if (padRest > 0) process.stdout.write(' '.repeat(padRest));
    process.stdout.write(chalk.hex(theme.muted)(`${BOX.v}\n`));
  }

  // --- FOOTER ---
  console.log(chalk.hex(theme.muted)(`  ${BOX.bl}${BOX.h.repeat(width - 2)}${BOX.br}`));
  process.stdout.write('\n');
}

export function showDiff(filePath: string, oldContent: string, newContent: string): void {
  const differences = diff.diffLines(oldContent, newContent);

  // Vérifier si un changement a réellement eu lieu
  let hasChanges = false;
  for (const part of differences) {
    if (part.added || part.removed) {
      hasChanges = true;
      break;
    }
  }

  if (!hasChanges) {
    const short = filePath.replace(/\\/g, '/');
    console.log(chalk.hex(theme.muted)(`  ⎿ Diff ${short} (no line changes)\n`));
    return;
  }

  const diffLines = buildHunkLines(differences);
  renderDiffBox(filePath, diffLines);
}
