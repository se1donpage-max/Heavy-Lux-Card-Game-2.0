import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('docs/assets-manifest.json','utf8'));
const ids = new Set(); let images = 0;
for (const entry of manifest) {
  assert(!ids.has(entry.id), `Duplicate ${entry.id}`); ids.add(entry.id);
  for (const variant of ['web_2x','retina_4x']) {
    const file = entry.files[variant];
    assert(file.path.startsWith(`${variant}/`) && !file.path.includes('..'));
    const bytes = readFileSync(join('public/k7-ui',file.path));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),file.width); assert.equal(bytes.readUInt32BE(20),file.height);
    assert.equal(bytes[25],6,`${file.path} is not RGBA`); images++;
  }
}
const registry = readFileSync('lib/brand-assets.ts','utf8');
for(const id of ids) assert(registry.includes(JSON.stringify(id)),`Missing registry ID: ${id}`);
let uses=0;
for(const dir of ['app','components']) for(const f of readdirSync(dir)) {
  const path=join(dir,f); if(!statSync(path).isFile()||!f.endsWith('.tsx')) continue;
  const source=readFileSync(path,'utf8');
  for(const [,id] of source.matchAll(/\basset="([^"]+)"/g)) { assert(ids.has(id),`${path}: ${id}`); uses++; }
}
console.log(`Asset checks OK: ${ids.size} IDs, ${images} PNGs, ${uses} explicit JSX references.`);
