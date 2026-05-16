// src/ui/components/status-bar.ts
// Bottom persistent status bar for the chat session.
import chalk from 'chalk';
import { theme } from '../theme';

export interface StatusState {
  model: string;
  tokens: number;
  costFcfa: number;
  trackId?: string;
  phase?: 'idle' | 'thinking' | 'tool';
}

let lastLineCount = 0;

/**
 * Renders a sticky bottom status bar.
 * Overwrites previous bar using ANSI escape sequences.
 */
export function renderStatusBar(state: StatusState): void {
  const termWidth = process.stdout.columns || 80;

  // Erase previous bar lines
  for (let i = 0; i < lastLineCount; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }

  const modelStr   = chalk.hex(theme.secondary)(state.model.toUpperCase());
  const tokenStr   = chalk.hex(theme.muted)(`${state.tokens.toLocaleString()}tk`);
  const costStr    = chalk.hex(theme.muted)(`${state.costFcfa.toFixed(2)} FCFA`);
  const trackStr   = state.trackId
    ? chalk.hex(theme.warning)('TRK ') + chalk.hex(theme.text)(state.trackId)
    : chalk.hex(theme.muted)('no track');

  const phaseIcon =
    state.phase === 'thinking' ? chalk.hex(theme.warning)('⠋') :
    state.phase === 'tool'     ? chalk.hex(theme.accent)('◆') :
                                 chalk.hex(theme.muted)('○');

  const left  = `${phaseIcon} ${modelStr} · ${tokenStr}`;
  const right = `${costStr} · ${trackStr}`;
  const midPad = Math.max(1, termWidth - left.length - right.length - 2);
  const line = `${left}${' '.repeat(midPad)}${right}`;

  const bar = chalk.bgHex(theme.bg)(chalk.hex(theme.muted)(` ${line} `));
  process.stdout.write(`\n${bar}\n`);
  lastLineCount = 2; // one blank before bar + bar line
}

export function clearStatusBar(): void {
  for (let i = 0; i < lastLineCount; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }
  lastLineCount = 0;
}
