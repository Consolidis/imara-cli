import type * as readline from 'readline';

/** Délai après la dernière ligne avant envoi (coller un texte multi-lignes). */
export const MULTILINE_FLUSH_MS = 120;

/** Remonte et efface N lignes terminal (échos readline). */
export function eraseTerminalLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[1A\r\x1b[2K');
  }
}

/**
 * Regroupe les événements `line` de readline (un par retour à la ligne).
 * - Coller un long texte : toutes les lignes sont fusionnées puis envoyées.
 * - Saisie manuelle multi-lignes : Entrée sur une ligne vide envoie le bloc.
 * - Une seule ligne + Entrée : envoi après un court délai.
 */
export function attachMultilineLineHandler(
  rl: readline.Interface,
  onFlush: (fullText: string, echoedLineCount: number) => void | Promise<void>,
  flushDelayMs = MULTILINE_FLUSH_MS
): void {
  let buffer: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (buffer.length === 0) return;
    const lines = buffer.slice();
    buffer = [];
    const text = lines.join('\n');
    void onFlush(text, lines.length);
  };

  const scheduleFlush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, flushDelayMs);
  };

  rl.on('line', (line) => {
    // Ligne vide = "j'ai fini" quand on compose plusieurs lignes à la main
    if (line === '' && buffer.length > 0) {
      flush();
      return;
    }
    if (line === '' && buffer.length === 0) {
      return;
    }

    buffer.push(line);
    scheduleFlush();
  });
}
