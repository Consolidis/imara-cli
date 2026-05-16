// src/ui/components/response.ts
import chalk from 'chalk';
import { theme, wrapText } from '../theme';

export function showResponse(text: string): void {
  if (!text) return;
  console.log(''); // Empty line before
  
  // Prefix IMARA stylized on the first line
  const prefix = chalk.hex(theme.primary).bold('IMARA') + 
                 chalk.hex(theme.muted)(' ›') + ' ';
  
  const lines = wrapText(text, 76);
  lines.forEach((line, i) => {
    if (i === 0) {
      console.log(prefix + chalk.hex(theme.text)(line));
    } else {
      console.log('        ' + chalk.hex(theme.text)(line)); // Aligned with text
    }
  });
  
  console.log(''); // Empty line after
}
