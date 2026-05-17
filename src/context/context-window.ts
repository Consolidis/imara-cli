import { Message } from '../agent/agent.types';
import { countConversationTokens, countTokensBatch } from '../utils/token-counter';
import { SessionSummary } from './session-summary';

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
  warningThreshold: number; // pourcentage (0-100)
  compactThreshold: number; // pourcentage (0-100)
}

const MIN_PRESERVE_MESSAGES = 3; // system + 2 derniers echanges

export class ContextWindow {
  private maxTokens: number;
  private warningTokens: number;
  private compactTokens: number;

  constructor(options: ContextWindowOptions) {
    this.maxTokens = options.maxTokens;
    this.warningTokens = Math.floor(this.maxTokens * (options.warningThreshold / 100));
    this.compactTokens = Math.floor(this.maxTokens * (options.compactThreshold / 100));
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

  compact(messages: Message[]): Message[] {
    if (messages.length <= MIN_PRESERVE_MESSAGES) return messages;

    const systemMessage = messages.find(m => m.role === 'system');
    if (!systemMessage) return messages;

    // Conserver system + 2 derniers echanges (user + assistant/tool)
    const tail = messages.slice(-2);
    const middleMessages = messages.filter(
      m => m.role !== 'system' && !tail.includes(m)
    );

    if (middleMessages.length === 0) return messages;

    // Resumer les messages intermediaires
    const summary = this.generateSummary(middleMessages);
    const summaryMessage: Message = {
      role: 'system',
      content: `RESUME DES ECHANGES PRECEDENTS : ${summary}`
    };

    const compacted = [systemMessage, summaryMessage, ...tail];

    // Si toujours au-dessus du seuil apres resume, tronquer les anciens
    if (this.getTotalTokens(compacted) >= this.compactTokens) {
      return [systemMessage, ...tail];
    }

    return compacted;
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
