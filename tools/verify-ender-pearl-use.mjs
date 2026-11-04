// Native 1.7.10 ItemEnderPearl right-click behavior + class-bound item facts.
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
const out = path.join(research, 'ender-pearl-use-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await rm(out, { recursive: true, force: true }); await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/MobMoveProbe.java'), path.join(root, 'probes/EnderPearlUseProbe.java')], { maxBuffer: 1 << 24 });
const { stdout } = await exec('java', ['-cp', cp, 'EnderPearlUseProbe'], { maxBuffer: 1 << 22 });
const cases = stdout.trim().split('\n').filter(s => s.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, 3);
const survival = cases.find(c => c.case === 'survival-server'), client = cases.find(c => c.case === 'survival-client'), creative = cases.find(c => c.case === 'creative-server');
assert.equal(survival.sameStack, true); assert.equal(survival.maxStack, 16);
assert.equal(survival.count, 1); assert.equal(survival.events.length, 2);
assert.match(survival.events[0], /^sound\|random\.bow\|0\.5\|[^|]+\|count=1$/);
assert.match(survival.events[1], /^spawn\|enderPearl\|count=1\|xyz=/);
assert.equal(client.sameStack, true); assert.equal(client.count, 1); assert.equal(client.events.length, 1);
assert.match(client.events[0], /^sound\|random\.bow\|0\.5\|[^|]+\|count=1$/);
assert.equal(creative.sameStack, true); assert.equal(creative.maxStack, 16);
assert.equal(creative.count, 2); assert.deepEqual(creative.events, []);
const methodsOut = await exec('javap', ['-p', '-cp', jar, 'zm']);
const pearlMethods = methodsOut.stdout.split('\n').map(s => s.trim()).filter(s => s.endsWith(';') && s.includes('('));
const ownMethods = pearlMethods.filter(s => !s.startsWith('public zm('));
assert.deepEqual(ownMethods, ['protected void a(azu);']);
const digest = async name => createHash('sha256').update((await exec('unzip', ['-p', jar, name + '.class'], { encoding: 'buffer', maxBuffer: 1 << 24 })).stdout).digest('hex');
const reference = { target: 'Minecraft Java 1.7.10', clientSha1: sha1,
  classes: { aco: { name: 'ItemEnderPearl', sha256: await digest('aco') }, zm: { name: 'EntityEnderPearl', sha256: await digest('zm') }, zk: { name: 'EntityThrowable', sha256: await digest('zk') } },
  semantics: { nativeId: 368, internalId: 378, maxStack: 16, survival: 'decrement stack, play random.bow at volume 0.5 and pitch 0.4/(rand*0.4+0.8), then spawn EntityEnderPearl only when !world.isRemote', creative: 'return the same stack before decrement, sound, or projectile spawn' },
  entityMethods: { declaredInEntityEnderPearl: pearlMethods, updateOverride: false, impact: 'protected void a(azu) (obfuscated onImpact); flight is inherited from zk EntityThrowable' }, cases };
await writeFile(path.join(root, '../public/research/ender-pearl-use-reference.json'), JSON.stringify(reference, null, 2) + '\n');
console.log('native ItemEnderPearl right-click: survival decrement/sound/spawn and Creative no-op');
