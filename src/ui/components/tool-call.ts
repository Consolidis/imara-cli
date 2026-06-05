import chalk from 'chalk';
import { theme } from '../theme';
import { formatToolAction } from '../tool-labels';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

let spinnerIndex = 0;
let spinnerInterval: ReturnType<typeof setInterval> | null = null;
let currentLabel = '';

function clearSpinnerLine(): void {
  process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
}

/** Extract a short verb from tool name (web_search -> Web, read_file -> Read). */
function toolVerb(name: string): string {
  const map: Record<string, string> = {
    web_search: 'Web',
    read_file: 'Read',
    read_file_range: 'Read',
    read_multiple_files: 'Read',
    write_file: 'Write',
    append_file: 'Update',
    replace_in_file: 'Edit',
    batch_replace: 'Edit',
    list_directory: 'List',
    search_files: 'Search',
    run_command: 'Bash',
    git_diff: 'Diff',
    code_map: 'Map',
    inspect_file: 'Inspect',
    smart_read: 'Read',
    clear_context: 'Clear',
    conductor_create_track: 'Track',
    conductor_update_plan: 'Track',
    conductor_archive_track: 'Track',
    conductor_validate_plan: 'Track',
    validate_file: 'Validate',
    diff_preview: 'Diff',
    project_summary: 'Summary',
    workspace_index: 'Index',
  };
  return map[name] || name;
}

export function showToolResultWithContent(name: string, content: string, durationMs?: number): void {
  const preview = content.split('\n')[0].substring(0, 80).trim();
  const verb = toolVerb(name);
  const check = chalk.hex(theme.accent)('✓');
  const duration = durationMs ? chalk.hex(theme.muted)(` · ${durationMs}ms`) : '';
  clearSpinnerLine();
  if (preview) {
    process.stdout.write(`  ${check} ${chalk.hex(theme.muted)(verb)} → ${chalk.hex(theme.text)(preview)}${duration}\n`);
  } else {
    process.stdout.write(`  ${check} ${chalk.hex(theme.muted)(verb)} ${duration}\n`);
  }
}

export function showToolCall(name: string, args: Record<string, unknown>, durationMs?: number): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }

  const action = formatToolAction(name, args);
  const check = chalk.hex(theme.accent)('✓');
  const duration = durationMs ? chalk.hex(theme.muted)(` · ${durationMs}ms`) : '';

  clearSpinnerLine();
  process.stdout.write(`  ${check} ${chalk.hex(theme.muted)(action)}${duration}\n`);
}

export function startToolCallSpinner(name: string, args: Record<string, unknown>): void {
  if (spinnerInterval) clearInterval(spinnerInterval);

  currentLabel = formatToolAction(name, args);
  spinnerIndex = 0;

  const tick = () => {
    const frame = chalk.hex(theme.warning)(SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]);
    clearSpinnerLine();
    process.stdout.write(`  ${frame} ${chalk.hex(theme.muted)(currentLabel)}`);
    spinnerIndex++;
  };

  tick();
  spinnerInterval = setInterval(tick, 80);
}

export function stopToolCallSpinner(): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    clearSpinnerLine();
  }
}
