import { createHash } from 'crypto';
import { Message } from '../agent/agent.types';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, sortKeys(nestedValue)])
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/**
 * Computes a stable SHA-256 hash of the full request, normalizing message spacing.
 */
export function computeContextHash(request: Message[] | Record<string, unknown>): string {
  const normalizeMessages = (messages: Message[]) =>
    messages.map(message => ({
      ...message,
      content: (message.content || '').trim(),
    }));

  const normalized = Array.isArray(request)
    ? normalizeMessages(request)
    : {
        ...request,
        ...(Array.isArray(request.messages)
          ? { messages: normalizeMessages(request.messages as Message[]) }
          : {}),
      };

  return createHash('sha256').update(stableSerialize(normalized)).digest('hex');
}
