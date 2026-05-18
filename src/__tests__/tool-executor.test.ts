import { describe, it, expect } from 'vitest';
import { ToolExecutor } from '../agent/tools';
import { ok, err } from '../types/result';

describe('ToolExecutor', () => {
  it('should return err for unknown tool', async () => {
    const result = await ToolExecutor.execute('unknown_tool', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Tool inconnu');
  });

  it('should execute list_directory successfully', async () => {
    const result = await ToolExecutor.execute('list_directory', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('src');
  });

  it('should execute search_files successfully', async () => {
    const result = await ToolExecutor.execute('search_files', { pattern: 'TODO', filePattern: '*.md' });
    expect(result.ok).toBe(true);
  });

  it('should allow write_file when no track active', async () => {
    const fs = await import('fs');
    const testPath = 'test-tmp-write.txt';
    try {
      const result = await ToolExecutor.execute('write_file', { path: testPath, content: 'hello' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toContain('écrit');
    } finally {
      if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
    }
  });

  it('should execute read_file with error for missing file', async () => {
    const result = await ToolExecutor.execute('read_file', { path: 'nonexistent.xyz' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain('non trouvé');
  });

  it('should block write_file outside Conductor dir but allow inside when track is active and unvalidated', async () => {
    const { TrackManager } = await import('../context/conductor/track-manager');
    const vi = (await import('vitest')).vi;
    
    // Mock active unvalidated track
    vi.spyOn(TrackManager, 'getActive').mockReturnValue({
      id: '099-test-track',
      title: 'Test Track',
      dir: 'custom-conductor/tracks/099-test-track',
      validated: false
    });
    vi.spyOn(TrackManager, 'getConductorDir').mockReturnValue('custom-conductor');

    // 1. Outside Conductor dir: should be blocked
    const resultOutside = await ToolExecutor.execute('write_file', { path: 'src/index.ts', content: 'hello' });
    expect(resultOutside.ok).toBe(false);
    if (!resultOutside.ok) {
      expect(resultOutside.error.message).toContain('BARRIÈRE CONDUCTOR');
    }

    // 2. Inside Conductor dir: should be allowed (bypasses guardrail, will proceed to execute and fail on path/directory existence since it is mocked)
    const resultInside = await ToolExecutor.execute('write_file', { path: 'custom-conductor/plan.md', content: 'hello' });
    if (!resultInside.ok) {
      expect(resultInside.error.message).not.toContain('BARRIÈRE CONDUCTOR');
    } else {
      expect(resultInside.ok).toBe(true);
    }
    
    vi.restoreAllMocks();
  });
});
