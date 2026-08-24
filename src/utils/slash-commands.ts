import * as fs from 'fs';
import * as path from 'path';
import { getImaraHome } from './file-snapshot';

/**
 * Slash commands personnalisables.
 * Config : ~/.imara/commands.json (global) OU .imara/commands.json (projet, prioritaire).
 * Format : [{ "name": "review", "prompt": "...", "model": "flash" }]
 * Le prompt peut contenir {args} qui sera remplace par les arguments passes
 * apres le nom de la commande dans le chat.
 */

export interface CustomCommand {
  name: string;
  prompt: string;
  model?: string;
}

export interface ResolvedCustomCommand {
  name: string;
  args: string;
  prompt: string;
  model?: string;
}

export function getGlobalCommandsPath(): string {
  return path.join(getImaraHome(), 'commands.json');
}

export function getProjectCommandsPath(): string {
  return path.join(process.cwd(), '.imara', 'commands.json');
}

/** Lit et valide un fichier commands.json. Throw avec message clair si mal forme. */
function readCommandsFile(filePath: string): CustomCommand[] {
  if (!fs.existsSync(filePath)) return [];
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Impossible de lire ${filePath} : ${msg}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`commands.json invalide (${filePath}) : ${msg}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`commands.json invalide (${filePath}) : doit etre un tableau JSON.`);
  }
  const commands: CustomCommand[] = [];
  for (const item of parsed) {
    if (item && typeof item === 'object' && typeof (item as any).name === 'string' && typeof (item as any).prompt === 'string') {
      commands.push({
        name: (item as any).name.trim().replace(/^\//, ''),
        prompt: (item as any).prompt,
        model: typeof (item as any).model === 'string' ? (item as any).model : undefined
      });
    }
  }
  return commands;
}

/** Charge toutes les commandes : projet prioritaire, puis global. */
export function loadCommands(): Map<string, CustomCommand> {
  const map = new Map<string, CustomCommand>();
  const globalPath = getGlobalCommandsPath();
  const projectPath = getProjectCommandsPath();
  for (const cmd of readCommandsFile(globalPath)) {
    map.set(cmd.name, cmd);
  }
  // Projet : ecrase les commandes globales homonymes
  for (const cmd of readCommandsFile(projectPath)) {
    map.set(cmd.name, cmd);
  }
  return map;
}

/**
 * Resout une saisie /<name> [args...] vers une commande personnalisee.
 * Retourne null si la commande n'existe pas (le guardrail "Commande inconnue"
 * du chat reste alors inchange).
 * Throw si le fichier de config est mal forme.
 */
export function resolveCustomCommand(input: string): ResolvedCustomCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.split(/\s+/);
  const rawName = parts[0].slice(1);
  if (!rawName) return null;
  const args = parts.slice(1).join(' ').trim();
  const commands = loadCommands();
  const cmd = commands.get(rawName);
  if (!cmd) return null;
  let prompt = cmd.prompt;
  if (prompt.includes('{args}')) {
    prompt = prompt.replace(/\{args\}/g, args);
  } else if (args) {
    prompt = `${prompt}\n\nArguments: ${args}`;
  }
  return { name: cmd.name, args, prompt, model: cmd.model };
}
