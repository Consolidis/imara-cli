// Types JSON pour les schemas d'outils
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ToolArguments = Record<string, JsonValue>;

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: ToolArguments;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AgentResponse {
  content: string;
  finishReason: 'stop' | 'tool_calls';
  toolCalls: ParsedToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costFcfa: number;
  };
}

export interface AgentOptions {
  model?: string;
  yes?: boolean;
  execute?: boolean;
  maxTokens?: number;
  contextDepth?: number;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  whatsappNumber: string;
  walletBalance: number;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: JsonValue;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolResult {
  content: string;
  error?: string;
  durationMs?: number;
}

export interface AgentProxy {
  getMessages(): Message[];
  setMessages(messages: Message[]): void;
}
