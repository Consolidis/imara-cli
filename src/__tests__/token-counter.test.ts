import { describe, it, expect } from 'vitest';
import { estimateTokens, truncateToTokenLimit } from '../utils/token-counter';

describe('TokenCounter', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens based on length (4 chars per token)', () => {
      expect(estimateTokens('1234')).toBe(1);
      expect(estimateTokens('12345')).toBe(2);
    });
  });

  describe('truncateToTokenLimit', () => {
    it('should not truncate if within limit', () => {
      const text = '12345678'; // 2 tokens
      expect(truncateToTokenLimit(text, 2)).toBe(text);
    });

    it('should truncate if exceeds limit', () => {
      const text = '1234567890'; // 3 tokens
      expect(truncateToTokenLimit(text, 1)).toContain('Tronqué');
    });
  });
});
