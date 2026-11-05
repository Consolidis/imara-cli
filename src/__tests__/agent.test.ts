import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent/agent';
import { ImaraClient } from '../api/imara-client';
import { Keychain } from '../auth/keychain';
import { ContextBuilder } from '../context/context-builder';
import { ToolExecutor } from '../agent/tools';
import { Message } from '../agent/agent.types';

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
    buildSystemPrompt: vi.fn().mockResolvedValue('Mocked System Prompt'),
    buildStaticSystemPrompt: vi.fn(() => 'STATIC: Mocked System Rules'),
    buildDynamicContext: vi.fn().mockResolvedValue('DYNAMIC: Mocked Project Context'),
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

  it('should append refreshed project context without changing the cached prompt prefix', async () => {
    vi.mocked(ContextBuilder.buildDynamicContext)
      .mockResolvedValueOnce('DYNAMIC: initial project context')
      .mockResolvedValueOnce('DYNAMIC: refreshed project context');
    const sentMessages: Message[][] = [];
    const mockChat = vi.fn().mockImplementation((messages: Message[]) => {
      sentMessages.push(messages.map(message => ({ ...message })));
      if (sentMessages.length === 1) {
        return Promise.resolve({
          content: '',
          finishReason: 'tool_calls',
          toolCalls: [{
            id: 'write-1',
            name: 'write_file',
            arguments: { path: 'example.txt', content: 'updated' },
          }],
          usage: { totalTokens: 10, costFcfa: 0.1 },
        });
      }
      return Promise.resolve({
        content: 'Terminé.',
        finishReason: 'stop',
        usage: { totalTokens: 10, costFcfa: 0.1 },
      });
    });
    vi.mocked(ImaraClient).prototype.chat = mockChat;
    const executeSpy = vi.spyOn(ToolExecutor, 'execute')
      .mockResolvedValue({ ok: true, value: 'Fichier écrit.' });

    try {
      const agent = new Agent();
      await agent.run('Modifie le fichier.');

      expect(sentMessages[0][0].content).toBe(sentMessages[1][0].content);
      expect(sentMessages[0][1].content).toBe('DYNAMIC: initial project context');
      expect(sentMessages[1][1].content).toBe('DYNAMIC: initial project context');
      expect(sentMessages[1][sentMessages[1].length - 1]).toMatchObject({
        role: 'user',
        content: expect.stringContaining('DYNAMIC: refreshed project context'),
      });
    } finally {
      executeSpy.mockRestore();
    }
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
  it('should stop without retrying when cancel() is called during execution', async () => {
    let rejectChat: (e: Error) => void = () => {};
    const mockChat = vi.fn().mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        rejectChat = reject;
      });
    });
    vi.mocked(ImaraClient).prototype.chat = mockChat;
    const agent = new Agent();
    const runPromise = agent.run('test cancel');
    // Attendre que la requete soit en cours, puis annuler
    await vi.waitFor(() => expect(mockChat).toHaveBeenCalled());
    agent.cancel();
    // Simuler le fetch annule (AbortError remonte depuis le client)
    rejectChat(new DOMException('The operation was aborted.', 'AbortError'));
    // run() doit sortir proprement sans rejeter et sans relancer de requete
    await expect(runPromise).resolves.toBeUndefined();
    expect(mockChat).toHaveBeenCalledTimes(1); // aucune relance apres annulation
    expect(agent.getSessionStats().messages).toBe(3); // historique conserve (2 system + 1 user)
  });

  it('should NOT start the loop when cancel() is called during initialization (context build)', async () => {
    let resolveContext: (v: string) => void = () => {};
    vi.mocked(ContextBuilder.buildDynamicContext)
      .mockImplementationOnce(() => new Promise<string>(res => { resolveContext = res; }));
    const mockChat = vi.fn().mockResolvedValue({
      content: 'should never run',
      finishReason: 'stop',
      usage: { totalTokens: 10, costFcfa: 0.1 },
    });
    vi.mocked(ImaraClient).prototype.chat = mockChat;
    const agent = new Agent();
    const runPromise = agent.run('test init cancel');
    // Annuler pendant le build du contexte dynamique
    agent.cancel();
    resolveContext('DYNAMIC: late context');
    // run() doit sortir proprement sans lancer la boucle d'execution
    await expect(runPromise).resolves.toBeUndefined();
    expect(mockChat).not.toHaveBeenCalled();
  });
});
