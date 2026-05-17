export const API_KEY_MIN_LENGTH = 20;
export const API_KEY_MAX_LENGTH = 256;

export function isValidApiKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  if (key.length < API_KEY_MIN_LENGTH || key.length > API_KEY_MAX_LENGTH) return false;
  return /^[A-Za-z0-9_.~+/=-]+$/.test(key);
}

export function isValidHttpsUrl(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeForLogging(input: string, apiKey?: string): string {
  if (typeof input !== 'string') return String(input);
  let sanitized = input;
  if (apiKey) {
    sanitized = sanitized.replaceAll(apiKey, '[REDACTED]');
  }
  const genericKeyPattern = /[A-Za-z0-9_\-]{40,}/g;
  sanitized = sanitized.replace(genericKeyPattern, '[REDACTED]');
  return sanitized;
}
