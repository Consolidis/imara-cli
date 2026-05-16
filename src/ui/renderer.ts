import chalk from 'chalk';
import { theme } from './theme';
import { showToolCall as uiShowToolCall } from './components/tool-call';
import { showResponse as uiShowResponse } from './components/response';
import { showIntention as uiShowIntention } from './components/intention';

export { showResponse as uiShowResponse } from './components/response';
export { showIntention } from './components/intention';


export function showResponse(content: string) {
  uiShowResponse(content);
}

export function showToolCall(name: string, args: Record<string, unknown>) {
  uiShowToolCall(name, args);
}

export function showToolResult(name: string, result: unknown, duration?: number) {
  uiShowToolCall(name, {}, duration);
}

export function showTokenUsage(usage: { totalTokens: number, costFcfa: number }) {
  if (!usage) return;
  const costStr = usage.costFcfa > 0 ? ` | Coût: ${usage.costFcfa.toFixed(2)} FCFA` : '';
  // Token usage is now handled on demand or exit, but we keep the method for compatibility
  // console.log(chalk.hex(theme.muted)(`\nUsage session: ${usage.totalTokens} tokens${costStr}`));
}

export function showError(message: string) {
  console.error(`\n${chalk.bgHex(theme.error).white.bold(' ERREUR ')} ${chalk.hex(theme.error)(message)}\n`);
}

export function showNewFile(path: string) {
  console.log(`${chalk.hex(theme.accent)('  📄 Nouveau fichier créé')} : ${path}`);
}
