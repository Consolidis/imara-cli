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
  persistHistory: boolean;
}

const DEFAULTS: ConfigSchema = {
  apiKey: '',
  // baseUrl: 'https://api.imara.consolidis.com',
  baseUrl: 'http://localhost:3001', 
  model: 'imara-zuri',
  temperature: 0.7,
  maxTokens: 16384, 
  contextWindow: 32768,
  verbose: false,
  theme: 'dark',
  offline: false,
  persistHistory: true,
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
