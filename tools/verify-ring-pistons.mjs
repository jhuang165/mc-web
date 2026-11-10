// Records (javap bytecode-read, nothing executes) why redstone pistons and hoppers need no neighbour-chunk test of their own natively
// (natural-spawning.md "Batch 37", HeadlessColumns.reaches, LiveRedstone.eventActive / tileActive, hopper.js hopperActive):
//  - BlockPistonBase (app), BlockPistonMoving (apr), BlockPistonExtension (apq), TileEntityPiston (aps), TileEntityHopper (api) and
//    EntityMinecartHopper (xr) call no World chunk-existence test (checkChunksExist b(IIIIII)Z, chunkExists c(II)Z, blockExists
//    d(III)Z, getChunkFromBlockCoords is not one);
//  - World.updateEntities (ahb.h) updates a tile entity only after !isInvalid, hasWorldObj and blockExists(x, y, z) (its own chunk),
//    then calls TileEntity.updateEntity (aor.h), and TileEntityPiston.updateEntity and TileEntityHopper.updateEntity run through it.
// Writes public/research/ring-pistons-reference.json. Same jar lookup as tools/verify-ring-ticks.mjs.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'ring-pistons-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const names = { ahb: 'World', app: 'BlockPistonBase', apq: 'BlockPistonExtension', apr: 'BlockPistonMoving', aps: 'TileEntityPiston', api: 'TileEntityHopper', xr: 'EntityMinecartHopper', aor: 'TileEntity' };
await exec('unzip', ['-q', '-o', jar, ...Object.keys(names).map((c) => c + '.class'), '-d', out]);
const code = {};
for (const c of Object.keys(names)) code[c] = (await exec('javap', ['-c', '-p', path.join(out, c + '.class')], { maxBuffer: 1 << 26 })).stdout;
// World's chunk tests: checkChunksExist b(IIIIII)Z, chunkExists c(II)Z, blockExists d(III)Z (called on `ahb`, or unqualified inside it).
const TESTS = /Method (ahb\.)?(b:\(IIIIII\)Z|c:\(II\)Z|d:\(III\)Z)/;
const chunkTests = Object.fromEntries(Object.keys(names).filter((c) => c !== 'ahb' && c !== 'aor').map((c) => [names[c], code[c].split('\n').filter((l) => TESTS.test(l) && /ahb\./.test(l)).length]));
for (const [n, k] of Object.entries(chunkTests)) assert.equal(k, 0, `${n} makes no World chunk test`);
assert.ok(code.app.includes('bipush        13') || code.app.includes('bipush 13'), 'BlockPistonBase scans 13 cells');
// World.updateEntities: the tile loop.
const lines = code.ahb.split('\n'), at = lines.findIndex((l) => l.trim() === 'public void h();');
assert.ok(at > 0);
const body = []; for (let i = at + 1; i < lines.length && lines[i].trim() !== ''; i++) body.push(lines[i].trim().replace(/^\d+:\s*/, '').replace(/\s+\/\/\s*/, ' // ').replace(/#\d+(,\s*\d+)?\s*/, ''));
const first = body.findIndex((l) => l.includes('Method aor.r:()Z'));
assert.ok(first > 0, 'tile loop found');
const tile = body.slice(first, first + 16).filter((l) => /Method (aor\.(r:\(\)Z|o:\(\)Z|h:\(\)V)|d:\(III\)Z)/.test(l));
assert.deepEqual(tile.map((l) => l.replace(/^.*Method /, '')), ['aor.r:()Z', 'aor.o:()Z', 'd:(III)Z', 'aor.h:()V'], 'isInvalid, hasWorldObj, blockExists, updateEntity');
const digest = async (c) => createHash('sha256').update(await readFile(path.join(out, c + '.class'))).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: 'javap -c -p of the unchanged classes (tools/verify-ring-pistons.mjs): bytecode-read, nothing is executed.',
  facts: {
    worldChunkTestsInPistonAndHopperClasses: chunkTests,
    pistonLineCells: 13,
    tileLoop: 'World.updateEntities: !isInvalid, hasWorldObj, blockExists(x, y, z) (own chunk only), then updateEntity',
  },
  bytecode: { 'ahb.h() tile loop': body.slice(first - 2, first + 20) },
};
await writeFile(path.join(root, '../public/research/ring-pistons-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('ring pistons reference: chunk tests', JSON.stringify(chunkTests), ', tile loop', tile.map((l) => l.replace(/^.*Method /, '')).join(' > '));
