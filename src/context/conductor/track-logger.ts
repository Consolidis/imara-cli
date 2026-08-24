// src/context/conductor/track-logger.ts
// Auto-logs every tool call executed by the agent into .imara/conductor/tracks/<id>/log.md
import * as fs from 'fs';
import * as path from 'path';
import { TrackManager } from './track-manager';

export class TrackLogger {
  /**
   * Garantit l'existence de log.md pour le track (lazy-create).
   * Rend le journal natif : meme les tracks crees avant cette correction,
   * ou sans log.md, sont actives des la premiere action d'outil.
   * Retourne le chemin du log, ou null en cas d'echec d'ecriture (silencieux).
   */
  private static ensureLogFile(track: { id: string; title: string; dir: string }): string | null {
    const logPath = path.join(track.dir, 'log.md');
    if (fs.existsSync(logPath)) return logPath;
    try {
      const now = new Date().toISOString();
      const header = `# Journal — ${track.title}\n\n## ${now.slice(0, 10)} — Création automatique du journal\n- Track : ${track.id}\n`;
      fs.writeFileSync(logPath, header, 'utf-8');
      return logPath;
    } catch {
      return null;
    }
  }

  /**
   * Appends a tool call entry to the active track's log.md.
   * Called automatically by agent.ts after each tool execution.
   */
  static log(toolName: string, args: Record<string, unknown>, result: string | null, durationMs: number, error?: string): void {
    const track = TrackManager.getActive();
    if (!track) return; // No active track — silent no-op
    const logPath = this.ensureLogFile(track);
    if (!logPath) return;
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
    const logPath = this.ensureLogFile(track);
    if (!logPath) return;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    fs.appendFileSync(logPath, `\n### ${timestamp} — ${message}\n`, 'utf-8');
  }
}

function buildLabel(toolName: string, args: Record<string, unknown>): string {
  const p = String(args?.path || args?.file_path || args?.filepath || '');
  const q = String(args?.query || args?.pattern || args?.command || args?.search || '');
  const paths = args?.paths as string[] | undefined;
  switch (toolName) {
    case 'read_file':          return p;
    case 'write_file':         return p;
    case 'append_file':        return p;
    case 'list_directory':     return p || 'racine';
    case 'run_command':        return q.slice(0, 60);
    case 'search_files':       return `"${q.slice(0, 40)}"`;
    case 'read_multiple_files':return `${(paths || []).length} fichier(s)`;
    case 'web_search':         return `"${q.slice(0, 50)}"`;
    default:                   return JSON.stringify(args).slice(0, 60);
  }
}
