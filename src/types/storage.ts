export interface Message {
  id: number;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  tokenCount: number;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  projectPath: string;
  contextSnapshot?: Record<string, any>;
  isActive: boolean;
}

export interface Variable {
  id: number;
  sessionId: string;
  key: string;
  value: string;
  type: string;
  updatedAt: number;
  scope: 'session' | 'global';
}

export interface Summary {
  id: number;
  sessionId: string;
  content: string;
  tokenCount: number;
  createdAt: number;
  version: number;
}

export interface StorageProvider {
  init(): void;
  close(): void;

  createSession(session: Omit<Session, 'id'> & { id?: string }): Session;
  getSession(id: string): Session | undefined;
  updateSession(session: Session): void;
  listSessions(): Session[];
  deleteSession(id: string): void;

  addMessage(message: Omit<Message, 'id'>): Message;
  getMessages(sessionId: string, limit?: number, offset?: number): Message[];
  deleteMessages(sessionId: string): void;

  setVariable(variable: Omit<Variable, 'id'>): Variable;
  getVariable(sessionId: string, key: string): Variable | undefined;
  getVariables(sessionId: string): Variable[];

  saveSummary(summary: Omit<Summary, 'id'>): Summary;
  getLatestSummary(sessionId: string): Summary | undefined;
}
