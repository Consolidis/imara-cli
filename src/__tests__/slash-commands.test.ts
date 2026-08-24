import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadCommands, resolveCustomCommand, getGlobalCommandsPath, getProjectCommandsPath } from '../utils/slash-commands';

const TEMP_DIR = path.join(os.tmpdir(), `slash-test-${process.pid}-${Date.now()}`);

describe('Slash commands personnalisees', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(TEMP_DIR);
  });

  afterEach(() => {
    if (cwdSpy) cwdSpy.mockRestore();
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.rmSync(path.join(os.homedir(), '.imara'), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('charge les commandes globales (~/.imara/commands.json)', () => {
    const globalPath = getGlobalCommandsPath();
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify([
      { name: 'review', prompt: 'Fais une revue du code : {args}', model: 'flash' }
    ]), 'utf-8');
    const cmds = loadCommands();
    expect(cmds.size).toBe(1);
    expect(cmds.get('review')!.prompt).toContain('{args}');
    expect(cmds.get('review')!.model).toBe('flash');
  });

  it('la commande projet (.imara/commands.json) ecrase la globale homonyme', () => {
    const globalPath = getGlobalCommandsPath();
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify([
      { name: 'review', prompt: 'prompt global' }
    ]), 'utf-8');
    const projectPath = getProjectCommandsPath();
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    fs.writeFileSync(projectPath, JSON.stringify([
      { name: 'review', prompt: 'prompt projet' },
      { name: 'explain', prompt: 'Explique {args}' }
    ]), 'utf-8');

    const cmds = loadCommands();
    expect(cmds.size).toBe(2);
    expect(cmds.get('review')!.prompt).toBe('prompt projet');
    expect(cmds.get('explain')).toBeDefined();
  });

  it('resolveCustomCommand substitue {args} par les arguments', () => {
    const globalPath = getGlobalCommandsPath();
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify([
      { name: 'review', prompt: 'Revue de code ciblee : {args}' }
    ]), 'utf-8');

    const resolved = resolveCustomCommand('/review auth.service.ts');
    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('review');
    expect(resolved!.args).toBe('auth.service.ts');
    expect(resolved!.prompt).toBe('Revue de code ciblee : auth.service.ts');
  });

  it('resolveCustomCommand ajoute les arguments en append si {args} absent', () => {
    const globalPath = getGlobalCommandsPath();
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify([
      { name: 'fix', prompt: 'Corrige les erreurs' }
    ]), 'utf-8');

    const resolved = resolveCustomCommand('/fix linter');
    expect(resolved).not.toBeNull();
    expect(resolved!.prompt).toContain('Corrige les erreurs');
    expect(resolved!.prompt).toContain('Arguments: linter');
  });

  it('retourne null pour une commande inconnue (guardrail inchange)', () => {
    const resolved = resolveCustomCommand('/cmd-inexistante foo');
    expect(resolved).toBeNull();
  });

  it('retourne null si la saisie ne commence pas par /', () => {
    expect(resolveCustomCommand('salut /review')).toBeNull();
  });

  it('throw avec message clair si commands.json est mal forme', () => {
    const globalPath = getGlobalCommandsPath();
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, '{ pas un json', 'utf-8');
    expect(() => resolveCustomCommand('/review')).toThrow(/commands\.json invalide/);
  });

  it('throw si commands.json nest pas un tableau', () => {
    const projectPath = getProjectCommandsPath();
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });
    fs.writeFileSync(projectPath, JSON.stringify({ name: 'nope' }), 'utf-8');
    expect(() => loadCommands()).toThrow(/doit etre un tableau/);
  });
});
