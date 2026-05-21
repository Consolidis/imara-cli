import chalk from 'chalk';
import { theme } from '../theme';
import { formatToolAction } from '../tool-labels';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

let spinnerIndex = 0;
let spinnerInterval: ReturnType<typeof setInterval> | null = null;
let currentLabel = '';

function clearSpinnerLine(): void {
  process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
}

export function showToolCall(name: string, args: Record<string, unknown>, durationMs?: number): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }

  const action = formatToolAction(name, args);
  const check = chalk.hex(theme.accent)('✓');
  const duration = durationMs ? chalk.hex(theme.muted)(` · ${durationMs}ms`) : '';

  clearSpinnerLine();
  process.stdout.write(`  ${check} ${chalk.hex(theme.muted)(action)}${duration}\n`);
}

export function startToolCallSpinner(name: string, args: Record<string, unknown>): void {
  if (spinnerInterval) clearInterval(spinnerInterval);

  currentLabel = formatToolAction(name, args);
  spinnerIndex = 0;

  const tick = () => {
    const frame = chalk.hex(theme.warning)(SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]);
    clearSpinnerLine();
    process.stdout.write(`  ${frame} ${chalk.hex(theme.muted)(currentLabel)}`);
    spinnerIndex++;
  };

  tick();
  spinnerInterval = setInterval(tick, 80);
}

export function stopToolCallSpinner(): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    clearSpinnerLine();
  }
}
