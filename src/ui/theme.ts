// src/ui/theme.ts — Design System Imara CLI

/** Palette proche du terminal Claude Code (tons chauds / neutres). */
export const palette = {
  primary:   '#D4A574',
  secondary: '#E8C9A8',
  accent:    '#7DD3A0',
  warning:   '#E5C07B',
  error:     '#E06C75',
  muted:     '#6B7280',
  text:      '#E6E6E6',
  toolBg:    '#1A1A1A',
  bg:        '#141414',
} as const;

export const theme = {
  ...palette,
  // ANSI-safe fallback for basic terminals
  primary16:   33,  // blue
  secondary16: 75,  // light blue
  accent16:    78,  // green
  warning16:   220, // yellow
  error16:     196, // red
  muted16:     245, // gray
  text16:      255, // white
};

export type ThemeColor = keyof typeof palette;

/** Wrap text to a given width preserving paragraphs */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(' ')) {
      if ((current + word).length <= width) {
        current += (current ? ' ' : '') + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Small helper: colorize by theme key safely */
export function color16(key: ThemeColor): number {
  return theme[`${key}16` as keyof typeof theme] as number;
}
