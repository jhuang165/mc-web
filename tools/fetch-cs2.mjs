// Install the user's CS2 Unified pack unmodified into a Git-ignored asset directory.
// The local zip retains its own authors' credits and terms; no pack payload belongs in source commits.
import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { zipEntries } from './zip-entries.mjs';
import { parseLenient } from '../src/mods/guns/json5.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || process.env.CS2_PACK || path.join(os.homedir(), 'Documents/curseforge/minecraft/Instances/The Last War_ Floydian/tacz/cs2_unified-2.7.0-mode-sounds-2026-10-07.zip');
const zip = await readFile(file), entries = [...zipEntries(zip)];
const meta = entries.find(e => /(^|\/)gunpack\.meta\.json$/.test(e.name));
if (!meta || parseLenient(meta.read().toString()).namespace !== 'cs2') throw Error('Expected a CS2 Unified gun pack with namespace cs2.');
const prefix = meta.name.slice(0, -'gunpack.meta.json'.length), out = path.join(root, 'public/mods/cs2'), staging = out + '.install';
await rm(staging, { recursive: true, force: true });
const files = [];
for (const entry of entries) {
  if (!entry.name.startsWith(prefix)) continue;
  const rel = entry.name.slice(prefix.length);
  if (!/^(assets|data)\/cs2\//.test(rel) && !/^(gunpack\.meta\.json|.*(?:credits|license|readme).*\.(txt|md))$/i.test(rel)) continue;
  if (rel.endsWith('/') || rel.split('/').some(p => p === '..' || p === '.' || !p)) continue;
  const bytes = entry.read(); if (!bytes) throw Error('Unsupported compressed entry: ' + rel);
  const target = path.join(staging, 'pack', rel);
  await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); files.push(rel);
}
const list = (folder) => files.filter(n => n.startsWith(folder) && n.endsWith('.json')).map(n => n.slice(folder.length, -5)).sort();
const index = { namespace: 'cs2', file: path.basename(file), sha256: createHash('sha256').update(zip).digest('hex'),
  guns: list('data/cs2/index/guns/'), ammo: list('data/cs2/index/ammo/'), attachments: list('data/cs2/index/attachments/'),
  melee: list('data/cs2/index/melee/'), attachmentTags: list('data/cs2/tacz_tags/attachments/'), recipes: list('data/cs2/recipes/'),
  sounds: files.filter(n => /^assets\/cs2\/tacz_sounds\/.+\.ogg$/.test(n)).map(n => n.slice('assets/cs2/tacz_sounds/'.length, -4)).sort() };
await writeFile(path.join(staging, 'index.json'), JSON.stringify(index, null, 1));
await writeFile(path.join(staging, 'CREDITS.txt'), `CS2 Unified installed from ${index.file}\nSHA-256: ${index.sha256}\nPack files are unmodified and retain their original authors' terms and credits.\nInstalled locally by tools/fetch-cs2.mjs; source repository contains no pack payload.\n`);
await rm(out, { recursive: true, force: true }); await rename(staging, out);
console.log(`Installed ${files.length} unmodified CS2 Unified files: ${index.guns.length} gun entries, ${index.melee.length} LR knives, ${index.recipes.length} recipes.`);
