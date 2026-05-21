import { Message } from '../agent/agent.types';
import { countConversationTokens, countTokensBatch } from '../utils/token-counter';
import { SessionSummary } from './session-summary';
import { getStorage } from '../storage/index';

export type ContextWindowState = 'ok' | 'warning' | 'critical' | 'compacted';

export interface WindowStats {
  totalTokens: number;
  maxTokens: number;
  systemTokens: number;
  userTokens: number;
  assistantTokens: number;
  toolTokens: number;
  remainingTokens: number;
  state: ContextWindowState;
  messageCount: number;
}

interface ContextWindowOptions {
  maxTokens: number;
  warningThreshold: number; // pourcentage (0-100) ou ratio (0-1)
  compactThreshold: number; // pourcentage (0-100) ou ratio (0-1)
  preserveTailMessages?: number;
}

const DEFAULT_PRESERVE_TAIL = 32;

export class ContextWindow {
  private maxTokens: number;
  private warningTokens: number;
  private compactTokens: number;
  private preserveTailMessages: number;

  constructor(options: ContextWindowOptions) {
    this.maxTokens = options.maxTokens;
    const warnFactor = options.warningThreshold > 1 ? options.warningThreshold / 100 : options.warningThreshold;
    const compactFactor = options.compactThreshold > 1 ? options.compactThreshold / 100 : options.compactThreshold;
    this.warningTokens = Math.floor(this.maxTokens * warnFactor);
    this.compactTokens = Math.floor(this.maxTokens * compactFactor);
    this.preserveTailMessages = Math.max(4, options.preserveTailMessages ?? DEFAULT_PRESERVE_TAIL);
  }

  getStats(messages: Message[]): WindowStats {
    const perRole = this.countByRole(messages);
    const total = perRole.system + perRole.user + perRole.assistant + perRole.tool;
    const state = this.determineState(total);

    return {
      totalTokens: total,
      maxTokens: this.maxTokens,
      systemTokens: perRole.system,
      userTokens: perRole.user,
      assistantTokens: perRole.assistant,
      toolTokens: perRole.tool,
      remainingTokens: Math.max(0, this.maxTokens - total),
      state,
      messageCount: messages.length,
    };
  }

  check(messages: Message[]): { state: ContextWindowState; action: 'none' | 'warn' | 'compact' | 'truncate' } {
    const total = this.getTotalTokens(messages);
    const percentage = (total / this.maxTokens) * 100;

    if (total >= this.compactTokens) {
      return { state: 'critical', action: 'compact' };
    }
    if (total >= this.warningTokens) {
      return { state: 'warning', action: 'warn' };
    }
    return { state: 'ok', action: 'none' };
  }

  compact(messages: Message[], sessionId?: string): Message[] {
    const minMessages = 1 + this.preserveTailMessages;
    if (messages.length <= minMessages) {
      return this.truncateToFit(messages);
    }

    const systemMessage = messages.find(m => m.role === 'system');
    if (!systemMessage) {
      return this.truncateToFit(messages);
    }

    // Conserver system + N derniers messages (demandes, réponses, résultats d'outils)
    const tail = messages.slice(-this.preserveTailMessages);
    const middleMessages = messages.filter(
      m => m.role !== 'system' && !tail.includes(m)
    );

    let compacted = messages;
    if (middleMessages.length > 0) {
      // Resumer les messages intermediaires
      const summary = this.generateSummary(middleMessages);

      // Sauvegarde SQLite du résumé de contexte
      if (sessionId) {
        const provider = getStorage();
        if (provider) {
          try {
            const latest = provider.getLatestSummary(sessionId);
            const nextVersion = (latest?.version ?? 0) + 1;
            provider.saveSummary({
              sessionId,
              content: summary,
              tokenCount: countConversationTokens([{ role: 'system', content: summary }]),
              createdAt: Date.now(),
              version: nextVersion
            });
          } catch {
            // Fallback silencieux en cas d'erreur SQLite
          }
        }
      }

      const summaryMessage: Message = {
        role: 'system',
        content: `RESUME DES ECHANGES PRECEDENTS : ${summary}`
      };

      compacted = [systemMessage, summaryMessage, ...tail];
    }

    // Si toujours au-dessus du seuil apres resume, tronquer les anciens
    if (this.getTotalTokens(compacted) >= this.compactTokens) {
      compacted = [systemMessage, ...tail];
    }

    // Troncature dure auto-correctrice pour s'assurer de ne jamais dépasser maxTokens
    return this.truncateToFit(compacted);
  }

  private truncateToFit(messages: Message[]): Message[] {
    let total = this.getTotalTokens(messages);
    if (total <= this.maxTokens) return messages;

    // Clone pour éviter les mutations directes
    const cloned = messages.map(m => ({ ...m }));

    while (total > this.maxTokens) {
      let largestIndex = -1;
      let largestLength = 0;

      for (let i = 0; i < cloned.length; i++) {
        const msg = cloned[i];
        if (msg.role === 'system') continue;
        if (msg.content && msg.content.length > largestLength) {
          largestLength = msg.content.length;
          largestIndex = i;
        }
      }

      if (largestIndex === -1 || largestLength <= 60) {
        break;
      }

      const msg = cloned[largestIndex];
      const truncationSuffix = '\n... [CONTENU TRONQUÉ POUR CONTEXTE LIMITE] ...\n';
      const cleanContent = msg.content.includes(truncationSuffix)
        ? msg.content.replace(truncationSuffix, '')
        : msg.content;
      
      const originalLen = cleanContent.length;
      const targetLen = Math.floor(originalLen * 0.5);

      if (targetLen < 10) {
        msg.content = '...' + truncationSuffix;
      } else if (msg.role === 'tool') {
        msg.content = cleanContent.slice(0, targetLen) + truncationSuffix;
      } else {
        const half = Math.floor(targetLen / 2);
        msg.content = cleanContent.slice(0, half) + truncationSuffix + cleanContent.slice(-half);
      }

      total = this.getTotalTokens(cloned);
    }

    return cloned;
  }

  private getTotalTokens(messages: Message[]): number {
    return countConversationTokens(messages.map(m => ({ role: m.role, content: m.content })));
  }

  private countByRole(messages: Message[]): { system: number; user: number; assistant: number; tool: number } {
    const stats = { system: 0, user: 0, assistant: 0, tool: 0 };
    const contents = messages.map(m => m.content);
    const counts = countTokensBatch(contents);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role in stats) {
        stats[msg.role as keyof typeof stats] += counts[i] + 4;
      }
    }
    return stats;
  }

  private determineState(total: number): ContextWindowState {
    if (total >= this.compactTokens) return 'critical';
    if (total >= this.warningTokens) return 'warning';
    return 'ok';
  }

  private generateSummary(messages: Message[]): string {
    return SessionSummary.summarize(messages);
  }
}
