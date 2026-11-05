import test from 'node:test';
import assert from 'node:assert/strict';
import { World, BLOCKS, blockBounds } from './world.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { ITEMS } from './survival.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { SKULL, ITEM_SKULL, skullBounds, skullPose, skullRot, Skulls, tryBuildWither, skullDrops } from './skull.js';
import { WITHER_SKELETON_STATS, witherSkeletonDrops, witherHitEffect } from './wither-skeleton.js';
import { mobDrops } from './combat.js';
import { witherAccepts, witherArmored, witherSkullEffectTicks, WITHER } from './wither-rules.js';
import { JavaRandom } from './java-random.js';

test('skull block and item registration', () => {
  assert.equal(BLOCKS[172].name, 'Mob Head');
  assert.deepEqual(toOriginal(SKULL, 3), [144, 3]);
  assert.equal(fromOriginal(144, 5).id, SKULL);
  assert.equal(ORIGINAL_ITEMS[397], ITEM_SKULL);
  assert.equal(ITEMS[ITEM_SKULL].variants.length, 5);
  assert.deepEqual(skullBounds(1), [0.25, 0, 0.25, 0.75, 0.5, 0.75]);
  assert.deepEqual(skullBounds(5), [0, 0.25, 0.25, 0.5, 0.75, 0.75]);
  assert.deepEqual(skullPose(4, 0), { t: [0.74, 0.25, 0.5], angle: 270 });
  assert.equal(skullPose(1, 4).angle, 90);
  assert.equal(skullRot(180), 8);
  assert.deepEqual(skullDrops(4), [{ id: ITEM_SKULL, count: 1, damage: 4 }]);
});

test('skull tiles round trip', () => {
  const s = new Skulls(); s.create(1, 2, 3, 1, 5);
  assert.deepEqual(Skulls.fromJSON(s.toJSON()).tile(1, 2, 3), { x: 1, y: 2, z: 3, type: 1, rot: 5, owner: '' });
});

test('wither T-shape builds only from wither skulls on soul sand', () => {
  const cells = new Map(), world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, set: (x, y, z, id) => cells.set(`${x},${y},${z}`, id) };
  const skulls = new Skulls(), SAND = 151;
  for (const z of [9, 10, 11]) { world.set(5, 10, z, SAND); world.set(5, 11, z, SKULL); skulls.create(5, 11, z, 1); }
  world.set(5, 9, 10, SAND);
  let at = null;
  const built = tryBuildWither(world, skulls, 5, 11, 11, { difficulty: 2, soulSand: SAND, spawn: (...a) => { at = a; } });
  assert.equal(built.axis, 'z');
  assert.deepEqual(at, [5.5, 9.55, 10.5, 90]);
  assert.equal(world.get(5, 10, 10), 0);
  assert.equal(skulls.tiles.size, 0);
  assert.equal(tryBuildWither(world, skulls, 5, 11, 11, { difficulty: 0, soulSand: SAND }), null);
});

test('wither skeleton rules', () => {
  assert.equal(WITHER_SKELETON_STATS.height, Math.fround(2.34));
  assert.deepEqual(witherHitEffect(), { id: 20, duration: 200, amplifier: 0 });
  const r = new JavaRandom(7n);
  const ids = witherSkeletonDrops(r, { looting: 0 }).map((d) => d[0]);
  assert.ok(ids.every((i) => i === 263 || i === 352));
  assert.ok(mobDrops({ type: 'wither_skeleton' }, { playerHit: true }, new JavaRandom(3n)).every(([id]) => id !== 262));
});

test('wither constants', () => {
  assert.equal(WITHER.maxHealth, 300);
  assert.equal(witherArmored(150), true);
  assert.equal(witherAccepts({ invul: 5, health: 100 }), false);
  assert.equal(witherAccepts({ arrow: true, health: 100 }), false);
  assert.equal(witherSkullEffectTicks(3), 800);
  assert.equal(witherSkullEffectTicks(1), 0);
});
