/**
 * @deprecated Intentions are merged into tool-call spinner (single line per tool).
 * Kept for API compatibility — no extra output.
 */
export function showIntention(_name: string, _args: Record<string, unknown>): void {
  // Claude Code shows one line per tool (spinner → checkmark), not a separate intention line.
}
