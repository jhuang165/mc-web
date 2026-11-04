// Capture constructor/heading/NBT facts from the unchanged pinned 1.7.10 JAR.
// Native impact particle/hit/death paths run on world doubles; the connected
// EntityPlayerMP teleport branch is inspected in the pinned native bytecode.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = p => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const d of dirs) if (await exists(path.join(d, 'minecraft-1.7.10.jar'))) { research = d; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const d of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries'), path.join(os.homedir(), '.gradle/caches')]) {
    if (!await exists(d)) continue;
    const { stdout } = await exec('find', [d, '-name', prefix + '*.jar', '-not', '-name', '*sources*'], { maxBuffer: 1 << 24 });
    const p = stdout.split('\n').filter(Boolean).sort()[0]; if (p) return p;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-'].map(library));
const out = path.join(research, 'ender-pearl-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await rm(out, { recursive: true, force: true }); await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe,
  path.join(root, 'probes/MobMoveProbe.java'), path.join(root, 'probes/EnderPearlProbe.java'), path.join(root, 'probes/EnderPearlImpactProbe.java')]);
const seeds = [1, 2, 7, 42, 1337, 8675309];
const { stdout } = await exec('java', ['-cp', cp, 'EnderPearlProbe', ...seeds.map(String)], { maxBuffer: 1 << 26 });
const cases = stdout.trim().split('\n').filter(l => l.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, seeds.length);
for (const c of cases) {
  assert.equal(c.width, 0.25); assert.equal(c.height, 0.25);
  assert.deepEqual([c.x, c.y, c.z], [2, 4, 6]);
  assert.ok([c.mx, c.my, c.mz, c.yaw, c.pitch].every(Number.isFinite));
  assert.match(c.nbt, /Pos/); assert.match(c.nbt, /Motion/); assert.match(c.nbt, /Rotation/);
  assert.doesNotMatch(c.nbt, /ticksInAir|portal/);
}
const impactOut = await exec('java', ['-cp', cp, 'EnderPearlImpactProbe'], { maxBuffer: 1 << 26 });
const impacts = impactOut.stdout.trim().split('\n').filter(l => l.startsWith('{')).map(JSON.parse);
assert.equal(impacts.length, 3);
assert.equal(impacts[0].dead, true); assert.equal(impacts[0].events.length, 32);
assert.equal(impacts[1].dead, false); assert.equal(impacts[1].attacked, true); assert.equal(impacts[1].damage, 0);
assert.equal(impacts[2].dead, true); assert.equal(impacts[2].attacked, true); assert.equal(impacts[2].damage, 0);
for (const c of impacts) assert.equal(c.events.filter(e => e.startsWith('particle|portal|')).length, 32);
for (const c of impacts.filter(c => c.hit)) assert.match(c.events[0], /^hit\|0\.0\|/, 'native hit must precede particles');
const digest = async name => createHash('sha256').update((await exec('unzip', ['-p', jar, name + '.class'], { encoding: 'buffer', maxBuffer: 1 << 24 })).stdout).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all([['zm', 'EntityEnderPearl'], ['zk', 'EntityThrowable'], ['aco', 'ItemEnderPearl']].map(async ([id, name]) => [id, { name, sha256: await digest(id) }]))),
  item: { nativeId: 368, internalId: 378, maxStackSize: 16, useSound: 'random.bow', creativeConsumes: false },
  impact: { method: 'zm.a(azu)', bytecodeInspected: true, particles: '32 portal particles after hit damage; x/z are pearl position, y is pearl y + nextDouble()*2; x/z motion use two nextGaussian draws and y motion is zero', hitArgument: 'ray-hit entity receives thrown DamageSource amount 0 before particle calls', serverGate: 'world.isRemote == false', ownerGate: 'thrower is EntityPlayerMP and its Netty channel is open', worldGate: 'player.world == pearl.world', riding: 'dismount if riding, then teleport to pearl x/y/z', damage: 'fall distance set to 0, then DamageSource.fall for 5 damage', dead: 'setDead runs on server after owner branch; client impact waits for server synchronization' },
  save: 'Native superclass writes standard entity Pos/Motion/Rotation; EntityThrowable adds ownerName, in-ground and shake fields, but does not save ticksInAir. Empty-owner constructor case shows ownerName:"". Browser adapter shape currently omits ownerName and in-ground/shake details.',
  method: 'Unchanged zm/zk/aco classes extracted from the pinned local JAR. Native probe executes constructor, setThrowableHeading at six Entity.rand seeds, dimensions, Entity.writeToNBT, and EntityEnderPearl.onImpact for no-owner server, client hit, and server hit scenarios on MobMoveProbe world doubles. The connected-EntityPlayerMP teleport/damage branch is bytecode-inspected, not executed.',
  cases, impactCases: impacts,
};
await writeFile(path.join(root, '../public/research/ender-pearl-reference.json'), JSON.stringify(reference, null, 2) + '\n');
console.log(`${cases.length} native ender pearl constructor/heading/save cases; impact method hash recorded`);
