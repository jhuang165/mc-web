// Batch 72 flowerpots72: executes the unchanged 1.7.10 BlockFlowerPot/TileEntityFlowerPot over every item and damage
// (tools/probes/PotSweepProbe.java, built on StoneUtilityProbe's world double) and writes public/research/pot-sweep-reference.json.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
let research;
for (const dir of [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean)) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'pot-sweep-probe'), sha = 'e80d9b3bf5085002218d4be59e668bac718abbc6';
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), sha);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries'), path.join(os.homedir(), '.gradle/caches')]) {
    if (!await exists(dir)) continue;
    const { stdout } = await exec('find', [dir, '-name', prefix + '*.jar', '-not', '-name', '*sources*'], { maxBuffer: 1 << 24 }), hit = stdout.split('\n').filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'netty-all-'].map(library)), classes = path.join(out, 'classes');
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, 'probe'); await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/StoneUtilityProbe.java'), path.join(root, 'probes/PotSweepProbe.java')]);
const { stdout } = await exec('java', ['-cp', cp, 'PotSweepProbe'], { maxBuffer: 1 << 26 });
const rows = stdout.trim().split('\n').filter((l) => l.startsWith('{')).map(JSON.parse), count = (k) => rows.filter((r) => r.kind === k).length;
assert.ok(count('potAccept') > 0 && count('potNbt') === 20 && count('potPlace') > 100 && count('potSweep') === 1);
const reference = { target: 'Minecraft Java 1.7.10', clientSha1: sha,
  method: 'Unchanged BlockFlowerPot.onBlockActivated/canPlaceBlockAt and TileEntityFlowerPot read/write over StoneUtilityProbe\'s map-backed World double: every registered item id 1-2300 at damage 0-15, Survival and Creative, into an empty pot (accepted rows record the stored item/data, block metadata, remaining stack, break drops, NBT Item/Data and the plant block render type); NBT reads of chosen Item/Data pairs; support over every block id and metadata.',
  counts: Object.fromEntries(['potAccept', 'potNbt', 'potPlace', 'potSweep', 'potFull', 'potNoTile'].map((k) => [k, count(k)])), rows };
await writeFile(path.join(root, '../public/research/pot-sweep-reference.json'), JSON.stringify(reference) + '\n');
console.log('pot sweep rows:', rows.length, JSON.stringify(reference.counts));
