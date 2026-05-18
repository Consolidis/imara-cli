import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RunCommandTool } from '../agent/tools/run-command.tool';

describe('RunCommandTool (Targeted & Secure)', () => {
  const testDir = path.join(process.cwd(), 'temp-test-runcmd');

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('should run a command in process.cwd by default', async () => {
    const result = await RunCommandTool.run({ command: 'echo hello_from_root' });
    expect(result).toContain('hello_from_root');
  });

  it('should run a command in a targeted sub-directory when cwd is specified', async () => {
    const subDir = path.join(testDir, 'sub-folder');
    fs.mkdirSync(subDir);

    const command = process.platform === 'win32' ? 'echo %cd%' : 'pwd';
    const result = await RunCommandTool.run({ command, cwd: 'sub-folder' });
    expect(result.toLowerCase()).toContain('sub-folder');
  });

  it('should throw an error and refuse execution if cwd is outside the project workspace', async () => {
    await expect(RunCommandTool.run({ command: 'echo unsafe', cwd: '../../' })).rejects.toThrow('Sécurité');
  });
});
