import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../services/socket';

interface ConnectionState {
  connected: boolean;
  socketId: string | null;
  error: string | null;
}

/**
 * Hook de connexion Socket.io.
 * Gère l'état de connexion et la réconciliation avec le cycle de vie React.
 */
export function useSocket(): {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
  reconnect: () => void;
} {
  const [state, setState] = useState<ConnectionState>({
    connected: false,
    socketId: null,
    error: null,
  });

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = connectSocket();

    const onConnect = () => {
      setState({
        connected: true,
        socketId: s.id || null,
        error: null,
      });
    };

    const onDisconnect = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        socketId: null,
      }));
    };

    const onConnectError = (err: Error) => {
      setState((prev) => ({
        ...prev,
        connected: false,
        error: err.message,
      }));
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    // Si déjà connecté (s'est produit avant le useEffect)
    if (s.connected) {
      onConnect();
    }

    setSocket(s);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      disconnectSocket();
    };
  }, []);

  const reconnect = useCallback(() => {
    disconnectSocket();
    const s = connectSocket();
    setSocket(s);
  }, []);

  return {
    socket,
    connected: state.connected,
    error: state.error,
    reconnect,
  };
}
