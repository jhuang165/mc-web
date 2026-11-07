// WorldServer.createSpawnPosition and the EntityPlayerMP placement (world-spawn.js). The reference is the unchanged jar's createSpawnPosition
// (tools/verify-spawn.mjs); see public/research/world-spawn.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { FlatChunkProvider, parseFlatInfo } from './flat-world.js';
import { nativeWorldSpawn, biomeLayerOptions, nativeSpawnGeneration, mapFeaturesOn } from './java-world.js';
import { JavaRandom } from './java-random.js';
import { BIOMES_TO_SPAWN_IN } from './biome-layers.js';
import { topSolidOrLiquidBlock, originalTerrainIsTop, playerSpawnPoint, canCoordinateBeSpawn, createSpawnPosition } from './world-spawn.js';
import { World } from './world.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/spawn-reference.json', import.meta.url), 'utf8'));
const TYPES = { default: 'default', largeBiomes: 'largeBiomes', amplified: 'amplified' };

test('the reference covers default, large biomes, amplified and the eight Superflat presets', () => {
  const kinds = new Map();
  for (const r of reference.records) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  assert.deepEqual([...kinds], [['default', 36], ['largeBiomes', 8], ['amplified', 8], ['flat', 32]]);
});

test('createSpawnPosition reproduces the native world spawn and getTopSolidOrLiquidBlock around it', () => {
  let walked = 0;
  for (const r of reference.records) {
    const seed = BigInt(r.seed), state = new BiomeTerrainState();
    const gen = r.kind === 'flat' ? new FlatChunkProvider(parseFlatInfo(r.preset)) : new ChunkProviderGenerate(seed, TYPES[r.kind], state, biomeLayerOptions(16));
    const label = `${r.kind} ${r.seed} ${r.preset ?? ''}`;
    const biome = gen.manager.findBiomePosition(0, 0, 256, BIOMES_TO_SPAWN_IN, new JavaRandom(seed));
    assert.deepEqual(biome ? [biome[0], biome[2]] : null, r.biomePos, label);
    const out = nativeWorldSpawn(gen, seed, state, r.kind);
    assert.deepEqual([out.x, out.y, out.z], r.spawn, label);
    if (out.steps) walked++;
    for (const [x, z, y] of r.topSolid) assert.equal(topSolidOrLiquidBlock(x, z, originalTerrainIsTop(out.blockAt)), y, `${label} ${x},${z}`);
  }
  assert.ok(walked > 20);
});

test('the walk stops on grass, gives up after 1000 steps and falls back to the origin without a spawn biome', () => {
  const manager = { findBiomePosition: () => null };
  const grass = (x, y, z) => (y <= 63 ? (y === 63 ? 2 : 3) : 0);
  assert.deepEqual(createSpawnPosition({ seed: 5n, manager, blockAt: grass }), { x: 0, y: 64, z: 0, foundBiome: false, steps: 0 });
  assert.equal(canCoordinateBeSpawn(7, 7, (x, y, z) => (y <= 63 ? 12 : 0)), false);
  const sand = createSpawnPosition({ seed: 5n, manager, blockAt: (x, y, z) => (y <= 63 ? 12 : 0) });
  assert.equal(sand.steps, 1000);
  const r = new JavaRandom(5n); let x = 0, z = 0;
  for (let i = 0; i < 1000; i++) { x += r.nextInt(64) - r.nextInt(64); z += r.nextInt(64) - r.nextInt(64); }
  assert.deepEqual([sand.x, sand.z], [x, z]);
});

test('the player is placed within the spawn protection fuzz and lifted out of blocks', () => {
  const random = new JavaRandom(99n), shadow = new JavaRandom(99n), calls = [];
  const p = playerSpawnPoint({ spawn: [100, 64, -40], random, topSolid: (x, z) => { calls.push([x, z]); return 70; }, collides: (x, y) => y < 72 });
  const dx = shadow.nextInt(20) - 10, dz = shadow.nextInt(20) - 10;
  assert.deepEqual(calls, [[100 + dx, -40 + dz]]);
  assert.deepEqual(p, { x: 100 + dx + 0.5, y: 72, z: -40 + dz + 0.5 });
  // Adventure mode and no-sky providers keep the exact spawn.
  assert.deepEqual(playerSpawnPoint({ spawn: [1, 5, 2], adventure: true, topSolid: () => assert.fail(), collides: () => false }), { x: 1.5, y: 5, z: 2.5 });
  assert.deepEqual(playerSpawnPoint({ spawn: [1, 5, 2], hasSky: false, topSolid: () => assert.fail(), collides: () => false }), { x: 1.5, y: 5, z: 2.5 });
  // The radius is max(5, protection - 6).
  const small = [];
  playerSpawnPoint({ spawn: [0, 0, 0], protectionSize: 0, random: new JavaRandom(1n), topSolid: (x, z) => { small.push(x, z); return 1; }, collides: () => false });
  assert.ok(small.every((v) => v >= -5 && v < 5));
});

test('generation gate: 18 and 19 use the native spawn, 12 to 17 keep the earlier origin', () => {
  for (const v of [12, 13, 15, 16, 17]) assert.equal(nativeSpawnGeneration(v), false);
  for (const v of [18, 19]) assert.equal(nativeSpawnGeneration(v), true);
  for (const v of [13, 15, 16, 18]) assert.equal(mapFeaturesOn(v), true);
  for (const v of [17, 19]) assert.equal(mapFeaturesOn(v), false);
  const old = new World('671', 'javaStreamed', 16, 'default'), fresh = new World('671', 'javaStreamed', 18, 'default');
  assert.equal(old.nativeSpawn, undefined);
  const biome = old.javaGenerator.manager.findBiomePosition(0, 0, 256, BIOMES_TO_SPAWN_IN, new JavaRandom(671n));
  assert.deepEqual([old.originX, old.originZ], [((biome[0] >> 4) - 4) * 16, ((biome[2] >> 4) - 4) * 16]);
  const ref = reference.records.find((r) => r.kind === 'default' && r.seed === '671');
  assert.deepEqual(fresh.nativeSpawn, ref.spawn);
  assert.deepEqual([fresh.originX, fresh.originZ], [((ref.spawn[0] >> 4) - 4) * 16, ((ref.spawn[2] >> 4) - 4) * 16]);
});

test('a generation 18 world places the player around its spawn', () => {
  const world = new World('671', 'javaStreamed', 18, 'default');
  world.streamAround(64, 64);
  const p = world.spawn(), sx = world.nativeSpawn[0] - world.originX, sz = world.nativeSpawn[2] - world.originZ;
  assert.ok(Math.abs(p.x - 0.5 - sx) <= 10 && Math.abs(p.z - 0.5 - sz) <= 10);
  assert.ok(p.y > 0);
});
