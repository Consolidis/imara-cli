import { describe, it, expect, vi, afterEach } from 'vitest';
import { ImaraClient } from '../api/imara-client';
import { computeContextHash } from '../utils/cache';
import { Message } from '../agent/agent.types';
import * as fetchModule from '../utils/fetch-with-timeout';

describe('Client Resilience & Cache Fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should compute deterministic hashes for messages regardless of spacing', () => {
    const messages1: Message[] = [
      { role: 'user', content: '  hello imara   ' },
      { role: 'assistant', content: 'hi!' }
    ];
    const messages2: Message[] = [
      { role: 'user', content: 'hello imara' },
      { role: 'assistant', content: 'hi!' }
    ];
    // They should produce exactly the same hash
    expect(computeContextHash(messages1)).toBe(computeContextHash(messages2));
  });

  it('should store and fallback to cache on network failures', async () => {
    const client = new ImaraClient('test-key');
    const messages: Message[] = [{ role: 'user', content: 'persistent query' }];
    const fakeResponse = {
      content: 'Hello, this is a real response',
      tokensUsed: 10,
      costFcfa: 0.1,
    };

    // 1. Mock fetch to succeed once to populate cache
    const fetchMock = vi.spyOn(fetchModule, 'fetchWithTimeout')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => fakeResponse,
      } as Response);

    // Call API (populates cache)
    const successRes = await client.chat(messages, { model: 'flash', maxTokens: 100 });
    expect(successRes.content).toBe('Hello, this is a real response');

    // 2. Now mock fetch to fail with a network error
    fetchMock.mockRejectedValue(new Error('Network connection failed'));

    // Call API again with same messages: should resolve from Cache Fallback instead of throwing!
    const fallbackRes = await client.chat(messages, { model: 'flash', maxTokens: 100 });
    expect(fallbackRes.content).toContain('[● HORS-LIGNE - RÉPONSE EN CACHE]');
    expect(fallbackRes.content).toContain('Hello, this is a real response');
    
    // Clear persistence cache for the test
    (client as any).cache.clear();
  });

  it('should parse raw embedded tool calls from content as a fallback', async () => {
    const client = new ImaraClient('test-key');
    const messages: Message[] = [{ role: 'user', content: 'test embedded tool call' }];
    const fakeRawResponse = {
      content: 'I will list the directory first. list_directory:0<|tool_call_argument_begin|>{"path": ".imara", "recursive": true}<|tool_call_end|><|tool_calls_section_end|>',
      finishReason: 'stop',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costFcfa: 0.1 }
    };

    vi.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => fakeRawResponse,
    } as Response);

    const res = await client.chat(messages, { model: 'flash', maxTokens: 100 });

    expect(res.finishReason).toBe('tool_calls');
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0].name).toBe('list_directory');
    expect(res.toolCalls[0].arguments).toEqual({ path: '.imara', recursive: true });
    expect(res.content).toBe('I will list the directory first.');
  });
});
