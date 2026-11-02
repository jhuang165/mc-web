// Regenerate raw NBT evidence using unchanged Java 1.7.10 NBT classes.
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
const out = path.join(research, 'nbt-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
// Extract to avoid javac's rejection of the original JAR's manifest class path.
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/NbtProbe.java')]);
const {stdout} = await exec('java', ['-cp', cp, 'NbtProbe'], {maxBuffer: 1 << 24});
const cases = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, 73);
const names = {df:'NBTTagByteArray', dg:'NBTTagByte', dh:'NBTTagCompound', dk:'NBTTagDouble', dl:'NBTTagEnd', dm:'NBTTagFloat', dn:'NBTTagIntArray', dp:'NBTTagInt', dq:'NBTTagList', dr:'NBTTagLong', ds:'NBTSizeTracker', du:'CompressedStreamTools', dw:'NBTTagShort', dx:'NBTTagString', dy:'NBTBase', dz:'NBTPrimitive'};
const classesInfo = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([id, name]) => {
  const {stdout: bytes} = await exec('unzip', ['-p', jar, id + '.class'], {encoding:'buffer'});
  return [id, {name, sha256:createHash('sha256').update(bytes).digest('hex')}];
})));
const metadata = {
  target:'Minecraft Java 1.7.10', clientSha1, classes:classesInfo,
  method:'Original NBT constructors and payload writers produce named compound streams with DataOutput.writeUTF names. Unchanged CompressedStreamTools.read(DataInput, NBTSizeTracker) reads them; normalized typed trees match their inputs (native equals returns false for NaN). Tree values use native accessors plus reflection for private NBTTagList storage (there is no general nonmutating accessor); compound order follows the native map, long values are decimal strings and special floats are strings. Raw streams only; no gzip, Anvil, item/game adapters or native malformed-input acceptance is claimed.',
};
// Keep deeply nested fixtures compact rather than expanding megabytes of indent.
const json = JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "cases": [\n' +
  cases.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n';
await writeFile(path.join(root, '../public/research/nbt-reference.json'), json);
console.log(`${cases.length} native NBT cases`);
