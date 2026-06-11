import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { SessionStats } from '../types';

const DEFAULT_STATS: SessionStats = {
  model: 'zuri',
  tokens: 0,
  costFcfa: 0,
  trackId: null,
  trackTitle: null,
  contextPercent: 0,
  contextState: 'ok',
  phase: 'idle',
};

/**
 * Hook pour recuperer les stats de session (modele, tokens, cout, track, contexte)
 * depuis le serveur via Socket.io.
 * Interroge toutes les 5s et immediatement apres un evenement chat.
 */
export function useSessionStats(socket: Socket | null): SessionStats {
  const [stats, setStats] = useState<SessionStats>(DEFAULT_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Mettre a jour socketRef
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Fonction de requete des stats
  const requestStats = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    s.emit('request-stats');
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Ecouter les reponses session-stats
    const handleStats = (data: SessionStats) => {
      setStats(data);
    };


    // Declencher une mise a jour apres chaque evenement chat ou changement modele
    const triggerRefresh = () => {
      requestStats();
    };
    socket.on('session-stats', handleStats);
    socket.on('chat-done', triggerRefresh);
    socket.on('chat-response', triggerRefresh);
    socket.on('chat-reasoning', triggerRefresh);
    socket.on('chat-tool-call', triggerRefresh);
    // Refresh immediat apres changement de modele (tache 8)
    socket.on('model-changed', triggerRefresh);

    // Interroger toutes les 5s
    intervalRef.current = setInterval(requestStats, 5000);

    // Premiere requete immediate
    requestStats();

    return () => {
      socket.off('session-stats', handleStats);

      socket.off('chat-done', triggerRefresh);
      socket.off('chat-response', triggerRefresh);
      socket.off('chat-reasoning', triggerRefresh);
      socket.off('chat-tool-call', triggerRefresh);
      socket.off('model-changed', triggerRefresh);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [socket, requestStats]);

  return stats;
}
