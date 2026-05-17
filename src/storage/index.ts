import { join } from 'path';
import { homedir } from 'os';
import { SQLiteStorageProvider } from './sqlite-provider.js';
import { ConfigManager } from '../config/config-manager.js';
import chalk from 'chalk';

let globalStorage: SQLiteStorageProvider | null = null;
let storageInitialized = false;
let fallbackMode = false;

export function getStorage(): SQLiteStorageProvider | null {
  const config = ConfigManager.get();
  if (!config.persistHistory) {
    return null;
  }

  if (storageInitialized) {
    return fallbackMode ? null : globalStorage;
  }

  storageInitialized = true;
  const dbPath = join(homedir(), '.imara', 'data', 'imara.db');
  try {
    globalStorage = new SQLiteStorageProvider(dbPath);
    globalStorage.init();
    fallbackMode = false;
  } catch (error) {
    fallbackMode = true;
    globalStorage = null;
    // Graceful degradation: Display a subtle, non-blocking diagnostic warning
    console.warn(
      chalk.yellow(
        '\n⚠ Diagnostic : Impossible d\'initialiser la base de données SQLite.'
      )
    );
    console.warn(
      chalk.gray(
        '  IMARA CLI continuera de fonctionner normalement en mode mémoire volatile.\n'
      )
    );
  }

  return globalStorage;
}

export function resetStorageState(): void {
  globalStorage = null;
  storageInitialized = false;
  fallbackMode = false;
}
