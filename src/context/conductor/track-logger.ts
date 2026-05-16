// src/context/conductor/track-logger.ts
// Auto-logs every tool call executed by the agent into .imara/conductor/tracks/<id>/log.md
import * as fs from 'fs';
import * as path from 'path';
import { TrackManager } from './track-manager';

export class TrackLogger {

  /**
   * Appends a tool call entry to the active track's log.md.
   * Called automatically by agent.ts after each tool execution.
   */
  static log(toolName: string, args: any, result: string | null, durationMs: number, error?: string): void {
    const track = TrackManager.getActive();
    if (!track) return; // No active track — silent no-op

    const logPath = path.join(track.dir, 'log.md');
    if (!fs.existsSync(logPath)) return;

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const label     = buildLabel(toolName, args);
    const status    = error ? `❌ ${error.slice(0, 80)}` : `✓ ${durationMs}ms`;

    const entry = `- [${timestamp}] ${toolName} · ${label} — ${status}\n`;

    fs.appendFileSync(logPath, entry, 'utf-8');
  }

  /**
   * Appends a free-form note to the active track's log.md.
   * Used for session start/end markers.
   */
  static note(message: string): void {
    const track = TrackManager.getActive();
    if (!track) return;

    const logPath = path.join(track.dir, 'log.md');
    if (!fs.existsSync(logPath)) return;

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    fs.appendFileSync(logPath, `\n### ${timestamp} — ${message}\n`, 'utf-8');
  }
}

function buildLabel(toolName: string, args: any): string {
  const p = args?.path || args?.file_path || '';
  const q = args?.query || args?.pattern || args?.command || '';
  switch (toolName) {
    case 'read_file':          return p;
    case 'write_file':         return p;
    case 'append_file':        return p;
    case 'list_directory':     return p || 'racine';
    case 'run_command':        return String(q).slice(0, 60);
    case 'search_files':       return `"${String(q).slice(0, 40)}"`;
    case 'read_multiple_files':return `${(args?.paths || []).length} fichier(s)`;
    case 'web_search':         return `"${String(q).slice(0, 50)}"`;
    default:                   return JSON.stringify(args).slice(0, 60);
  }
}
