import { describe, it, expect } from 'vitest';
import { isValidApiKey, isValidHttpsUrl, sanitizeForLogging } from '../utils/security';

describe('isValidApiKey', () => {
  it('accepts a valid alphanum+dots+slashes key', () => {
    expect(isValidApiKey('imara_key_abcdefghijklmnopqrstuvwxyz12345678')).toBe(true);
  });
  it('rejects too short keys', () => {
    expect(isValidApiKey('short_key')).toBe(false);
  });
  it('rejects keys with spaces', () => {
    expect(isValidApiKey('imara_key_abc def')).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(isValidApiKey(42 as any)).toBe(false);
  });
});

describe('isValidHttpsUrl', () => {
  it('accepts https URL', () => {
    expect(isValidHttpsUrl('https://api.imara.ai/v1')).toBe(true);
  });
  it('rejects http URL', () => {
    expect(isValidHttpsUrl('http://api.imara.ai/v1')).toBe(false);
  });
  it('rejects non-URL strings', () => {
    expect(isValidHttpsUrl('not-a-url')).toBe(false);
  });
});

describe('sanitizeForLogging', () => {
  it('redacts explicit api key', () => {
    const key = 'imara_key_abcdefghijklmnopqrstuvwxyz12345678';
    expect(sanitizeForLogging('error with ' + key, key)).toBe('error with [REDACTED]');
  });
  it('redacts long alphanumeric patterns', () => {
    const log = 'token abcdef1234567890abcdef1234567890abcdef12';
    const out = sanitizeForLogging(log);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abcdef1234567890abcdef1234567890abcdef12');
  });
});
