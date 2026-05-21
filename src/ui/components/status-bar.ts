import chalk from 'chalk';
import { theme } from '../theme';
import { networkEvents } from '../../utils/events';
import { AgentPhase } from '../ui-events';
import { visibleLength } from '../ansi';

export interface StatusState {
  model: string;
  tokens: number;
  costFcfa: number;
  trackId?: string;
  phase?: AgentPhase;
  activity?: string;
  contextPercent?: number;
  contextState?: 'ok' | 'warning' | 'critical' | 'compacted';
}

let isStatusBarActive = false;
let lastKnownState: StatusState | null = null;
let lastPaintedLine = '';
/** When false, state updates silently — no stdout (avoids spam during tool runs). */
let pinnedToPrompt = false;

function padLine(content: string, width: number): string {
  const len = visibleLength(content);
  const pad = Math.max(0, width - len);
  return content + ' '.repeat(pad);
}

function buildBarLine(state: StatusState): string {
  const termWidth = process.stdout.columns || 80;
  const innerWidth = Math.max(40, termWidth - 2);

  const networkStatus = networkEvents.getStatus();
  let netStr = '';
  if (networkStatus === 'online') {
    netStr = chalk.hex(theme.accent)('●');
  } else if (networkStatus === 'degraded') {
    netStr = chalk.hex(theme.warning)('◐');
  } else {
    netStr = chalk.hex(theme.error)('○');
  }

  const modelStr = chalk.hex(theme.secondary)(state.model.toUpperCase());
  const tokenStr = chalk.hex(theme.muted)(`${state.tokens.toLocaleString()} tk`);
  const costStr = chalk.hex(theme.muted)(`${state.costFcfa.toFixed(2)} FCFA`);

  let ctxStr = '';
  if (state.contextPercent !== undefined && state.contextState) {
    const ctxColor =
      state.contextState === 'critical' || state.contextState === 'compacted'
        ? theme.error
        : state.contextState === 'warning'
          ? theme.warning
          : theme.muted;
    ctxStr = chalk.hex(ctxColor)(`${state.contextPercent}%`);
  }

  const phase = state.phase ?? 'idle';
  let phaseStr = '';
  if (phase === 'thinking') {
    phaseStr = chalk.hex(theme.warning)('…');
  } else if (phase === 'tool' && state.activity) {
    phaseStr = chalk.hex(theme.muted)(state.activity);
  }

  const trackId = state.trackId ? state.trackId.slice(0, 20) : '';
  const trackStr = trackId ? chalk.hex(theme.muted)(trackId) : '';

  const parts = [netStr, modelStr, tokenStr, ctxStr, phaseStr, costStr, trackStr].filter(Boolean);
  const line = padLine(parts.join(chalk.hex(theme.muted)(' · ')), innerWidth);
  return chalk.bgHex(theme.bg)(chalk.hex(theme.muted)(` ${line} `));
}

function paintIfChanged(bar: string): void {
  if (bar === lastPaintedLine && isStatusBarActive) return;
  lastPaintedLine = bar;

  if (isStatusBarActive) {
    process.stdout.write('\x1b[1A\r\x1b[2K');
  }
  process.stdout.write(`${bar}\n`);
  isStatusBarActive = true;
}

/** Save state; paint only when pinned to the input prompt (idle). */
export function renderStatusBar(state: StatusState): void {
  lastKnownState = state;
  if (!pinnedToPrompt) return;

  const bar = buildBarLine(state);
  paintIfChanged(bar);
}

export function setStatusBarPinned(pinned: boolean): void {
  pinnedToPrompt = pinned;
  if (!pinned) {
    clearStatusBar();
    lastPaintedLine = '';
    return;
  }
  if (lastKnownState) {
    renderStatusBar(lastKnownState);
  }
}

export function clearStatusBar(): void {
  if (isStatusBarActive) {
    process.stdout.write('\x1b[1A\r\x1b[2K');
    isStatusBarActive = false;
  }
  lastPaintedLine = '';
}

networkEvents.on('status', () => {
  if (pinnedToPrompt && lastKnownState) {
    renderStatusBar(lastKnownState);
  }
});
