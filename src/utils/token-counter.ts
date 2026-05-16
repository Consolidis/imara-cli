export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Simple estimation: ~4 chars per token for English/Code
  // For French, it might be slightly more, but this is a good enough baseline for a CLI.
  return Math.ceil(text.length / 4);
}

export function truncateToTokenLimit(text: string, limit: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= limit) return text;
  
  const charLimit = limit * 4;
  return text.substring(0, charLimit) + '\n... [Tronqué pour respecter la limite de tokens]';
}
