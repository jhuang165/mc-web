// Execute unchanged RegionFile over real files and verify compact JS rewrites.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readRegion, writeRegion} from '../src/region-file.js';
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
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'netty-all-'].map(library));
const out = path.join(research, 'region-file-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await mkdir(classes, {recursive: true}); await mkdir(probe, {recursive: true});
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], {maxBuffer: 1 << 24});
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(root, 'probes/RegionFileProbe.java')]);
const {stdout} = await exec('java', ['-cp', cp, 'RegionFileProbe', out], {maxBuffer: 1 << 24});
const records = stdout.trim().split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
const cases = records.filter(c => c.index !== undefined), allocations = records.filter(c => c.allocation !== undefined);
assert.equal(cases.length, 4); assert.equal(allocations.length, 5);
for (const c of cases) {
  const native = gunzipSync(Buffer.from(c.regionGzip, 'base64'));
  const entries = readRegion(native);
  await writeFile(path.join(out, c.index + '.mca'), writeRegion(entries.values()));
}
const {stdout: checked} = await exec('java', ['-cp', cp, 'RegionFileProbe', out, 'verify']);
const summaries = checked.trim().split('\n').filter(s => s.startsWith('[')).map(JSON.parse);
assert.deepEqual(summaries, cases.map(c => c.entries));
const {stdout: classBytes} = await exec('unzip', ['-p', jar, 'aqh.class'], {encoding: 'buffer'});
const reference = {
 target:'Minecraft Java 1.7.10', clientSha1, regionFileSha256:createHash('sha256').update(classBytes).digest('hex'),
 method:'Unchanged RegionFile writes/reopens/reads four real files: empty, sparse, overwritten/fragmented and all 1024 slots. Timestamp tables are zeroed after closing for reproducibility. One gzip record is patched into a fixture to exercise original gzip reads (native writes zlib). Original protected write also records exact-boundary/max-sector allocations. JS compact rewrites of all four files reopen through original RegionFile with identical decompressed lengths and hashes. Arbitrary seeded bytes test container IO; no gameplay saves, RegionFileCache or in-place allocator parity is claimed.',
 allocations, cases,
};
await writeFile(path.join(root,'../public/research/region-file-reference.json'),JSON.stringify(reference,null,2)+'\n');
console.log('4 native region fixtures and 5 allocation probes; all JS files read by original RegionFile');
