/** Strip ANSI escape codes for layout width calculations. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}
