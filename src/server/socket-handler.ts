import { Server as SocketServer, Socket } from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';
import { validatePath, isFileTransferAllowed, isTextExtension } from './path-guard';
import { TrackManager } from '../context/conductor/track-manager';
import { GitUtils } from '../utils/git-utils';
import { Message, ParsedToolCall, ToolArguments } from '../agent/agent.types';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
  children?: FileNode[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolArgs?: ToolArguments;
  type?: 'reasoning' | 'response';
  timestamp: number;
}

export function setupSocketHandlers(
  io: SocketServer,
  onChatMessage: (socket: Socket, message: string, sessionId: string) => Promise<void>
): void {

  // Cache + throttle pour list-directory (evite la boucle infinie)
  let lastListDirTime = 0;
  let cachedTree: FileNode[] | null = null;
  const LIST_DIR_THROTTLE_MS = 3000;

  io.on('connection', (socket: Socket) => {
    console.log(`[Browser IDE] Client connecte: ${socket.id}`);

    socket.on('list-directory', async (_data: unknown, callback?: (nodes: FileNode[]) => void) => {
      const now = Date.now();
      if (now - lastListDirTime < LIST_DIR_THROTTLE_MS && cachedTree !== null) {
        if (typeof callback === 'function') {
          callback(cachedTree);
        } else {
          socket.emit('directory-listing', cachedTree);
        }
        return;
      }
      try {
        const rootPath = process.cwd();
        console.log(`[Browser IDE] Construction arborescence depuis: ${rootPath}`);
        cachedTree = await buildFileTree(rootPath, rootPath, 0);
        lastListDirTime = Date.now();
        console.log(`[Browser IDE] Arborescence construite: ${cachedTree.length} elements racine`);
        if (typeof callback === 'function') {
          callback(cachedTree);
        } else {
          socket.emit('directory-listing', cachedTree);
        }
      } catch (err: any) {
        console.error(`[Browser IDE] Erreur construction arborescence: ${err.message}`);
        if (typeof callback === 'function') {
          callback([]);
        } else {
          socket.emit('error', { code: 'LIST_ERROR', message: err.message });
        }
      }
    });

    socket.on('read-file', async (data: { path: string }, callback?: (result: any) => void) => {
      try {
        const safePath = validatePath(data.path);
        if (!isFileTransferAllowed(safePath)) {
          const err = 'Fichier trop volumineux (>1 Mo) ou inaccessible.';
          if (typeof callback === 'function') { callback({ error: err }); }
          else { socket.emit('file-error', { path: data.path, error: err }); }
          return;
        }
        const content = fs.readFileSync(safePath, 'utf-8');
        const stat = fs.statSync(safePath);
        const result = { path: data.path, content, language: detectLanguage(safePath), size: stat.size, lastModified: stat.mtime.toISOString() };
        if (typeof callback === 'function') { callback(result); }
        else { socket.emit('file-content', result); }
      } catch (err: any) {
        const errorMsg = { path: data.path, error: err.message };
        if (typeof callback === 'function') { callback({ error: err.message }); }
        else { socket.emit('file-error', errorMsg); }
      }
    });

    socket.on('write-file', async (data: { path: string; content: string }, callback?: (result: any) => void) => {
      try {
        const safePath = validatePath(data.path);
        fs.writeFileSync(safePath, data.content, 'utf-8');
        console.log(`[Browser IDE] Fichier sauvegarde: ${path.relative(process.cwd(), safePath)}`);
        const result = { path: data.path, saved: true, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(result); }
        else { socket.emit('file-saved', result); }
      } catch (err: any) {
        const errorMsg = { path: data.path, error: err.message };
        if (typeof callback === 'function') { callback({ error: err.message }); }
        else { socket.emit('file-error', errorMsg); }
      }
    });

    socket.on('request-stats', () => {
      const { BrowserAgentBridge } = require('./browser-agent');
      const stats = BrowserAgentBridge.getStatsForSocket(socket.id);
      const track = TrackManager.getActive();
      if (track) {
        stats.trackId = track.id;
        stats.trackTitle = track.title;
      }
      socket.emit('session-stats', stats);
    });

    socket.on('change-model', (data: { model: string }) => {
      console.log(`[Socket/change-model] Client ${socket.id} change de modele: "${data.model}"`);
      const { BrowserAgentBridge } = require('./browser-agent');
      BrowserAgentBridge.setModelForSocket(socket.id, data.model);
      BrowserAgentBridge.clearSessionForSocket(socket.id);
      socket.emit('model-changed', { model: data.model, timestamp: Date.now() });
    });

    socket.on('request-git-diff', (_data: unknown, callback?: (result: any) => void) => {
      try {
        const diff = GitUtils.getDiff();
        const status = GitUtils.getGitStatus();
        const result = { diff, status, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(result); }
        else { socket.emit('git-diff-result', result); }
      } catch (err: any) {
        const errorResult = { error: err.message, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(errorResult); }
        else { socket.emit('git-diff-error', errorResult); }
      }
    });

    socket.on('request-git-log', (_data: unknown, callback?: (result: any) => void) => {
      try {
        const commits = GitUtils.getRecentCommits(15);
        const status = GitUtils.getGitStatus();
        const diff = GitUtils.getDiff();
        const result = { commits, status, diff, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(result); }
        else { socket.emit('git-log-result', result); }
      } catch (err: any) {
        const errorResult = { error: err.message, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(errorResult); }
        else { socket.emit('git-log-error', errorResult); }
      }
    });

    socket.on('request-git-push', async (_data: unknown, callback?: (result: any) => void) => {
      try {
        const pushResult = GitUtils.push();
        if (typeof callback === 'function') { callback(pushResult); }
        else { socket.emit('git-push-result', pushResult); }
      } catch (err: any) {
        const errorResult = { success: false, message: err.message };
        if (typeof callback === 'function') { callback(errorResult); }
        else { socket.emit('git-push-error', errorResult); }
      }
    });

    socket.on('request-conductor', (_data: unknown, callback?: (result: any) => void) => {
      try {
        const active = TrackManager.getActive();
        const tracks = TrackManager.getAllTracks();
        const progress: Record<string, { done: number; total: number; percent: number; tasks: string[] }> = {};
        for (const t of tracks) {
          progress[t.id] = TrackManager.computeProgress(t.id);
        }
        const spec = TrackManager.readSpec();
        const workflow = TrackManager.readWorkflow();
        const logs = TrackManager.readLogs();
        const registre = TrackManager.getRegistre();
        const result = { active, tracks, progress, spec, workflow, logs, registre, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(result); }
        else { socket.emit('conductor-data', result); }
      } catch (err: any) {
        const errorResult = { error: err.message, timestamp: Date.now() };
        if (typeof callback === 'function') { callback(errorResult); }
        else { socket.emit('conductor-error', errorResult); }
      }
    });

    socket.on('chat-message', async (data: { message: string; sessionId?: string }) => {
      const sessionId = data.sessionId || `session_${socket.id}`;
      try { await onChatMessage(socket, data.message, sessionId); }
      catch (err: any) {
        socket.emit('chat-error', { sessionId, error: err.message || 'Erreur lors du traitement du message.', timestamp: Date.now() });
      }
    });

    socket.on('stop-generation', (data: { sessionId?: string }) => {
      const sessionId = data?.sessionId || `session_${socket.id}`;
      console.log(`[Browser IDE] Arret demande par le client: ${socket.id} session=${sessionId}`);
      const { BrowserAgentBridge } = require('./browser-agent');
      BrowserAgentBridge.cancelGeneration(sessionId);
      socket.emit('generation-stopped', { sessionId, timestamp: Date.now() });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Browser IDE] Client deconnecte: ${socket.id} (raison: ${reason})`);
    });
  });
}

async function buildFileTree(dirPath: string, rootPath: string, depth: number): Promise<FileNode[]> {
  const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'ui-dist', '.next', 'build', '.cache', '__pycache__', '.venv', 'venv', '.idea', '.vscode']);
  const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', '.DS_Store']);
  if (depth > 5) return [];
  const entries: FileNode[] = [];
  let names: string[];
  try { names = fs.readdirSync(dirPath); }
  catch { return entries; }
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
    if (name.startsWith('.')) continue;
    if (name === 'ui') continue;
    let stat: fs.Stats;
    try { stat = fs.statSync(fullPath); }
    catch { continue; }
    if (stat.isDirectory()) {
      const children = await buildFileTree(fullPath, rootPath, depth + 1);
      entries.push({ name, path: relativePath, type: 'directory', children });
    } else if (stat.isFile()) {
      entries.push({ name, path: relativePath, type: 'file', extension: path.extname(name).toLowerCase(), size: stat.size });
    }
  }
  return entries;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json', '.md': 'markdown', '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.html': 'html', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    '.env': 'plaintext', '.txt': 'plaintext', '.py': 'python', '.rb': 'ruby',
    '.go': 'go', '.rs': 'rust', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c',
    '.hpp': 'cpp', '.php': 'php', '.vue': 'html', '.svelte': 'html', '.sql': 'sql',
    '.graphql': 'graphql', '.sh': 'shell', '.bat': 'bat', '.ps1': 'powershell',
    '.svg': 'xml', '.gitignore': 'plaintext', '.dockerignore': 'plaintext',
    '.editorconfig': 'ini', '.config': 'json', '.rc': 'json', '.astro': 'html',
  };
  return langMap[ext] || 'plaintext';
}
