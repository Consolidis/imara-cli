// src/ui/components/tool-call.ts
import chalk from 'chalk';
import { theme } from '../theme';

export function showToolCall(name: string, args: Record<string, unknown>, durationMs?: number): void {
  const icon = toolIcon(name);
  const label = toolLabel(name, args);
  const duration = durationMs ? chalk.hex(theme.muted)(` ${durationMs}ms`) : '';
  
  const line = `  ${icon} ${chalk.hex(theme.muted)(label)}${duration}`;
  
  // Clear current line and write (using \r to allow overwrite)
  process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
  process.stdout.write(line);
  
  if (durationMs) {
    process.stdout.write('\n'); // New line only after result is in
  }
}

function toolIcon(name: string): string {
  const icons: Record<string, string> = {
    read_file: '○',
    write_file: '●',
    list_directory: '◎',
    run_command: '▶',
    search_files: '◈',
    web_search: '◉',
  };
  return chalk.hex(theme.muted)(icons[name] ?? '○');
}

function toolLabel(name: string, args: Record<string, unknown>): string {
  const getPath = (a: Record<string, unknown>) => String(a.path || a.file_path || a.filepath || a.filename || '');
  const getQuery = (a: Record<string, unknown>) => String(a.query || a.search || a.q || '');
  const getCmd = (a: Record<string, unknown>) => String(a.command || a.cmd || a.args || '');
  const getPattern = (a: Record<string, unknown>) => String(a.pattern || a.regex || a.search || '');

  switch (name) {
    case 'read_file': return `Lecture · ${getPath(args)}`;
    case 'write_file': return `Écriture · ${getPath(args)}`;
    case 'list_directory': return `Exploration · ${getPath(args) || 'racine'}`;
    case 'run_command': return `Exécution · ${getCmd(args)}`;
    case 'search_files': return `Recherche · "${getPattern(args)}"`;
    case 'read_multiple_files': return `Lecture multiple · ${((args.paths as string[] | undefined) || []).length} fichier(s)`;
    case 'web_search': return `Web · ${getQuery(args)}`;
    default: return name;
  }
}
