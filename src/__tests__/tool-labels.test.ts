import { describe, it, expect } from 'vitest';
import { buildToolConfirmContent } from '../ui/tool-labels';

describe('buildToolConfirmContent', () => {
  it('should show shell command for run_command', () => {
    const c = buildToolConfirmContent('run_command', { command: 'npm run build' });
    expect(c.kind).toBe('shell');
    expect(c.body).toBe('npm run build');
    expect(c.headline).toContain('commande');
  });

  it('should show path for write_file', () => {
    const c = buildToolConfirmContent('write_file', { path: 'src/app.ts' });
    expect(c.body).toBe('src/app.ts');
  });
});
