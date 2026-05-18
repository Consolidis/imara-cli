#!/usr/bin/env node
import { program } from './cli/program';
import updateNotifier from 'update-notifier';
import { showErrorPanel } from './ui/components/error-panel';
import { resetStorageState } from './storage';
const pkg = require('../package.json');

// Check for updates
try {
  updateNotifier({ pkg }).notify();
} catch {
  // Silent fallback
}

// Global Exception Boundaries to prevent CLI crash
process.on('uncaughtException', (error) => {
  try {
    showErrorPanel(error);
    resetStorageState();
  } catch {
    console.error('\nErreur fatale non gérée:', error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  try {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    showErrorPanel(error);
    resetStorageState();
  } catch {
    console.error('\nErreur fatale non gérée (rejection):', reason);
  }
  process.exit(1);
});

// Parse and run
program.parseAsync(process.argv).then(() => {
  resetStorageState();
  // Safe exit
  if (process.env.NODE_ENV !== 'test') {
    process.exit(0);
  }
}).catch((error) => {
  showErrorPanel(error);
  resetStorageState();
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});
