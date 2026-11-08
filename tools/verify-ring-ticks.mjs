// Records the 1.7.10 bytecode facts behind ticking vehicles, fireballs, portal travel, fluids and redstone in the headless ring
// (natural-spawning.md "Round 7", streaming-ticks.js ringEntityActive / ringBlockTickActive, fireballs.js blockExists) into
// public/research/ring-ticks-reference.json:
//  - EntityMinecart.onUpdate (xl.h) and EntityBoat.onUpdate (xi.h) make no chunk test of their own, so the +/- 32 block
//    checkChunksExist of World.updateEntityWithOptionalForce (ring-entities-reference.json) is their only gate; xl.h carries its
//    own "portal" section;
//  - EntityFireball.onUpdate (ze.h) sets the ball dead when its shooter is dead or !World.blockExists((int) x, (int) y, (int) z);
//    World.blockExists (ahb.d(III)) is false outside 0 <= y < 256, else chunkExists; EntityLargeFireball (zg),
//    EntitySmallFireball (zi) and EntityWitherSkull (zp) extend ze without overriding h();
//  - Entity.onEntityUpdate (sa.C) runs its "portal" section (travelToDimension, sa.b(I)) with no chunk test: every updated entity;
//  - WorldServer.scheduleBlockUpdateWithPriority (mt.a(IIILaji;II)) adds an entry only when checkChunksExist over +/- b0 holds,
//    b0 = 0 (8 only while scheduledUpdatesAreImmediate); tickUpdates (mt.a(Z)) runs a due entry with b0 = 0;
//  - World.setActivePlayerChunksAndCheckLight (ahb.C) fills activeChunkSet with the chunks within p() of each player, and
//    WorldServer.p() is the server's view distance (MinecraftServer.ah().s()); WorldServer.func_147456_g (mt.g) random-ticks
//    exactly that set.
// Reads the unchanged classes with the JDK's javap (no game code runs). Same jar lookup as the other verify-*.mjs tools.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'ring-ticks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const names = { ahb: 'World', mt: 'WorldServer', sa: 'Entity', xl: 'EntityMinecart', xi: 'EntityBoat', ze: 'EntityFireball', zg: 'EntityLargeFireball', zi: 'EntitySmallFireball', zp: 'EntityWitherSkull' };
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

// Vehicles: no chunk test in onUpdate.
const cart = ops(method('xl', 'public void h();')), boat = ops(method('xi', 'public void h();'));
assert.equal(cart.filter((l) => CHUNK_TESTS.test(l)).length, 0, 'EntityMinecart.onUpdate has no chunk test');
assert.equal(boat.filter((l) => CHUNK_TESTS.test(l)).length, 0, 'EntityBoat.onUpdate has no chunk test');
assert.ok(cart.some((l) => l.includes('String portal')), 'EntityMinecart.onUpdate has its own portal section');

// EntityFireball.onUpdate: shooter dead or !blockExists((int) posX, (int) posY, (int) posZ) -> setDead, return.
const fb = ops(method('ze', 'public void h();'));
const fbExists = fb.findIndex((l) => l.includes('Method ahb.d:(III)Z'));
assert.ok(fbExists > 0 && fb.slice(0, fbExists).filter((l) => l === 'd2i').length === 3, 'blockExists of the truncated position');
assert.ok(fb.slice(0, fbExists).some((l) => l.includes('Field sv.K:Z')), 'the shooter isDead test comes first');
assert.ok(fb[fbExists + 1].startsWith('ifne') && fb[fbExists + 3].includes('Method B:()V') && fb[fbExists + 4] === 'return', 'else setDead and return');
const blockExists = ops(method('ahb', 'public boolean d(int, int, int);'));
assert.ok(blockExists.includes('sipush        256') && blockExists.some((l) => l.includes('Method c:(II)Z')), 'World.blockExists: 0 <= y < 256, then chunkExists');
const noOverride = Object.fromEntries(['zg', 'zi', 'zp'].map((c) => [c, !code[c].split('\n').some((l) => l.trim() === 'public void h();')]));
for (const c of ['zg', 'zi', 'zp']) {
  assert.ok(code[c].includes('extends ze'), `${c} extends EntityFireball`);
  assert.ok(noOverride[c], `${c} keeps EntityFireball.onUpdate`);
}

// Entity.onEntityUpdate: the portal section has no chunk test before travelToDimension.
const base = ops(method('sa', 'public void C();'));
const portal = base.findIndex((l) => l.includes('String portal')), travel = base.findIndex((l, i) => i > portal && l.includes('Method b:(I)V'));
assert.ok(portal > 0 && travel > portal);
assert.equal(base.slice(portal, travel).filter((l) => CHUNK_TESTS.test(l)).length, 0, 'portal travel needs only the entity update');

// WorldServer.scheduleBlockUpdateWithPriority: b0 = 0, 8 only while updates are immediate; checkChunksExist before the add.
const sched = ops(method('mt', 'public void a(int, int, int, aji, int, int);'));
assert.deepEqual(sched.slice(sched.indexOf('astore        7') + 1, sched.indexOf('astore        7') + 3), ['iconst_0', 'istore        8']);
assert.ok(sched.includes('bipush        8'), 'b0 = 8 for immediate updates');
const schedCheck = sched.map((l, i) => (l.includes('Method b:(IIIIII)Z') ? i : -1)).filter((i) => i >= 0);
const add = sched.findIndex((l) => l.includes('TreeSet.add'));
assert.ok(schedCheck.length === 2 && schedCheck[1] < add, 'the entry is added only when its chunks exist');
// tickUpdates: b0 = 0.
const tu = ops(method('mt', 'public boolean a(boolean);'));
const tuCheck = tu.findIndex((l) => l.includes('Method b:(IIIIII)Z')), b0 = tu.findIndex((l, i) => i < tuCheck && l === 'istore        5');
assert.ok(tuCheck > 0 && b0 > 0 && tu[b0 - 1] === 'iconst_0', 'tickUpdates b0 = 0');

// Random block ticks: activeChunkSet = chunks within p() of each player; WorldServer.p() = view distance; mt.g iterates it.
const active = ops(method('ahb', 'protected void C();'));
assert.ok(active.some((l) => l.includes('Method p:()I')) && active.some((l) => l.includes('Set.add')), 'activeChunkSet over -p()..p()');
const p = ops(method('mt', 'protected int p();'));
assert.ok(p.some((l) => l.includes('MinecraftServer.ah:()Loi;')) && p.some((l) => l.includes('Method oi.s:()I')), 'view distance');
const g = ops(method('mt', 'protected void g();'));
assert.ok(g[1].includes('Method ahb.g:()V') && g.some((l) => l.includes('Field F:Ljava/util/Set;')), 'random ticks over activeChunkSet');

const digest = async (c) => createHash('sha256').update(await readFile(path.join(out, c + '.class'))).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: 'javap -c -p of the unchanged classes (tools/verify-ring-ticks.mjs); the asserted instruction sequences are stored below.',
  facts: {
    vehicleChunkTests: 0,
    minecartPortalSection: true,
    fireballBlockExists: true,
    blockExistsHeight: 256,
    fireballSubclassesKeepOnUpdate: noOverride,
    portalChunkTests: 0,
    scheduleRange: 0,
    scheduleImmediateRange: 8,
    tickUpdatesRange: 0,
    randomTicks: 'activeChunkSet: chunks within the server view distance of each player',
  },
  bytecode: {
    'ze.h() head': fb.slice(0, fbExists + 5),
    'ahb.d(III)': blockExists,
    'sa.C() portal': base.slice(portal, travel + 1),
    'mt.a(IIILaji;II) head': sched.slice(0, 20),
    'mt.a(boolean) b0': tu.slice(b0 - 1, tuCheck + 2),
    'mt.p()': p,
  },
};
await writeFile(path.join(root, '../public/research/ring-ticks-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('ring ticks reference: vehicle chunk tests', reference.facts.vehicleChunkTests, ', fireball blockExists below y', reference.facts.blockExistsHeight, ', schedule +/-', reference.facts.scheduleRange, ', tickUpdates +/-', reference.facts.tickUpdatesRange);
