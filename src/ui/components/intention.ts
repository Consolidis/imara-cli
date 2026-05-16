// src/ui/components/intention.ts
// Shows the agent's intention BEFORE executing a tool call — for transparency.
// Renders in a subdued style (dim/muted) to differentiate from tool results.
import chalk from 'chalk';
import { theme } from '../theme';

/**
 * Displays the agent's intention before tool execution.
 * This gives the user real-time visibility into what the agent is about to do,
 * similar to Gemini CLI / Claude Code transparency patterns.
 */
export function showIntention(name: string, args: Record<string, unknown>): void {
  const icon = intentionIcon(name);
  const label = intentionLabel(name, args);

  // Print on its own line with a distinctive "→" prefix
  const line = `\n  ${chalk.hex(theme.muted)('→')} ${icon} ${chalk.hex(theme.muted).italic(label)}`;
  process.stdout.write(line + '\n');
}

function intentionIcon(name: string): string {
  const icons: Record<string, string> = {
    read_file:           chalk.hex(theme.muted)('○'),
    write_file:          chalk.hex(theme.accent)('●'),
    append_file:         chalk.hex(theme.accent)('◐'),
    list_directory:      chalk.hex(theme.muted)('◎'),
    run_command:         chalk.hex(theme.warning ?? '#ffaa00')('▶'),
    search_files:        chalk.hex(theme.muted)('◈'),
    read_multiple_files: chalk.hex(theme.muted)('○○'),
    web_search:          chalk.hex(theme.primary)('◉'),
  };
  return icons[name] ?? chalk.hex(theme.muted)('○');
}

function intentionLabel(name: string, args: Record<string, unknown>): string {
  const getPath    = (a: Record<string, unknown>) => String(a?.path || a?.file_path || a?.filepath || a?.filename || '');
  const getQuery   = (a: Record<string, unknown>) => String(a?.query || a?.search || a?.q || '');
  const getCmd     = (a: Record<string, unknown>) => String(a?.command || a?.cmd || '');
  const getPattern = (a: Record<string, unknown>) => String(a?.pattern || a?.regex || a?.search || '');

  switch (name) {
    case 'read_file':
      return `Lecture de ${getPath(args)}`;
    case 'write_file':
      return `Écriture de ${getPath(args)}`;
    case 'append_file':
      return `Ajout de contenu dans ${getPath(args)}`;
    case 'list_directory':
      return `Exploration de ${getPath(args) || 'la racine du projet'}`;
    case 'run_command':
      return `Exécution : ${String(getCmd(args)).slice(0, 60)}`;
    case 'search_files':
      return `Recherche du pattern "${String(getPattern(args)).slice(0, 40)}"`;
    case 'read_multiple_files':
      return `Lecture de ${((args?.paths as string[] | undefined) || []).length} fichier(s)`;
    case 'web_search':
      return `Recherche web : "${String(getQuery(args)).slice(0, 50)}"`;
    default:
      return `Appel de ${name}`;
  }
}
