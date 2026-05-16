import { describe, it, expect } from 'vitest';

describe('Imara CLI Smoke Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have a working environment', () => {
    expect(process.cwd()).toBeDefined();
  });
});
