import { Socket } from 'socket.io';
import { Agent } from '../agent/agent';
import { requireAuth } from '../auth/auth';
import { ProjectAnalyzer } from '../context/project-analyzer';
import { ConfigManager } from '../config/config-manager';
import { Keychain } from '../auth/keychain';
import { isNativeModel } from '../utils/model';

const activeSessions = new Map<string, { agent: Agent; socket: Socket }>();

// ---- Utilitaires de nettoyage ANSI ----

/**
 * Supprime les séquences ANSI escape codes (couleurs chalk, styles, etc.)
 */
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][0-9;]*\x1b\\/g, '')
    .replace(/\x1b\][0-9;]*\x07/g, '')
    .trim();
}

/**
 * Vrai si la ligne est un artefact terminal (bordures, lignes vides, etc.)
 */
function isJunkLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[─┌┐└┘├┤┬┴┼│┃╔╗╚╝╠╣╦╩╬═\s]{2,}$/.test(t)) return true;
  if (/^[-=\s]{3,}$/.test(t)) return true;
  if (/^❯\s*$/.test(t)) return true;
  return false;
}

/**
 * Nettoie une ligne de son contenu terminal et retourne le texte utile.
 */
function cleanLine(raw: string): string {
  let c = stripAnsi(raw);
  // Retirer l'indentation terminal standard (2 espaces)
  c = c.replace(/^  +/, '');
  return c;
}

/**
 * Vrai si la ligne nettoyee ne contient qu'un spinner de chargement terminal.
 * Les spinners sont typiquement : ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ suivi de "pense" ou autre texte court.
 */
const SPINNER_CHARS = /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\s]*$/;
function isSpinnerLine(text: string): boolean {
  // Lignes qui ne sont QUE des frames de spinner
  if (SPINNER_CHARS.test(text)) return true;
  // Frame de spinner suivie de "pense" ou "pense." etc.
  if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+\s+pense[.\s]*$/i.test(text)) return true;
  return false;
}

/**
 * Vrai si la ligne est une pensee de l'agent (showReasoning).
 */
function isReasoningLine(text: string): boolean {
  return /^(Pensée|🧠\s*Pens[eé]e|💭)/i.test(text);
}

/**
 * Détecte si le texte propre correspond à un outil (tool call).
 */
function isToolOutput(text: string): boolean {
  const tools = [
    '✓ Read', '✓ Write', '✓ Update', '✓ Edit', '✓ Bash',
    '✓ List', '✓ Search', '✓ Diff', '✓ Map', '✓ Index',
    '✓ Summary', '✓ Validate', '✓ Track', '✓ Web', '✓ Inspect',
    '✓ Clear', '✓ Remove',
  ];
  return tools.some(t => text.startsWith(t) || text.includes(t));
}

// Stocke le modele choisi par chaque client socket (socketId -> model)
const socketModelMap = new Map<string, string>();

// ---- BrowserAgentBridge ----
export class BrowserAgentBridge {
  /** Enregistre le modele choisi par un client socket */
  static setModelForSocket(socketId: string, model: string): void {
    console.log(`[BrowserAgentBridge] Modele enregistre pour socket ${socketId}: "${model}"`);
    socketModelMap.set(socketId, model);
  }

  /** Recupere le modele associe a un socket, ou le defaut */
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

      // Interception stdout : les tool calls sont emis en temps reel.
      const originalWrite = process.stdout.write.bind(process.stdout);
      let partialLine = '';
      const reasoningLines: string[] = [];
      const responseLines: string[] = [];

      const writeInterceptor = (chunk: any, encoding?: any, callback?: any): boolean => {
        const raw = typeof chunk === 'string' ? chunk : chunk.toString();
        const full = partialLine + raw;
        const segmentsByCr = full.split('\r');
        let lastAfterCr = segmentsByCr.pop() || '';
        for (const seg of segmentsByCr) {
          const subLines = seg.split('\n');
          subLines.pop();
          for (const line of subLines) {
            const cleaned = cleanLine(line);
            if (!cleaned || isJunkLine(cleaned) || isSpinnerLine(cleaned)) continue;
            if (isToolOutput(cleaned)) {
              socket.emit('chat-tool-call', { sessionId, content: cleaned, timestamp: Date.now() });
            } else if (isReasoningLine(cleaned)) {
              reasoningLines.push(cleaned);
            } else {
              responseLines.push(cleaned);
            }
          }
        }
        const finalLines = lastAfterCr.split('\n');
        partialLine = finalLines.pop() || '';
        for (const line of finalLines) {
          const cleaned = cleanLine(line);
          if (!cleaned || isJunkLine(cleaned) || isSpinnerLine(cleaned)) continue;
          if (isToolOutput(cleaned)) {
            socket.emit('chat-tool-call', { sessionId, content: cleaned, timestamp: Date.now() });
          } else if (isReasoningLine(cleaned)) {
            reasoningLines.push(cleaned);
          } else {
            responseLines.push(cleaned);
          }
        }
        return originalWrite(chunk, encoding, callback);
      };

      (process.stdout as any).write = writeInterceptor;

      try {
        await session.agent.run(message);

        // Vider la ligne partielle restante
        if (partialLine.trim()) {
          const cleaned = cleanLine(partialLine);
          if (cleaned && !isJunkLine(cleaned) && !isSpinnerLine(cleaned)) {
            if (isToolOutput(cleaned)) {
              socket.emit('chat-tool-call', { sessionId, content: cleaned, timestamp: Date.now() });
            } else if (isReasoningLine(cleaned)) {
              reasoningLines.push(cleaned);
            } else {
              responseLines.push(cleaned);
            }
          }
        }

        // Envoyer la pensee en premier (si presente)
        if (reasoningLines.length > 0) {
          socket.emit('chat-response', {
            sessionId,
            role: 'assistant',
            content: reasoningLines.join('\n'),
            timestamp: Date.now(),
          });
        }
        // Envoyer la reponse
        if (responseLines.length > 0) {
          socket.emit('chat-response', {
            sessionId,
            role: 'assistant',
            content: responseLines.join('\n'),
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

  /** Retourne les stats de session pour un socket (ou valeurs par defaut) */
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
    // Chercher une session associee a ce socket
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
    // Pas de session active -> defaut
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
