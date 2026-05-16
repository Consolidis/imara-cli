import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Message } from '../agent/agent.types';

const SESSIONS_DIR = path.join(os.homedir(), '.imara', 'sessions');

export class SessionManager {
  private sessionId: string;
  private messages: Message[] = [];

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.load();
  }

  addMessage(message: Message) {
    this.messages.push(message);
    this.save();
  }

  setMessages(messages: Message[]) {
    this.messages = messages;
  }

  getMessages() {
    return this.messages;
  }

  save() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.messages, null, 2));
  }

  load() {
    const filePath = path.join(SESSIONS_DIR, `${this.sessionId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        this.messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        this.messages = [];
      }
    }
  }

  getSessionId() {
    return this.sessionId;
  }
}
