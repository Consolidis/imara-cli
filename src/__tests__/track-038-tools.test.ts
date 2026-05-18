import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SmartReadTool } from '../agent/tools/smart-read.tool';
import { WorkspaceIndexTool } from '../agent/tools/workspace-index.tool';
import { BatchReplaceTool } from '../agent/tools/batch-replace.tool';
import { DiffPreviewTool } from '../agent/tools/diff-preview.tool';
import { ProjectSummaryTool } from '../agent/tools/project-summary.tool';
import { resetStorageState } from '../storage';

const TEMP_DIR = path.join(process.cwd(), '.test-track-038');

describe('Track 038 - Smart Tools', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    resetStorageState();
  });

  describe('SmartReadTool', () => {
    it('should output outline mode signatures with empty bodies', async () => {
      const filePath = path.join(TEMP_DIR, 'test-outline.ts');
      const content = `import { something } from 'somewhere';

export class Calculator {
  add(a: number, b: number): number {
    const result = a + b;
    return result;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}`;
      fs.writeFileSync(filePath, content, 'utf8');

      const result = await SmartReadTool.run({ path: filePath, mode: 'outline' });
      expect(result).toContain('export class Calculator {');
      expect(result).toContain('add(a: number, b: number): number {}');
      expect(result).toContain('subtract(a: number, b: number): number {}');
      expect(result).not.toContain('const result = a + b;');
    });

    it('should truncate functions over 15 lines in summary mode', async () => {
      const filePath = path.join(TEMP_DIR, 'test-summary.ts');
      const longFunction = `export function doHeavyWork() {
  console.log("line 1");
  console.log("line 2");
  console.log("line 3");
  console.log("line 4");
  console.log("line 5");
  console.log("line 6");
  console.log("line 7");
  console.log("line 8");
  console.log("line 9");
  console.log("line 10");
  console.log("line 11");
  console.log("line 12");
  console.log("line 13");
  console.log("line 14");
  console.log("line 15");
  console.log("line 16");
}`;
      fs.writeFileSync(filePath, longFunction, 'utf8');

      const result = await SmartReadTool.run({ path: filePath, mode: 'summary' });
      expect(result).toContain('// [Méthode de 18 lignes');
      expect(result).not.toContain('line 5');
    });

    it('should support extension-specific comments in summary mode', async () => {
      const pyPath = path.join(TEMP_DIR, 'test.py');
      const pyContent = `def long_py_func():
    print("1")
    print("2")
    print("3")
    print("4")
    print("5")
    print("6")
    print("7")
    print("8")
    print("9")
    print("10")
    print("11")
    print("12")
    print("13")
    print("14")
    print("15")
    print("16")`;
      fs.writeFileSync(pyPath, pyContent, 'utf8');

      const result = await SmartReadTool.run({ path: pyPath, mode: 'summary' });
      expect(result).toContain('# [Méthode de 17 lignes');
    });
  });

  describe('WorkspaceIndexTool', () => {
    it('should perform recursive scans and find symbols', async () => {
      const file1 = path.join(TEMP_DIR, 'file1.ts');
      const content1 = `export class SmartScanner {}`;
      fs.writeFileSync(file1, content1, 'utf8');

      const result = await WorkspaceIndexTool.run({ query: 'SmartScanner' });
      expect(result).toContain('SmartScanner');
    });
  });

  describe('BatchReplaceTool', () => {
    it('should apply multiple non-contiguous edits successfully', async () => {
      const filePath = path.join(TEMP_DIR, 'test-batch.ts');
      const content = `let state = 0;
console.log("initial state");
state = 1;
console.log("final state");`;
      fs.writeFileSync(filePath, content, 'utf8');

      const result = await BatchReplaceTool.run({
        path: filePath,
        replacements: [
          { old_text: 'let state = 0;', new_text: 'let state = 42;' },
          { old_text: 'console.log("final state");', new_text: 'console.log("complete");' }
        ]
      });

      const updated = fs.readFileSync(filePath, 'utf8');
      expect(updated).toContain('let state = 42;');
      expect(updated).toContain('console.log("complete");');
      expect(result).toContain('modifié avec succès');
    });

    it('should throw and rollback if any old_text is missing', async () => {
      const filePath = path.join(TEMP_DIR, 'test-batch-rollback.ts');
      const content = `const a = 1;`;
      fs.writeFileSync(filePath, content, 'utf8');

      await expect(BatchReplaceTool.run({
        path: filePath,
        replacements: [
          { old_text: 'const a = 1;', new_text: 'const a = 2;' },
          { old_text: 'const missing = 99;', new_text: 'const found = 0;' }
        ]
      })).rejects.toThrow('Remplacement échoué');

      // Assert rollback
      const updated = fs.readFileSync(filePath, 'utf8');
      expect(updated).toBe(content);
    });
  });

  describe('DiffPreviewTool', () => {
    it('should render unified diff', async () => {
      const filePath = path.join(TEMP_DIR, 'test-diff.ts');
      const content = `const x = 1;\nconst y = 2;`;
      fs.writeFileSync(filePath, content, 'utf8');

      const result = await DiffPreviewTool.run({
        path: filePath,
        proposed_content: `const x = 1;\nconst y = 3;`
      });

      expect(result).toContain('-const y = 2');
      expect(result).toContain('+const y = 3');
    });
  });

  describe('ProjectSummaryTool', () => {
    it('should run and save cache summary without crashing', async () => {
      const result = await ProjectSummaryTool.run({ forceRefresh: true });
      expect(result).toContain('Résumé du projet mis à jour avec succès');
    });
  });
});
