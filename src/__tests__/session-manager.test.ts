import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../context/session-manager';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('os', () => ({
  homedir: () => '/home/test',
}));

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => '/home/test/.imara/sessions');
    vi.mocked(fs.renameSync).mockImplementation(() => {});
    vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as fs.Stats);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create session with generated id', () => {
    const sm = new SessionManager();
    expect(sm.getSessionId()).toMatch(/^session_\d+$/);
  });

  it('should accept custom session id', () => {
    const sm = new SessionManager('my-session');
    expect(sm.getSessionId()).toBe('my-session');
  });

  it('should add messages and flush', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const sm = new SessionManager('s1');
    sm.addMessage({ role: 'user', content: 'hello' });
    sm.save();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should get messages', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const sm = new SessionManager('s1');
    sm.addMessage({ role: 'user', content: 'hello' });
    const msgs = sm.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
  });

  it('should set messages and replace existing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const sm = new SessionManager('s1');
    sm.addMessage({ role: 'user', content: 'old' });
    sm.setMessages([{ role: 'user', content: 'new' }]);
    expect(sm.getMessages()).toHaveLength(1);
    expect(sm.getMessages()[0].content).toBe('new');
  });

  it('should load existing session', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([{ role: 'user', content: 'loaded' }]));
    const sm = new SessionManager('s1');
    expect(sm.getMessages()).toHaveLength(1);
    expect(sm.getMessages()[0].content).toBe('loaded');
  });
});
