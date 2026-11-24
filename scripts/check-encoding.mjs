import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const decoder = new TextDecoder('utf-8', { fatal: true });
let count = 0;
let failed = false;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'out'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!/\.(tsx?|[cm]?js|css|sql|json|md|txt)$/.test(path)) continue;
    count++;
    try {
      const text = decoder.decode(await readFile(path));
      // Typical UTF-8 decoded as Latin-1 / Windows-1252, or replacement characters.
      const pattern = /[\u0080-\u009f\ufffd]|[\u00d0\u00d1][\u00a0-\u00bf]|\u00e2[\u0080-\u00bf]/u;
      for (const [i, line] of text.split('\n').entries()) {
        if (pattern.test(line)) { console.error(`${path}:${i + 1}: possible encoding damage`); failed = true; }
      }
    } catch (error) { console.error(path, error.message); failed = true; }
  }
}
await walk('.');
console.log(`UTF-8 check: ${count} files`);
if (failed) process.exitCode = 1;
