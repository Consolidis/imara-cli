import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Initialise la connexion Socket.io vers le serveur CLI.
 * L'URL est déduite automatiquement depuis window.location.
 */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const serverUrl = window.location.origin;

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connecté au serveur IDE');
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Déconnecté:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Erreur de connexion:', error.message);
  });

  return socket;
}

/**
 * Retourne l'instance Socket.io actuelle.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Ferme la connexion Socket.io.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
