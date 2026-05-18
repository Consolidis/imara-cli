export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: process.env.NODE_ENV === 'test' ? 0 : 1000,
  maxDelayMs: process.env.NODE_ENV === 'test' ? 0 : 8000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Classifies if a thrown error is retriable (network failure, timeout, or specific HTTP codes).
 */
export function isRetriableError(error: unknown, config: Required<RetryConfig> = DEFAULT_RETRY_CONFIG): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const lowerMsg = msg.toLowerCase();

  // Explicit Cloudflare blocks / saturations / rate limits are always retriable
  if (
    lowerMsg.includes('cloudflare') ||
    lowerMsg.includes('1015') ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('satur') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('502')
  ) {
    return true;
  }

  // Exclude explicit client failures immediately
  if (
    lowerMsg.includes('400') ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('402') ||
    lowerMsg.includes('403') ||
    lowerMsg.includes('404')
  ) {
    return false;
  }

  // 1. Check for specific status code patterns
  const statusMatch = msg.match(/\b(408|429|500|502|503|504)\b/) || 
                      msg.match(/code\s*(\d+)/i) || 
                      msg.match(/status\s*(\d+)/i);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    if (config.retryableStatusCodes.includes(code)) return true;
  }

  // 2. Direct string checks for status codes
  for (const code of config.retryableStatusCodes) {
    if (msg.includes(String(code))) {
      return true;
    }
  }

  // 3. DNS / connection / network timeout error identifiers
  const networkPatterns = [
    /timeout/i,
    /timed\s*out/i,
    /abort/i,
    /network/i,
    /connection/i,
    /dns/i,
    /econnrefused/i,
    /enotfound/i,
    /econnreset/i,
    /etimedout/i,
    /ehostunreach/i,
  ];

  if (networkPatterns.some(p => p.test(lowerMsg))) {
    return true;
  }

  return false;
}

/**
 * Executes a promise-returning function with retry, exponential backoff, and full jitter.
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === finalConfig.maxRetries || !isRetriableError(error, finalConfig)) {
        throw error;
      }

      // Full Jitter: random(0, min(maxDelayMs, baseDelayMs * 2^attempt))
      const temp = Math.min(finalConfig.maxDelayMs, finalConfig.baseDelayMs * Math.pow(2, attempt));
      const delayMs = Math.random() * temp;

      if (finalConfig.onRetry) {
        try {
          finalConfig.onRetry(error, attempt, delayMs);
        } catch { /* ignore callback errors */ }
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
