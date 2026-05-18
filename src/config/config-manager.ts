import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

export interface ConfigSchema {
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultModel: string;
  language: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  contextDepth: number;
  verbose: boolean;
  theme: string;
  offline: boolean;
  autoConfirm: boolean;
  apiBaseUrl: string;
  tokenWarningThreshold: number;
  tokenCompactThreshold: number;
  onboardingDone: boolean;
  persistHistory: boolean;
  userName: string;
  userEmail: string;
}

export const DEFAULT_CONFIG: ConfigSchema = {
  apiKey: '',
  baseUrl: 'https://api.imara.consolidis.com',
  model: 'zuri',
  defaultModel: 'zuri',
  language: 'fr',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 8192,
  contextDepth: 2,
  verbose: false,
  theme: 'dark',
  offline: false,
  autoConfirm: false,
  apiBaseUrl: 'https://api.imara.consolidis.com',
  tokenWarningThreshold: 0.7,
  tokenCompactThreshold: 0.85,
  onboardingDone: false,
  persistHistory: true,
  userName: '',
  userEmail: '',
};

export class ConfigManager {
  static _cache: ConfigSchema | null = null;

  private static getPath(): string {
    return join(homedir(), '.imara', 'config.json');
  }

  static isFirstLaunch(): boolean {
    const path = this.getPath();
    if (!existsSync(path)) return true;
    return !this.get().onboardingDone;
  }

  static get(): ConfigSchema {
    if (this._cache) return this._cache;
    const path = this.getPath();
    if (!existsSync(path)) {
      this._cache = { ...DEFAULT_CONFIG };
      return this._cache;
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      this._cache = { ...DEFAULT_CONFIG, ...raw };
    } catch {
      this._cache = { ...DEFAULT_CONFIG };
    }
    return this._cache!;
  }

  static getRaw<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return this.get()[key];
  }

  static set(partial: Partial<ConfigSchema>): void {
    const current = this.get();
    const updated = { ...current, ...partial };
    this._cache = updated;
    const path = this.getPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(updated, null, 2));
  }

  static reset(): void {
    this._cache = { ...DEFAULT_CONFIG };
    const path = this.getPath();
    if (existsSync(path)) {
      writeFileSync(path, JSON.stringify(this._cache, null, 2));
    }
  }

  static validateKey(key: string): boolean {
    return key in DEFAULT_CONFIG;
  }

  static parseValue<K extends keyof ConfigSchema>(
    key: K,
    value: string
  ): ConfigSchema[K] {
    const def = DEFAULT_CONFIG[key];
    if (typeof def === 'boolean') return (value === 'true') as ConfigSchema[K];
    if (typeof def === 'number') return (Number(value) || def) as ConfigSchema[K];
    return value as ConfigSchema[K];
  }
}