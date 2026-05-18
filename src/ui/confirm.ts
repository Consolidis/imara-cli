import chalk from 'chalk';
import { theme } from './theme';

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
  }
}
