import { describe, it, expect } from 'vitest';
import { ok, err, map, flatMap, unwrapOr, fromPromise, tryCatch } from '../types/result';

describe('Result<T,E>', () => {
  it('should create an Ok result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it('should create an Err result', () => {
    const r = err('failure');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('failure');
  });

  it('should map over Ok', () => {
    const r = map(ok(2), x => x * 3);
    expect(r.ok && r.value).toBe(6);
  });

  it('should not map over Err', () => {
    const r = map(err('fail'), (_x: number) => _x * 3);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('fail');
  });

  it('should flatMap over Ok', () => {
    const r = flatMap(ok(5), x => ok(x + 1));
    expect(r.ok && r.value).toBe(6);
  });

  it('should unwrap with default', () => {
    expect(unwrapOr(ok(10), 0)).toBe(10);
    expect(unwrapOr(err('e'), 0)).toBe(0);
  });

  it('should wrap a resolved promise', async () => {
    const r = await fromPromise(Promise.resolve(7), e => String(e));
    expect(r.ok && r.value).toBe(7);
  });

  it('should wrap a rejected promise', async () => {
    const r = await fromPromise(Promise.reject(new Error('boom')), e => String(e));
    expect(!r.ok && r.error).toBe('Error: boom');
  });

  it('should wrap a successful sync function', () => {
    const r = tryCatch(() => 99, e => String(e));
    expect(r.ok && r.value).toBe(99);
  });

  it('should wrap a throwing sync function', () => {
    const r = tryCatch(() => { throw new Error('crash'); }, e => String(e));
    expect(!r.ok && r.error).toBe('Error: crash');
  });
});
