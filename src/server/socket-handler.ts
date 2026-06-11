import { Server as SocketServer, Socket } from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';
import { validatePath, isFileTransferAllowed, isTextExtension } from './path-guard';
import { Message, ParsedToolCall, ToolArguments } from '../agent/agent.types';

// Types des événements Socket.io

/** Nœud de l'arborescence du projet */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
  children?: FileNode[];
}

/** Message affiché dans le chat UI */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolArgs?: ToolArguments;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Gestionnaire d'événements Socket.io
// ---------------------------------------------------------------------------

/**
 * Configure tous les gestionnaires d'événements Socket.io.
 *
 * @param io - Instance du serveur Socket.io
 * @param onChatMessage - Callback pour traiter un message chat (relié à l'agent)
 */
export function setupSocketHandlers(
  io: SocketServer,
  onChatMessage: (socket: Socket, message: string, sessionId: string) => Promise<void>
): void {

  io.on('connection', (socket: Socket) => {
    console.log(`[Browser IDE] Client connecté: ${socket.id}`);

    // --- LIST DIRECTORY : Renvoie l'arborescence du projet ---
    socket.on('list-directory', async (_data: unknown, callback?: (nodes: FileNode[]) => void) => {
      try {
        const rootPath = process.cwd();
        const tree = await buildFileTree(rootPath, rootPath, 0);
        if (typeof callback === 'function') {
          callback(tree);
        } else {
          socket.emit('directory-listing', tree);
        }
      } catch (err: any) {
        socket.emit('error', { code: 'LIST_ERROR', message: err.message });
      }
    });

    // --- READ FILE : Lit un fichier sur le disque ---
    socket.on('read-file', async (data: { path: string }, callback?: (result: any) => void) => {
      try {
        const safePath = validatePath(data.path);
        if (!isFileTransferAllowed(safePath)) {
          const err = 'Fichier trop volumineux (>1 Mo) ou inaccessible.';
          if (typeof callback === 'function') {
            callback({ error: err });
          } else {
            socket.emit('file-error', { path: data.path, error: err });
          }
          return;
        }

        const content = fs.readFileSync(safePath, 'utf-8');
        const stat = fs.statSync(safePath);
        const result = {
          path: data.path,
          content,
          language: detectLanguage(safePath),
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
        };

        if (typeof callback === 'function') {
          callback(result);
        } else {
          socket.emit('file-content', result);
        }
      } catch (err: any) {
        const errorMsg = { path: data.path, error: err.message };
        if (typeof callback === 'function') {
          callback({ error: err.message });
        } else {
          socket.emit('file-error', errorMsg);
        }
      }
    });

    // --- WRITE FILE : Écrit les modifications sur le disque ---
    socket.on('write-file', async (data: { path: string; content: string }, callback?: (result: any) => void) => {
      try {
        const safePath = validatePath(data.path);
        fs.writeFileSync(safePath, data.content, 'utf-8');
        console.log(`[Browser IDE] Fichier sauvegardé: ${path.relative(process.cwd(), safePath)}`);

        const result = { path: data.path, saved: true, timestamp: Date.now() };
        if (typeof callback === 'function') {
          callback(result);
        } else {
          socket.emit('file-saved', result);
        }
      } catch (err: any) {
        const errorMsg = { path: data.path, error: err.message };
        if (typeof callback === 'function') {
          callback({ error: err.message });
        } else {
          socket.emit('file-error', errorMsg);
        }
      }
    });

    // --- CHAT MESSAGE : Transmet le message à l'agent ---    // --- CHANGE MODEL : Recoit le changement de modele depuis l'UI ---    // --- CHANGE MODEL : Recoit le changement de modele depuis l'UI ---
    socket.on('change-model', (data: { model: string }) => {
      console.log(`[Socket/change-model] Client ${socket.id} change de modele: "${data.model}"`);
      // Stocker le modele pour ce socket via BrowserAgentBridge
      const { BrowserAgentBridge } = require('./browser-agent');
      BrowserAgentBridge.setModelForSocket(socket.id, data.model);
      // Accuser reception
      socket.emit('model-changed', { model: data.model, timestamp: Date.now() });
    });

    // --- CHAT MESSAGE : Transmet le message à l'agent ---
    socket.on('chat-message', async (data: { message: string; sessionId?: string }) => {
      const sessionId = data.sessionId || `session_${socket.id}`;
      try {
        await onChatMessage(socket, data.message, sessionId);
      } catch (err: any) {
        socket.emit('chat-error', {
          sessionId,
          error: err.message || 'Erreur lors du traitement du message.',
          timestamp: Date.now(),
        });
      }
    });

    // --- STOP GENERATION : Interrompt l'agent ---    // --- STOP GENERATION : Interrompt l'agent ---
    socket.on('stop-generation', (_data: unknown) => {
      console.log(`[Browser IDE] Arrêt demandé par le client: ${socket.id}`);
      socket.emit('generation-stopped', { timestamp: Date.now() });
    });

    // --- DÉCONNEXION ---
    socket.on('disconnect', (reason: string) => {
      console.log(`[Browser IDE] Client déconnecté: ${socket.id} (raison: ${reason})`);
    });
  });
}

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

/**
 * Construit récursivement l'arborescence des fichiers du projet,
 * en excluant les dossiers sensibles (node_modules, .git, dist, etc.).
 */
async function buildFileTree(
  dirPath: string,
  rootPath: string,
  depth: number
): Promise<FileNode[]> {
  const EXCLUDED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'ui-dist', '.next', 'build',
    '.cache', '__pycache__', '.venv', 'venv', '.idea', '.vscode',
  ]);
  const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', '.DS_Store']);

  if (depth > 5) return []; // Limiter la profondeur à 5 niveaux

  const entries: FileNode[] = [];
  let names: string[];

  try {
    names = fs.readdirSync(dirPath);
  } catch {
    return entries;
  }

  // Trier : dossiers d'abord, puis fichiers, par ordre alphabétique
  const sortedNames = names.sort((a, b) => {
    const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
    const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  for (const name of sortedNames) {
    const fullPath = path.join(dirPath, name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (EXCLUDED_DIRS.has(name) || EXCLUDED_FILES.has(name)) continue;
    if (name.startsWith('.')) continue; // Cacher les fichiers cachés
    if (name === 'ui') continue; // Le dossier UI a son propre build

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const children = await buildFileTree(fullPath, rootPath, depth + 1);
      entries.push({
        name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else if (stat.isFile()) {
      entries.push({
        name,
        path: relativePath,
        type: 'file',
        extension: path.extname(name).toLowerCase(),
        size: stat.size,
      });
    }
  }

  return entries;
}

/**
 * Détecte le langage d'un fichier à partir de son extension pour Monaco Editor.
 */
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.htm': 'html',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.env': 'plaintext',
    '.txt': 'plaintext',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.php': 'php',
    '.vue': 'html',
    '.svelte': 'html',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.sh': 'shell',
    '.bat': 'bat',
    '.ps1': 'powershell',
    '.svg': 'xml',
    '.gitignore': 'plaintext',
    '.dockerignore': 'plaintext',
    '.editorconfig': 'ini',
    '.config': 'json',
    '.rc': 'json',
    '.astro': 'html',
  };
  return langMap[ext] || 'plaintext';
}
