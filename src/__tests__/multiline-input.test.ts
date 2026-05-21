import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as readline from 'readline';
import { attachMultilineLineHandler } from '../ui/multiline-input';

describe('attachMultilineLineHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should join multiple rapid lines (paste) into one submit', () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const submitted: string[] = [];

    attachMultilineLineHandler(rl, (text) => {
      submitted.push(text);
    }, 80);

    rl.emit('line', 'Error: 500');
    rl.emit('line', 'Stack trace here');
    rl.emit('line', 'at foo.ts:12');

    expect(submitted).toHaveLength(0);
    vi.advanceTimersByTime(80);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toBe('Error: 500\nStack trace here\nat foo.ts:12');

    rl.close();
  });

  it('should flush on empty line when buffer has content', () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const submitted: string[] = [];

    attachMultilineLineHandler(rl, (text) => {
      submitted.push(text);
    });

    rl.emit('line', 'line one');
    rl.emit('line', '');

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toBe('line one');

    rl.close();
  });
});
