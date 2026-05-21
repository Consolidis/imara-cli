import { describe, it, expect } from 'vitest';
import { ContextWindow, WindowStats } from '../context/context-window';
import { Message } from '../agent/agent.types';

function createMessages(count: number): Message[] {
  const msgs: Message[] = [
    { role: 'system', content: 'System prompt initial avec instructions detaillees.' }
  ];
  for (let i = 0; i < count; i++) {
    msgs.push({ role: 'user', content: `Question ${i} : comment implementer cette fonctionnalite ?` });
    msgs.push({ role: 'assistant', content: `Reponse ${i} : Voici comment proceder... detail detail detail detail detail.` });
    msgs.push({ role: 'tool', tool_call_id: `id_${i}`, name: 'read_file', content: 'Contenu du fichier lu avec beaucoup de texte pour prendre de la place.' });
  }
  return msgs;
}

describe('ContextWindow', () => {
  describe('getStats', () => {
    it('should report ok state for small history', () => {
      const cw = new ContextWindow({ maxTokens: 8000, warningThreshold: 50, compactThreshold: 85 });
      const msgs = createMessages(1);
      const stats = cw.getStats(msgs);
      expect(stats.state).toBe('ok');
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.messageCount).toBe(4); // system + 1 user + 1 assistant + 1 tool
    });

    it('should report warning state near threshold', () => {
      const cw = new ContextWindow({ maxTokens: 200, warningThreshold: 50, compactThreshold: 85 });
      const msgs: Message[] = [
        { role: 'system', content: 'System prompt with substantial length to consume tokens' },
        { role: 'user', content: 'Hello how are you today, can you help me implement a very complex feature with many details and specifications that I will describe now in this long message' },
        { role: 'assistant', content: 'I would be happy to help you implement this complex feature. Let me analyze your requirements step by step and provide a detailed solution with code examples and architecture recommendations.' },
        { role: 'user', content: 'Here are more details about the feature we need to build. It needs authentication, database integration, caching layer, and real-time WebSocket support for thousands of concurrent users.' },
      ];
      const stats = cw.getStats(msgs);
      expect(stats.totalTokens).toBeGreaterThanOrEqual(100); // seuil warning
      expect(stats.state).toBe('warning');
    });
  });

  describe('check', () => {
    it('should return none action for small history', () => {
      const cw = new ContextWindow({ maxTokens: 8000, warningThreshold: 50, compactThreshold: 85 });
      const result = cw.check([{ role: 'user', content: 'Hello' }]);
      expect(result.state).toBe('ok');
      expect(result.action).toBe('none');
    });

    it('should return warn when over warning threshold', () => {
      const cw = new ContextWindow({ maxTokens: 80, warningThreshold: 50, compactThreshold: 85 });
      const msgs: Message[] = [
        { role: 'user', content: 'message one with substantial text content here for token counting' },
        { role: 'assistant', content: 'response with very detailed explanation text content for counting' },
        { role: 'user', content: 'message two with additional text content here for counting purposes' },
      ];
      const result = cw.check(msgs);
      expect(result.state).toBe('warning');
      expect(result.action).toBe('warn');
    });
  });

  describe('compact', () => {
    it('should not compact if less than minimum messages', () => {
      const cw = new ContextWindow({ maxTokens: 8000, warningThreshold: 50, compactThreshold: 85 });
      const msgs = [{ role: 'system', content: 'system' }, { role: 'user', content: 'hello' }];
      const result = cw.compact(msgs);
      expect(result).toEqual(msgs);
    });

    it('should compact with summary message', () => {
      const cw = new ContextWindow({ maxTokens: 200, warningThreshold: 50, compactThreshold: 85, preserveTailMessages: 2 });
      const msgs: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Reponse 1 detaillee' },
        { role: 'tool', tool_call_id: 't1', name: 'read_file', content: 'fichier lu' },
        { role: 'user', content: 'Question 2' },
        { role: 'assistant', content: 'Reponse 2 detaillee' },
        { role: 'user', content: 'Question 3' },
        { role: 'assistant', content: 'Reponse 3 detaillee' },
      ];
      const result = cw.compact(msgs);
      expect(result.length).toBeLessThan(msgs.length);
      expect(result.find(m => m.content.startsWith('RESUME'))).toBeDefined();
    });

    it('should proactively truncate extremely large messages if they exceed maxTokens', () => {
      const cw = new ContextWindow({ maxTokens: 25, warningThreshold: 50, compactThreshold: 85 });
      const msgs: Message[] = [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'A extremely huge message that definitely has many many characters and is way above the maximum token limit of 100 tokens, which would normally trigger an overflow error on the client and server side.' }
      ];
      const result = cw.compact(msgs);
      const stats = cw.getStats(result);
      
      expect(stats.totalTokens).toBeLessThanOrEqual(35);
      expect(result.some(m => m.content.includes('[CONTENU TRONQUÉ POUR CONTEXTE LIMITE]'))).toBe(true);
    });
  });
});
