import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';

dotenv.config();

const CONFIG_DIR = path.join(os.homedir(), '.imara');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface ConfigSchema {
  defaultModel: string;
  language: string;
  autoConfirm: boolean;
  contextDepth: number;
  maxTokensPerRequest: number;
  apiBaseUrl: string;
}

export const DEFAULT_CONFIG: ConfigSchema = {
  defaultModel: 'zuri',
  language: 'fr',
  autoConfirm: false,
  contextDepth: 2,
  maxTokensPerRequest: 8192,
  apiBaseUrl: 'https://api.imara.ai'
};

const ALLOWED_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof ConfigSchema)[];

export class ConfigManager {
  private static _cache: ConfigSchema | null = null;

  static get(): ConfigSchema {
    if (this._cache) return this._cache;

    const fileConfig = this.loadFromFile();
    const merged = { ...DEFAULT_CONFIG, ...fileConfig };
    const envConfig = this.loadFromEnv();

    this._cache = { ...merged, ...envConfig };
    return this._cache;
  }

  static getRaw<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return this.get()[key];
  }

  static set(values: Partial<ConfigSchema>): void {
    const current = this.loadFromFile();
    const updated = { ...current, ...values };
    this.saveToFile(updated);
    this._cache = null;
  }

  static reset(): void {
    this.saveToFile(DEFAULT_CONFIG);
    this._cache = null;
  }

  static validateKey(key: string): key is keyof ConfigSchema {
    return ALLOWED_KEYS.includes(key as keyof ConfigSchema);
  }

  static parseValue(key: keyof ConfigSchema, raw: string): ConfigSchema[keyof ConfigSchema] {
    const defaultVal = DEFAULT_CONFIG[key];
    if (typeof defaultVal === 'boolean') return raw === 'true';
    if (typeof defaultVal === 'number') {
      const num = Number(raw);
      if (isNaN(num)) throw new Error(`La valeur pour "${key}" doit être un nombre.`);
      return num;
    }
    return raw;
  }

  private static loadFromFile(): Partial<ConfigSchema> {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return this.sanitize(parsed);
    } catch {
      return {};
    }
  }

  private static loadFromEnv(): Partial<ConfigSchema> {
    const env: Partial<ConfigSchema> = {};
    if (process.env.IMARA_API_URL) env.apiBaseUrl = process.env.IMARA_API_URL.trim();
    if (process.env.IMARA_AUTO_CONFIRM) env.autoConfirm = process.env.IMARA_AUTO_CONFIRM === 'true';
    if (process.env.IMARA_DEBUG) env.contextDepth = parseInt(process.env.IMARA_DEBUG, 10); /* fallback map */
    return env;
  }

  private static saveToFile(config: Partial<ConfigSchema>): void {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  private static sanitize(raw: Record<string, unknown>): Partial<ConfigSchema> {
    const clean: Partial<ConfigSchema> = {};
    for (const key of ALLOWED_KEYS) {
      if (key in raw) {
        const val = raw[key];
        if (this.isValidType(key, val)) {
          (clean as Record<string, unknown>)[key] = val;
        }
      }
    }
    return clean;
  }

  private static isValidType<K extends keyof ConfigSchema>(key: K, val: unknown): val is ConfigSchema[K] {
    const expected = typeof DEFAULT_CONFIG[key];
    return typeof val === expected;
  }
}
