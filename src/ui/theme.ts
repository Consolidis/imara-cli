// src/ui/theme.ts

export const theme = {
  primary: '#4B8BF5',      // Bleu Gemini — titres, nom du modèle
  secondary: '#8AB4F8',    // Bleu clair — labels
  accent: '#81C995',       // Vert — succès, résultats tools
  warning: '#FDD663',      // Jaune — warnings
  error: '#F28B82',        // Rouge — erreurs
  muted: '#9AA0A6',        // Gris — texte secondaire, métadonnées
  text: '#E8EAED',         // Blanc cassé — texte principal
  toolBg: '#1E2A3A',       // Fond foncé bleuté — blocs tool calls
};

/**
 * Utility to wrap text to a certain width
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    let currentLine = '';
    const words = paragraph.split(' ');

    for (const word of words) {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}
