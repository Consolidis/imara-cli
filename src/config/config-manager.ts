import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

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
  contextPreserveMessages: number;
  maxWriteLines: number;
  maxFullFileReadsPerTurn: number;
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
  tavilyApiKey: string;
}

export const DEFAULT_CONFIG: ConfigSchema = {
  apiKey: '',
  baseUrl: 'https://api.imara.consolidis.com',
  // baseUrl: 'http://localhost:3001',
  model: 'flash',
  defaultModel: 'flash',
  language: 'fr',
  temperature: 0.7,
  maxTokens: 216384,
  contextWindow: 232768,
  contextDepth: 4,
  contextPreserveMessages: 32,
  maxWriteLines: 150,
  maxFullFileReadsPerTurn: 8,
  verbose: false,
  theme: 'dark',
  offline: false,
  autoConfirm: false,
  apiBaseUrl: 'https://api.imara.consolidis.com',
  // apiBaseUrl: 'http://localhost:3001',
  tokenWarningThreshold: 0.88,
  tokenCompactThreshold: 0.96,
  onboardingDone: false,
  persistHistory: true,
  userName: '',
  userEmail: '',
  tavilyApiKey: '',
};

export class ConfigManager {
  static _cache: ConfigSchema | null = null;

  /**
   * Répertoire racine de la configuration.
   * IMARA_CONFIG_DIR permet de rediriger le home (CI, tests, isolation).
   */
  private static getConfigDir(): string {
    const override = process.env.IMARA_CONFIG_DIR?.trim();
    if (override) return override;
    return homedir();
  }

  private static getPath(): string {
    return join(this.getConfigDir(), '.imara', 'config.json');
  }

  /** Relit l'état réel du fichier depuis le disque, sans passer par le cache mémoire. */
  private static readFromDisk(): ConfigSchema {
    const path = this.getPath();
    if (!existsSync(path)) return { ...DEFAULT_CONFIG };
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...raw };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Invalide le cache mémoire et recharge la configuration depuis le disque.
   * À appeler avant de lire une valeur qui peut avoir été modifiée par un
   * autre processus (ex: `imara config set ...` lancé en parallèle).
   */
  static refresh(): void {
    this._cache = this.readFromDisk();
  }

  static isFirstLaunch(): boolean {
    const path = this.getPath();
    if (!existsSync(path)) return true;
    return !this.get().onboardingDone;
  }

  static get(): ConfigSchema {
    if (this._cache) return this._cache;
    this._cache = this.readFromDisk();
    return this._cache!;
  }

  static getRaw<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return this.get()[key];
  }

  /**
   * Écrit une mise à jour de configuration.
   * IMPORTANT : fusion read-modify-write depuis le DISQUE (et non depuis le
   * cache mémoire), pour ne jamais écraser des écritures concurrentes
   * provenant d'autres processus (perte d'écriture évitée).
   */
  static set(partial: Partial<ConfigSchema>): void {
    const current = this.readFromDisk();
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
