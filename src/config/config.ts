import { existsSync, readFileSync } from 'node:fs';
import { join } from 'path';

export interface ConfigSchema {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  verbose: boolean;
  theme: string;
  offline: boolean;
}

const DEFAULTS: ConfigSchema = {
  apiKey: '',
  baseUrl: 'https://api.imara.consolidis.com',
  model: 'imara-zuri',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 8192,
  verbose: false,
  theme: 'dark',
  offline: false,
};

export function loadConfig(): ConfigSchema {
  const path = join(process.cwd(), '.imara', 'config.json');
  if (!existsSync(path)) return DEFAULTS;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}
