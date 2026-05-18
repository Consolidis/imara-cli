import { getStorage } from '../storage/index.js';
import { Message as StorageMessage, Session } from '../types/storage';
import { Message as AgentMessage } from '../agent/agent.types';

export class SessionStore {
  close(): void {
    // Managed globally, no-op
  }

  createSession(name: string, projectPath: string): Session | undefined {
    const provider = getStorage();
    if (!provider) return undefined;
    const now = Date.now();
    return provider.createSession({
      name,
      createdAt: now,
      updatedAt: now,
      projectPath,
      isActive: true,
    });
  }

  getSession(id: string): Session | undefined {
    const provider = getStorage();
    if (!provider) return undefined;
    return provider.getSession(id);
  }

  findSessionByName(name: string): Session | undefined {
    const provider = getStorage();
    if (!provider) return undefined;
    const sessions = provider.listSessions();
    return sessions.find(s => s.name === name);
  }

  listSessions(projectPath?: string): Session[] {
    const provider = getStorage();
    if (!provider) return [];
    return provider.listSessions(projectPath);
  }

  activateSession(id: string): void {
    const provider = getStorage();
    if (!provider) return;
    const session = provider.getSession(id);
    if (!session) return;
    session.isActive = true;
    session.updatedAt = Date.now();
    provider.updateSession(session);
  }

  deactivateSession(id: string): void {
    const provider = getStorage();
    if (!provider) return;
    const session = provider.getSession(id);
    if (!session) return;
    session.isActive = false;
    session.updatedAt = Date.now();
    provider.updateSession(session);
  }

  deleteSession(id: string): void {
    const provider = getStorage();
    if (!provider) return;
    provider.deleteSession(id);
  }

  saveMessages(sessionId: string, messages: AgentMessage[]): void {
    const provider = getStorage();
    if (!provider) return;
    provider.deleteMessages(sessionId);
    for (const msg of messages) {
      const storageMsg: Omit<StorageMessage, 'id'> = {
        sessionId,
        role: this.mapRole(msg.role),
        content: msg.content,
        timestamp: Date.now(),
        tokenCount: 0,
        metadata: this.buildMetadata(msg),
      };
      provider.addMessage(storageMsg);
    }
    const session = provider.getSession(sessionId);
    if (session) {
      session.updatedAt = Date.now();
      provider.updateSession(session);
    }
  }

  loadMessages(sessionId: string): AgentMessage[] {
    const provider = getStorage();
    if (!provider) return [];
    const rows = provider.getMessages(sessionId, 10000);
    return rows.map(r => this.toAgentMessage(r));
  }

  deleteOldSessions(maxAgeDays: number): number {
    const provider = getStorage();
    if (!provider) return 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const sessions = provider.listSessions();
    let count = 0;
    for (const s of sessions) {
      if (!s.isActive && s.updatedAt < cutoff) {
        provider.deleteSession(s.id);
        count++;
      }
    }
    return count;
  }

  private mapRole(role: AgentMessage['role']): StorageMessage['role'] {
    if (role === 'tool') return 'assistant';
    return role;
  }

  private buildMetadata(msg: AgentMessage): Record<string, any> | undefined {
    if (msg.role === 'tool') {
      return {
        tool_result: true,
        name: msg.name,
        tool_call_id: msg.tool_call_id,
      };
    }
    if (msg.role === 'assistant' && msg.tool_calls) {
      return { tool_calls: msg.tool_calls };
    }
    return undefined;
  }

  private toAgentMessage(row: StorageMessage): AgentMessage {
    const meta = row.metadata;
    if (meta?.tool_result) {
      return {
        role: 'tool',
        tool_call_id: meta.tool_call_id,
        name: meta.name,
        content: row.content,
      };
    }
    if (meta?.tool_calls) {
      return {
        role: 'assistant',
        content: row.content,
        tool_calls: meta.tool_calls,
      };
    }
    return {
      role: row.role as AgentMessage['role'],
      content: row.content,
    };
  }
}
