// Native 1.7.10 fishing: EntityFishHook (xe), ItemFishingRod (acv), ItemFishFood (act/acu) and
// WeightedRandomFishable (xf) run unchanged by probes/FishingProbe.java. Writes
// public/research/fishing-reference.json, replayed by src/fishing.test.js.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = p => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const d of dirs) if (await exists(path.join(d, 'minecraft-1.7.10.jar'))) { research = d; break; }
if (!research) throw new Error('Set MC_RESEARCH to the directory containing minecraft-1.7.10.jar.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), sha1 = createHash('sha1').update(await readFile(jar)).digest('hex');
assert.equal(sha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const d of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries'), path.join(os.homedir(), '.gradle/caches')]) {
    if (!await exists(d)) continue;
    const { stdout } = await exec('find', [d, '-name', prefix + '*.jar', '-not', '-name', '*sources*'], { maxBuffer: 1 << 24 });
    const p = stdout.split('\n').filter(Boolean).sort()[0]; if (p) return p;
  }
  throw new Error(`Missing ${prefix}*.jar; pass library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'authlib-'].map(library));
const out = path.join(research, 'fishing-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await rm(out, { recursive: true, force: true }); await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/FishingProbe.java')], { maxBuffer: 1 << 24 });
const { stdout } = await exec('java', ['-cp', cp, 'FishingProbe'], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split('\n').filter(s => s.startsWith('{')).map(JSON.parse);
const by = k => rows.filter(r => r.kind === k);
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: sha1,
  classes: { xe: 'EntityFishHook', acv: 'ItemFishingRod', act: 'ItemFishFood', acu: 'ItemFishFood.FishType', xf: 'WeightedRandomFishable' },
  tables: by('table'), food: by('food')[0], effects: by('effects')[0], launches: by('launch'), casts: by('cast'), ground: by('ground')[0], reels: by('reel'), loot: by('loot'),
};
await writeFile(path.join(root, '../public/research/fishing-reference.json'), JSON.stringify(reference) + '\n');
console.log(`native fishing: ${reference.tables.length} tables, ${reference.casts.length} casts, ${reference.reels.length} reels, ${reference.loot.reduce((n, l) => n + l.rows.length, 0)} loot rolls`);
