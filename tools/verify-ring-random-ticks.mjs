// Records the 1.7.10 bytecode facts behind random block ticks in the headless ring (natural-spawning.md "Round 8",
// weather.js tickChunk / activeChunks, headless-columns.js randomTickChunks, streaming-ticks.js ringRandomActive) into
// public/research/ring-random-ticks-reference.json:
//  - WorldServer.func_147456_g (mt.g) walks activeChunkSet (field F) and, per chunk, runs the mood step, Chunk.func_150804_b, the
//    lightning roll, the one-in-16 ice and snow step, and then for every ExtendedBlockStorage with getNeedsRandomTick (apz.b) exactly
//    three draws (iconst_3 loop bound) of Block.tickRandomly (aji.t) -> Block.updateTick (aji.a). It makes no chunk-existence test
//    (checkChunksExist) of its own: the chunk itself is all it needs;
//  - BlockLeaves.updateTick (alt.a) decays only when checkChunksExist(x - 5, y - 5, z - 5, x + 5, y + 5, z + 5) holds (b0 = 4, b1 = b0 + 1),
//    which is the 5-block reach the port uses for leaves at the rim of the ring;
//  - WorldServer.tickUpdates (mt.a(Z)) runs scheduled ticks (fire included) with b0 = 0 (ring-ticks-reference.json).
// Reads the unchanged classes with the JDK's javap (no game code runs). Same jar lookup as the other verify-*.mjs tools.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'ring-random-ticks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const names = { mt: 'WorldServer', alt: 'BlockLeaves' };
await exec('unzip', ['-q', '-o', jar, ...Object.keys(names).map((c) => c + '.class'), '-d', out]);
const code = {};
for (const c of Object.keys(names)) code[c] = (await exec('javap', ['-c', '-p', path.join(out, c + '.class')], { maxBuffer: 1 << 26 })).stdout;
const method = (c, sig) => {
  const lines = code[c].split('\n'), at = lines.findIndex((l) => l.trim() === sig);
  assert.ok(at >= 0, `${c} ${sig}`);
  const body = [];
  for (let i = at + 1; i < lines.length && lines[i].trim() !== ''; i++) if (lines[i].trim() !== 'Code:') body.push(lines[i].trim());
  return body;
};
const ops = (body) => body.map((l) => l.replace(/^\d+:\s*/, '').replace(/\s+\/\/\s*/, ' // ').replace(/#\d+(,\s*\d+)?\s*/, ''));
const CHUNK_TESTS = /Method (ahb\.)?(b:\(IIIIII\)Z|d:\(III\)Z|c:\(II\)Z)/;

// mt.g: activeChunkSet, then per chunk the steps in order, then the section loop with three draws.
const g = ops(method('mt', 'protected void g();'));
const at = (re, from = 0) => { const i = g.findIndex((l, k) => k >= from && re.test(l)); assert.ok(i >= 0, String(re)); return i; };
const iter = at(/Field F:Ljava\/util\/Set;/), mood = at(/Method a:\(IILapx;\)V/, iter), light = at(/Method apx\.b:\(Z\)V/, mood);
const thunder = at(/Method java\/util\/Random\.nextInt:\(I\)I/, light), ice = at(/bipush\s+16/, thunder);
const sections = at(/Method apx\.i:\(\)\[Lapz;/, ice), needs = at(/Method apz\.b:\(\)Z/, sections), draws = g.findIndex((l, k) => k > sections && l === 'iconst_3' && g[k + 1].startsWith('if_icmpge'));
const tickRandomly = at(/Method aji\.t:\(\)Z/, needs), updateTick = at(/Method aji\.a:\(Lahb;IIILjava\/util\/Random;\)V/, tickRandomly);
assert.ok(iter < mood && mood < light && light < thunder && thunder < ice && ice < sections && sections < needs && needs < draws && draws < tickRandomly && tickRandomly < updateTick, 'step order');
assert.equal(g.filter((l) => CHUNK_TESTS.test(l)).length, 0, 'func_147456_g has no checkChunksExist of its own');
assert.equal(g.filter((l, k) => k > sections && l === 'iconst_3' && g[k + 1].startsWith('if_icmpge')).length, 1, 'one section draw loop');

// BlockLeaves.updateTick: b0 = 4, b1 = b0 + 1, checkChunksExist over +/- b1 before any decay work.
const leaves = ops(method('alt', 'public void a(ahb, int, int, int, java.util.Random);'));
const b0 = leaves.findIndex((l, i) => l === 'iconst_4' && leaves[i + 1] === 'istore        7'), b1 = leaves.findIndex((l, i) => l === 'iload         7' && leaves[i + 1] === 'iconst_1' && leaves[i + 2] === 'iadd' && leaves[i + 3] === 'istore        8');
const check = leaves.findIndex((l) => CHUNK_TESTS.test(l));
assert.ok(b0 > 0 && b1 > b0 && check > b1, 'leaf decay range');
assert.equal(leaves.slice(check - 24, check).filter((l) => l === 'iload         8').length, 6, 'all six bounds use b1');

const digest = async (c) => createHash('sha256').update(await readFile(path.join(out, c + '.class'))).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: 'javap -c -p of the unchanged classes (tools/verify-ring-random-ticks.mjs); the asserted instruction sequences are stored below.',
  facts: {
    randomTickSource: 'activeChunkSet (mt.g field F)',
    perChunkSteps: ['mood (ahb.a(II, apx))', 'Chunk.func_150804_b(false)', 'lightning roll', 'ice and snow (1 in 16)', 'sections with getNeedsRandomTick'],
    drawsPerSection: 3,
    chunkExistsTestInRandomTick: false,
    leafDecayReach: 5,
    leafDecayNeedsChunksExist: true,
    tickUpdatesRange: 0,
  },
  bytecode: {
    'mt.g() sections': g.slice(sections - 2, updateTick + 3),
    'alt.a() range': leaves.slice(b0 - 1, check + 1),
  },
};
await writeFile(path.join(root, '../public/research/ring-random-ticks-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('ring random ticks reference: draws per section', reference.facts.drawsPerSection, ', chunk tests in func_147456_g', 0, ', leaf decay reach', reference.facts.leafDecayReach);
