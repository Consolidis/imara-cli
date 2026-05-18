import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../context/project-analyzer';

describe('ProjectAnalyzer (Multi-Git Scanner)', () => {
  const testDir = path.join(process.cwd(), 'temp-test-analyzer');

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('should analyze project and discover multiple git repos', async () => {
    // 1. Setup mock nested git repositories in the test sandbox
    const backendGit = path.join(testDir, 'backend', '.git');
    fs.mkdirSync(backendGit, { recursive: true });

    const frontendGit = path.join(testDir, 'frontend', '.git');
    fs.mkdirSync(frontendGit, { recursive: true });

    // Create a mock package.json
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'my-monorepo' }), 'utf-8');

    // Run analyzer
    const analysis = await ProjectAnalyzer.analyze();
    expect(analysis.name).toBe('my-monorepo');
    expect(analysis.multiGitStatus).toContain('backend');
    expect(analysis.multiGitStatus).toContain('frontend');
  });
});
