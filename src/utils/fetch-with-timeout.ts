export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    retries = 1,
    retryDelayMs = 1_000,
    ...fetchOptions
  } = options;

  let lastError: Error = new Error('Unknown fetch error');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort =
        (err instanceof Error &&
          (err.name === 'AbortError' ||
           err.message.toLowerCase().includes('abort'))) ||
        controller.signal.aborted;
      if (isAbort) {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < retries) {
        await delay(retryDelayMs * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
