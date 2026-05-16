// src/ui/components/error-panel.ts
// Contextual error display with actionable help messages.
import chalk from 'chalk';
import { theme } from '../theme';
import { ImaraError, ErrorCategory } from '../../types/errors';

const ACTION_HINTS: Record<ErrorCategory, string> = {
  LLM:        'Réessayez dans quelques secondes ou changez de modèle.',
  FILESYSTEM: 'Vérifiez le chemin et les permissions.',
  CONFIG:     'Lancez `imara config reset` si le fichier est corrompu.',
  COMMAND:    'Vérifiez la commande et que l\'outil est installé.',
  AUTH:       'Lancez `imara login` pour renouveler votre session.',
  NETWORK:    'Vérifiez votre connexion et réessayez.',
  CONDUCTOR:  'Créez un track avec `imara track new <titre>`.',
  USER:       '',
  UNKNOWN:    'Contactez le support si le problème persiste.',
};

export function showErrorPanel(error: ImaraError | Error): void {
  const isImara = error instanceof ImaraError;
  const category = isImara ? error.category : ErrorCategory.UNKNOWN;
  const code     = isImara ? error.code : 'UNKNOWN';
  const hint     = ACTION_HINTS[category] || '';

  const header = chalk.bgHex(theme.error).white.bold(` ${category} `);
  const codeTag = chalk.hex(theme.muted)(`[${code}]`);

  console.error(`\n  ${header} ${codeTag}`);
  console.error(`  ${chalk.hex(theme.error)(error.message)}`);
  if (hint) {
    console.error(`  ${chalk.hex(theme.muted)('→')} ${chalk.hex(theme.secondary)(hint)}`);
  }
  console.error('');
}
