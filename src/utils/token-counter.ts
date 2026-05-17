import { getEncoding } from 'js-tiktoken';

let encoder: ReturnType<typeof getEncoding> | null = null;

const MAX_CACHE_SIZE = 200;
const tokenCache = new Map<string, number>();

function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) {
    encoder = getEncoding('cl100k_base');
  }
  return encoder;
}

function getCachedTokenCount(text: string): number | undefined {
  return tokenCache.get(text);
}

function setCachedTokenCount(text: string, count: number): void {
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) {
      tokenCache.delete(firstKey);
    }
  }
  tokenCache.set(text, count);
}

export function countTokens(text: string): number {
  if (!text) return 0;
  const cached = getCachedTokenCount(text);
  if (cached !== undefined) return cached;
  try {
    const count = getEncoder().encode(text).length;
    setCachedTokenCount(text, count);
    return count;
  } catch {
    return estimateTokensFallback(text);
  }
}

export function estimateTokensFallback(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function countMessageTokens(message: string): number {
  const overhead = 4;
  return countTokens(message) + overhead;
}

export function countTokensBatch(texts: string[]): number[] {
  const enc = getEncoder();
  const results: number[] = [];
  for (const text of texts) {
    if (!text) {
      results.push(0);
      continue;
    }
    const cached = getCachedTokenCount(text);
    if (cached !== undefined) {
      results.push(cached);
      continue;
    }
    try {
      const count = enc.encode(text).length;
      setCachedTokenCount(text, count);
      results.push(count);
    } catch {
      const est = estimateTokensFallback(text);
      results.push(est);
    }
  }
  return results;
}

export function countConversationTokens(messages: Array<{ role: string; content: string }>): number {
  if (!messages.length) return 0;
  const contents = messages.map(m => m.content);
  const counts = countTokensBatch(contents);
  let total = 3;
  for (let i = 0; i < messages.length; i++) {
    total += counts[i] + 4;
  }
  return total;
}

export function truncateToTokenLimit(text: string, limit: number): string {
  const currentTokens = countTokens(text);
  if (currentTokens <= limit) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const substr = text.substring(0, mid);
    if (countTokens(substr) <= limit - 5) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return text.substring(0, low - 1) + '\n... [Tronqué pour respecter la limite de tokens]';
}

export function estimateTokens(text: string): number {
  return countTokens(text);
}
