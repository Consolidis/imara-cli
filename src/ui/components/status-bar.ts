// src/ui/components/status-bar.ts
// Bottom persistent status bar for the chat session.
import chalk from 'chalk';
import { theme } from '../theme';
import { networkEvents } from '../../utils/events';

export interface StatusState {
  model: string;
  tokens: number;
  costFcfa: number;
  trackId?: string;
  phase?: 'idle' | 'tool';
  contextPercent?: number;
  contextState?: 'ok' | 'warning' | 'critical' | 'compacted';
}

let lastLineCount = 0;
let isStatusBarActive = false;
let lastKnownState: StatusState | null = null;

/**
 * Renders a sticky bottom status bar below the current prompt line.
 * Uses ANSI escape sequences to save/restore the cursor position.
 */
export function renderStatusBar(state: StatusState): void {
  lastKnownState = state;
  const termWidth = process.stdout.columns || 80;

  // 1. Erase previous bar if active
  if (isStatusBarActive && lastLineCount > 0) {
    process.stdout.write('\x1b[s'); // Save cursor position
    for (let i = 0; i < lastLineCount; i++) {
      process.stdout.write('\n\x1b[2K'); // Move down and clear line
    }
    process.stdout.write('\x1b[u'); // Restore cursor position
  }

  // 2. Format network pastille
  const networkStatus = networkEvents.getStatus();
  let netStr = '';
  if (networkStatus === 'online') {
    netStr = chalk.green('● EN LIGNE');
  } else if (networkStatus === 'degraded') {
    netStr = chalk.yellow('● DÉGRADÉ');
  } else {
    netStr = chalk.red('● HORS-LIGNE');
  }

  const modelStr   = chalk.hex(theme.secondary)(state.model.toUpperCase());
  const tokenStr   = chalk.hex(theme.muted)(`${state.tokens.toLocaleString()}tk`);
  const costStr    = chalk.hex(theme.muted)(`${state.costFcfa.toFixed(2)} FCFA`);
  const trackStr   = state.trackId
    ? chalk.hex(theme.warning)('TRK ') + chalk.hex(theme.text)(state.trackId)
    : chalk.hex(theme.muted)('no track');

  let ctxStr = '';
  if (state.contextPercent !== undefined && state.contextState) {
    const ctxColor = state.contextState === 'critical' ? theme.error :
                     state.contextState === 'warning' ? theme.warning :
                     theme.accent;
    ctxStr = chalk.hex(ctxColor)(`· ctx:${state.contextPercent}%`);
  }

  const phaseIcon =
    state.phase === 'tool' ? chalk.hex(theme.accent)('◆') :
                             chalk.hex(theme.muted)('○');

  const left  = `${phaseIcon} ${modelStr} · ${tokenStr} · ${netStr}`;
  const mid   = ctxStr;
  const right = `${costStr} · ${trackStr}`;
  const innerWidth = termWidth - left.length - right.length - 4;
  const midPad = Math.max(1, innerWidth - mid.length);
  const line = `${left}${ctxStr}${' '.repeat(midPad)}${right}`;

  const bar = chalk.bgHex(theme.bg)(chalk.hex(theme.muted)(` ${line} `));

  // 3. Print the bar below the prompt and restore cursor
  process.stdout.write('\x1b[s'); // Save cursor position
  process.stdout.write(`\n${bar}\n`); // Draw on lines below
  lastLineCount = 2; // Blank line + bar line
  isStatusBarActive = true;
  process.stdout.write('\x1b[u'); // Restore cursor position to the input prompt line
}

/**
 * Erases the status bar from the terminal completely to avoid it entering the scrollback history.
 */
export function clearStatusBar(): void {
  if (isStatusBarActive && lastLineCount > 0) {
    process.stdout.write('\x1b[s'); // Save cursor
    process.stdout.write('\n\x1b[J'); // Move to the next line and clear to bottom of viewport
    process.stdout.write('\x1b[u'); // Restore cursor
    lastLineCount = 0;
    isStatusBarActive = false;
  }
}

// Listen for network status changes to dynamically update the status bar
networkEvents.on('status', () => {
  if (lastKnownState) {
    renderStatusBar(lastKnownState);
  }
});
