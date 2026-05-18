import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadFileTool } from '../agent/tools/read-file.tool';
import { InspectFileTool } from '../agent/tools/inspect-file.tool';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');

describe('Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ReadFileTool', () => {
    it('should read a file within CWD', async () => {
      const mockContent = 'hello world';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any);
      
      const result = await ReadFileTool.run({ path: 'test.txt' });
      expect(result).toBe(mockContent);
    });

    it('should throw error if file is outside CWD', async () => {
      // Mocking path.resolve and path.relative might be needed if they are used for safety checks
      await expect(ReadFileTool.run({ path: '../../etc/passwd' })).rejects.toThrow();
    });
  });

  describe('InspectFileTool', () => {
    it('should inspect file metadata and optional search term', async () => {
      const mockContent = 'line 1\nline 2 with query keyword\nline 3';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1024,
        isDirectory: () => false
      } as any);

      // Without query
      const result = await InspectFileTool.run({ path: 'big-file.txt' });
      expect(result).toContain('Taille : 1.00 KB');
      expect(result).toContain('Lignes : 3 lignes');

      // With query
      const resultWithQuery = await InspectFileTool.run({ path: 'big-file.txt', query: 'keyword' });
      expect(resultWithQuery).toContain('Ligne 2 : line 2 with query keyword');
    });
  });
});
