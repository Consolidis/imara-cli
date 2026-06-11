import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface TrackMeta {
  id: string;
  title: string;
  author: string;
  status: 'active' | 'done' | 'archived';
  createdAt: string;
  updatedAt: string;
  validated: boolean;
}

export interface TrackProgress {
  done: number;
  total: number;
  percent: number;
  tasks: string[];
}

export interface ConductorData {
  active: TrackMeta | null;
  tracks: TrackMeta[];
  progress: Record<string, TrackProgress>;
  spec: string;
  workflow: string;
  logs: string;
  registre: string;
  timestamp: number;
}

const DEFAULT_CONDUCTOR: ConductorData = {
  active: null,
  tracks: [],
  progress: {},
  spec: '',
  workflow: '',
  logs: '',
  registre: '',
  timestamp: 0,
};

/**
 * Hook pour recuperer les donnees Conductor (tracks, progression, specs, logs)
 * depuis le serveur via Socket.io.
 * Interroge toutes les 5s.
 */
export function useConductorData(socket: Socket | null): {
  data: ConductorData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<ConductorData>(DEFAULT_CONDUCTOR);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const requestConductor = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    setLoading(true);
    s.emit('request-conductor', (result: ConductorData & { error?: string }) => {
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setData({
        active: result.active || null,
        tracks: result.tracks || [],
        progress: result.progress || {},
        spec: result.spec || '',
        workflow: result.workflow || '',
        logs: result.logs || '',
        registre: result.registre || '',
        timestamp: result.timestamp || Date.now(),
      });
      setError(null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConductorData = (result: ConductorData) => {
      setData({
        active: result.active || null,
        tracks: result.tracks || [],
        progress: result.progress || {},
        spec: result.spec || '',
        workflow: result.workflow || '',
        logs: result.logs || '',
        registre: result.registre || '',
        timestamp: result.timestamp || Date.now(),
      });
      setError(null);
      setLoading(false);
    };

    socket.on('conductor-data', handleConductorData);

    intervalRef.current = setInterval(() => {
      requestConductor();
    }, 5000);

    requestConductor();

    return () => {
      socket.off('conductor-data', handleConductorData);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [socket, requestConductor]);

  return { data, loading, error, refresh: requestConductor };
}
