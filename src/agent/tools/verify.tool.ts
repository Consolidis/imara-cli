import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition } from '../agent.types';

/**
 * Outil verify : detection automatique du runner de test du projet,
 * execution avec timeout, et rapport structure OK/ECHEC.
 * N'execute QUE le runner de test detecte (jamais de commande arbitraire).
 */

export interface TestRunner {
  name: string;
  command: string;
}

export interface VerifyReport {
  runner: TestRunner | null;
  passed: number;
  failed: number;
  summaryLines: string[];
  errorLines: string[];
  output: string;
}

const MAX_ERROR_LINES = 40;

/** Remonte jusqu'a 3 niveaux pour trouver la racine du projet. */
function findProjectRoot(): string {
  let dir = process.cwd();
  const markers = ['package.json', 'pytest.ini', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
  for (let i = 0; i < 3; i++) {
    if (markers.some(m => fs.existsSync(path.join(dir, m)))) {
      return dir;
    }
    const parent = path.resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Detecte le runner de test a la racine du projet. */
export function detectTestRunner(root: string): TestRunner | null {
  // 1. Node.js : package.json
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (pkg.scripts && typeof pkg.scripts.test === 'string') {
        return { name: 'npm test', command: 'npm test' };
      }
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.vitest) return { name: 'vitest', command: 'npx vitest run' };
      if (deps.jest) return { name: 'jest', command: 'npx jest --runInBand' };
      if (deps.mocha) return { name: 'mocha', command: 'npx mocha' };
    } catch { /* package.json malforme : ignore */ }
  }
  // 2. Python : pytest.ini / pyproject.toml [tool.pytest]
  if (fs.existsSync(path.join(root, 'pytest.ini'))) {
    return { name: 'pytest', command: 'pytest -q' };
  }
  const pyproject = path.join(root, 'pyproject.toml');
  if (fs.existsSync(pyproject)) {
    try {
      const content = fs.readFileSync(pyproject, 'utf-8');
      if (content.includes('[tool.pytest')) {
        return { name: 'pytest', command: 'pytest -q' };
      }
    } catch { /* ignore */ }
  }
  // 3. Rust : Cargo.toml
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
    return { name: 'cargo test', command: 'cargo test --quiet' };
  }
  // 4. Go : go.mod
  if (fs.existsSync(path.join(root, 'go.mod'))) {
    return { name: 'go test', command: 'go test ./...' };
  }
  return null;
}

/**
 * Parse la sortie des tests pour extraire le resume et les erreurs.
 * Patterns supportes : vitest, jest, mocha, pytest, cargo, go.
 */
export function parseTestOutput(output: string): { passed: number; failed: number; summaryLines: string[]; errorLines: string[] } {
  const lines = output.split(/\r?\n/);
  let passed = 0;
  let failed = 0;
  const summaryLines: string[] = [];
  const errorLines: string[] = [];

  // Comptage : patterns "N passed" / "N failed" (vitest, jest, pytest, cargo)
  for (const line of lines) {
    const passedMatch = line.match(/(\d+)\s+passed/);
    const failedMatch = line.match(/(\d+)\s+failed/);
    if (passedMatch) passed = Math.max(passed, parseInt(passedMatch[1], 10));
    if (failedMatch) failed = Math.max(failed, parseInt(failedMatch[1], 10));
  }

  // Lignes de resume significatives
  const summaryPatterns = [
    /Tests:\s+\d+\s+(passed|failed)/i,
    /Test Files:/i,
    /test result:\s*(ok|FAILED)/i,
    /^ok\s+\S+/m,
    /^FAIL\b/m,
    /\d+\s+passing/i,
    /\d+\s+failing/i,
    /\d+\s+passed/i,
    /\d+\s+failed/i
  ];
  for (const line of lines) {
    if (summaryPatterns.some(p => p.test(line))) {
      if (summaryLines.length < 6 && !summaryLines.includes(line.trim())) {
        summaryLines.push(line.trim());
      }
    }
  }

  // Lignes d'erreur : apres un marqueur d'echec, ou contenant "FAIL"/"Error"
  let captureErrors = false;
  const errorMarkers = [/Tests:\s+\d+\s+failed/i, /test result:\s*FAILED/i, /^FAIL\b/m, /\d+\s+failing/i];
  for (const line of lines) {
    if (errorMarkers.some(p => p.test(line))) {
      captureErrors = true;
      if (errorLines.length < MAX_ERROR_LINES && !errorLines.includes(line.trim())) {
        errorLines.push(line.trim());
      }
      continue;
    }
    if (captureErrors && line.trim()) {
      if (errorLines.length >= MAX_ERROR_LINES) break;
      if (!errorLines.includes(line.trim())) {
        errorLines.push(line.trim());
      }
    }
  }

  // Fallback : si des tests ont echoue mais qu'aucune ligne d'erreur n'a ete
  // capturee par les marqueurs, collecter les lignes evidentes (Error, FAIL,
  // Assertion, expected) sans polluer le contexte.
  if (failed > 0 && errorLines.length === 0) {
    const hintPatterns = [/error/i, /\bfail/i, /assert/i, /expected/i, /exception/i];
    for (const line of lines) {
      if (errorLines.length >= MAX_ERROR_LINES) break;
      if (!line.trim()) continue;
      if (hintPatterns.some(p => p.test(line)) && !errorLines.includes(line.trim())) {
        errorLines.push(line.trim());
      }
    }
  }

  return { passed, failed, summaryLines, errorLines };
}

/** Execute le runner de test avec timeout et maxBuffer. */
function executeRunner(command: string, root: string, timeoutMs: number, maxBuffer: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(
      command,
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const combined = (stdout || '') + (stderr || '');
        if (error && !combined) {
          reject(new Error(error.message));
        } else {
          resolve(combined || (error ? `Sortie vide (code ${(error as any).code ?? '?'})` : 'Commande executee sans sortie.'));
        }
      }
    );
    if (child.stdin) {
      child.stdin.on('error', () => { /* ignore EPIPE */ });
    }
  });
}

export class VerifyTool {
  static definition: ToolDefinition = {
    name: 'verify',
    description: 'Execute les tests du projet (detection automatique du runner : npm test, vitest, jest, mocha, pytest, cargo, go). ' +
      'A utiliser apres chaque modification de code. Retourne un rapport OK/ECHEC sans polluer le contexte.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  };

  static async run(): Promise<string> {
    const root = findProjectRoot();
    const runner = detectTestRunner(root);
    if (!runner) {
      return '[VERIFY] Aucun runner de test detecte (package.json, pytest, cargo, go). Verification ignoree (non bloquant).';
    }
    try {
      const rawOutput = await executeRunner(runner.command, root, 120000, 10 * 1024 * 1024);
      const parsed = parseTestOutput(rawOutput);
      const status = parsed.failed > 0 ? 'ECHEC' : 'OK';
      let report = `[VERIFY] ${status} (${runner.name})`;
      if (parsed.passed > 0) report += ` — ${parsed.passed} tests passes`;
      if (parsed.failed > 0) report += `, ${parsed.failed} tests echoues`;
      report += `\n[VERIFY] Root: ${root}`;
      if (parsed.summaryLines.length > 0) {
        report += `\n${parsed.summaryLines.join('\n')}`;
      }
      if (parsed.errorLines.length > 0) {
        report += `\n\n[VERIFY] ERREURS (max ${MAX_ERROR_LINES} lignes) :\n${parsed.errorLines.join('\n')}`;
      }
      return report;
    } catch (reason) {
      const errMsg = reason instanceof Error ? reason.message : String(reason);
      return `[VERIFY] ECHEC — erreur d'execution : ${errMsg.slice(0, 500)}`;
    }
  }
}
