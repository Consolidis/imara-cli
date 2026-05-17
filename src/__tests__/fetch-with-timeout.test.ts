import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns response on success', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response('ok', { status: 200 }))
    );
    const res = await fetchWithTimeout('https://example.com');
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const res = await fetchWithTimeout('https://example.com');
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('fail')));
    await expect(fetchWithTimeout('https://example.com', { retries: 1 })).rejects.toThrow('fail');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws timeout error when request hangs', async () => {
    global.fetch = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }
      });
    });
    await expect(
      fetchWithTimeout('https://example.com', { timeoutMs: 50, retries: 0 })
    ).rejects.toThrow('timed out');
  });
});
