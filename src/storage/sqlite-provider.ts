import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import crypto from 'node:crypto';
import type {
  StorageProvider,
  Message,
  Session,
  Variable,
  Summary,
} from '../types/storage';

export class SQLiteStorageProvider implements StorageProvider {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  init(): void {
    if (this.db) return;
    if (this.dbPath !== ':memory:') {
      mkdirSync(dirname(this.dbPath), { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        project_path TEXT NOT NULL,
        context_snapshot TEXT,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        token_count INTEGER DEFAULT 0,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);

      CREATE TABLE IF NOT EXISTS variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        scope TEXT NOT NULL CHECK(scope IN ('session','global')),
        UNIQUE(session_id, key),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id, version);
    `);

    const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
    const currentVersion = row?.version ?? 0;
    if (currentVersion < 1) {
      this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (1)').run();
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  createSession(session: Omit<Session, 'id'> & { id?: string }): Session {
    if (!this.db) throw new Error('Database not initialized');
    const id = session.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const stmt = this.db.prepare(
      'INSERT INTO sessions (id, name, created_at, updated_at, project_path, context_snapshot, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      id,
      session.name,
      session.createdAt,
      session.updatedAt,
      session.projectPath,
      session.contextSnapshot ? JSON.stringify(session.contextSnapshot) : null,
      session.isActive ? 1 : 0
    );
    const { id: _, ...rest } = session;
    return { id, ...rest };
  }

  getSession(id: string): Session | undefined {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapSessionRow(row);
  }

  updateSession(session: Session): void {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(
      'UPDATE sessions SET name=?, updated_at=?, project_path=?, context_snapshot=?, is_active=? WHERE id=?'
    );
    stmt.run(
      session.name,
      session.updatedAt,
      session.projectPath,
      session.contextSnapshot ? JSON.stringify(session.contextSnapshot) : null,
      session.isActive ? 1 : 0,
      session.id
    );
  }

  listSessions(projectPath?: string): Session[] {
    if (!this.db) throw new Error('Database not initialized');
    if (projectPath) {
      const rows = this.db.prepare('SELECT * FROM sessions WHERE project_path = ? ORDER BY updated_at DESC').all(projectPath) as any[];
      return rows.map(r => this.mapSessionRow(r));
    }
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as any[];
    return rows.map(r => this.mapSessionRow(r));
  }

  deleteSession(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  private mapSessionRow(row: any): Session {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectPath: row.project_path,
      contextSnapshot: row.context_snapshot ? JSON.parse(row.context_snapshot) : undefined,
      isActive: row.is_active === 1,
    };
  }

  addMessage(message: Omit<Message, 'id'>): Message {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(
      'INSERT INTO messages (session_id, role, content, timestamp, token_count, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      message.sessionId,
      message.role,
      message.content,
      message.timestamp,
      message.tokenCount,
      message.metadata ? JSON.stringify(message.metadata) : null
    );
    return { id: Number(result.lastInsertRowid), ...message };
  }

  getMessages(sessionId: string, limit = 100, offset = 0): Message[] {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(sessionId, limit, offset) as any[];
    return rows.map(r => this.mapMessageRow(r));
  }

  deleteMessages(sessionId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  }

  private mapMessageRow(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      tokenCount: row.token_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  setVariable(variable: Omit<Variable, 'id'>): Variable {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(
      'INSERT INTO variables (session_id, key, value, type, updated_at, scope) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id, key) DO UPDATE SET value=excluded.value, type=excluded.type, updated_at=excluded.updated_at, scope=excluded.scope'
    );
    const result = stmt.run(
      variable.sessionId,
      variable.key,
      variable.value,
      variable.type,
      variable.updatedAt,
      variable.scope
    );
    return { id: Number(result.lastInsertRowid), ...variable };
  }

  getVariable(sessionId: string, key: string): Variable | undefined {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT * FROM variables WHERE session_id = ? AND key = ?').get(sessionId, key) as any;
    if (!row) return undefined;
    return this.mapVariableRow(row);
  }

  getVariables(sessionId: string): Variable[] {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db.prepare('SELECT * FROM variables WHERE session_id = ?').all(sessionId) as any[];
    return rows.map(r => this.mapVariableRow(r));
  }

  private mapVariableRow(row: any): Variable {
    return {
      id: row.id,
      sessionId: row.session_id,
      key: row.key,
      value: row.value,
      type: row.type,
      updatedAt: row.updated_at,
      scope: row.scope,
    };
  }

  saveSummary(summary: Omit<Summary, 'id'>): Summary {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(
      'INSERT INTO summaries (session_id, content, token_count, created_at, version) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      summary.sessionId,
      summary.content,
      summary.tokenCount,
      summary.createdAt,
      summary.version
    );
    return { id: Number(result.lastInsertRowid), ...summary };
  }

  getLatestSummary(sessionId: string): Summary | undefined {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare('SELECT * FROM summaries WHERE session_id = ? ORDER BY version DESC LIMIT 1')
      .get(sessionId) as any;
    if (!row) return undefined;
    return this.mapSummaryRow(row);
  }

  private mapSummaryRow(row: any): Summary {
    return {
      id: row.id,
      sessionId: row.session_id,
      content: row.content,
      tokenCount: row.token_count,
      createdAt: row.created_at,
      version: row.version,
    };
  }
}
