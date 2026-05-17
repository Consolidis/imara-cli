import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../utils/circuit-breaker';
import { networkEvents } from '../utils/events';
import { existsSync, unlinkSync } from 'fs';

describe('Circuit Breaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    // Clear persistence first before creating the test instance to prevent loading stale data from disk
    const temp = new CircuitBreaker('cb-test');
    temp.clearPersistence();

    cb = new CircuitBreaker('cb-test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 500, // short timeout for testing
    });
  });

  afterEach(() => {
    cb.clearPersistence();
    vi.restoreAllMocks();
  });

  it('should start in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });

  it('should trip to OPEN after failureThreshold is reached', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');

    cb.recordFailure(); // 3rd failure (trips)
    expect(cb.getState()).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('should throw CircuitBreakerOpenError immediately when OPEN', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // trip to OPEN

    await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should transition to HALF_OPEN after timeoutMs elapses', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // Trip to OPEN
    
    expect(cb.getState()).toBe('OPEN');

    // Wait for timeout (500ms)
    await new Promise(resolve => setTimeout(resolve, 550));

    // Try executing a request: should trigger HALF_OPEN transition internally
    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('should transition back to CLOSED after successThreshold consecutive successes in HALF_OPEN', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // Trip to OPEN

    await new Promise(resolve => setTimeout(resolve, 550));

    // 1st success -> state becomes HALF_OPEN
    const res1 = await cb.execute(async () => 'success 1');
    expect(res1).toBe('success 1');
    expect(cb.getState()).toBe('HALF_OPEN');

    // 2nd success -> successThreshold (2) reached, returns to CLOSED
    const res2 = await cb.execute(async () => 'success 2');
    expect(res2).toBe('success 2');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should revert back to OPEN on any failure in HALF_OPEN', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // Trip to OPEN

    await new Promise(resolve => setTimeout(resolve, 550));

    // 1st success -> HALF_OPEN
    await cb.execute(async () => 'ok');
    expect(cb.getState()).toBe('HALF_OPEN');

    // Next fails -> Trips back to OPEN immediately
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    expect(cb.getState()).toBe('OPEN');
  });

  it('should persist its state and load it on re-instantiation', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // Trips to OPEN
    expect(cb.getState()).toBe('OPEN');

    // Re-create breaker with same ID
    const cb2 = new CircuitBreaker('cb-test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 500,
    });

    expect(cb2.getState()).toBe('OPEN');
    expect(cb2.isOpen()).toBe(true);
  });
});
