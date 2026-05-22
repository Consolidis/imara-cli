import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNativeModel } from '../ui/screens/welcome';
import { ImaraClient } from '../api/imara-client';

vi.mock('../utils/env', () => ({
  getApiUrl: () => 'http://localhost:3000',
  getApiKey: () => 'mock-api-key',
  getDebugMode: () => false,
}));

vi.mock('../utils/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

describe('Track 007 — Support Multi-Modèles & Swapping Dynamique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNativeModel Helper', () => {
    it('should identify native models correctly', () => {
      expect(isNativeModel('zuri')).toBe(true);
      expect(isNativeModel('standard')).toBe(true);
      expect(isNativeModel('flash')).toBe(true);
      expect(isNativeModel('imara-zuri')).toBe(true);
      expect(isNativeModel('imara')).toBe(true);
      expect(isNativeModel('imara-flash')).toBe(true);
      expect(isNativeModel('IMARA-FLASH')).toBe(true);
    });

    it('should identify non-native models correctly', () => {
      expect(isNativeModel('gpt-4o')).toBe(false);
      expect(isNativeModel('claude-3-5-sonnet')).toBe(false);
      expect(isNativeModel('llama-3')).toBe(false);
      expect(isNativeModel('custom-model')).toBe(false);
    });
  });

  describe('ImaraClient model mapping and translation', () => {
    it('should map standard model shortcuts correctly', async () => {
      const client = new ImaraClient('mock-key');
      const { fetchWithTimeout } = await import('../utils/fetch-with-timeout');
      
      const mockFetch = vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: 'Hello',
          finishReason: 'stop',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costFcfa: 1 }
        })
      } as any);

      await client.chat([{ role: 'user', content: 'hi' }], { model: 'flash' });

      // Verifies 'flash' shortcut maps to 'imara-flash'
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/agent/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"model":"imara-flash"')
        })
      );
    });

    it('should allow custom model names to pass through directly', async () => {
      const client = new ImaraClient('mock-key');
      const { fetchWithTimeout } = await import('../utils/fetch-with-timeout');
      
      const mockFetch = vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: 'Hello',
          finishReason: 'stop',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costFcfa: 5 }
        })
      } as any);

      await client.chat([{ role: 'user', content: 'hi' }], { model: 'gpt-4o' });

      // Verifies custom 'gpt-4o' name passes through directly in body
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/agent/chat'),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4o"')
        })
      );
    });

    it('should attach external key headers for external models', async () => {
      const { Keychain } = await import('../auth/keychain');
      const getSpy = vi.spyOn(Keychain, 'getExternalKey').mockResolvedValue('sk-external-123');

      const client = new ImaraClient('mock-key');
      const { fetchWithTimeout } = await import('../utils/fetch-with-timeout');
      
      const mockFetch = vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: 'Hello',
          finishReason: 'stop',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costFcfa: 5 }
        })
      } as any);

      await client.chat([{ role: 'user', content: 'hi' }], { model: 'deepseek-chat' });

      expect(getSpy).toHaveBeenCalledWith('deepseek-chat');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/agent/chat'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-external-key': 'sk-external-123',
            'x-external-base-url': 'https://api.deepseek.com'
          })
        })
      );
    });

    it('should translate insufficient wallet balance errors', async () => {
      const client = new ImaraClient('mock-key');
      const { fetchWithTimeout } = await import('../utils/fetch-with-timeout');
      
      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Agent Error: Insufficient wallet balance'
        })
      } as any);

      await expect(
        client.chat([{ role: 'user', content: 'insufficient funds prompt' }], { model: 'gpt-4o' })
      ).rejects.toThrow('Solde insuffisant dans votre wallet. Veuillez recharger vos crédits sur https://imara.consolidis.com pour utiliser ce modèle.');
    });
  });
});
