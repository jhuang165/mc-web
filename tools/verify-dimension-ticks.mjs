// Records the 1.7.10 bytecode facts behind the Nether and End chunk loop (natural-spawning.md "Round 9", weather.js tickDimension,
// fluids.js skyless/nether, fire.js End bedrock, snow.js meltResult hell, nether-portal-live.js) into
// public/research/dimension-ticks-reference.json. Reads the unchanged classes with javap (no game code runs): "bytecode-read".
//  - WorldServer.func_147456_g (mt.g) reads no WorldProvider field, so the Nether and End run the same chunk loop as the Overworld;
//  - World.updateWeatherBody (ahb.o) is skipped where WorldProvider.g (hasNoSky: Hell and End set it); the mood step (ahb.a(II, apx)) is
//    server-side only (World.isRemote, ahb.E, ends it) and draws for every chunk of activeChunkSet while ambientTickCountdown is 0;
//  - WorldProvider fields: Hell sets f (isHellWorld), g (hasNoSky), dimensionId -1; End sets g and dimensionId 1 only;
//  - BlockLiquid.tickRate (alw.a(ahb)): lava 10 where g, else 30; BlockDynamicLiquid.updateTick (akr.a) level step reads f;
//  - BlockIce (alp): updateTick and harvestBlock read f (air instead of water);
//  - BlockFire (alb): eternal over netherrack, and over bedrock when the provider is WorldProviderEnd (aqr); onBlockAdded lights a portal
//    only where dimensionId <= 0;
//  - BlockPortal.updateTick (amp.a) spawns a pigman only where isSurfaceWorld (aqo.d()) (false in both);
//  - BiomeGenHell and BiomeGenEnd are built with setDisableRain (ahu.b: enableRain = false), so no lightning, snow or cauldron fill.
import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url'; import path from 'node:path'; import { createHash } from 'node:crypto'; import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'dimension-ticks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const names = { mt: 'WorldServer', ahb: 'World', alw: 'BlockLiquid', akr: 'BlockDynamicLiquid', alp: 'BlockIce', alb: 'BlockFire', amp: 'BlockPortal', aqp: 'WorldProviderHell', aqr: 'WorldProviderEnd', ahu: 'BiomeGenBase' };
await exec('unzip', ['-q', '-o', jar, ...Object.keys(names).map((c) => c + '.class'), '-d', out]);
const code = {};
for (const c of Object.keys(names)) code[c] = (await exec('javap', ['-c', '-p', '-constants', path.join(out, c + '.class')], { maxBuffer: 1 << 26 })).stdout;
const method = (c, sig) => {
  const lines = code[c].split('\n'), at = lines.findIndex((l) => l.trim() === sig);
  assert.ok(at >= 0, `${c} ${sig}`);
  const body = [];
  for (let i = at + 1; i < lines.length && lines[i].trim() !== ''; i++) if (lines[i].trim() !== 'Code:') body.push(lines[i].trim());
  return body;
};
const ops = (body) => body.map((l) => l.replace(/^\d+:\s*/, '').replace(/\s+\/\/\s*/, ' // ').replace(/#\d+(,\s*\d+)?\s*/, ''));
const providerReads = (body) => body.filter((l) => /Field (ahb\.t:Laqo;|aqo\.[a-z]:)|Method aqo\./.test(l));
const field = (body, re) => body.some((l) => re.test(l));

// WorldServer.func_147456_g: no provider access of its own beyond the super call (ahb.g).
const g = ops(method('mt', 'protected void g();'));
assert.equal(providerReads(g).length, 0, 'func_147456_g reads no WorldProvider');
// World.updateWeatherBody (ahb.o): first thing is the aqo.g test.
const o = ops(method('ahb', 'protected void o();'));
assert.ok(o.slice(0, 8).some((l) => /Field aqo\.g:Z/.test(l)), 'updateWeatherBody tests aqo.g first');
// World.func_147467_a (ahb.a(int,int,apx)): countdown K, then isRemote E, then the lcg step.
const mood = ops(method('ahb', 'protected void a(int, int, apx);'));
const mK = mood.findIndex((l) => /Field K:I/.test(l)), mE = mood.findIndex((l) => /Field E:Z/.test(l)), mk = mood.findIndex((l) => /Field k:I/.test(l));
assert.ok(mK >= 0 && mK < mE && mE < mk && /^ifne/.test(mood[mK + 1]) && /^ifne/.test(mood[mE + 1]), 'mood: countdown, isRemote, then the lcg step');
// WorldProviders.
const hell = ops(method('aqp', 'public void b();')), end = ops(method('aqr', 'public void b();'));
const puts = (body) => body.filter((l) => /putfield/.test(l)).map((l) => l.match(/Field (\w+):/)[1]);
assert.deepEqual(puts(hell), ['e', 'f', 'g', 'i']); assert.deepEqual(puts(end), ['e', 'i', 'g']);
assert.ok(hell.some((l) => l === 'iconst_m1') && end.some((l) => l === 'iconst_1'));
const surface = (c) => ops(method(c, 'public boolean d();')).join(' ');
assert.equal(surface('aqp'), 'iconst_0 ireturn'); assert.equal(surface('aqr'), 'iconst_0 ireturn');
// BlockLiquid.tickRate: water 5, lava 10 if aqo.g else 30.
const tick = ops(method('alw', 'public int a(ahb);'));
assert.ok(field(tick, /iconst_5/) && field(tick, /bipush\s+10/) && field(tick, /bipush\s+30/) && field(tick, /Field aqo\.g:Z/) && !field(tick, /Field aqo\.f:Z/), 'tickRate reads aqo.g');
// BlockDynamicLiquid.updateTick level step reads aqo.f.
const dyn = ops(method('akr', 'public void a(ahb, int, int, int, java.util.Random);'));
assert.deepEqual(dyn.filter((l) => /Field aqo\.[fg]:Z/.test(l)).map((l) => l.match(/aqo\.[fg]/)[0]), ['aqo.f'], 'level step reads aqo.f only');
// BlockIce: random tick and harvestBlock both test aqo.f and call setBlockToAir (ahb.f(III)Z) before anything else.
const iceTick = ops(method('alp', 'public void a(ahb, int, int, int, java.util.Random);')), iceHarvest = ops(method('alp', 'public void a(ahb, yz, int, int, int, int);'));
for (const b of [iceTick, iceHarvest]) { const i = b.findIndex((l) => /Field aqo\.f:Z/.test(l)); assert.ok(i > 0 && /Method ahb\.f:\(III\)Z/.test(b[i + 6] ?? b[i + 7] ?? ''), 'ice: aqo.f then setBlockToAir'); }
// BlockFire.updateTick: netherrack, then `ahb.t instanceof aqr` and the block below == Blocks.bedrock (ajn.h).
const fire = ops(method('alb', 'public void a(ahb, int, int, int, java.util.Random);'));
const inst = fire.findIndex((l) => /instanceof .*class aqr/.test(l)), net = fire.findIndex((l) => /Field ajn\.aL:Laji;/.test(l)), bed = fire.findIndex((l) => /Field ajn\.h:Laji;/.test(l));
assert.ok(net > 0 && inst > net && bed > inst, 'fire: netherrack, End, bedrock');
const added = ops(method('alb', 'public void b(ahb, int, int, int);'));
const di = added.findIndex((l) => /Field aqo\.i:I/.test(l));
assert.ok(di > 0 && /^ifgt/.test(added[di + 1]) && added.some((l) => /Method amp\.e:\(ahb, int, int, int\)Z|Method amp\.e:/.test(l)), 'fire onBlockAdded: dimensionId > 0 skips the portal');
// BlockPortal.updateTick: aqo.d() first.
const portal = ops(method('amp', 'public void a(ahb, int, int, int, java.util.Random);'));
const pd = portal.findIndex((l) => /Method aqo\.d:\(\)Z/.test(l)), pg = portal.findIndex((l) => /String doMobSpawning/.test(l)), pn = portal.findIndex((l) => /nextInt:\(I\)I/.test(l));
assert.ok(pd > 0 && pd < pg && pg < pn, 'portal updateTick: isSurfaceWorld, doMobSpawning, then the nextInt(2000) draw');
// Biomes: Hell and Sky are built with b() (enableRain = false).
const setDisableRain = ops(method('ahu', 'protected ahu b();'));
assert.ok(setDisableRain.some((l) => /putfield.*Field ax:Z/.test(l)) && setDisableRain.some((l) => l === 'iconst_0'));
const clinit = code.ahu.split('\n'), hellAt = clinit.findIndex((l) => /String Hell/.test(l)), skyAt = clinit.findIndex((l) => /String Sky/.test(l));
assert.ok(/Method b:\(\)Lahu;/.test(clinit[hellAt + 2]) && /Method b:\(\)Lahu;/.test(clinit[skyAt + 2]), 'Hell and Sky call setDisableRain');
// World.getActualHeight (ahb.S) reads aqo.g too (the End is 128 tall there).
const actual = ops(method('ahb', 'public int S();'));
assert.ok(actual.some((l) => /Field aqo\.g:Z/.test(l)));

const digest = async (c) => createHash('sha256').update(await readFile(path.join(out, c + '.class'))).digest('hex');
const reference = {
  target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6',
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: 'javap -c -p -constants of the unchanged classes (tools/verify-dimension-ticks.mjs); bytecode-read, no class was executed. The asserted instruction sequences are stored below.',
  facts: {
    worldServerLoopReadsProvider: false,
    weatherTimersSkippedWhen: 'aqo.g (hasNoSky: Nether and End)',
    providerFields: { 'aqo.f': 'isHellWorld: set by WorldProviderHell only', 'aqo.g': 'hasNoSky: set by WorldProviderHell and WorldProviderEnd', 'aqo.i': 'dimensionId: -1 and 1', note: 'dimensions.js labels these two fields the other way round (its hasNoSky is aqo.f, its isHellWorld aqo.g)' },
    lavaTickRate: { water: 5, lavaWhereG: 10, lavaOtherwise: 30, field: 'aqo.g' },
    lavaLevelStepField: 'aqo.f',
    iceHellField: 'aqo.f',
    iceMeltsToAirIn: 'Nether',
    fireEndBedrock: true,
    firePortalAttemptWhen: 'dimensionId <= 0',
    portalUpdateTickNeeds: 'aqo.d() isSurfaceWorld',
    isSurfaceWorld: { Nether: false, End: false },
    biomesDisableRain: ['Hell', 'Sky'],
    moodIsServerSide: true,
    moodDrawsForEveryActiveChunkWhileCountdownIsZero: true,
    actualHeightField: 'aqo.g (End is 128 tall in World.getActualHeight)',
  },
  bytecode: {
    'mt.g()': g.filter((l) => /Method (a|b|c):|Field F:/.test(l)).slice(0, 12),
    'ahb.o() head': o.slice(0, 8),
    'ahb.a(II,apx) head': mood.slice(0, 16),
    'aqp.b()': hell, 'aqr.b()': end,
    'alw.a(ahb)': tick,
    'alb.a() End branch': fire.slice(inst - 2, bed + 4),
    'alb.b() portal': added.slice(0, 12),
  },
};
await writeFile(path.join(root, '../public/research/dimension-ticks-reference.json'), JSON.stringify(reference, null, 1) + '\n');
console.log('dimension ticks reference written; loop reads provider:', false);
