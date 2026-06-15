import { Socket } from 'socket.io';
import { Agent } from '../agent/agent';
import { requireAuth } from '../auth/auth';
import { ProjectAnalyzer } from '../context/project-analyzer';
import { ConfigManager } from '../config/config-manager';
import { Keychain } from '../auth/keychain';
import { isNativeModel } from '../utils/model';

const activeSessions = new Map<string, { agent: Agent; socket: Socket }>();

function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][0-9;]*\x1b\\/g, '')
    .replace(/\x1b\][0-9;]*\x07/g, '')
    .trim();
}

function isJunkLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[─┌┐└┘├┤┬┴┼│┃╔╗╚╝╠╣╦╩╬═\s]{2,}$/.test(t)) return true;
  if (/^[-=\s]{3,}$/.test(t)) return true;
  if (/^❯\s*$/.test(t)) return true;
  return false;
}

function cleanLine(raw: string): string {
  let c = stripAnsi(raw);
  c = c.replace(/^  +/, '');
  return c;
}

const SPINNER_CHARS = /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\s]*$/;

function isSpinnerLine(text: string): boolean {
  if (SPINNER_CHARS.test(text)) return true;
  if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+\s+pense[.\s]*$/i.test(text)) return true;
  return false;
}

function isReasoningLine(text: string): boolean {
  return /^(Pensée|🧠\s*Pens[eé]e|💭)/i.test(text);
}

function isToolOutput(text: string): boolean {
  const tools = [
    '✓ Read', '✓ Write', '✓ Update', '✓ Edit', '✓ Bash',
    '✓ List', '✓ Search', '✓ Diff', '✓ Map', '✓ Index',
    '✓ Summary', '✓ Validate', '✓ Track', '✓ Web', '✓ Inspect',
    '✓ Clear', '✓ Remove',
  ];
  return tools.some(t => text.startsWith(t) || text.includes(t));
}

const socketModelMap = new Map<string, string>();

export class BrowserAgentBridge {
  static setModelForSocket(socketId: string, model: string): void {
    console.log(`[BrowserAgentBridge] Modele enregistre pour socket ${socketId}: "${model}"`);
    socketModelMap.set(socketId, model);
  }

  static getModelForSocket(socketId: string): string {
    const stored = socketModelMap.get(socketId);
    if (stored) return stored;
    const config = ConfigManager.get();
    return config.defaultModel || 'zuri';
  }

  static async handleChatMessage(
    socket: Socket,
    message: string,
    sessionId: string
  ): Promise<void> {
    try {
      await requireAuth();
      let session = activeSessions.get(sessionId);
      if (!session) {
        const resolvedModel = BrowserAgentBridge.getModelForSocket(socket.id);
        console.log(`[BrowserAgentBridge] Creation session socket=${socket.id}, modele="${resolvedModel}"`);
        if (!isNativeModel(resolvedModel)) {
          const key = await Keychain.getExternalKey(resolvedModel);
          if (!key) {
            socket.emit('chat-response', {
              sessionId,
              role: 'assistant',
              content: `Modele externe "${resolvedModel}" necessite une cle API. Executez d'abord "imara chat" dans le terminal pour la configurer.`,
              timestamp: Date.now(),
            });
            return;
          }
        }
        const agent = new Agent({
          model: resolvedModel,
          yes: true,
          execute: true,
        });
        agent.initContext();
        session = { agent, socket };
        activeSessions.set(sessionId, session);
        const projectInfo = await ProjectAnalyzer.analyze();
        socket.emit('chat-response', {
          sessionId,
          role: 'system',
          content: `Session IMARA initialisee pour le projet "${projectInfo.name}". Agent pret.`,
          timestamp: Date.now(),
        });
      }
      socket.emit('chat-message-ack', {
        sessionId,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });
      const originalWrite = process.stdout.write.bind(process.stdout);
      let partialLine = '';
      const responseLines: string[] = [];
      const writeInterceptor: (...args: any[]) => boolean = (chunk: any, encoding?: any, callback?: any): boolean => {
        const raw = typeof chunk === 'string' ? chunk : chunk.toString();
        const full = partialLine + raw;
        const segmentsByCr = full.split('\r');
        let lastAfterCr = segmentsByCr.pop() || '';
        const classifyLine = (cleaned: string, rawLine: string): void => {
          if (!cleaned || isSpinnerLine(cleaned)) {
            return;
          }
          const hasItalicStyle = /\x1b\[3m/.test(rawLine) || /\x1b\[2m/.test(rawLine);
          if (isToolOutput(cleaned)) {
            socket.emit('chat-tool-call', { sessionId, content: cleaned, timestamp: Date.now() });
            // Detecter les ecritures de fichiers pour emettre file-written avec diff
            // Format 1: "✓ Write → Fichier path/to/file ecrit avec succes (42 lignes)."
            let writeMatch = cleaned.match(/^✓\s*(Write|Update|Edit|Append)\s*→\s*Fichier\s+(.+?)\s+(?:écrit|sauvegardé|modifié)/i);
            if (!writeMatch) {
              // Format 2: "✓ Write(path/to/file)"
              writeMatch = cleaned.match(/^✓\s*(Write|Update|Edit|Append)\s*\((.+?)\)/i);
            }
            if (writeMatch) {
              let filePath = writeMatch[2].trim();
              const pathModule = require('path');
              const cwd = process.cwd();
              if (!filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\\/)) {
                filePath = pathModule.resolve(cwd, filePath);
              }
              const relPath = pathModule.relative(cwd, filePath).replace(/\\/g, '/');
              const { GitUtils } = require('../utils/git-utils');
              const diff = GitUtils.getFileDiff(filePath);
              socket.emit('file-written', {
                sessionId,
                path: relPath,
                diff: diff || '',
                timestamp: Date.now(),
              });
              // Emettre le diff dans le chat
              if (diff) {
                socket.emit('chat-diff', {
                  sessionId,
                  path: relPath,
                  content: diff,
                  timestamp: Date.now(),
                });
              }
            }
            return;
          }
          if (hasItalicStyle || isReasoningLine(cleaned)) {
            socket.emit('chat-reasoning', { sessionId, content: cleaned, timestamp: Date.now() });
            return;
          }
          responseLines.push(cleaned);
        };
        for (const seg of segmentsByCr) {
          const subLines = seg.split('\n');
          subLines.pop();
          for (const line of subLines) {
            classifyLine(cleanLine(line), line);
          }
        }
        const finalLines = lastAfterCr.split('\n');
        partialLine = finalLines.pop() || '';
        for (const line of finalLines) {
          classifyLine(cleanLine(line), line);
        }
        return originalWrite(chunk, encoding, callback);
      };
      (process.stdout as any).write = writeInterceptor;
      try {
        await session.agent.run(message);
        if (partialLine.trim()) {
          const cleaned = cleanLine(partialLine);
          if (cleaned && !isJunkLine(cleaned) && !isSpinnerLine(cleaned)) {
            if (isToolOutput(cleaned)) {
              socket.emit('chat-tool-call', { sessionId, content: cleaned, timestamp: Date.now() });
            } else if (isReasoningLine(cleaned) || /\x1b\[3m/.test(partialLine) || /\x1b\[2m/.test(partialLine)) {
              socket.emit('chat-reasoning', { sessionId, content: cleaned, timestamp: Date.now() });
            } else {
              responseLines.push(cleaned);
            }
          }
        }
        if (responseLines.length > 0) {
          socket.emit('chat-response', {
            sessionId,
            role: 'assistant',
            content: responseLines.join('\n'),
            type: 'response',
            timestamp: Date.now(),
          });
        }
        socket.emit('chat-done', { sessionId, timestamp: Date.now() });
      } finally {
        (process.stdout as any).write = originalWrite;
      }
    } catch (error: any) {
      socket.emit('chat-error', {
        sessionId,
        error: error.message || 'Erreur lors du traitement du message.',
        timestamp: Date.now(),
      });
    }
  }

  static getStatsForSocket(socketId: string): {
    model: string;
    tokens: number;
    costFcfa: number;
    trackId: string | null;
    trackTitle: string | null;
    contextPercent: number;
    contextState: 'ok' | 'warning' | 'critical' | 'compacted';
    phase: 'idle' | 'thinking' | 'tool';
  } {
    for (const [, session] of activeSessions) {
      if (session.socket.id === socketId) {
        const stats = session.agent.getSessionStats();
        const ctxStats = session.agent.getContextStats();
        return {
          model: session.agent.getModel(),
          tokens: stats.tokens,
          costFcfa: stats.cost,
          trackId: null,
          trackTitle: null,
          contextPercent: ctxStats.percent,
          contextState: ctxStats.state,
          phase: 'idle',
        };
      }
    }
    return {
      model: 'zuri',
      tokens: 0,
      costFcfa: 0,
      trackId: null,
      trackTitle: null,
      contextPercent: 0,
      contextState: 'ok',
      phase: 'idle',
    };
  }

  static clearSessionForSocket(socketId: string): void {
    for (const [sessionId, session] of activeSessions) {
      if (session.socket.id === socketId) {
        session.agent.cancel();
        activeSessions.delete(sessionId);
        console.log(`[BrowserAgentBridge] Session detruite pour socket ${socketId} (ancien modele)`);
        return;
      }
    }
  }

  static cancelGeneration(sessionId: string): void {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.agent.cancel();
    }
  }

  static cleanup(): void {
    for (const [sessionId, session] of activeSessions) {
      session.agent.cancel();
      activeSessions.delete(sessionId);
    }
  }
}
