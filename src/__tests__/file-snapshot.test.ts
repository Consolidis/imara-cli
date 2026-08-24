import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getImaraHome,
  getSnapshotsDir,
  snapshotBefore,
  rollbackLast,
  listSnapshots,
  clearSnapshots
} from '../utils/file-snapshot';

const TEMP_DIR = path.join(os.tmpdir(), `snapshot-test-${process.pid}-${Date.now()}`);

describe('FileSnapshot - checkpoints fichiers', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(TEMP_DIR);
  });

  afterEach(() => {
    if (cwdSpy) cwdSpy.mockRestore();
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.rmSync(getSnapshotsDir(), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('stocke les snapshots sous $IMARA_HOME/snapshots', () => {
    expect(getImaraHome()).toContain('.imara');
    expect(getSnapshotsDir()).toContain('snapshots');
  });

  it('cree un snapshot et restaure le contenu d origine via rollbackLast', () => {
    const filePath = 'src/demo.ts';
    const fullPath = path.join(TEMP_DIR, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, 'version originale', 'utf-8');

    const manifest = snapshotBefore(filePath);
    expect(manifest.existed).toBe(true);

    // Modification du fichier apres snapshot
    fs.writeFileSync(fullPath, 'version modifiee', 'utf-8');

    const rollback = rollbackLast();
    expect(rollback).not.toBeNull();
    expect(rollback!.filePath).toBe(fullPath);
    expect(rollback!.existed).toBe(true);
    expect(rollback!.deleted).toBe(false);
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe('version originale');
  });

  it('rollback supprime un fichier cree par la modification (fichier nouveau)', () => {
    const filePath = 'nouveau.txt';
    const fullPath = path.join(TEMP_DIR, filePath);

    const manifest = snapshotBefore(filePath);
    expect(manifest.existed).toBe(false);

    // L'outil cree ensuite le fichier
    fs.writeFileSync(fullPath, 'contenu cree', 'utf-8');
    expect(fs.existsSync(fullPath)).toBe(true);

    const rollback = rollbackLast();
    expect(rollback).not.toBeNull();
    expect(rollback!.existed).toBe(false);
    expect(rollback!.deleted).toBe(true);
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it('rollbackLast retourne null quand aucun snapshot', () => {
    expect(rollbackLast()).toBeNull();
  });

  it('listSnapshots trie du plus recent au plus ancien', () => {
    fs.writeFileSync(path.join(TEMP_DIR, 'a.txt'), 'aaa', 'utf-8');
    fs.writeFileSync(path.join(TEMP_DIR, 'b.txt'), 'bbb', 'utf-8');
    snapshotBefore('a.txt');
    // Petit delai pour garantir un timestamp distinct
    const t0 = Date.now();
    while (Date.now() - t0 < 5) { /* attendre */ }
    snapshotBefore('b.txt');
    const snaps = listSnapshots();
    expect(snaps.length).toBe(2);
    expect(snaps[0].filePath).toContain('b.txt');
    expect(snaps[1].filePath).toContain('a.txt');
  });

  it('clearSnapshots supprime tous les snapshots', () => {
    fs.writeFileSync(path.join(TEMP_DIR, 'c.txt'), 'ccc', 'utf-8');
    snapshotBefore('c.txt');
    expect(listSnapshots().length).toBe(1);
    const removed = clearSnapshots();
    expect(removed).toBeGreaterThanOrEqual(2); // 1 manifeste + 1 .snap
    expect(listSnapshots().length).toBe(0);
  });

  it('refuse les snapshots hors workspace', () => {
    const outside = path.join(os.tmpdir(), 'outside-project-file.txt');
    fs.writeFileSync(outside, 'x', 'utf-8');
    expect(() => snapshotBefore(outside)).toThrow(/en dehors du workspace/);
    try { fs.unlinkSync(outside); } catch { /* ignore */ }
  });
});
