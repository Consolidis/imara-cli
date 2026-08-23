/**
 * Setup global des tests : isole le répertoire personnel (homedir) vers un
 * dossier temporaire unique par worker. Sans cela, les tests qui manipulent
 * ConfigManager / search-cache écriraient ou SUPPRIMERAIENT le vrai
 * ~/.imara/config.json de l'utilisateur (apiKey, tavilyApiKey, ...).
 */
import { vi, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Factory INLINE obligatoire : le hoisting de vi.mock déplace l'appel en haut
// du fichier, avant toute déclaration const. Une référence à une variable
// externe y lèverait "Cannot access before initialization". Le factory n'est
// exécuté qu'au premier import de 'os' par un test, moment où TEST_HOME existe.
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof os>('os');
  return {
    ...actual,
    homedir: () => TEST_HOME,
  };
});

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof os>('node:os');
  return {
    ...actual,
    homedir: () => TEST_HOME,
  };
});

// Unique par worker (process.pid) pour éviter les collisions entre workers
// Vitest qui s'exécutent en parallèle.
const TEST_HOME = path.join(os.tmpdir(), `imara-test-home-${process.pid}`);

afterAll(() => {
  try {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  } catch {
    // Nettoyage best-effort
  }
});
