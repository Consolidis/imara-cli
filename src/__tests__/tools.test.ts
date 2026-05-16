import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadFileTool } from '../agent/tools/read-file.tool';
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
});
