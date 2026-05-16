import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configCommand } from '../cli/commands/config.command';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('path', async () => {
  const actual = await vi.importActual('path') as any;
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/'))
  };
});
vi.mock('os', () => ({
  homedir: () => '/home/user'
}));

describe('ConfigCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set a config value', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    
    await configCommand('set', 'defaultModel', 'flash');
    
    expect(fs.writeFileSync).toHaveBeenCalled();
    const savedConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(savedConfig.defaultModel).toBe('flash');
  });

  it('should reset config', async () => {
    await configCommand('reset');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
