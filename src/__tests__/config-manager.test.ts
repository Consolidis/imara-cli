import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, DEFAULT_CONFIG } from '../config';

const TEST_CONFIG = path.join(os.homedir(), '.imara', 'config.json');

describe('ConfigManager', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_CONFIG)) fs.unlinkSync(TEST_CONFIG);
    (ConfigManager as any)._cache = null;
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG)) fs.unlinkSync(TEST_CONFIG);
    (ConfigManager as any)._cache = null;
  });

  it('should return default config when no file exists', () => {
    const cfg = ConfigManager.get();
    expect(cfg.defaultModel).toBe('zuri');
    expect(cfg.language).toBe('fr');
  });

  it('should persist and reload config', () => {
    ConfigManager.set({ defaultModel: 'flash' });
    (ConfigManager as any)._cache = null;
    const cfg = ConfigManager.get();
    expect(cfg.defaultModel).toBe('flash');
  });

  it('should validate allowed keys', () => {
    expect(ConfigManager.validateKey('defaultModel')).toBe(true);
    expect(ConfigManager.validateKey('invalidKey')).toBe(false);
  });

  it('should parse boolean values', () => {
    expect(ConfigManager.parseValue('autoConfirm', 'true')).toBe(true);
    expect(ConfigManager.parseValue('autoConfirm', 'false')).toBe(false);
  });

  it('should parse numeric values', () => {
    expect(ConfigManager.parseValue('contextDepth', '5')).toBe(5);
  });

  it('should reset to defaults', () => {
    ConfigManager.set({ defaultModel: 'custom' });
    ConfigManager.reset();
    (ConfigManager as any)._cache = null;
    expect(ConfigManager.get().defaultModel).toBe('zuri');
  });
});
