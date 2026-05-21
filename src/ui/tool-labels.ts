/**
 * Shared tool labels — Claude Code–style compact verbs (Read, Write, Bash…).
 */

export function getPathArg(args: Record<string, unknown>): string {
  return String(args.path || args.file_path || args.filepath || args.filename || '');
}

export function formatToolAction(name: string, args: Record<string, unknown>): string {
  const p = getPathArg(args);
  const cmd = String(args.command || args.cmd || '');
  const pattern = String(args.pattern || args.regex || args.search || '');
  const query = String(args.query || args.search || args.q || '');
  const paths = (args.paths as string[] | undefined) || [];

  switch (name) {
    case 'read_file':
      return p ? `Read(${shortPath(p)})` : 'Read';
    case 'read_file_range':
      return p ? `Read(${shortPath(p)}:${args.start_line ?? 1}-${args.end_line ?? '?'})` : 'Read range';
    case 'read_multiple_files':
      return `Read(${paths.length} files)`;
    case 'write_file':
      return p ? `Write(${shortPath(p)})` : 'Write';
    case 'append_file':
      return p ? `Update(${shortPath(p)})` : 'Update';
    case 'replace_in_file':
      return p ? `Edit(${shortPath(p)})` : 'Edit';
    case 'batch_replace':
      return 'Edit (batch)';
    case 'list_directory':
      return p ? `List(${shortPath(p) || '.'})` : 'List(.)';
    case 'search_files':
      return `Search("${truncate(pattern, 36)}")`;
    case 'run_command':
      return `Bash(${truncate(cmd, 48)})`;
    case 'web_search':
      return `Web("${truncate(query, 40)}")`;
    case 'git_diff':
      return p ? `Diff(${shortPath(p)})` : 'Diff';
    case 'code_map':
      return p ? `Map(${shortPath(p)})` : 'Map';
    case 'inspect_file':
      return p ? `Inspect(${shortPath(p)})` : 'Inspect';
    case 'smart_read':
      return p ? `Read(${shortPath(p)})` : 'Read';
    case 'clear_context':
      return 'Clear context';
    case 'conductor_create_track':
      return 'Track(create)';
    case 'conductor_update_plan':
      return 'Track(update)';
    case 'conductor_archive_track':
      return 'Track(archive)';
    case 'conductor_validate_plan':
      return 'Track(validate)';
    default:
      return name;
  }
}

function shortPath(p: string): string {
  const norm = p.replace(/\\/g, '/');
  if (norm.length <= 42) return norm;
  const parts = norm.split('/');
  if (parts.length <= 2) return '…' + norm.slice(-40);
  return '…/' + parts.slice(-2).join('/');
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

export interface ToolConfirmContent {
  headline: string;
  body: string;
  /** run_command | write_file | delete_file | other */
  kind: 'shell' | 'file' | 'generic';
}

/** Message de confirmation lisible (commande shell, chemin fichier…). */
export function buildToolConfirmContent(
  name: string,
  args: Record<string, unknown>
): ToolConfirmContent {
  const p = getPathArg(args);
  const cmd = String(args.command || args.cmd || '').trim();
  const cwd = args.cwd ? String(args.cwd).replace(/\\/g, '/') : '';

  switch (name) {
    case 'run_command':
      return {
        kind: 'shell',
        headline: 'Exécuter cette commande ?',
        body: cmd || '(commande vide)',
      };
    case 'write_file':
      return {
        kind: 'file',
        headline: 'Écrire ou remplacer ce fichier ?',
        body: p || '(chemin non précisé)',
      };
    case 'append_file':
      return {
        kind: 'file',
        headline: 'Ajouter du contenu à ce fichier ?',
        body: p || '(chemin non précisé)',
      };
    case 'replace_in_file':
      return {
        kind: 'file',
        headline: 'Modifier ce fichier ?',
        body: p || '(chemin non précisé)',
      };
    case 'delete_file':
      return {
        kind: 'file',
        headline: 'Supprimer ce fichier ?',
        body: p || '(chemin non précisé)',
      };
    default:
      return {
        kind: 'generic',
        headline: `Autoriser : ${formatToolAction(name, args)} ?`,
        body: '',
      };
  }
}

/** Affiche cwd sous la commande si présent. */
export function formatConfirmFooter(name: string, args: Record<string, unknown>): string | null {
  if (name !== 'run_command') return null;
  const cwd = args.cwd ? String(args.cwd).replace(/\\/g, '/') : '';
  return cwd ? `répertoire : ${cwd}` : null;
}
