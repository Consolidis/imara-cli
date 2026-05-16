import { ConfigManager } from '../config';

export function getApiUrl(): string {
  return ConfigManager.getRaw('apiBaseUrl');
}

export function getDebugMode(): boolean {
  return process.env.IMARA_DEBUG === 'true';
}

export function getAutoConfirm(): boolean {
  return ConfigManager.getRaw('autoConfirm') || process.env.IMARA_AUTO_CONFIRM === 'true';
}

export function getApiKey(): string | null {
  return process.env.IMARA_API_KEY || null;
}

