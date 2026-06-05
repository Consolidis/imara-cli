// src/ui/components/error-panel.ts
// Contextual error display with actionable help messages and visual framing.
import chalk from 'chalk';
import { theme } from '../theme';
import { ImaraError, ErrorCategory } from '../../types/errors';

const CATEGORY_META: Record<ErrorCategory, {
  icon: string;
  label: string;
  color: string;
  hint: string;
}> = {
  LLM: {
    icon: '🤖',
    label: 'IA',
    color: theme.warning,
    hint: 'Reessaie dans quelques secondes ou change de modele avec /model.'
  },
  FILESYSTEM: {
    icon: '📁',
    label: 'FICHIER',
    color: theme.secondary,
    hint: 'Verifie le chemin d\'acces et les permissions du fichier.'
  },
  CONFIG: {
    icon: '⚙️',
    label: 'CONFIG',
    color: theme.secondary,
    hint: 'Execute `imara config reset` si le fichier est corrompu.'
  },
  COMMAND: {
    icon: '⌨️',
    label: 'COMMANDE',
    color: theme.secondary,
    hint: 'Verifie que l\'outil requis est installe et accessible.'
  },
  AUTH: {
    icon: '🔑',
    label: 'AUTH',
    color: theme.warning,
    hint: 'Execute `imara login` pour renouveler ta session.'
  },
  NETWORK: {
    icon: '🌐',
    label: 'RESEAU',
    color: theme.warning,
    hint: 'Verifie ta connexion internet et reessaie.'
  },
  CONDUCTOR: {
    icon: '📋',
    label: 'CONDUCTOR',
    color: theme.secondary,
    hint: 'Cree un track avec `imara track new <titre>` ou valide le plan avec /approve.'
  },
  USER: {
    icon: '👤',
    label: 'UTILISATEUR',
    color: theme.muted,
    hint: ''
  },
  UNKNOWN: {
    icon: '❓',
    label: 'INATTENDU',
    color: theme.error,
    hint: 'Contacte le support si le probleme persiste.'
  },
};

export function showErrorPanel(error: ImaraError | Error): void {
  const isImara = error instanceof ImaraError;
  const category = isImara ? error.category : ErrorCategory.UNKNOWN;
  const code     = isImara ? error.code : 'UNKNOWN';
  const meta     = CATEGORY_META[category] || CATEGORY_META.UNKNOWN;

  const icon     = meta.icon;
  const label    = meta.label;
  const color    = meta.color;
  const hint     = meta.hint;
  const msg      = isImara ? error.message : error.message;

  const width = Math.min(72, (process.stdout.columns || 80) - 4);
  const topBorder    = chalk.hex(theme.muted)('┌─') + chalk.hex(color)(` ${icon} ${label} `) + chalk.hex(theme.muted)(`[${code}] `) + chalk.hex(theme.muted)('─'.repeat(Math.max(1, width - 6 - label.length - code.length - 8)));
  const bottomBorder = chalk.hex(theme.muted)('└' + '─'.repeat(width - 2) + '┘');

  console.error();
  console.error(`  ${topBorder}`);
  console.error(`  ${chalk.hex(theme.muted)('│')}  ${chalk.hex(color)(msg)}`);
  if (hint) {
    console.error(`  ${chalk.hex(theme.muted)('│')}  ${chalk.hex(theme.muted)('→')} ${chalk.hex(theme.text)(hint)}`);
  }
  console.error(`  ${bottomBorder}`);
  console.error();
}
