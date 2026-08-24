import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runHooks, loadHooksConfig, getProjectHooksPath } from '../utils/hooks';

const TEMP_DIR = path.join(os.tmpdir(), `hooks-test-${process.pid}-${Date.now()}`);

function writeProjectHooks(config: unknown): string {
  const hooksDir = path.join(TEMP_DIR, '.imara');
  fs.mkdirSync(hooksDir, { recursive: true });
  const hooksPath = path.join(hooksDir, 'hooks.json');
  fs.writeFileSync(hooksPath, JSON.stringify(config), 'utf-8');
  return hooksPath;
}

describe('Hooks - garde-fous evenementiels', () => {
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

  it('substitue {file} dans la commande du hook', async () => {
    writeProjectHooks({ before_write: ['node -e "console.log(\'{file}\')"'] });
    const res = await runHooks('before_write', { file: 'src/toto.ts' });
    expect(res.ok).toBe(true);
    expect(res.output).toContain('src/toto.ts');
  });

  it('un hook before_write en echec bloque l action (ok=false)', async () => {
    writeProjectHooks({ before_write: ['node -e "process.exit(1)"'] });
    const res = await runHooks('before_write', { file: 'a.ts' });
    expect(res.ok).toBe(false);
    expect(res.output).toContain('before_write');
    expect(res.output).toContain('bloque');
  });

  it('un hook after_write en echec ne bloque pas (ok=true)', async () => {
    writeProjectHooks({ after_write: ['node -e "process.exit(2)"'] });
    const res = await runHooks('after_write', { file: 'a.ts' });
    expect(res.ok).toBe(true);
  });

  it('charge la config projet (prioritaire sur global)', async () => {
    const globalPath = path.join(os.homedir(), '.imara', 'hooks.json');
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify({ before_write: ['echo global'] }), 'utf-8');
    writeProjectHooks({ before_write: ['echo projet'] });

    const config = loadHooksConfig();
    expect(config.before_write).toEqual(['echo projet']);

    const res = await runHooks('before_write', {});
    expect(res.ok).toBe(true);
    expect(res.output).toContain('projet');
    expect(res.output).not.toContain('global');
  });

  it('une config invalide bloque un before_* avec message clair', async () => {
    const hooksDir = path.join(TEMP_DIR, '.imara');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'hooks.json'), '{ pas du json valide', 'utf-8');
    const res = await runHooks('before_write', { file: 'x.ts' });
    expect(res.ok).toBe(false);
    expect(res.output).toContain('invalide');
  });

  it('aucun hook configure => ok=true sans sortie', async () => {
    const res = await runHooks('before_write', { file: 'x.ts' });
    expect(res.ok).toBe(true);
    expect(res.output).toBe('');
  });

  it('getProjectHooksPath pointe vers .imara/hooks.json du projet', () => {
    const p = getProjectHooksPath();
    expect(p.endsWith(path.join('.imara', 'hooks.json'))).toBe(true);
  });
});
