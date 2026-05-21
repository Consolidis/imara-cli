import chalk from 'chalk';
import { theme } from './theme';
import { buildToolConfirmContent, formatConfirmFooter } from './tool-labels';

export async function confirmDangerousTool(
  name: string,
  args: Record<string, unknown>
): Promise<'yes' | 'no' | 'always'> {
  if (process.env.NODE_ENV === 'test') {
    return 'yes';
  }

  const { headline, body, kind } = buildToolConfirmContent(name, args);
  const footer = formatConfirmFooter(name, args);

  process.stdout.write('\n');
  if (kind === 'shell' && body) {
    process.stdout.write(chalk.hex(theme.warning)('  ⚠ ') + chalk.hex(theme.muted)(headline) + '\n');
    process.stdout.write(chalk.hex(theme.accent)('  $ ') + chalk.hex(theme.text)(body) + '\n');
    if (footer) {
      process.stdout.write(chalk.hex(theme.muted)(`  ${footer}\n`));
    }
    process.stdout.write('\n');
  } else if (body) {
    process.stdout.write(chalk.hex(theme.warning)('  ⚠ ') + chalk.hex(theme.muted)(headline) + '\n');
    process.stdout.write(chalk.hex(theme.text)(`  ${body}\n`));
    if (footer) process.stdout.write(chalk.hex(theme.muted)(`  ${footer}\n`));
    process.stdout.write('\n');
  }

  return confirmAction(headline);
}

export async function confirmAction(message: string): Promise<'yes' | 'no' | 'always'> {
  if (process.env.NODE_ENV === 'test') {
    return 'yes';
  }

  const { Select } = require('enquirer');
  const prompt = new Select({
    name: 'action',
    message: chalk.hex(theme.warning ?? '#ffcc00')(`⚠ ${message}`),
    choices: [
      { name: 'no', message: chalk.hex(theme.error ?? '#ff5555')('Non, refuser l\'exécution') },
      { name: 'yes', message: chalk.hex(theme.accent ?? '#55ff55')('Oui, accepter cette fois') },
      { name: 'always', message: chalk.hex(theme.primary ?? '#55ccff')('Toujours accepter pour cette session (Auto-Confirm)') }
    ]
  });

  try {
    const answer = await prompt.run();
    return answer as 'yes' | 'no' | 'always';
  } catch {
    return 'no';
  } finally {
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }
  }
}

export async function promptLoopResolution(message: string): Promise<'continue' | 'pause'> {
  if (process.env.NODE_ENV === 'test') {
    return 'continue';
  }

  const { Select } = require('enquirer');
  const prompt = new Select({
    name: 'loopAction',
    message: chalk.hex(theme.warning ?? '#ffcc00')(`⚠ ${message}`),
    choices: [
      { name: 'continue', message: chalk.hex(theme.accent ?? '#55ff55')('Continuer (forcer le passage)') },
      { name: 'pause', message: chalk.hex(theme.error ?? '#ff5555')('Mettre en pause et revenir au chat') }
    ]
  });

  try {
    const answer = await prompt.run();
    return answer as 'continue' | 'pause';
  } catch {
    return 'pause';
  } finally {
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }
  }
}

