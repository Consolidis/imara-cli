import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadFileRangeTool } from '../agent/tools/read-file-range.tool';
import { CodeMapTool } from '../agent/tools/code-map.tool';
import { GitDiffTool } from '../agent/tools/git-diff.tool';
import { ClearContextTool } from '../agent/tools/clear-context.tool';
import * as fs from 'fs';
import { execSync } from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('Optimization Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ReadFileRangeTool', () => {
    it('should read specific lines of a file', async () => {
      const mockContent = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      
      const result = await ReadFileRangeTool.run({ path: 'test.txt', start_line: 2, end_line: 4 });
      expect(result).toContain('line2\nline3\nline4');
      expect(result).not.toContain('line1');
      expect(result).not.toContain('line5');
    });

    it('should throw if range is too large', async () => {
      await expect(ReadFileRangeTool.run({ path: 'test.txt', start_line: 1, end_line: 2500 }))
        .rejects.toThrow('Plage trop grande');
    });
  });

  describe('CodeMapTool', () => {
    it('should extract signatures from code', async () => {
      const mockContent = `
        export class MyClass {
          constructor() {}
          myMethod() {
            console.log('hi');
          }
        }
        function myFunc() { return 1; }
        const arrow = () => {};
      `;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      
      const result = await CodeMapTool.run({ path: 'test.ts' });
      expect(result).toContain('export class MyClass');
      expect(result).toContain('myMethod() {');
      expect(result).toContain('function myFunc()');
      expect(result).toContain('const arrow = () =>');
      expect(result).not.toContain('console.log');
    });
  });

  describe('GitDiffTool', () => {
    it('should return git diff output', async () => {
      vi.mocked(execSync).mockReturnValue('diff content' as any);
      const result = await GitDiffTool.run({});
      expect(result).toBe('diff content');
    });

    it('should handle non-git directory', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });
      await expect(GitDiffTool.run({})).rejects.toThrow('Ce dossier n\'est pas un dépôt Git');
    });
  });

  describe('ClearContextTool', () => {
    it('should clear history but keep system and all user messages', async () => {
      const mockMessages = [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'initial task' },
        { role: 'assistant', content: 'step 1' },
        { role: 'tool', content: 'tool result' },
        { role: 'user', content: 'next task' }
      ];
      
      const mockAgent = {
        getMessages: () => mockMessages,
        setMessages: vi.fn()
      };

      const result = await ClearContextTool.run({ reason: 'test' }, mockAgent);
      expect(result).toContain('Historique allégé');
      expect(mockAgent.setMessages).toHaveBeenCalledWith([
        { role: 'system', content: 'system' },
        { role: 'user', content: 'initial task' },
        { role: 'user', content: 'next task' },
      ]);
    });
  });
});
