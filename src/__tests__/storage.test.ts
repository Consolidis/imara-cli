import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStorageProvider } from '../storage/sqlite-provider';
import type { Session, Message, Variable, Summary } from '../types/storage';

describe('SQLiteStorageProvider', () => {
  let provider: SQLiteStorageProvider;

  beforeEach(() => {
    // In-memory SQLite for super-fast and isolated testing
    provider = new SQLiteStorageProvider(':memory:');
    provider.init();
  });

  afterEach(() => {
    provider.close();
  });

  describe('Session Operations', () => {
    it('creates and retrieves a session successfully', () => {
      const newSession: Omit<Session, 'id'> = {
        name: 'Test Session',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/test/path',
        isActive: true,
        contextSnapshot: { foo: 'bar' }
      };

      const created = provider.createSession(newSession);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Session');
      expect(created.isActive).toBe(true);

      const retrieved = provider.getSession(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Session');
      expect(retrieved?.contextSnapshot).toEqual({ foo: 'bar' });
      expect(retrieved?.isActive).toBe(true);
    });

    it('returns undefined for non-existent session', () => {
      const retrieved = provider.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('updates an existing session successfully', () => {
      const session = provider.createSession({
        name: 'Original Session',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/test/path',
        isActive: true
      });

      session.name = 'Updated Session';
      session.updatedAt = 3000;
      session.isActive = false;
      session.contextSnapshot = { updated: true };

      provider.updateSession(session);

      const retrieved = provider.getSession(session.id);
      expect(retrieved?.name).toBe('Updated Session');
      expect(retrieved?.updatedAt).toBe(3000);
      expect(retrieved?.isActive).toBe(false);
      expect(retrieved?.contextSnapshot).toEqual({ updated: true });
    });

    it('lists all sessions sorted by updatedAt descending', () => {
      const session1 = provider.createSession({
        name: 'Session 1',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/path1',
        isActive: true
      });

      const session2 = provider.createSession({
        name: 'Session 2',
        createdAt: 1000,
        updatedAt: 3000,
        projectPath: '/path2',
        isActive: true
      });

      const sessions = provider.listSessions();
      expect(sessions.length).toBe(2);
      // Session 2 has higher updatedAt (3000 > 2000), so it must be first
      expect(sessions[0].id).toBe(session2.id);
      expect(sessions[1].id).toBe(session1.id);
    });

    it('deletes a session successfully', () => {
      const session = provider.createSession({
        name: 'To Delete',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/path',
        isActive: true
      });

      provider.deleteSession(session.id);
      expect(provider.getSession(session.id)).toBeUndefined();
    });
  });

  describe('Message Operations', () => {
    let session: Session;

    beforeEach(() => {
      session = provider.createSession({
        name: 'Chat Session',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/path',
        isActive: true
      });
    });

    it('adds and retrieves messages in a session', () => {
      const msg1: Omit<Message, 'id'> = {
        sessionId: session.id,
        role: 'system',
        content: 'System prompt',
        timestamp: 1500,
        tokenCount: 10,
        metadata: { sys: true }
      };

      const msg2: Omit<Message, 'id'> = {
        sessionId: session.id,
        role: 'user',
        content: 'Hello',
        timestamp: 1600,
        tokenCount: 5
      };

      const created1 = provider.addMessage(msg1);
      const created2 = provider.addMessage(msg2);

      expect(created1.id).toBeDefined();
      expect(created2.id).toBeDefined();

      const messages = provider.getMessages(session.id);
      expect(messages.length).toBe(2);
      // Retrieve is DESC by timestamp, so msg2 (1600) is first
      expect(messages[0].content).toBe('Hello');
      expect(messages[0].role).toBe('user');
      expect(messages[1].content).toBe('System prompt');
      expect(messages[1].metadata).toEqual({ sys: true });
    });

    it('deletes all messages in a session', () => {
      provider.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Hello',
        timestamp: 1000,
        tokenCount: 5
      });

      provider.deleteMessages(session.id);
      expect(provider.getMessages(session.id).length).toBe(0);
    });
  });

  describe('Variable Operations', () => {
    let session: Session;

    beforeEach(() => {
      session = provider.createSession({
        name: 'Var Session',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/path',
        isActive: true
      });
    });

    it('sets, retrieves, and updates variables', () => {
      const newVar: Omit<Variable, 'id'> = {
        sessionId: session.id,
        key: 'current_file',
        value: 'index.ts',
        type: 'string',
        updatedAt: 1500,
        scope: 'session'
      };

      const created = provider.setVariable(newVar);
      expect(created.id).toBeDefined();
      expect(created.key).toBe('current_file');

      // Retrieve single variable
      const retrieved = provider.getVariable(session.id, 'current_file');
      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toBe('index.ts');

      // Update variable
      const updatedVar: Omit<Variable, 'id'> = {
        ...newVar,
        value: 'main.ts',
        updatedAt: 1600
      };
      provider.setVariable(updatedVar);

      const retrievedUpdated = provider.getVariable(session.id, 'current_file');
      expect(retrievedUpdated?.value).toBe('main.ts');
    });

    it('lists all variables of a session', () => {
      provider.setVariable({
        sessionId: session.id,
        key: 'k1',
        value: 'v1',
        type: 'string',
        updatedAt: 1000,
        scope: 'session'
      });

      provider.setVariable({
        sessionId: session.id,
        key: 'k2',
        value: 'v2',
        type: 'string',
        updatedAt: 1100,
        scope: 'session'
      });

      const list = provider.getVariables(session.id);
      expect(list.length).toBe(2);
      expect(list.map(v => v.key)).toContain('k1');
      expect(list.map(v => v.key)).toContain('k2');
    });
  });

  describe('Summary Operations', () => {
    let session: Session;

    beforeEach(() => {
      session = provider.createSession({
        name: 'Summary Session',
        createdAt: 1000,
        updatedAt: 2000,
        projectPath: '/path',
        isActive: true
      });
    });

    it('saves and retrieves summaries', () => {
      const summary1: Omit<Summary, 'id'> = {
        sessionId: session.id,
        content: 'Summary V1',
        tokenCount: 20,
        createdAt: 1500,
        version: 1
      };

      const summary2: Omit<Summary, 'id'> = {
        sessionId: session.id,
        content: 'Summary V2',
        tokenCount: 25,
        createdAt: 1600,
        version: 2
      };

      provider.saveSummary(summary1);
      provider.saveSummary(summary2);

      const latest = provider.getLatestSummary(session.id);
      expect(latest).toBeDefined();
      expect(latest?.content).toBe('Summary V2');
      expect(latest?.version).toBe(2);
    });

    it('returns undefined if no summary exists', () => {
      expect(provider.getLatestSummary(session.id)).toBeUndefined();
    });
  });
});
