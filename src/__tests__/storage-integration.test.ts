import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../context/session-manager';
import { ContextWindow } from '../context/context-window';
import { SQLiteStorageProvider } from '../storage/sqlite-provider';
import { ConfigManager } from '../config/config-manager';
import { getStorage, resetStorageState } from '../storage/index';

// Mock getStorage to return a memory database for testing
vi.mock('../storage/index', async () => {
  const actual = await vi.importActual<any>('../storage/index');
  let testDb: SQLiteStorageProvider | null = null;
  return {
    ...actual,
    getStorage: () => {
      const config = ConfigManager.get();
      if (!config.persistHistory) return null;
      if (!testDb) {
        testDb = new SQLiteStorageProvider(':memory:');
        testDb.init();
      }
      return testDb;
    },
    resetStorageState: () => {
      testDb = null;
    }
  };
});

describe('SQLite Storage Integration', () => {
  beforeEach(() => {
    resetStorageState();
    ConfigManager.set({ persistHistory: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SessionManager SQLite Integration', () => {
    it('persists and reloads messages successfully from SQLite', () => {
      const sessionId = `test_session_${Date.now()}`;
      
      const sm1 = new SessionManager(sessionId);
      sm1.addMessage({ role: 'user', content: 'Hi Imara' });
      sm1.addMessage({ role: 'assistant', content: 'Hello developer' });
      
      sm1.save();

      const db = getStorage();
      expect(db).toBeDefined();
      
      const dbSession = db?.getSession(sessionId);
      expect(dbSession).toBeDefined();
      
      const dbMessages = db?.getMessages(sessionId);
      expect(dbMessages).toHaveLength(2);
      expect(dbMessages?.[0].content).toBe('Hello developer');
      expect(dbMessages?.[1].content).toBe('Hi Imara');

      const sm2 = new SessionManager(sessionId);
      const loadedMessages = sm2.getMessages();
      expect(loadedMessages).toHaveLength(2);
      expect(loadedMessages[0].content).toBe('Hi Imara');
      expect(loadedMessages[1].content).toBe('Hello developer');
    });

    it('respects persistHistory configuration and bypasses SQLite when false', () => {
      ConfigManager.set({ persistHistory: false });
      
      const sessionId = `test_session_no_sql_${Date.now()}`;
      const sm = new SessionManager(sessionId);
      sm.addMessage({ role: 'user', content: 'Non-persistent message' });
      sm.save();

      const db = getStorage();
      expect(db).toBeNull();
    });
  });

  describe('ContextWindow SQLite Compaction Integration', () => {
    it('saves a compacted conversation summary successfully to SQLite', () => {
      const sessionId = `test_compaction_${Date.now()}`;
      
      const db = getStorage();
      db?.createSession({
        id: sessionId,
        name: 'Compaction Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectPath: process.cwd(),
        isActive: true
      });

      const cw = new ContextWindow({
        maxTokens: 100,
        warningThreshold: 70,
        compactThreshold: 85,
        preserveTailMessages: 2,
      });

      const messages: any[] = [
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'Explain quantum computing in one sentence.' },
        { role: 'assistant', content: 'It uses quantum bits to perform calculations.' },
        { role: 'tool', tool_call_id: 't1', name: 'read_file', content: 'file content sample' },
        { role: 'user', content: 'Explain black holes.' },
        { role: 'assistant', content: 'They are high density regions in space.' },
        { role: 'user', content: 'What is dark matter?' },
        { role: 'assistant', content: 'Matter we cannot see directly.' },
      ];

      const compacted = cw.compact(messages, sessionId);

      expect(compacted.length).toBeLessThan(messages.length);

      const latestSummary = db?.getLatestSummary(sessionId);
      expect(latestSummary).toBeDefined();
      expect(latestSummary?.content).toBeDefined();
      expect(latestSummary?.content.length).toBeGreaterThan(0);
      expect(latestSummary?.version).toBe(1);
    });
  });

  describe('Project Workspace Segregation Integration', () => {
    it('segregates sessions correctly by projectPath in listSessions', () => {
      const db = getStorage();
      expect(db).toBeDefined();

      const sessionA_Id = `session_a_${Date.now()}`;
      const sessionB_Id = `session_b_${Date.now()}`;

      // Create session for Project A (current directory)
      db?.createSession({
        id: sessionA_Id,
        name: 'Project A Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectPath: process.cwd(),
        isActive: true
      });

      // Create session for Project B (another path)
      db?.createSession({
        id: sessionB_Id,
        name: 'Project B Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectPath: 'C:\\Users\\test\\Documents\\ProjectB',
        isActive: true
      });

      // Query sessions for Project A
      const sessionsA = db?.listSessions(process.cwd()) || [];
      expect(sessionsA.some(s => s.id === sessionA_Id)).toBe(true);
      expect(sessionsA.some(s => s.id === sessionB_Id)).toBe(false);

      // Query sessions for Project B
      const sessionsB = db?.listSessions('C:\\Users\\test\\Documents\\ProjectB') || [];
      expect(sessionsB.some(s => s.id === sessionA_Id)).toBe(false);
      expect(sessionsB.some(s => s.id === sessionB_Id)).toBe(true);

      // Clean up test sessions
      db?.deleteSession(sessionA_Id);
      db?.deleteSession(sessionB_Id);
    });
  });
});
