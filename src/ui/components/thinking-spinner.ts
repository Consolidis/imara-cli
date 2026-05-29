import chalk from 'chalk';
import { theme } from '../theme';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DOTS_FRAMES = ['   ', '.  ', '.. ', '...', '.. ', '.  '];

let thinkingInterval: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

function clearLine(): void {
  process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
}

export function startThinkingSpinner(): void {
  if (thinkingInterval) clearInterval(thinkingInterval);
  frameIndex = 0;

  const tick = () => {
    const spinnerFrame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    const dots = DOTS_FRAMES[Math.floor(frameIndex / 2) % DOTS_FRAMES.length];
    clearLine();
    process.stdout.write(`  ${chalk.hex(theme.warning)(spinnerFrame)} ${chalk.hex(theme.muted)('pense')}${chalk.hex(theme.muted)(dots)}`);
    frameIndex++;
  };

  tick();
  thinkingInterval = setInterval(tick, 80);
}

export function stopThinkingSpinner(): void {
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
    clearLine();
  }
}
