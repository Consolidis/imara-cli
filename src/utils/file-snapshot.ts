import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isInsideCwd } from './file-utils';

/**
 * Checkpoints fichiers (snapshots) pour rollback securise.
 * Les snapshots sont stockes dans ~/.imara/snapshots/ (ou $IMARA_HOME/snapshots).
 * Chaque snapshot = un fichier JSON de manifeste + un fichier .snap (contenu
 * d'origine) si le fichier existait. Un fichier nouveau (inexistant) est
 * represente par un manifeste avec existed=false : le rollback supprimera
 * le fichier cree par la modification.
 */

export interface SnapshotManifest {
  id: string;
  filePath: string;
  existed: boolean;
  timestamp: number;
  snapFile: string | null;
  size: number;
}

export interface RollbackResult {
  filePath: string;
  existed: boolean;
  size: number;
  deleted: boolean;
}

export function getImaraHome(): string {
  return process.env.IMARA_HOME || path.join(os.homedir(), '.imara');
}

export function getSnapshotsDir(): string {
  return path.join(getImaraHome(), 'snapshots');
}

/** Hash simple (djb2) pour generer un id stable sans dependance externe. */
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function listManifests(): SnapshotManifest[] {
  const dir = getSnapshotsDir();
  if (!fs.existsSync(dir)) return [];
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  const manifests: SnapshotManifest[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const parsed = JSON.parse(raw) as SnapshotManifest;
      if (parsed && typeof parsed.filePath === 'string') {
        manifests.push(parsed);
      }
    } catch {
      // Manifeste corrompu : ignore (sera nettoye par clearSnapshots)
    }
  }
  manifests.sort((a, b) => b.timestamp - a.timestamp);
  return manifests;
}

/**
 * Cree un snapshot du fichier AVANT modification.
 * Fichier existant : copie du contenu dans <id>.snap.
 * Fichier nouveau : manifeste avec existed=false (rollback = suppression).
 * Securite : refuse les fichiers hors workspace.
 */
export function snapshotBefore(filePath: string): SnapshotManifest {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!isInsideCwd(fullPath)) {
    throw new Error('Securite: Snapshot refuse en dehors du workspace.');
  }
  const dir = getSnapshotsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const timestamp = Date.now();
  const id = `${timestamp}-${hashString(fullPath)}`;
  const existed = fs.existsSync(fullPath);
  let snapFile: string | null = null;
  let size = 0;
  if (existed) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    size = Buffer.byteLength(content, 'utf-8');
    snapFile = `${id}.snap`;
    fs.writeFileSync(path.join(dir, snapFile), content, 'utf-8');
  }
  const manifest: SnapshotManifest = {
    id,
    filePath: fullPath,
    existed,
    timestamp,
    snapFile,
    size
  };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}

/**
 * Restaure le dernier snapshot (le plus recent), puis supprime le snapshot.
 * Retourne null si aucun snapshot disponible.
 */
export function rollbackLast(): RollbackResult | null {
  const manifests = listManifests();
  if (manifests.length === 0) return null;
  const snap = manifests[0];
  const dir = getSnapshotsDir();
  let deleted = false;
  if (snap.existed && snap.snapFile) {
    const snapPath = path.join(dir, snap.snapFile);
    if (fs.existsSync(snapPath)) {
      const content = fs.readFileSync(snapPath, 'utf-8');
      const targetDir = path.dirname(snap.filePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(snap.filePath, content, 'utf-8');
    }
  } else {
    // Fichier cree par la modification : suppression au rollback
    if (fs.existsSync(snap.filePath)) {
      fs.unlinkSync(snap.filePath);
      deleted = true;
    }
  }
  // Nettoyage du snapshot (manifeste + contenu)
  try {
    fs.unlinkSync(path.join(dir, `${snap.id}.json`));
  } catch { /* ignore */ }
  if (snap.snapFile) {
    try {
      fs.unlinkSync(path.join(dir, snap.snapFile));
    } catch { /* ignore */ }
  }
  return {
    filePath: snap.filePath,
    existed: snap.existed,
    size: snap.size,
    deleted
  };
}

/** Liste les snapshots disponibles (du plus recent au plus ancien). */
export function listSnapshots(): SnapshotManifest[] {
  return listManifests();
}

/** Supprime tous les snapshots enregistres. */
export function clearSnapshots(): number {
  const dir = getSnapshotsDir();
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') || f.endsWith('.snap'));
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(dir, file));
    } catch { /* ignore */ }
  }
  return files.length;
}
