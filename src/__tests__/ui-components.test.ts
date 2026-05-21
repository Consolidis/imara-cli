import { describe, expect, it } from 'vitest';
import { theme, palette, color16, wrapText } from '../ui/theme';
import { renderStatusBar, clearStatusBar, setStatusBarPinned } from '../ui/components/status-bar';
import { showErrorPanel } from '../ui/components/error-panel';
import { showToolCall, startToolCallSpinner, stopToolCallSpinner } from '../ui/components/tool-call';
import { showResponse } from '../ui/components/response';

describe('UI Components', () => {
  it('should export theme palette', () => {
    expect(theme.primary).toBe(palette.primary);
    expect(theme.error16).toBe(196);
  });

  it('color16 should return ANSI code', () => {
    expect(color16('error')).toBe(196);
    expect(color16('accent')).toBe(78);
  });

  it('wrapText should preserve paragraphs', () => {
    const lines = wrapText('hello world', 5);
    expect(lines).toContain('hello');
  });

  it('showResponse should not throw', () => {
    expect(() => showResponse('test')).not.toThrow();
  });

  it('showToolCall should not throw', () => {
    expect(() => showToolCall('read_file', { path: 'x' })).not.toThrow();
    expect(() => showToolCall('read_file', { path: 'x' }, 42)).not.toThrow();
  });

  it('start/stop spinner should not throw', () => {
    expect(() => startToolCallSpinner('run_command', { command: 'ls' })).not.toThrow();
    expect(() => stopToolCallSpinner()).not.toThrow();
  });

  it('renderStatusBar should not throw', () => {
    setStatusBarPinned(true);
    expect(() => renderStatusBar({ model: 'test', tokens: 100, costFcfa: 5.5 })).not.toThrow();
    setStatusBarPinned(false);
  });

  it('clearStatusBar should not throw', () => {
    expect(() => clearStatusBar()).not.toThrow();
  });

  it('showErrorPanel should not throw on plain Error', () => {
    expect(() => showErrorPanel(new Error('fail'))).not.toThrow();
  });
});
