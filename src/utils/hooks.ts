import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getImaraHome } from './file-snapshot';

/**
 * Hooks declarables : garde-fous evenementiels autour des outils.
 * Config : ~/.imara/hooks.json (global) OU .imara/hooks.json (projet, prioritaire).
 * Structure : { before_write: [], after_write: [], before_commit: [], after_commit: [] }
 * - Un hook before_* en echec (exit code != 0) BLOQUE l'action.
 * - Substitution {file} par le chemin du fichier cible.
 * - Sortie tronquee a 2 Ko pour ne pas polluer le contexte.
 */

export type HookEvent = 'before_write' | 'after_write' | 'before_commit' | 'after_commit';

export type HooksConfig = Partial<Record<HookEvent, string[]>>;

export interface HookResult {
  ok: boolean;
  output: string;
}

const HOOK_EVENTS: HookEvent[] = ['before_write', 'after_write', 'before_commit', 'after_commit'];
const MAX_OUTPUT = 2048;
const HOOK_TIMEOUT_MS = 30000;

export function getGlobalHooksPath(): string {
  return path.join(getImaraHome(), 'hooks.json');
}

export function getProjectHooksPath(): string {
  return path.join(process.cwd(), '.imara', 'hooks.json');
}

/** Charge et fusionne la config hooks (projet prioritaire sur global). */
export function loadHooksConfig(): HooksConfig {
  const config: HooksConfig = {};
  // Global d'abord
  const globalPath = getGlobalHooksPath();
  if (fs.existsSync(globalPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(globalPath, 'utf-8')) as HooksConfig;
      mergeHooks(config, parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`hooks.json global invalide (${globalPath}) : ${msg}`);
    }
  }
  // Projet ensuite (prioritaire : ecrase les commandes globales)
  const projectPath = getProjectHooksPath();
  if (fs.existsSync(projectPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(projectPath, 'utf-8')) as HooksConfig;
      mergeHooks(config, parsed, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`hooks.json projet invalide (${projectPath}) : ${msg}`);
    }
  }
  return config;
}

function mergeHooks(target: HooksConfig, source: HooksConfig, overwrite = false): void {
  for (const event of HOOK_EVENTS) {
    const list = source[event];
    if (!Array.isArray(list)) continue;
    if (overwrite) {
      target[event] = [...list];
    } else {
      target[event] = [...(target[event] || []), ...list];
    }
  }
}

function executeCommand(cmd: string, timeoutMs: number): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    exec(
      cmd,
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const output = ((stdout || '') + (stderr || '')).trim();
        const code = error && typeof (error as any).code === 'number' ? (error as any).code : (error ? 1 : 0);
        resolve({ code, output });
      }
    );
  });
}

/**
 * Execute les hooks d'un evenement.
 * context.file : chemin du fichier cible (substitution {file}).
 * Retourne { ok, output }. Un before_* en echec => ok=false (action bloquee).
 */
export async function runHooks(event: HookEvent, context: { file?: string } = {}): Promise<HookResult> {
  let config: HooksConfig;
  try {
    config = loadHooksConfig();
  } catch (e) {
    // Config invalide : on bloque par securite uniquement les before_*
    const msg = e instanceof Error ? e.message : String(e);
    if (event.startsWith('before_')) {
      return { ok: false, output: `[HOOKS] ${msg}` };
    }
    return { ok: true, output: `[HOOKS] ${msg}` };
  }
  const commands = config[event] || [];
  if (commands.length === 0) {
    return { ok: true, output: '' };
  }
  const outputs: string[] = [];
  let totalLength = 0;
  for (const rawCmd of commands) {
    const cmd = (rawCmd || '').replace(/\{file\}/g, context.file || '');
    if (!cmd.trim()) continue;
    const { code, output } = await executeCommand(cmd, HOOK_TIMEOUT_MS);
    if (output && totalLength < MAX_OUTPUT) {
      const remaining = MAX_OUTPUT - totalLength;
      outputs.push(output.slice(0, remaining));
      totalLength += Math.min(output.length, remaining);
    }
    if (code !== 0 && event.startsWith('before_')) {
      return {
        ok: false,
        output: `[HOOKS] ${event} bloque (code ${code}) : ${output.slice(0, 500) || 'aucune sortie'}`
      };
    }
  }
  const full = outputs.join('\n').slice(0, MAX_OUTPUT);
  return { ok: true, output: full ? `[HOOKS:${event}] ${full}` : '' };
}

/** Liste les evenements hooks disponibles (utilite /help et documentation). */
export function listHookEvents(): HookEvent[] {
  return [...HOOK_EVENTS];
}
