import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import keytar from 'keytar';

const SERVICE_NAME = 'imara-cli';
const ACCOUNT_NAME = 'api-key';

// --- FileKeychain : fallback fichier pour Linux sans libsecret ---

const FALLBACK_DIR = join(homedir(), '.imara');

function getFallbackPath(key: string): string {
  return join(FALLBACK_DIR, key);
}

function ensureDir(): void {
  if (!existsSync(FALLBACK_DIR)) {
    mkdirSync(FALLBACK_DIR, { recursive: true });
  }
}

function writeFallbackFile(key: string, value: string): void {
  ensureDir();
  const path = getFallbackPath(key);
  writeFileSync(path, value, { encoding: 'utf-8', mode: 0o600 });
  // Tentative de protection des permissions (silencieux si non supporté)
  try { chmodSync(path, 0o600); } catch { /* ignore sur Windows */ }
}

function readFallbackFile(key: string): string | null {
  const path = getFallbackPath(key);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').trim();
}

function deleteFallbackFile(key: string): void {
  const path = getFallbackPath(key);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

// Utilitaires pour tenter keytar avec fallback fichier
async function keytarSaveSafe(account: string, value: string): Promise<boolean> {
  try {
    await keytar.setPassword(SERVICE_NAME, account, value);
    return true;
  } catch {
    return false;
  }
}

async function keytarGetSafe(account: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, account);
  } catch {
    return null;
  }
}

async function keytarDeleteSafe(account: string): Promise<boolean> {
  try {
    await keytar.deletePassword(SERVICE_NAME, account);
    return true;
  } catch {
    return false;
  }
}

// --- Classe principale Keychain avec fallback ---

export class Keychain {
  static async save(apiKey: string): Promise<void> {
    const ok = await keytarSaveSafe(ACCOUNT_NAME, apiKey);
    if (!ok) {
      writeFallbackFile('api-key', apiKey);
    }
  }

  static async get(): Promise<string | null> {
    const fromKeytar = await keytarGetSafe(ACCOUNT_NAME);
    if (fromKeytar) return fromKeytar;
    return readFallbackFile('api-key');
  }

  static async delete(): Promise<void> {
    const ok = await keytarDeleteSafe(ACCOUNT_NAME);
    if (!ok) {
      deleteFallbackFile('api-key');
    } else {
      // Nettoyer aussi le fichier au cas où un fallback existait
      deleteFallbackFile('api-key');
    }
  }

  static async saveExternalKey(modelName: string, apiKey: string): Promise<void> {
    const account = `external-key-${modelName.toLowerCase()}`;
    const ok = await keytarSaveSafe(account, apiKey);
    if (!ok) {
      writeFallbackFile(account, apiKey);
    }
  }

  static async getExternalKey(modelName: string): Promise<string | null> {
    const account = `external-key-${modelName.toLowerCase()}`;
    const fromKeytar = await keytarGetSafe(account);
    if (fromKeytar) return fromKeytar;
    return readFallbackFile(account);
  }

  static async deleteExternalKey(modelName: string): Promise<void> {
    const account = `external-key-${modelName.toLowerCase()}`;
    const ok = await keytarDeleteSafe(account);
    if (!ok) {
      deleteFallbackFile(account);
    } else {
      deleteFallbackFile(account);
    }
  }
}
