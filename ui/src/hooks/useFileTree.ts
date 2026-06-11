import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { FileNode } from '../types';

/**
 * Hook pour charger et maintenir l'arborescence des fichiers
 * du projet via Socket.io.
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

  const loadTree = useCallback(() => {
    if (!socket) return;

    setLoading(true);
    setError(null);

    socket.emit('list-directory', {}, (nodes: FileNode[]) => {
      setTree(nodes);
      setLoading(false);
    });

    // Fallback si pas de callback (timeout après 5s)
    setTimeout(() => {
      setLoading(false);
    }, 5000);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    loadTree();

    // Rafraîchir l'arborescence quand un fichier est ajouté/supprimé
    const handleFileChange = () => {
      loadTree();
    };

    socket.on('file-added', handleFileChange);
    socket.on('file-deleted', handleFileChange);
    socket.on('directory-added', handleFileChange);
    socket.on('directory-deleted', handleFileChange);

    return () => {
      socket.off('file-added', handleFileChange);
      socket.off('file-deleted', handleFileChange);
      socket.off('directory-added', handleFileChange);
      socket.off('directory-deleted', handleFileChange);
    };
  }, [socket, loadTree]);

  return { tree, loading, error, refresh: loadTree };
}
