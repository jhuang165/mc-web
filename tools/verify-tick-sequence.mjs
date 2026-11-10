// Batch 35: executed tick sequences. Runs the unchanged BlockDynamicLiquid / BlockStaticLiquid / BlockFalling classes (tools/probes/TickSequenceProbe.java)
// on the scenarios of tools/tick-sequence-scenarios.mjs, checks the port's tick tree gives the same result, and stores public/research/tick-sequence-reference.json
// (replayed by src/tick-sequence.test.js).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SEQUENCES, replaySequence} from './tick-sequence-scenarios.mjs';
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
const out = path.join(research, 'tick-sequence-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
const probeSource = path.join(root, 'probes/TickSequenceProbe.java');
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, probeSource]);
const input = SEQUENCES.map(s => `scenario ${s.name} ${s.dims.join(' ')} ${s.ticks} ${s.rseed}\ngrid ${s.grid}\n${s.events.map(e => `event ${e.join(' ')}`).join('\n')}\n`).join('');
const {stdout} = await new Promise((res, rej) => {
  const child = execFile('java', ['-cp', cp, 'TickSequenceProbe'], {maxBuffer: 1 << 26}, (err, stdout) => err ? rej(err) : res({stdout}));
  child.stdin.end(input);
});
const native = stdout.trim().split('\n').filter(l => l.startsWith('{')).map(JSON.parse);
assert.equal(native.length, SEQUENCES.length);
const digest = async name => createHash('sha256').update((await exec('unzip', ['-p', jar, name + '.class'], {encoding: 'buffer', maxBuffer: 1 << 24})).stdout).digest('hex');
const names = {akr: 'BlockDynamicLiquid', ant: 'BlockStaticLiquid', alw: 'BlockLiquid', akx: 'BlockFalling', anh: 'BlockSand', ali: 'BlockGravel'};
let diverged = 0;
const scenarios = SEQUENCES.map((s, i) => {
  const mine = replaySequence(s), n = native[i];
  const same = JSON.stringify(mine.ticks) === JSON.stringify(n.ticks) && mine.final === n.final && mine.pending === n.pending && mine.pendingHash === n.pendingHash && mine.rng === n.rng;
  if (!same) { diverged++; const t = mine.ticks.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(n.ticks[k])); console.log(`DIVERGES ${s.name}: first differing tick ${t + 1}: port ${JSON.stringify(mine.ticks[t])} native ${JSON.stringify(n.ticks[t])}; final ${mine.final}/${n.final} pending ${mine.pending}/${n.pending} rng ${mine.rng}/${n.rng}`); }
  return {name: s.name, dims: s.dims, ticks: s.ticks, rseed: s.rseed, events: s.events.length, cells: s.grid.length, native: {ticks: n.ticks, final: n.final, pending: n.pending, pendingHash: n.pendingHash, fizz: n.fizz, rng: n.rng}};
});
const metadata = {
  target: 'Minecraft Java 1.7.10', clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, {name: n, sha256: await digest(c)}]))),
  method: 'The unchanged BlockDynamicLiquid (akr), BlockStaticLiquid (ant), BlockLiquid (alw), BlockFalling (akx), BlockSand (anh) and BlockGravel (ali) run their updateTick against the FluidProbe World test double (setBlock, neighbour notification in x-1,x+1,y-1,y+1,z-1,z+1 order, a scheduled-tick TreeSet ordered by time, priority and creation with HashSet de-duplication, at most 1000 entries taken per tick, the model of WorldServer.tickUpdates whose own cap TileTicksProbe probes on the real class). BlockFalling.fallInstantly (akx.M) is set, so a falling block moves at once and no EntityFallingBlock exists. Per tick: [entries taken, entries whose block was still there and ran, 31x+char hash of the taken sequence as kind@x,y,z (w water, l lava, s sand, g gravel), hash of the grid]; at the end the grid hash, the pending entries (count and hash of kind@x,y,z:delay, sorted), the fizz count and the world Random next int. Scenarios: tools/tick-sequence-scenarios.mjs.',
  scenarios,
};
await writeFile(path.join(root, '../public/research/tick-sequence-reference.json'), JSON.stringify(metadata, null, 1).replace(/\n\s+(-?\d)/g, ' $1').replace(/\n\s+\]/g, ']') + '\n');
console.log(`${scenarios.length} executed sequences, ${diverged} diverge from the port`);
