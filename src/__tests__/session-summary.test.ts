import { describe, it, expect } from 'vitest';
import { SessionSummary } from '../context/session-summary';
import { Message } from '../agent/agent.types';

describe('SessionSummary', () => {
  it('should return empty summary for empty messages', () => {
    expect(SessionSummary.summarize([])).toBe('Aucun echange precedent.');
  });

  it('should detect question intention', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Comment implementer une authentification JWT ?' },
      { role: 'assistant', content: 'Voici les etapes...' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('question');
  });

  it('should detect creation intention', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Ajoute un module de cache Redis' },
      { role: 'assistant', content: 'Cree les fichiers...' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('creation');
  });

  it('should detect blocked status', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Corrige cette erreur 500' },
      { role: 'assistant', content: 'Erreur impossible a resoudre' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('bloque');
  });

  it('should detect success status', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Fix ce bug' },
      { role: 'assistant', content: 'Corrige et enregistre' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('reussi');
  });

  it('should ignore system messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'Tu es IMARA' },
      { role: 'user', content: 'Quelle est la meilleure architecture ?' },
      { role: 'assistant', content: 'Je recommande une architecture...' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).not.toContain('IMARA');
    expect(summary).toContain('architecture');
  });

  it('should limit topic length', () => {
    const messages: Message[] = [
      { role: 'user', content: 'a'.repeat(200) },
      { role: 'assistant', content: 'reponse' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).not.toContain('a'.repeat(200));
    expect(summary.length).toBeLessThan(600);
  });

  it('should extract touched file paths from tool messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Corrige src/agent/agent.ts' },
      { role: 'tool', tool_call_id: '1', name: 'read_file', content: '--- src/agent/agent.ts ---\nexport class Agent {}' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('agent.ts');
  });

  it('should compute multi-exchange stats', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Reponse 1 terminee' },
      { role: 'user', content: 'Question 2' },
      { role: 'assistant', content: 'Reponse 2 terminee' },
    ];
    const summary = SessionSummary.summarize(messages);
    expect(summary).toContain('2 echanges');
  });
});
