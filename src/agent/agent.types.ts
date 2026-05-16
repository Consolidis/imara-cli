export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentResponse {
  content: string;
  finishReason: 'stop' | 'tool_calls';
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
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

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
