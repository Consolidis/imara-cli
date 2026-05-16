import chalk from 'chalk';
import { theme } from './theme';

export async function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(chalk.hex(theme.warning)(`\n  ⚠ ${message} `) + chalk.hex(theme.muted)('(y/N) '));

    // Read directly from stdin without creating a new readline interface
    // (creating one would call stdin.pause() on close, killing the main chat loop)
    const onData = (data: Buffer) => {
      process.stdin.removeListener('data', onData);
      const answer = data.toString().trim().toLowerCase();
      process.stdout.write('\n');
      resolve(answer === 'y' || answer === 'yes' || answer === 'o' || answer === 'oui');
    };

    process.stdin.once('data', onData);
  });
}
