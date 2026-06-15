import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { FileNode } from '../types';

/**
 * Hook pour charger et maintenir l'arborescence des fichiers
 * du projet via Socket.io.
 * Inclut un debounce pour eviter les appels en boucle.
 */
export function useFileTree(socket: Socket | null): {
  tree: FileNode[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTree = useCallback(() => {
    if (!socket) return;
    // Garde-fou: ne pas lancer si deja en cours
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    socket.emit('list-directory', {}, (nodes: FileNode[]) => {
      setTree(nodes);
      setLoading(false);
      loadingRef.current = false;
    });
    // Fallback timeout de securite
    setTimeout(() => {
      if (loadingRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }, 5000);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    loadTree();

    // Debouncer les evenements de rechargement (300ms)
    const debouncedRefresh = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        loadTree();
      }, 300);
    };

    socket.on('file-added', debouncedRefresh);
    socket.on('file-deleted', debouncedRefresh);
    socket.on('directory-added', debouncedRefresh);
    socket.on('directory-deleted', debouncedRefresh);

    return () => {
      socket.off('file-added', debouncedRefresh);
      socket.off('file-deleted', debouncedRefresh);
      socket.off('directory-added', debouncedRefresh);
      socket.off('directory-deleted', debouncedRefresh);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [socket, loadTree]);

  return { tree, loading, error, refresh: loadTree };
}
