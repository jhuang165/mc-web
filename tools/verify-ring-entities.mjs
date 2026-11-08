// Records the 1.7.10 bytecode facts behind ticking non-living entities in the headless ring (natural-spawning.md "Round 6",
// streaming-ticks.js ringEntityActive / ringTickActive, falling.js fall) into public/research/ring-entities-reference.json:
//  - World.updateEntities (ahb.h) updates every entity of loadedEntityList through updateEntity (ahb.g -> ahb.a(sa, true)) with no
//    type test, and updateEntityWithOptionalForce (ahb.a(sa, boolean)) returns unless checkChunksExist over +/- 32 blocks;
//  - WorldServer.updateEntityWithOptionalForce (mt.a(sa, boolean)) only tests animals (wf), water mobs (wu) and NPCs (yu) before
//    the super call, so item entities, orbs, arrows, throwables, falling blocks and TNT reach the same 32-block test;
//  - WorldServer.tickUpdates (mt.a(boolean)) runs a due entry when checkChunksExist over +/- b0 with b0 = 0 (its own chunk);
//  - BlockFalling.func_149830_m (akx.m) spawns EntityFallingBlock when checkChunksExist over +/- 32, else falls instantly:
//    setBlockToAir, walk down while func_149831_e, then setBlock(x, y, z, this) (metadata 0) when y > 0.
// Reads the unchanged classes with the JDK's javap (no game code runs). Same jar lookup as the other verify-*.mjs tools.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'ring-entities-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const names = { ahb: 'World', mt: 'WorldServer', akx: 'BlockFalling' };
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

// World.updateEntities: the loadedEntityList (field e) loop calls ahb.g(sa) for each entity, with no instanceof in the loop.
const h = ops(method('ahb', 'public void h();'));
const loopStart = h.findIndex((l) => l.includes('Field e:Ljava/util/List;')), loopEnd = h.findIndex((l, i) => i > loopStart && l.includes('Field g:Ljava/util/List;'));
assert.ok(loopStart > 0 && loopEnd > loopStart);
const loop = h.slice(loopStart, loopEnd);
assert.ok(loop.some((l) => l.startsWith('invokevirtual') && l.includes('Method g:(Lsa;)V')), 'updateEntity call');
assert.equal(loop.filter((l) => l.startsWith('instanceof')).length, 0, 'no entity type test in the loadedEntityList loop');
const g = ops(method('ahb', 'public void g(sa);'));
assert.deepEqual(g.slice(2, 4), ['iconst_1', 'invokevirtual // Method a:(Lsa;Z)V']);
const force = ops(method('ahb', 'public void a(sa, boolean);'));
const b32 = force.indexOf('bipush        32'), check = force.findIndex((l) => l.includes('Method b:(IIIIII)Z'));
assert.ok(b32 >= 0 && check > b32 && force[check + 1].startsWith('ifne') && force[check + 2] === 'return', 'updateEntityWithOptionalForce: 32-block checkChunksExist, else return');
// WorldServer.updateEntityWithOptionalForce: the only type tests before super.
const ws = ops(method('mt', 'public void a(sa, boolean);'));
const wsTypes = ws.filter((l) => l.startsWith('instanceof')).map((l) => l.split('class ')[1]);
assert.deepEqual(wsTypes, ['wf', 'wu', 'yu']);
assert.ok(ws.some((l) => l.includes('Method ahb.a:(Lsa;Z)V')), 'super call');
// WorldServer.tickUpdates: b0 = 0 before checkChunksExist.
const tu = ops(method('mt', 'public boolean a(boolean);'));
const tuCheck = tu.findIndex((l) => l.includes('Method b:(IIIIII)Z'));
const b0Store = tu.findIndex((l, i) => i < tuCheck && l === 'istore        5');
assert.ok(tuCheck > 0 && b0Store > 0 && tu[b0Store - 1] === 'iconst_0', 'tickUpdates b0 = 0');
// BlockFalling.func_149830_m.
const fall = ops(method('akx', 'private void m(ahb, int, int, int);'));
const fb = fall.indexOf('bipush        32'), fc = fall.findIndex((l) => l.includes('Method ahb.b:(IIIIII)Z'));
const air = fall.findIndex((l) => l.includes('Method ahb.f:(III)Z')), place = fall.findIndex((l) => l.includes('Method ahb.b:(IIILaji;)Z')), entity = fall.findIndex((l) => l.includes('class xj'));
assert.ok(fb >= 0 && fc > fb && air > fc && place > air && entity > place, 'BlockFalling: 32-block check, instant fall (setBlockToAir, setBlock without metadata), else EntityFallingBlock');
assert.ok(fall.slice(air, place).some((l) => l.startsWith('ifle')), 'the instant fall stops at y 0');

const digest = async (c) => createHash('sha256').update(await readFile(path.join(out, c + '.class'))).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: 'javap -c -p of the unchanged classes (tools/verify-ring-entities.mjs); the asserted instruction sequences are stored below.',
  facts: {
    updateEntitiesTypeTests: 0,
    updateEntityForce: true,
    entityCheckRange: 32,
    worldServerTypeTests: wsTypes,
    tickUpdatesRange: 0,
    fallingCheckRange: 32,
    instantFallMetadata: 0,
  },
  bytecode: {
    'ahb.g(sa)': g,
    'ahb.a(sa,boolean)': force.slice(0, check + 3),
    'mt.a(sa,boolean)': ws,
    'mt.a(boolean) b0': tu.slice(b0Store - 1, tuCheck + 2),
    'akx.m(ahb,int,int,int)': fall.slice(0, entity + 1),
  },
};
await writeFile(path.join(root, '../public/research/ring-entities-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('ring entities reference: entity check +/-', reference.facts.entityCheckRange, ', tickUpdates +/-', reference.facts.tickUpdatesRange, ', falling +/-', reference.facts.fallingCheckRange, ', WorldServer type tests', wsTypes.join(' '));
