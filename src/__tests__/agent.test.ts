import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent/agent';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';

vi.mock('../api/imara-client');
vi.mock('../auth/keychain');
vi.mock('../ui/renderer');
vi.mock('../ui/confirm', () => ({
  confirmDangerousTool: vi.fn().mockResolvedValue('yes'),
  confirmAction: vi.fn().mockResolvedValue('yes'),
  promptLoopResolution: vi.fn().mockResolvedValue('pause'),
}));
vi.mock('../context/context-builder', () => ({
  ContextBuilder: {
    buildSystemPrompt: vi.fn().mockResolvedValue('Mocked System Prompt')
  }
}));
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }))
}));

describe('Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Keychain.get).mockResolvedValue('fake-api-key');
  });

  it('should run a simple chat and show response', async () => {
    const mockChat = vi.fn().mockResolvedValue({
      content: 'Bonjour !',
      finishReason: 'stop',
      usage: { totalTokens: 10, costFcfa: 0.1 }
    });
    vi.mocked(ImaraClient).prototype.chat = mockChat;

    const agent = new Agent();
    await agent.run('Hello');

    expect(mockChat).toHaveBeenCalled();
    expect(agent.getSessionStats().tokens).toBe(10);
  });

  it('should handle tool calls', async () => {
    const mockChat = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [{ id: '1', name: 'read_file', arguments: { path: 'test.txt' } }],
        usage: { totalTokens: 20, costFcfa: 0.2 }
      })
      .mockResolvedValueOnce({
        content: 'Fichier lu.',
        finishReason: 'stop',
        usage: { totalTokens: 10, costFcfa: 0.1 }
      });
    
    vi.mocked(ImaraClient).prototype.chat = mockChat;

    const agent = new Agent();
    await agent.run('Lis test.txt');

    expect(mockChat).toHaveBeenCalledTimes(2);
    expect(agent.getSessionStats().tokens).toBe(30);
  });

  it('should throw an error when iterations exceed 120', async () => {
    const mockChat = vi.fn().mockResolvedValue({
      content: '',
      finishReason: 'tool_calls',
      toolCalls: [{ id: '1', name: 'read_file', arguments: { path: 'test.txt' } }],
      usage: { totalTokens: 10, costFcfa: 0.1 }
    });
    
    vi.mocked(ImaraClient).prototype.chat = mockChat;

    const agent = new Agent();
    await expect(agent.run('test max loop')).rejects.toThrow("Nombre maximum d'itérations (120) dépassé. Arrêt de sécurité.");
  });
});
