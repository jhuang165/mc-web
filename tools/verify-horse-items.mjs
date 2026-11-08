// Run the unchanged EntityHorse.readEntityFromNBT / writeEntityToNBT (tools/probes/HorseItemsProbe.java, on the HorseProbe world double) and store
// the saved-Items scenarios as public/research/horse-items-nbt-reference.json (replayed by src/horse-items-nbt.test.js).
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
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'authlib-', 'commons-io-', 'gson-'].map(library));
const out = path.join(research, 'horse-items-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', 'assets/minecraft/lang/en_US.lang', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, ...['MobMoveProbe', 'ModelProbe', 'HorseProbe', 'HorseItemsProbe'].map(n => path.join(root, `probes/${n}.java`))]);
const {stdout} = await exec('java', ['-cp', cp, 'HorseItemsProbe'], {maxBuffer: 1 << 24});
const cases = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, 4);
const metadata = {
  target: 'Minecraft Java 1.7.10', clientSha1,
  method: 'The unchanged EntityHorse (wi) is built on the HorseProbe/MobMoveProbe world double; readEntityFromNBT(a(dh)) loads an "Items" list (Slot, id, Count, Damage) and writeEntityToNBT(b(dh)) saves it again. chest is the AnimalChest (zt) after loading: 17 slots for a chested donkey or mule, 2 otherwise. Counts 0, negative bytes and above 64, slots outside 2..16, duplicate slots, unknown ids and a negative Damage are covered.',
  cases,
};
await writeFile(path.join(root, '../public/research/horse-items-nbt-reference.json'), JSON.stringify(metadata, null, 1).replace(/\n\s+(-?\d|\{|\[|null)/g, ' $1').replace(/\n\s+(\]|\})/g, '$1') + '\n');
console.log(`${cases.length} native horse Items scenarios`);
