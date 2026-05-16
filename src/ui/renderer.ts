export { showResponse } from './components/response';
export { showToolCall, startToolCallSpinner, stopToolCallSpinner } from './components/tool-call';
export { showIntention } from './components/intention';
export { showErrorPanel } from './components/error-panel';
export { renderStatusBar, clearStatusBar, type StatusState } from './components/status-bar';

import { showToolCall } from './components/tool-call';

// Legacy backward-compat re-exports
export function showToolResult(name: string, _result: unknown, durationMs?: number): void {
  showToolCall(name, {}, durationMs);
}

export function showError(message: string) {
  const chalk = require('chalk');
  const { theme } = require('./theme');
  console.error(`\n${chalk.bgHex(theme.error).white.bold(' ERREUR ')} ${chalk.hex(theme.error)(message)}\n`);
}
