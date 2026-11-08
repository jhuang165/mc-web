// Records the 1.7.10 bytecode facts behind the batch 28 dimension rules into public/research/dimension-rules-reference.json
// ("bytecode-read": javap -c -p -constants over every class of the jar; no game class runs here; the runtime evidence for the provider flags and
// World.getActualHeight is the unchanged-class light-engine3-reference.json providers, replayed by src/dimension-rules.test.js).
//  1. Every reader of WorldProvider.f (isHellWorld, WorldProviderHell only), WorldProvider.g (hasNoSky, Hell and End) and of
//     World.getActualHeight (ahb.S) over the whole jar, by class and method.
//  2. The World constructors: World.rand (ahb.s) is `new Random()` and World.updateLCG (ahb.k) is `new Random().nextInt()`, both unseeded and
//     per World instance (every WorldServer, so the Nether and the End have their own); WorldServer's constructor does not reseed them.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'dimension-rules-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-x', 'org/*', 'com/*', 'io/*', 'net/*', '-d', out], { maxBuffer: 1 << 26 });
const { stdout: ls } = await exec('ls', [out]);
const files = ls.split('\n').filter((f) => f.endsWith('.class')).map((f) => path.join(out, f));
const text = [];
for (let i = 0; i < files.length; i += 200) text.push((await exec('javap', ['-c', '-p', '-constants', ...files.slice(i, i + 200)], { maxBuffer: 1 << 30 })).stdout);
const lines = text.join('\n').split('\n');
const names = { abo: 'ItemBucket', adh: 'ItemMap', ahb: 'World', ahp: 'Teleporter', aho: 'SpawnerAnimals', ahr: 'ChunkCache', akg: 'BlockDaylightDetector', akr: 'BlockDynamicLiquid', alp: 'BlockIce', alw: 'BlockLiquid', apx: 'Chunk', aqk: 'AnvilChunkLoader', aqu: 'ChunkProviderFlat', arm: 'WorldGen (flower family, reads hasNoSky)', aro: 'WorldGen (flower family, reads hasNoSky)', bjf: 'WorldClient', gx: 'S21PacketChunkData (extractor)', gz: 'S26PacketMapChunkBulk', mw: 'EntityPlayerMP', mt: 'WorldServer', ur: 'EntityAIMoveIndoors', aqo: 'WorldProvider' };
let cls = null, method = null;
const readers = { 'aqo.f': [], 'aqo.g': [], 'World.getActualHeight': [] }, seen = new Set();
for (const l of lines) {
  const c = l.match(/^(?:public |final |abstract |private |protected )*(?:class|interface) ([a-z0-9_$]+)/);
  if (c) { cls = c[1]; method = null; continue; }
  const m = l.match(/^  [A-Za-z].*\)(?: throws .*)?;$/);
  if (m) { method = l.trim(); continue; }
  let key = null;
  if (/Field aqo\.f:Z/.test(l)) key = 'aqo.f'; else if (/Field aqo\.g:Z/.test(l)) key = 'aqo.g'; else if (/Method (ahb|mt|bjf)\.S:\(\)I/.test(l)) key = 'World.getActualHeight';
  if (!key || !method) continue;
  const k = `${key}|${cls}|${method}`;
  if (!seen.has(k)) { seen.add(k); readers[key].push({ class: cls, name: names[cls] ?? '?', method }); }
}
const set = (key) => [...new Set(readers[key].map((r) => r.class))].sort();
// Expected: ItemBucket, BlockDynamicLiquid and BlockIce read isHellWorld only.
assert.deepEqual(set('aqo.f'), ['abo', 'akr', 'alp']);
assert.deepEqual(set('World.getActualHeight'), ['aho', 'ahp']);
for (const c of ['ahb', 'apx', 'adh', 'akg', 'alw', 'ur', 'mw', 'arm', 'aro']) assert.ok(set('aqo.g').includes(c), `aqo.g read by ${c}`);
assert.ok(!set('aqo.g').includes('abo') && !set('aqo.g').includes('alp'), 'ItemBucket and BlockIce do not read aqo.g');
// World.getActualHeight itself: aqo.g ? 128 : 256.
const at = lines.findIndex((l, i) => l === '  public int S();' && /Field aqo\.g:Z/.test(lines[i + 4] ?? ''));
assert.ok(at > 0 && /sipush\s+128/.test(lines[at + 6]) && /sipush\s+256/.test(lines[at + 8]), 'ahb.S = aqo.g ? 128 : 256');
// Constructors of World (ahb): both initialise rand and updateLCG unseeded.
const ctorOf = (header, sig) => {
  const s = lines.findIndex((l) => l.startsWith(header));
  const a = lines.findIndex((l, i) => i > s && l.trim().startsWith(sig));
  const body = []; for (let i = a + 1; i < lines.length && lines[i].trim() !== ''; i++) if (lines[i].trim() !== 'Code:') body.push(lines[i].trim().replace(/^\d+:\s*/, '').replace(/\s+\/\/\s*/, ' // ').replace(/#\d+(,\s*\d+)?\s*/, ''));
  return body;
};
const worldCtors = [];
const wStart = lines.findIndex((l) => l.startsWith('public abstract class ahb '));
let ctorCount = 0;
for (let i = wStart; i < lines.length && ctorCount < 2; i++) {
  if (/^  (public|protected) ahb\(/.test(lines[i])) {
    ctorCount++;
    const body = []; for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) if (lines[j].trim() !== 'Code:') body.push(lines[j].trim().replace(/^\d+:\s*/, '').replace(/\s+\/\/\s*/, ' // ').replace(/#\d+(,\s*\d+)?\s*/, ''));
    const rnd = body.filter((l) => /Random|Field (s|k):/.test(l));
    const seq = rnd.map((l) => (/^new/.test(l) ? 'new' : /Random\."<init>":\(\)V/.test(l) ? 'init()' : /Random\."<init>":\(J\)V/.test(l) ? 'init(long)' : /nextInt:\(\)I/.test(l) ? 'nextInt()' : /nextInt:\(I\)I/.test(l) ? 'nextInt(int)' : /^putfield.*Field k:I/.test(l) ? 'put k' : /^putfield.*Field s:/.test(l) ? 'put s' : /^getfield.*Field s:/.test(l) ? 'get s' : l)).join(' ');
    // updateLCG: new Random().nextInt(); rand: new Random(); then the first draw from rand (World.ambientTickCountdown = rand.nextInt(12000)).
    assert.equal(seq, 'new init() nextInt() put k new init() put s get s nextInt(int)', 'unseeded rand and updateLCG, then ambientTickCountdown');
    worldCtors.push({ signature: lines[i].trim(), randomInstructions: rnd, sequence: seq });
  }
}
assert.equal(ctorCount, 2);
// WorldServer (mt) constructor: no Random of its own.
const mtStart = lines.findIndex((l) => l.startsWith('public class mt '));
let mtCtor = null;
for (let i = mtStart; i < lines.length; i++) if (/^  public mt\(/.test(lines[i])) { mtCtor = []; for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) mtCtor.push(lines[j]); break; }
assert.ok(mtCtor && !mtCtor.some((l) => /java\/util\/Random|Field (s|k):/.test(l)), 'WorldServer does not reseed rand or updateLCG');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6', classCount: files.length,
  method: 'javap -c -p -constants over every non-library class of the jar (tools/verify-dimension-rules.mjs); bytecode-read, no class was executed. Provider flags and World.getActualHeight at run time are in light-engine3-reference.json (unchanged classes).',
  providerFields: { 'aqo.f': 'isHellWorld: WorldProviderHell only', 'aqo.g': 'hasNoSky: WorldProviderHell and WorldProviderEnd', 'ahb.S': 'getActualHeight = aqo.g ? 128 : 256' },
  readers: Object.fromEntries(Object.entries(readers).map(([k, v]) => [k, v.sort((a, b) => (a.class + a.method).localeCompare(b.class + b.method))])),
  worldRandom: { rand: 'new Random() (unseeded)', updateLCG: 'new Random().nextInt() (unseeded)', perInstance: true, worldServerReseeds: false, constructors: worldCtors },
};
await writeFile(path.join(root, '../public/research/dimension-rules-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('dimension rules reference written;', Object.fromEntries(Object.entries(readers).map(([k, v]) => [k, v.length])));
