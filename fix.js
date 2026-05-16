const fs = require('fs');
const file = 'src/cli/commands/chat.command.ts';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const indent = line.match(/^(\s*)/)?.[1] || '';
  const trimmed = line.trim();

  if (trimmed === 'rl.prompt();') {
    // Check if any non-empty previous line in out is printStatus
    let hasPrintStatus = false;
    for (let j = out.length - 1; j >= 0; j--) {
      const t = out[j].trim();
      if (t === '') continue;
      if (t === 'printStatus();') { hasPrintStatus = true; break; }
      break;
    }
    if (!hasPrintStatus) {
      out.push(indent + 'printStatus();');
    }
  }
  out.push(line);
}

fs.writeFileSync(file, out.join('\n'));
console.log('done');
console.log('Hello World');
