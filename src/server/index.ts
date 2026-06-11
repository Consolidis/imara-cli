import * as http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createExpressApp } from './express-app';
import { setupSocketHandlers } from './socket-handler';
import { FileWatcher } from './file-watcher';
import { findFreePort } from './port-finder';
import { Socket } from 'socket.io';

// Module-level state : permet de détecter si le serveur est déjà lancé
let serverInstance: http.Server | null = null;
let ioInstance: SocketServer | null = null;
let fileWatcherInstance: FileWatcher | null = null;
let activePort: number | null = null;

/**
 * Résultat du démarrage du serveur IDE Web.
 */
export interface BrowserServerInfo {
  port: number;
  url: string;
  alreadyRunning: boolean;
}

/**
 * Démarre le serveur IDE Web sur un port libre.
 *
 * @param onChatMessage - Callback pour traiter les messages chat (relié à l'agent)
 * @returns Informations sur le serveur démarré
 */
export async function startBrowserServer(
  onChatMessage?: (socket: Socket, message: string, sessionId: string) => Promise<void>
): Promise<BrowserServerInfo> {
  // Détection : si le serveur est déjà lancé, retourner l'info
  if (serverInstance && activePort !== null) {
    return {
      port: activePort,
      url: `http://127.0.0.1:${activePort}`,
      alreadyRunning: true,
    };
  }

  // Trouver un port libre
  const port = await findFreePort();
  activePort = port;

  // Créer l'application Express
  const { app } = createExpressApp();

  // Créer le serveur HTTP
  const httpServer = http.createServer(app);

  // Créer Socket.io
  const io = new SocketServer(httpServer, {
    cors: {
      origin: ['http://127.0.0.1', 'http://localhost'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
  });
  ioInstance = io;

  // Configurer les handlers Socket.io
  const defaultChatHandler = async (socket: Socket, message: string, sessionId: string) => {
    // Par défaut : écho simple (sera remplacé par l'agent réel)
    socket.emit('chat-response', {
      sessionId,
      role: 'assistant',
      content: `Message reçu: ${message}. L'agent sera connecté dans une prochaine mise à jour.`,
      timestamp: Date.now(),
    });
  };

  setupSocketHandlers(io, onChatMessage || defaultChatHandler);

  // Démarrer le FileWatcher
  const fileWatcher = new FileWatcher(process.cwd());
  fileWatcher.attachSocket(io);
  fileWatcher.start();
  fileWatcherInstance = fileWatcher;

  // Stocker l'instance serveur
  serverInstance = httpServer;

  // Promesse pour le démarrage
  return new Promise((resolve, reject) => {
    httpServer.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(`[Browser IDE] Serveur démarré sur ${url}`);
      resolve({
        port,
        url,
        alreadyRunning: false,
      });
    });

    httpServer.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Le port ${port} est déjà utilisé.`));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Arrête proprement le serveur IDE Web.
 */
export async function stopBrowserServer(): Promise<void> {
  if (fileWatcherInstance) {
    fileWatcherInstance.stop();
    fileWatcherInstance = null;
  }

  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }

  if (serverInstance) {
    return new Promise((resolve) => {
      serverInstance!.close(() => {
        console.log('[Browser IDE] Serveur arrêté.');
        serverInstance = null;
        activePort = null;
        resolve();
      });
    });
  }
}

/**
 * Vérifie si le serveur IDE Web est actuellement en cours d'exécution.
 */
export function isBrowserServerRunning(): boolean {
  return serverInstance !== null && activePort !== null;
}

/**
 * Retourne l'URL du serveur IDE Web, ou null s'il n'est pas lancé.
 */
export function getBrowserServerUrl(): string | null {
  if (activePort === null) return null;
  return `http://127.0.0.1:${activePort}`;
}
