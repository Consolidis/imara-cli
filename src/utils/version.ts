import * as fs from 'fs';
import * as path from 'path';

export function getVersion(): string {
  try {
    // Dev: __dirname is src/utils -> package.json is 2 folders up
    const p1 = path.join(__dirname, '..', '..', 'package.json');
    if (fs.existsSync(p1)) {
      return JSON.parse(fs.readFileSync(p1, 'utf8')).version;
    }
    // Prod: __dirname is dist/utils -> package.json is 1 folder up
    const p2 = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(p2)) {
      return JSON.parse(fs.readFileSync(p2, 'utf8')).version;
    }
  } catch {}
  return '1.0.1'; // Fallback
}
