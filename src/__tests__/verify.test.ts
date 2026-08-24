import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectTestRunner, parseTestOutput, VerifyTool } from '../agent/tools/verify.tool';

const TEMP_DIR = path.join(os.tmpdir(), `verify-test-${process.pid}-${Date.now()}`);

function writeProject(files: Record<string, string>): string {
  const root = path.join(TEMP_DIR, `proj-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return root;
}

describe('VerifyTool - detection du runner', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  });
  afterEach(() => {
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('detecte npm test quand package.json a un script test', () => {
    const root = writeProject({ 'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }) });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.name).toBe('npm test');
    expect(runner!.command).toBe('npm test');
  });

  it('detecte vitest via devDependencies sans script test', () => {
    const root = writeProject({ 'package.json': JSON.stringify({ devDependencies: { vitest: '^4.0.0' } }) });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.name).toBe('vitest');
  });

  it('detecte pytest via pytest.ini', () => {
    const root = writeProject({ 'pytest.ini': '[pytest]\nminversion = 7.0' });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.name).toBe('pytest');
    expect(runner!.command).toBe('pytest -q');
  });

  it('detecte pytest via pyproject.toml [tool.pytest]', () => {
    const root = writeProject({ 'pyproject.toml': '[tool.pytest.ini_options]\naddopts = "-q"' });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.name).toBe('pytest');
  });

  it('detecte cargo test via Cargo.toml', () => {
    const root = writeProject({ 'Cargo.toml': '[package]\nname = "demo"' });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.command).toBe('cargo test --quiet');
  });

  it('detecte go test via go.mod', () => {
    const root = writeProject({ 'go.mod': 'module demo\ngo 1.22' });
    const runner = detectTestRunner(root);
    expect(runner).not.toBeNull();
    expect(runner!.command).toBe('go test ./...');
  });

  it('retourne null quand aucun runner nest detecte', () => {
    const root = writeProject({ 'README.md': 'no tests here' });
    const runner = detectTestRunner(root);
    expect(runner).toBeNull();
  });
});

describe('VerifyTool - parsing de sortie', () => {
  it('parse la sortie vitest (passed + failed)', () => {
    const output = [
      'Test Files  3 passed (3)',
      '     Tests  12 passed | 2 failed (14)',
      'AssertionError: expected 1 to be 2',
      '  at file:12:5'
    ].join('\n');
    const parsed = parseTestOutput(output);
    expect(parsed.passed).toBe(12);
    expect(parsed.failed).toBe(2);
    expect(parsed.summaryLines.length).toBeGreaterThan(0);
    expect(parsed.errorLines.length).toBeGreaterThan(0);
  });

  it('parse la sortie jest (Tests: N passed)', () => {
    const output = 'Tests: 8 passed, 8 total\nTest Suites: 2 passed, 2 total\n';
    const parsed = parseTestOutput(output);
    expect(parsed.passed).toBe(8);
    expect(parsed.failed).toBe(0);
  });

  it('parse la sortie pytest (N passed, M failed)', () => {
    const output = '=========================== FAILURES ===========================\n___ test_bad ____\n2 passed, 1 failed in 0.45s\n';
    const parsed = parseTestOutput(output);
    expect(parsed.passed).toBe(2);
    expect(parsed.failed).toBe(1);
  });

  it('parse la sortie cargo (test result: FAILED)', () => {
    const output = 'running 3 tests\ntest result: FAILED. 2 passed; 1 failed; 0 ignored\n';
    const parsed = parseTestOutput(output);
    expect(parsed.failed).toBe(1);
    expect(parsed.summaryLines.some(l => l.includes('FAILED'))).toBe(true);
  });
});

describe('VerifyTool.run - sans runner', () => {
  it('retourne un message non bloquant si aucun runner', async () => {
    const root = writeProject({ 'README.md': 'rien' });
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      const result = await VerifyTool.run();
      expect(result).toContain('[VERIFY]');
      expect(result).toContain('Aucun runner de test detecte');
    } finally {
      cwdSpy.mockRestore();
    }
  });
});
