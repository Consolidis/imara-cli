import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeWithRetry, isRetriableError } from '../utils/retry';

describe('Retry Utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return result if fn succeeds immediately', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await executeWithRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retriable error and succeed eventually', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce('recovered');

    const result = await executeWithRetry(fn, { baseDelayMs: 1, maxDelayMs: 2 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should stop and throw after maxRetries is exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

    await expect(
      executeWithRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 })
    ).rejects.toThrow('500');
    
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry on non-retriable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    await expect(
      executeWithRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 })
    ).rejects.toThrow('401');
    
    expect(fn).toHaveBeenCalledTimes(1); // Fails instantly
  });

  it('should use constant delay when constant option is true', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce('recovered');

    const onRetrySpy = vi.fn();
    const result = await executeWithRetry(fn, {
      constant: true,
      baseDelayMs: 50,
      maxRetries: 3,
      onRetry: onRetrySpy,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetrySpy).toHaveBeenCalledTimes(2);
    // The delay passed should be exactly 50ms (constant)
    expect(onRetrySpy.mock.calls[0][2]).toBe(50);
    expect(onRetrySpy.mock.calls[1][2]).toBe(50);
  });

  describe('isRetriableError classification', () => {
    it('should classify typical retriable HTTP status codes', () => {
      expect(isRetriableError(new Error('HttpError: 503'))).toBe(true);
      expect(isRetriableError(new Error('HttpError: 429'))).toBe(true);
      expect(isRetriableError(new Error('HttpError: 500'))).toBe(true);
      expect(isRetriableError(new Error('HttpError: 408'))).toBe(true);
    });

    it('should classify timeout and connection errors as retriable', () => {
      expect(isRetriableError(new Error('fetch timed out'))).toBe(true);
      expect(isRetriableError(new Error('Network connection lost'))).toBe(true);
      expect(isRetriableError(new Error('getaddrinfo ENOTFOUND'))).toBe(true);
      expect(isRetriableError(new Error('connect ECONNREFUSED'))).toBe(true);
    });

    it('should classify client errors (400, 401, 402, 403) as non-retriable', () => {
      expect(isRetriableError(new Error('HttpError: 400'))).toBe(false);
      expect(isRetriableError(new Error('HttpError: 401'))).toBe(false);
      expect(isRetriableError(new Error('HttpError: 402'))).toBe(false);
      expect(isRetriableError(new Error('HttpError: 403'))).toBe(false);
    });
  });
});
