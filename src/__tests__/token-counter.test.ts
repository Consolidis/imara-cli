import { describe, it, expect } from 'vitest';
import {
  countTokens,
  estimateTokensFallback,
  countMessageTokens,
  countConversationTokens,
  truncateToTokenLimit,
  estimateTokens
} from '../utils/token-counter';

describe('TokenCounter', () => {
  describe('countTokens', () => {
    it('should return 0 for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should count tokens precisely with js-tiktoken', () => {
      const text = 'Hello world';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should count French text tokens', () => {
      const text = 'Bonjour le monde, comment ça va ?';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensFallback', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokensFallback('')).toBe(0);
    });

    it('should estimate based on length', () => {
      expect(estimateTokensFallback('1234')).toBe(1);
      expect(estimateTokensFallback('12345')).toBe(2);
    });
  });

  describe('countMessageTokens', () => {
    it('should include overhead', () => {
      const text = 'test';
      const msgTokens = countMessageTokens(text);
      const textTokens = countTokens(text);
      expect(msgTokens).toBeGreaterThan(textTokens);
    });
  });

  describe('countConversationTokens', () => {
    it('should return 0 for empty array', () => {
      expect(countConversationTokens([])).toBe(0);
    });

    it('should count multiple messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];
      const total = countConversationTokens(messages);
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('truncateToTokenLimit', () => {
    it('should not truncate if within limit', () => {
      const text = 'Hello';
      expect(truncateToTokenLimit(text, 10)).toBe(text);
    });

    it('should truncate if exceeds limit', () => {
      const text = 'Hello world this is a very long text that should be truncated';
      const result = truncateToTokenLimit(text, 5);
      expect(result).toContain('Tronqué');
    });
  });

  describe('estimateTokens (legacy)', () => {
    it('should delegate to countTokens', () => {
      expect(estimateTokens('hello')).toBe(countTokens('hello'));
    });
  });
});
