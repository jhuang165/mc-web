import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {decodeNbt, encodeNbt} from '../src/nbt.js';
import {decodeCompressedNbt, encodeCompressedNbt} from '../src/nbt-compression.js';

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
const out = path.join(research, 'nbt-compression-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe'), inputs = path.join(out, 'inputs');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true}); await mkdir(inputs, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/NbtCompressionProbe.java')]);
const rawPath = path.join(root, '../public/research/nbt-reference.json'), rawBytes = await readFile(rawPath);
const rawReference = JSON.parse(rawBytes);
for (const [i, c] of rawReference.cases.entries()) await writeFile(path.join(inputs, i + '.nbt'), Buffer.from(c.hex, 'hex'));
const {stdout} = await exec('java', ['-cp', cp, 'NbtCompressionProbe', 'capture', inputs, String(rawReference.cases.length)], {maxBuffer: 1 << 24});
const cases = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
assert.equal(cases.length, rawReference.cases.length * 2);
for (const c of cases) {
  const raw = Buffer.from(c.rawHex, 'hex');
  const decoded = await decodeCompressedNbt(Buffer.from(c.hex, 'hex'), {format: c.format});
  assert.deepEqual(encodeNbt(decoded), new Uint8Array(raw));
  // Use the independently captured original raw input, retaining its named root.
  const input = decodeNbt(Buffer.from(rawReference.cases[c.index].hex, 'hex'));
  await writeFile(path.join(inputs, c.index + '.' + c.format), await encodeCompressedNbt(input, {format: c.format}));
  c.id = rawReference.cases[c.index].id;
  // Raw output is reproducible from the existing oracle; avoid duplicating large strings.
  c.rawSha256 = createHash('sha256').update(raw).digest('hex');
  delete c.rawHex;
}
const {stdout: verified} = await exec('java', ['-cp', cp, 'NbtCompressionProbe', 'verify', inputs, String(rawReference.cases.length)]);
assert.match(verified, /146 JS compressed documents/);
const {stdout: duBytes} = await exec('unzip', ['-p', jar, 'du.class'], {encoding: 'buffer'});
const metadata = {
  target: 'Minecraft Java 1.7.10', clientSha1,
  compressedStreamToolsSha256: createHash('sha256').update(duBytes).digest('hex'),
  rawReferenceSha256: createHash('sha256').update(rawBytes).digest('hex'),
  method: '73 original raw fixtures are read by unchanged CompressedStreamTools. Its original gzip byte-array writer/reader execute; JDK Deflater/Inflater streams wrap its original raw writer/reader for zlib. All 146 native compressed streams decode in JS. All 146 JS-encoded gzip/zlib streams then read through original NBT methods and reserialize to the same native raw bytes. Native output resets root names to empty; JS retains provided root names. No original RegionFile, Anvil save or gameplay execution. Compression bytes are fixtures from the executing JDK; interoperability compares uncompressed NBT, not compressor byte identity.',
  jsToNativeDocuments: cases.length,
};
await writeFile(path.join(root, '../public/research/nbt-compression-reference.json'),
  JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "cases": [\n' + cases.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n');
console.log(`${cases.length} native compressed records; ${verified.trim()}`);
