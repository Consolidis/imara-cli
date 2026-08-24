import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TrackManager } from '../context/conductor/track-manager';
import { TrackLogger } from '../context/conductor/track-logger';

describe('TrackManager (Conductor)', () => {
  const testDir = path.join(process.cwd(), 'temp-test-conductor');
  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    TrackManager.resetCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('should initialize conductor structure', () => {
    TrackManager.init();
    const conductorDir = path.join(testDir, '.imara', 'conductor');
    expect(fs.existsSync(conductorDir)).toBe(true);
    expect(fs.existsSync(path.join(conductorDir, 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(conductorDir, 'tracks.md'))).toBe(true);
    expect(fs.existsSync(path.join(conductorDir, 'workflow.md'))).toBe(true);
    expect(fs.existsSync(path.join(conductorDir, 'product.md'))).toBe(true);
  });

  it('should create a new track and set it active', () => {
    TrackManager.init();
    const track = TrackManager.newTrack('Test Feature');
    expect(track.id).toContain('001-test-feature');
    expect(track.validated).toBe(false);
    const active = TrackManager.getActive();
    expect(active?.id).toBe(track.id);
    expect(fs.existsSync(track.dir)).toBe(true);
    expect(fs.existsSync(path.join(track.dir, 'plan.md'))).toBe(true);
  });

  it('should natively create log.md at track creation', () => {
    TrackManager.init();
    const track = TrackManager.newTrack('Log Native');
    const logPath = path.join(track.dir, 'log.md');
    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('# Journal — Log Native');
    expect(content).toContain(track.id);
  });

  it('should auto-create log.md lazily for tracks without it', () => {
    TrackManager.init();
    const track = TrackManager.newTrack('Lazy Log');
    const logPath = path.join(track.dir, 'log.md');
    // Simuler un track ancien : suppression du log.md cree nativement
    fs.unlinkSync(logPath);
    expect(fs.existsSync(logPath)).toBe(false);
    // La premiere action d'outil doit recreer le journal
    TrackLogger.log('read_file', { path: 'src/index.ts' }, 'contenu', 42);
    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('read_file');
    expect(content).toContain('42ms');
  });

  it('should validate a track', () => {
    TrackManager.init();
    TrackManager.newTrack('Test Feature');
    expect(TrackManager.getActive()?.validated).toBe(false);
    TrackManager.validateTrack();
    expect(TrackManager.getActive()?.validated).toBe(true);
  });

  it('should detect conductor directory in different locations', () => {
    // 1. Root conductor/
    const rootCond = path.join(testDir, 'conductor');
    fs.mkdirSync(rootCond);
    expect(TrackManager.getConductorDir()).toBe(rootCond);
    fs.rmdirSync(rootCond);
    TrackManager.resetCache();
    // 2. backend/conductor/
    const backCond = path.join(testDir, 'backend', 'conductor');
    fs.mkdirSync(path.join(testDir, 'backend'), { recursive: true });
    fs.mkdirSync(backCond);
    expect(TrackManager.getConductorDir()).toBe(backCond);
  });

  it('should dynamically climb upward to find conductor directory', () => {
    const rootCond = path.join(testDir, 'backend', 'conductor');
    fs.mkdirSync(rootCond, { recursive: true });
    // Set process.cwd to nested sub-folder
    const deepSubDir = path.join(testDir, 'nested', 'deep', 'app');
    fs.mkdirSync(deepSubDir, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(deepSubDir);
    TrackManager.resetCache();
    expect(TrackManager.getConductorDir()).toBe(rootCond);
  });
});
