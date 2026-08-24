// Types minimaux pour mammoth (aucun @types/mammoth publie sur npm)
declare module 'mammoth' {
  interface MammothResult {
    value: string;
    messages: unknown[];
  }
  interface MammothInput {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }
  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function extractRawText(input: MammothInput, options?: Record<string, unknown>): Promise<MammothResult>;
}
