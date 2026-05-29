import chalk from 'chalk';
import { theme, wrapText } from '../theme';

function parseTableRow(line: string): string[] {
  const parts = line.trim().split('|');
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.map(cell => cell.trim());
}

/** Assistant reply — clean prose block (Claude Code–style, minimal chrome). */
export function showResponse(text: string): void {
  if (!text?.trim()) return;

  const cleanedText = text.replace(/\*\*/g, '');
  const width = Math.min(78, (process.stdout.columns || 80) - 4);

  const lines = cleanedText.split('\n');
  const blocks: Array<{ type: 'prose' | 'table' | 'code'; lines: string[] }> = [];
  let currentBlock: { type: 'prose' | 'table' | 'code'; lines: string[] } | null = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (currentBlock && currentBlock.type === 'code') {
        currentBlock.lines.push(line);
        blocks.push(currentBlock);
        currentBlock = null;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'code', lines: [line] };
      }
      continue;
    }

    if (inCodeBlock) {
      if (!currentBlock || currentBlock.type !== 'code') {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'code', lines: [] };
      }
      currentBlock.lines.push(line);
      continue;
    }

    const isTableLine = trimmed.startsWith('|') && trimmed.endsWith('|');
    if (isTableLine) {
      if (currentBlock && currentBlock.type === 'table') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'table', lines: [line] };
      }
    } else {
      if (currentBlock && currentBlock.type === 'prose') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'prose', lines: [line] };
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  const validatedBlocks: typeof blocks = [];
  for (const block of blocks) {
    if (block.type === 'table') {
      const hasSeparator = block.lines.length >= 2 &&
        /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(block.lines[1].trim());
      if (hasSeparator) {
        validatedBlocks.push(block);
      } else {
        validatedBlocks.push({ type: 'prose', lines: block.lines });
      }
    } else {
      validatedBlocks.push(block);
    }
  }

  const mergedBlocks: typeof blocks = [];
  for (const block of validatedBlocks) {
    const last = mergedBlocks[mergedBlocks.length - 1];
    if (last && last.type === block.type) {
      last.lines.push(...block.lines);
    } else {
      mergedBlocks.push(block);
    }
  }

  process.stdout.write('\n');
  for (const block of mergedBlocks) {
    if (block.type === 'prose') {
      const proseText = block.lines.join('\n');
      const wrappedLines = wrapText(proseText.trim(), width);
      for (const line of wrappedLines) {
        process.stdout.write('  ' + chalk.hex(theme.text)(line) + '\n');
      }
    } else if (block.type === 'code') {
      for (const line of block.lines) {
        process.stdout.write('  ' + chalk.hex(theme.text)(line) + '\n');
      }
    } else if (block.type === 'table') {
      const headerRow = parseTableRow(block.lines[0]);
      const dataRows = block.lines.slice(2).map(line => parseTableRow(line));
      const numCols = headerRow.length;

      if (numCols > 0) {
        const colWidths = new Array(numCols).fill(0);
        for (let colIdx = 0; colIdx < numCols; colIdx++) {
          let maxW = headerRow[colIdx]?.length || 0;
          for (const dataRow of dataRows) {
            const cellW = dataRow[colIdx]?.length || 0;
            if (cellW > maxW) maxW = cellW;
          }
          colWidths[colIdx] = Math.max(1, maxW);
        }

        const topBorder = chalk.hex(theme.muted)(
          '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'
        );
        process.stdout.write('  ' + topBorder + '\n');

        const coloredHeaderCells = headerRow.map((cell, colIdx) => {
          return chalk.hex('#ff6600').bold(cell.padEnd(colWidths[colIdx]));
        });
        const headerLine = chalk.hex(theme.muted)('│ ') +
          coloredHeaderCells.join(chalk.hex(theme.muted)(' │ ')) +
          chalk.hex(theme.muted)(' │');
        process.stdout.write('  ' + headerLine + '\n');

        const separatorLine = chalk.hex(theme.muted)(
          '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'
        );
        process.stdout.write('  ' + separatorLine + '\n');

        for (const row of dataRows) {
          const coloredCells = colWidths.map((w, colIdx) => {
            const cell = row[colIdx] || '';
            return chalk.hex(theme.text)(cell.padEnd(w));
          });
          const dataLine = chalk.hex(theme.muted)('│ ') +
            coloredCells.join(chalk.hex(theme.muted)(' │ ')) +
            chalk.hex(theme.muted)(' │');
          process.stdout.write('  ' + dataLine + '\n');
        }

        const bottomBorder = chalk.hex(theme.muted)(
          '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'
        );
        process.stdout.write('  ' + bottomBorder + '\n');
      }
    }
  }
  process.stdout.write('\n');
}

