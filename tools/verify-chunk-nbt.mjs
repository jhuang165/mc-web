// Execute unchanged AnvilChunkLoader payload methods, without region-file IO.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {decodeNbt, encodeNbt} from '../src/nbt.js';
import {chunkFromNbt, chunkToNbt} from '../src/chunk-nbt.js';
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
const out = path.join(research, 'chunk-nbt-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/ChunkNbtProbe.java')]);
const {stdout} = await exec('java', ['-cp', cp, 'ChunkNbtProbe'], {maxBuffer: 1 << 24});
const cases = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, 14);
const inputs = path.join(out, 'inputs'); await mkdir(inputs, {recursive: true});
for (const c of cases) {
  const loaded = chunkFromNbt(decodeNbt(gunzipSync(Buffer.from(c.inputGzip, 'base64'))), {hasSky: c.hasSky});
  await writeFile(path.join(inputs, c.index + '.nbt'), encodeNbt(chunkToNbt(loaded.chunk, {...loaded, lastUpdate: BigInt(c.time)})));
}
const {stdout: verified} = await exec('java', ['-cp', cp, 'ChunkNbtProbe', inputs]);
assert.match(verified, /14 JS chunk payloads/);
const classesInfo = Object.fromEntries(await Promise.all(Object.entries({aqk:'AnvilChunkLoader',apx:'Chunk',apz:'ExtendedBlockStorage',apv:'NibbleArray',du:'CompressedStreamTools',ahs:'NextTickListEntry'}).map(async ([id, name]) => {
  const {stdout: bytes} = await exec('unzip', ['-p', jar, id + '.class'], {encoding: 'buffer'});
  return [id, {name, sha256: createHash('sha256').update(bytes).digest('hex')}];
})));
const metadata = {
  target: 'Minecraft Java 1.7.10', clientSha1, classes: classesInfo,
  method: 'Reflection executes unchanged private AnvilChunkLoader.writeChunkToNBT/readChunkFromNBT payload methods. A constructor-free World supplies total time, sky capability, pending tick records and a recording schedule hook. Real Chunk/ExtendedBlockStorage/NibbleArray and unchanged NBT gzip IO execute. Fixtures include null/empty/full sections, invalid raw IDs/Add arrays, sky/no-sky, long endpoints, null/empty/nonempty tick lists, missing biome/optional fields and duplicate section Y. Entity and tile lists are empty; World construction, region files, lighting propagation and live-world integration are not exercised. Rewritten payloads use the fixture world time and original pending ticks, not a new scheduler. All 14 JS-loaded/serialized payloads also read and rewrite through original AnvilChunkLoader with identical storage, scheduled calls and native raw output.',
};
await writeFile(path.join(root, '../public/research/chunk-nbt-reference.json'),
  JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "cases": [\n' + cases.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n');
console.log(`${cases.length} native chunk NBT records; ${verified.trim()}`);
