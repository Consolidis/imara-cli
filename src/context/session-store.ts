import * as path from 'path';
import * as os from 'os';
import { SQLiteStorageProvider } from '../storage/sqlite-provider';
import { Message as StorageMessage, Session } from '../types/storage';
import { Message as AgentMessage } from '../agent/agent.types';

const DB_PATH = path.join(os.homedir(), '.imara', 'imara.db');

export class SessionStore {
  private provider: SQLiteStorageProvider;

  constructor(dbPath?: string) {
    this.provider = new SQLiteStorageProvider(dbPath || DB_PATH);
    this.provider.init();
  }

  close(): void {
    this.provider.close();
  }

  createSession(name: string, projectPath: string): Session {
    const now = Date.now();
    return this.provider.createSession({
      name,
      createdAt: now,
      updatedAt: now,
      projectPath,
      isActive: true,
    });
  }

  getSession(id: string): Session | undefined {
    return this.provider.getSession(id);
  }

  findSessionByName(name: string): Session | undefined {
    const sessions = this.provider.listSessions();
    return sessions.find(s => s.name === name);
  }

  listSessions(): Session[] {
    return this.provider.listSessions();
  }

  activateSession(id: string): void {
    const session = this.provider.getSession(id);
    if (!session) return;
    session.isActive = true;
    session.updatedAt = Date.now();
    this.provider.updateSession(session);
  }

  deactivateSession(id: string): void {
    const session = this.provider.getSession(id);
    if (!session) return;
    session.isActive = false;
    session.updatedAt = Date.now();
    this.provider.updateSession(session);
  }

  saveMessages(sessionId: string, messages: AgentMessage[]): void {
    this.provider.deleteMessages(sessionId);
    for (const msg of messages) {
      const storageMsg: Omit<StorageMessage, 'id'> = {
        sessionId,
        role: this.mapRole(msg.role),
        content: msg.content,
        timestamp: Date.now(),
        tokenCount: 0,
        metadata: this.buildMetadata(msg),
      };
      this.provider.addMessage(storageMsg);
    }
    const session = this.provider.getSession(sessionId);
    if (session) {
      session.updatedAt = Date.now();
      this.provider.updateSession(session);
    }
  }

  loadMessages(sessionId: string): AgentMessage[] {
    const rows = this.provider.getMessages(sessionId, 10000);
    return rows.map(r => this.toAgentMessage(r));
  }

  deleteOldSessions(maxAgeDays: number): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const sessions = this.provider.listSessions();
    let count = 0;
    for (const s of sessions) {
      if (!s.isActive && s.updatedAt < cutoff) {
        this.provider.deleteSession(s.id);
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
