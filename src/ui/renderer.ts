export { showResponse } from './components/response';
export { showReasoning } from './components/reasoning';
export { showToolCall, startToolCallSpinner, stopToolCallSpinner } from './components/tool-call';
export { showIntention } from './components/intention';
export { showErrorPanel } from './components/error-panel';
export { renderStatusBar, clearStatusBar, setStatusBarPinned, type StatusState } from './components/status-bar';
export { showUserMessage } from './components/user-message';
export { uiEvents, type AgentPhase } from './ui-events';

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
