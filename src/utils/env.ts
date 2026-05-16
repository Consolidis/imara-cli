// src/utils/env.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';

// Load .env file from current working directory
dotenv.config();

const CONFIG_FILE = path.join(os.homedir(), '.imara', 'config.json');

export function getEnv(name: string, defaultValue: string = ''): string {
  // 1. Check process.env
  if (process.env[name]) return process.env[name]!;

  // 2. Check config file
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (config[name]) return config[name];
    } catch { /* ignore */ }
  }

  return defaultValue;
}

export function getApiUrl(): string {
  return getEnv('IMARA_API_URL', 'https://api.imara.ai').trim();
}

export function getDebugMode(): boolean {
  return getEnv('IMARA_DEBUG') === 'true';
}

export function getAutoConfirm(): boolean {
  return getEnv('IMARA_AUTO_CONFIRM') === 'true';
}

export function getApiKey(): string | null {
  return getEnv('IMARA_API_KEY') || null;
}
