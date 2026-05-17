import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Message } from '../agent/agent.types';
import { getStorage } from '../storage/index.js';

const SESSIONS_DIR = path.join(os.homedir(), '.imara', 'sessions');
const PENDING_SUFFIX = '.pending';
const FLUSH_INTERVAL_MS = 2000;
const COMPRESS_THRESHOLD_BYTES = 100_000;

export class SessionManager {
  private sessionId: string;
  private messages: Message[] = [];
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.load();
  }

  addMessage(message: Message) {
    this.messages.push(message);
    this.dirty = true;
    this.scheduleFlush();
  }

  setMessages(messages: Message[]) {
    this.messages = messages;
    this.dirty = true;
    this.scheduleFlush();
  }

  getMessages(): Message[] {
    this.forceFlush();
    return [...this.messages];
  }

  getSessionId() {
    return this.sessionId;
  }

  save() {
    this.dirty = true;
    this.forceFlush();
  }

  load() {
    this.forceFlush();

    const provider = getStorage();
    if (provider) {
      try {
        const session = provider.getSession(this.sessionId);
        if (session) {
          const dbMessages = provider.getMessages(this.sessionId);
          // Reverse because getMessages returns descending by timestamp (newest first)
          this.messages = dbMessages.reverse().map(m => ({
            role: m.role as any,
            content: m.content,
            tool_calls: m.metadata?.tool_calls,
            tool_call_id: m.metadata?.tool_call_id,
            name: m.metadata?.name
          }));
          return;
        }
      } catch (error) {
        // Fallback to legacy JSON on DB load errors
      }
    }

    // Legacy JSON loading fallback/backup
    const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);
    if (!fs.existsSync(filePath)) {
      this.messages = [];
      return;
    }
    try {
      this.messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // If SQLite provider is available, back-populate the session
      if (provider) {
        try {
          provider.createSession({
            id: this.sessionId,
            name: `Session ${new Date().toLocaleDateString()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectPath: process.cwd(),
            isActive: true
          });
          this.messages.forEach((msg, idx) => {
            provider.addMessage({
              sessionId: this.sessionId,
              role: msg.role,
              content: msg.content,
              timestamp: Date.now() + idx,
              tokenCount: 0,
              metadata: {
                tool_calls: msg.tool_calls,
                tool_call_id: msg.tool_call_id,
                name: msg.name
              }
            });
          });
        } catch {
          // Ignore population errors
        }
      }
    } catch {
      this.messages = [];
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private forceFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  private flush() {
    if (!this.dirty || this.flushing) return;
    this.flushing = true;
    this.dirty = false;

    // Save to SQLite
    const provider = getStorage();
    if (provider) {
      try {
        const session = provider.getSession(this.sessionId);
        if (!session) {
          provider.createSession({
            id: this.sessionId,
            name: `Session ${new Date().toLocaleDateString()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectPath: process.cwd(),
            isActive: true
          });
        } else {
          session.updatedAt = Date.now();
          provider.updateSession(session);
        }

        provider.deleteMessages(this.sessionId);
        this.messages.forEach((msg, idx) => {
          provider.addMessage({
            sessionId: this.sessionId,
            role: msg.role,
            content: msg.content,
            timestamp: Date.now() + idx,
            tokenCount: 0,
            metadata: {
              tool_calls: msg.tool_calls,
              tool_call_id: msg.tool_call_id,
              name: msg.name
            }
          });
        });
      } catch (error) {
        // Fallback silently on SQLite save errors
      }
    }

    // Save to legacy JSON backup in parallel
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }

      const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);

      // Compression backup
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size > COMPRESS_THRESHOLD_BYTES) {
          const archivePath = path.join(
            SESSIONS_DIR,
            `${this.sessionId}_${Date.now()}.json`
          );
          fs.renameSync(filePath, archivePath);
        }
      }

      const pendingPath = filePath + PENDING_SUFFIX;
      const payload = JSON.stringify(this.messages, null, 2);

      fs.writeFileSync(pendingPath, payload, 'utf-8');
      fs.renameSync(pendingPath, filePath);
    } catch {
      // Ignorer silencieusement les erreurs IO en arriere-plan
    } finally {
      this.flushing = false;
      this.flushTimer = null;
    }
  }
}
