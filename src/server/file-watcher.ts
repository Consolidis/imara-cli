import * as chokidar from 'chokidar';
import * as path from 'path';
import { Server as SocketServer } from 'socket.io';

/**
 * Wrapper autour de chokidar pour surveiller les modifications du projet
 * et notifier les clients Socket.io en temps réel.
 *
 * Dossiers exclus de la surveillance :
 * - node_modules, .git, dist, ui-dist
 * - ui/node_modules (frontend en dev)
 */
export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private io: SocketServer | null = null;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Attache l'instance Socket.io pour les notifications.
   */
  attachSocket(io: SocketServer): void {
    this.io = io;
  }

  /**
   * Démarre la surveillance du répertoire.
   */
  start(): void {
    if (this.watcher) return; // Déjà en cours

    const EXCLUDED_PATTERNS = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/ui-dist/**',
      '**/.cache/**',
      '**/__pycache__/**',
      '**/.next/**',
      '**/build/**',
      '**/.venv/**',
      '**/venv/**',
      '**/.idea/**',
      '**/.vscode/**',
      '**/package-lock.json',
      '**/yarn.lock',
    ];

    this.watcher = chokidar.watch(this.rootPath, {
      ignored: EXCLUDED_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 8,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath: string) => {
        this.notify('file-added', filePath);
      })
      .on('change', (filePath: string) => {
        this.notify('file-updated', filePath);
      })
      .on('unlink', (filePath: string) => {
        this.notify('file-deleted', filePath);
      })
      .on('addDir', (dirPath: string) => {
        this.notify('directory-added', dirPath);
      })
      .on('unlinkDir', (dirPath: string) => {
        this.notify('directory-deleted', dirPath);
      })
      .on('error', (error: Error) => {
        console.error(`[FileWatcher] Erreur: ${error.message}`);
      });

    console.log(`[FileWatcher] Surveillance active: ${this.rootPath}`);
  }

  /**
   * Arrête la surveillance.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[FileWatcher] Surveillance arrêtée.');
    }
  }

  /**
   * Notifie les clients Socket.io d'un changement de fichier.
   */
  private notify(event: string, filePath: string): void {
    if (!this.io) return;

    const relativePath = path.relative(this.rootPath, filePath).replace(/\\/g, '/');

    const payload = {
      path: relativePath,
      fullPath: filePath,
      event,
      timestamp: Date.now(),
    };

    this.io.emit(event, payload);
    console.log(`[FileWatcher] ${event}: ${relativePath}`);
  }

  /**
   * Vérifie si la surveillance est active.
   */
  get isWatching(): boolean {
    return this.watcher !== null;
  }
}
