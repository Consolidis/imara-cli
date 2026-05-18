import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../context/session-manager';
import { getStorage } from '../storage/index.js';
import { ConfigManager } from '../config/config-manager';

// Ensure persistence is turned on for storage tests
ConfigManager.set({ persistHistory: true });

describe('SessionManager SQLite Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create session with generated id', () => {
    const sm = new SessionManager();
    expect(sm.getSessionId()).toMatch(/^session_\d+$/);
  });

  it('should accept custom session id', () => {
    const customId = `my-session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sm = new SessionManager(customId);
    expect(sm.getSessionId()).toBe(customId);
  });

  it('should add messages and flush to SQLite', () => {
    const sessionId = `test_sm_flush_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sm = new SessionManager(sessionId);
    sm.addMessage({ role: 'user', content: 'hello' });
    sm.save();

    const storage = getStorage();
    expect(storage).toBeDefined();
    const dbMessages = storage?.getMessages(sessionId);
    expect(dbMessages).toHaveLength(1);
    expect(dbMessages?.[0].content).toBe('hello');
  });

  it('should get messages in memory', () => {
    const sessionId = `test_in_memory_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sm = new SessionManager(sessionId);
    sm.addMessage({ role: 'user', content: 'hello' });
    const msgs = sm.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
  });

  it('should set messages and replace existing', () => {
    const sessionId = `test_replace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sm = new SessionManager(sessionId);
    sm.addMessage({ role: 'user', content: 'old' });
    sm.setMessages([{ role: 'user', content: 'new' }]);
    expect(sm.getMessages()).toHaveLength(1);
    expect(sm.getMessages()[0].content).toBe('new');
  });

  it('should load existing session from SQLite', () => {
    const sessionId = `test_sm_load_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storage = getStorage();
    expect(storage).toBeDefined();

    // Create session in DB first
    storage?.createSession({
      id: sessionId,
      name: 'Loaded Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectPath: process.cwd(),
      isActive: true
    });

    storage?.addMessage({
      sessionId,
      role: 'user',
      content: 'loaded message',
      timestamp: Date.now(),
      tokenCount: 0
    });

    const sm = new SessionManager(sessionId);
    const msgs = sm.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('loaded message');
  });
});
