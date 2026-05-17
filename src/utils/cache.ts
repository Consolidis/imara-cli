import { createHash } from 'crypto';
import { Message } from '../agent/agent.types';

/**
 * Computes a stable SHA-256 hash of the cleaned conversation history messages.
 */
export function computeContextHash(messages: Message[]): string {
  const normalized = messages
    .map(m => `${m.role}:${(m.content || '').trim()}`)
    .join('|');
  return createHash('sha256').update(normalized).digest('hex');
}
