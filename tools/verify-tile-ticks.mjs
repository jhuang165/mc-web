// Run the unchanged WorldServer pending-tick sets, scheduleBlockUpdateFromLoad and AnvilChunkLoader TileTicks reader/writer
// (tools/probes/TileTicksProbe.java) and store the scenarios as public/research/tile-ticks-reference.json (replayed by src/tile-ticks.test.js).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = p => access(p).then(() => true, () => false);
let research;
for (const dir of [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean)) {
  if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
}
if (!research) throw new Error('Set MC_RESEARCH to the directory containing minecraft-1.7.10.jar.');
const jar = path.join(research, 'minecraft-1.7.10.jar');
const clientSha1 = createHash('sha1').update(await readFile(jar)).digest('hex');
assert.equal(clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries')]) {
    if (!await exists(dir)) continue;
    const {stdout} = await exec('find', [dir, '-name', prefix + '*.jar', '-not', '-name', '*sources*']);
    const hit = stdout.split('\n').filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix} JAR; set MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-'].map(library));
const out = path.join(research, 'tile-ticks-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/TileTicksProbe.java')]);
const {stdout} = await exec('java', ['-cp', cp, 'TileTicksProbe'], {maxBuffer: 1 << 24});
const cases = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
assert.equal(cases.filter(c => c.kind === 'read').length, 14);
assert.equal(cases.filter(c => c.kind === 'write').length, 10);
const metadata = {
  target: 'Minecraft Java 1.7.10', clientSha1,
  method: 'The unchanged WorldServer (mt) is allocated without a constructor with real pendingTickListEntriesHashSet / TreeSet / ThisTick and a WorldInfo total time. read: the unchanged private AnvilChunkLoader reader calls the unchanged WorldServer.func_147446_b for every TileTicks entry of each loaded chunk in turn; the TreeSet is dumped in iteration order as [block id, x, y, z, scheduledTime - totalTime, priority]. write: entries are added to the real sets (and to ThisTick), then the unchanged writer saves one chunk through the unchanged getPendingBlockUpdates (2-block border box); the saved list is dumped in order as [i, x, y, z, t, p]. Ticking and live-world integration are not exercised.',
  cases,
};
await writeFile(path.join(root, '../public/research/tile-ticks-reference.json'), JSON.stringify(metadata, null, 1).replace(/\n\s+(-?\d)/g, ' $1').replace(/\n\s+\]/g, ']') + '\n');
console.log(`${cases.length} native TileTicks scenarios`);
