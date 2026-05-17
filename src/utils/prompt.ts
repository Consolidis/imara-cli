import * as readline from 'readline';
import { Writable } from 'stream';

/**
 * Prompts the user with a standard visible input.
 */
export function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts the user with a completely silent masked input (like Unix sudo password prompt).
 */
export function askQuestionMasked(query: string): Promise<string> {
  return new Promise((resolve) => {
    const mutableStdout = new Writable({
      write: (chunk, encoding, callback) => {
        if (!mutableStdout.muted) {
          process.stdout.write(chunk, encoding);
        } else {
          // Let newlines pass to advance cursor, mute everything else
          const str = chunk.toString();
          if (str === '\n' || str === '\r' || str === '\r\n') {
            process.stdout.write(chunk, encoding);
          }
        }
        callback();
      },
    }) as Writable & { muted: boolean };

    mutableStdout.muted = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    // Output the prompt safely
    mutableStdout.write(query);
    // Mute stdout for silent password input
    mutableStdout.muted = true;

    rl.question('', (answer) => {
      mutableStdout.muted = false;
      rl.close();
      resolve(answer.trim());
    });
  });
}
