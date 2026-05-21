import chalk from 'chalk';
import { theme } from '../theme';
import { getVersion } from '../../utils/version';

export function isNativeModel(modelName: string): boolean {
  const nativeList = ['zuri', 'imara-zuri', 'standard', 'imara', 'flash', 'imara-flash'];
  return nativeList.includes(modelName.toLowerCase());
}

/** Minimal welcome — Claude Code–inspired, low noise. */
export function renderWelcome(config: {
  model: string;
  projectName: string;
  projectType: string;
  mode: string;
}): void {
  console.clear();

  console.log(
    chalk.hex(theme.primary).bold('  IMARA') +
      chalk.hex(theme.muted)(`  v${getVersion()}  ·  `) +
      chalk.hex(theme.text)(config.projectName) +
      chalk.hex(theme.muted)(` (${config.projectType})`)
  );

  console.log(
    '  ' +
      chalk.hex(theme.muted)('model ') +
      chalk.hex(theme.secondary).bold(config.model.toUpperCase()) +
      chalk.hex(theme.muted)('  ·  ') +
      chalk.hex(theme.muted)(config.mode) +
      chalk.hex(theme.muted)('  ·  ') +
      chalk.hex(theme.muted)('Ctrl+C interrupt  ·  /help')
  );

  if (!isNativeModel(config.model)) {
    console.log(
      chalk.hex(theme.warning)(
        '  ⚠ Modèle non-natif : 5.00 FCFA / requête — vérifiez votre solde wallet.'
      )
    );
  }

  console.log(chalk.hex(theme.muted)('  ' + '─'.repeat(Math.min(56, (process.stdout.columns || 80) - 4))));
  console.log('');
}
