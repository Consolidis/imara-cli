/** Noeud de l'arborescence du projet */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
  children?: FileNode[];
}

/** Message dans le chat */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  type?: 'reasoning' | 'response';
  timestamp: number;
}

/** Événement de fichier modifié (depuis le FileWatcher) */
export interface FileChangeEvent {
  path: string;
  fullPath: string;
  event: 'file-added' | 'file-updated' | 'file-deleted' | 'directory-added' | 'directory-deleted';
  timestamp: number;
}

/** Résultat de lecture de fichier */
export interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: string;
}

/** Résultat d'écriture de fichier */
export interface FileSaveResult {
  path: string;
  saved: boolean;
  timestamp: number;
}

/** Statistiques de session (pour la barre de statut) */
export interface SessionStats {
  model: string;
  tokens: number;
  costFcfa: number;
  trackId: string | null;
  trackTitle: string | null;
  contextPercent: number;
  contextState: 'ok' | 'warning' | 'critical' | 'compacted';
  phase: 'idle' | 'thinking' | 'tool';
}
