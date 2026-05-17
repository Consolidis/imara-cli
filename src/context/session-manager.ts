import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Message } from '../agent/agent.types';

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
    const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);
    if (!fs.existsSync(filePath)) {
      this.messages = [];
      return;
    }
    try {
      this.messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }

      const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);

      // Compression si taille depasse le seuil
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
