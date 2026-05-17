// src/ui/screens/welcome.ts
import chalk from 'chalk';
import { theme } from '../theme';
import { getVersion } from '../../utils/version';

export function isNativeModel(modelName: string): boolean {
  const nativeList = ['zuri', 'imara-zuri', 'standard', 'imara', 'flash', 'imara-flash'];
  return nativeList.includes(modelName.toLowerCase());
}

export function renderWelcome(config: {
  model: string;
  projectName: string;
  projectType: string;
  mode: string;
}): void {
  console.clear();
  
  // High-fidelity spaced ASCII banner
  console.log(chalk.hex(theme.primary).bold(`
   ___  __  __   _   ___   _      ___  ___  ___  ___ 
  |_ _| | \\/ |  / \\ | _ \\ / \\    / __|/ _ \\|   \\| __|
   | |  | |\\/| |/ _ \\|   // _ \\  | (__| (_) | |) | _| 
  |___| |_|  |_/_/ \\_\\_|_n_/ \\_\\  \___|\\___/|___/|___|`));

  console.log(chalk.hex(theme.muted)(`  Engineering Intelligence · v${getVersion()}\n`));

  // Compact session bar
  const sessionLine = [
    chalk.hex(theme.secondary)('◆'),
    chalk.hex(theme.muted)('Modèle'),
    chalk.hex(theme.primary).bold(config.model.toUpperCase()),
    chalk.hex(theme.muted)('·'),
    chalk.hex(theme.accent).bold(config.projectName),
    chalk.hex(theme.muted)(`(${config.projectType})`),
    chalk.hex(theme.muted)('·'),
    chalk.hex(theme.muted)('Mode'),
    chalk.hex(theme.secondary)(config.mode),
  ].join(' ');

  console.log('  ' + sessionLine);
  console.log(chalk.hex(theme.muted)('  ' + '─'.repeat(58)));
  console.log(chalk.hex(theme.muted)(`  💡 Astuce : Changez de modèle à tout moment en tapant : ${chalk.hex(theme.accent)('/model <nom>')}`));

  // Dynamic non-native model notification panel
  if (!isNativeModel(config.model)) {
    console.log(chalk.hex(theme.warning).bold('\n  ┌────────────────────────────────────────────────────────┐'));
    console.log(chalk.hex(theme.warning).bold('  │ ⚠️  MODÈLE NON-NATIF ACTIF                              │'));
    console.log(chalk.hex(theme.warning).bold('  ├────────────────────────────────────────────────────────┤'));
    console.log(chalk.hex(theme.warning).bold('  │ • Un coût fixe de 5.00 FCFA est débité par requête.    │'));
    console.log(chalk.hex(theme.warning).bold('  │ • Assurez-vous d\'avoir des fonds suffisants.            │'));
    console.log(chalk.hex(theme.warning).bold('  └────────────────────────────────────────────────────────┘\n'));
  } else {
    console.log('');
  }
}
