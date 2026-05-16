import chalk from 'chalk';
import * as diff from 'diff';

export function showDiff(filePath: string, oldContent: string, newContent: string) {
  console.log(`\n${chalk.bold('Modification de')} ${chalk.cyan(filePath)} :`);
  
  const differences = diff.diffLines(oldContent, newContent);

  differences.forEach((part) => {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.grey;
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';

    if (part.added || part.removed) {
      process.stdout.write(color(part.value.split('\n').map(line => line ? prefix + line : line).join('\n')));
    } else {
      // Show context lines (only 2 lines if it's too long)
      const lines = part.value.split('\n');
      if (lines.length > 4) {
        process.stdout.write(color(lines.slice(0, 2).map(l => ' ' + l).join('\n') + '\n...\n' + lines.slice(-2).map(l => ' ' + l).join('\n')));
      } else {
        process.stdout.write(color(lines.map(l => ' ' + l).join('\n')));
      }
    }
  });
  console.log('\n');
}
