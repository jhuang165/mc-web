import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mobStepEvents, mobStepSound, canTriggerWalking, isEntityMob, MOB_STEP_SOUNDS } from './mob-steps.js';
import { landingEffects } from './damage-fx.js';
import { internalIdsFor } from './block-registry.js';
import { footstepSound } from './block-sounds.js';
import { LADDER, SNOW_LAYER } from './world.js';

const GRASS = 2, STONE = 1;
const flat = (id = GRASS) => ({ get: (x, y, z) => (y <= 0 ? id : 0) });
const mob = (type, over = {}) => ({ type, x: 0.5, y: 1, z: 0.5, vx: 0, vy: 0, vz: 0, ...over });
// Walk `blocks` blocks east in 0.1-block ticks and collect every event.
function walk(e, world, blocks, opts = {}) {
  const events = [];
  for (let i = 0; i < blocks * 10; i++) {
    const from = { x: e.x, y: e.y, z: e.z };
    e.x += 0.1;
    events.push(...mobStepEvents(world, e, from, opts));
  }
  return events;
}

test('each mob class plays its own step event at the native volume', () => {
  const expected = {
    zombie: ['mob.zombie.step', 0.15], skeleton: ['mob.skeleton.step', 0.15], spider: ['mob.spider.step', 0.15],
    cave_spider: ['mob.spider.step', 0.15], pig: ['mob.pig.step', 0.15], cow: ['mob.cow.step', 0.15], mooshroom: ['mob.cow.step', 0.15],
    pigman: ['mob.zombie.step', 0.15], wither_skeleton: ['mob.skeleton.step', 0.15],
    sheep: ['mob.sheep.step', 0.15], chicken: ['mob.chicken.step', 0.15], iron_golem: ['mob.irongolem.walk', 1], wolf: ['mob.wolf.step', 0.15],
  };
  assert.deepEqual(Object.keys(MOB_STEP_SOUNDS).sort(), Object.keys(expected).sort());
  for (const [type, [name, volume]] of Object.entries(expected)) {
    const [event] = walk(mob(type), flat(), 3);
    assert.equal(event.sound, name, type);
    assert.equal(event.volume, Math.fround(volume), type);
    assert.equal(event.pitch, 1, type);
  }
});

test('a step plays each time the distance (0.6 per block) passes the next whole number', () => {
  const events = walk(mob('pig'), flat(), 6);
  // 6 blocks * 0.6 = 3.6 distance: steps as it passes 1, 2 and 3, i.e. after 1.67, 3.33 and 5 blocks from x 0.5.
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => +e.position.x.toFixed(1)), [2.2, 3.9, 5.6]);
});

test('creepers, villagers and witches use the block they stand on, like Entity.func_145780_a', () => {
  for (const type of ['creeper', 'villager', 'witch']) {
    const [grass] = walk(mob(type), flat(GRASS), 2), [stone] = walk(mob(type), flat(STONE), 2);
    assert.equal(grass.sound, footstepSound(GRASS).name, type);
    assert.equal(stone.sound, footstepSound(STONE).name, type);
    assert.notEqual(grass.sound, stone.sound);
    assert.equal(grass.volume, footstepSound(GRASS).volume);
  }
  assert.equal(mobStepSound('creeper', STONE).name, footstepSound(STONE).name);
});

test('silverfish never step, riders and airborne mobs make no sound', () => {
  assert.equal(canTriggerWalking('silverfish'), false);
  assert.deepEqual(walk(mob('silverfish'), flat(), 4), []);
  assert.deepEqual(walk(mob('zombie', { riding: {} }), flat(), 4), []);
  assert.deepEqual(walk(mob('zombie', { y: 5 }), flat(), 4), [], 'the cell below is air: the distance still grows but nothing plays');
});

test('the distance keeps growing over air, so landing steps at once', () => {
  const e = mob('zombie', { y: 5 }), world = flat();
  walk(e, world, 4);
  assert.ok(e.stepDistance > 2.3);
  e.y = 1;
  const from = { x: e.x, y: e.y, z: e.z };
  e.x += 0.1;
  assert.equal(mobStepEvents(world, e, from).length, 1);
  assert.equal(e.nextStep, Math.floor(e.stepDistance) + 1);
});

test('vertical movement counts only on a ladder', () => {
  const world = { get: (x, y, z) => (y === 1 ? LADDER : y <= 0 ? STONE : 0) };
  const e = mob('zombie', { y: 1.2 }), plain = mob('zombie', { y: 1.2 });
  mobStepEvents(world, e, { x: 0.5, y: 0.2, z: 0.5 });
  assert.equal(e.stepDistance, Math.fround(Math.fround(1) * 0.6), 'one block up the ladder is 0.6');
  mobStepEvents(flat(), plain, { x: 0.5, y: 0.2, z: 0.5 });
  assert.equal(plain.stepDistance, 0);
});

test('liquid cells are silent; a snow layer on top plays the snow step', () => {
  const water = { get: (x, y) => (y <= 0 ? 10 : 0) };
  assert.deepEqual(walk(mob('creeper'), water, 3), []);
  const snow = { get: (x, y) => (y === 1 ? 46 : y <= 0 ? STONE : 0) };
  const e = mob('creeper', { y: 0.2 });
  e.nextStep = 0;
  const [s] = walk(e, snow, 2);
  assert.equal(s.sound, 'step.snow');
});

test('in water a mob plays its swim sound instead, scaled by its speed', () => {
  const draws = [0.75, 0.25];
  const random = () => draws.shift();
  const e = mob('zombie', { inWater: true, vx: 0.2, vy: 0, vz: 0 });
  e.stepDistance = 1.5;
  const [s, step] = mobStepEvents(flat(), e, { x: e.x - 0.1, y: e.y, z: e.z }, { hostile: true, random });
  assert.equal(s.sound, 'game.hostile.swim');
  assert.equal(step.sound, 'mob.zombie.step', 'moveEntity then calls func_145780_a as well (a solid cell under the swimmer)');
  assert.equal(s.volume, Math.fround(Math.sqrt(Math.fround(Math.fround(0.04) * 0.2)) * Math.fround(0.35)));
  assert.equal(s.pitch, Math.fround(1 + Math.fround(0.5) * 0.4));
  const pig = mob('pig', { inWater: true, vy: 9 });
  pig.stepDistance = 1.5;
  const [p] = mobStepEvents(flat(), pig, { x: pig.x - 0.1, y: pig.y, z: pig.z }, { random: () => 0.5 });
  assert.equal(p.sound, 'game.neutral.swim');
  assert.equal(p.volume, 1, 'the volume is capped at 1');
});

// ---- native replay: public/research/mob-steps-reference.json (tools/probes/MobStepProbe.java, tools/verify-mob-steps.mjs) ----
const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL('../public/research/mob-steps-reference.json', import.meta.url), 'utf8'));
const records = (kind) => reference.records.filter((r) => r.case === kind);
const parse = (s) => { const [name, volume, pitch] = s.split('|'); return { name, volume: f(Number(volume)), pitch: f(Number(pitch)) }; };
const horseTypes = { horse: 0, donkey: 1, mule: 2, zombie_horse: 3, skeleton_horse: 4 };
const jsType = (t) => (t in horseTypes ? 'horse' : t === 'ocelot' || t === 'wolf' ? t : t);
const entity = (t, over = {}) => mob(jsType(t), t in horseTypes ? { horse: { type: horseTypes[t] }, ...over } : over);
const BLOCK_ORIGINAL = { stone: 1, grass: 2, gravel: 13, sand: 12, planks: 5, wool: 35, glass: 20, snow: 80, water: 9, lava: 11, soul_sand: 88, ladder: 65, iron_block: 42 };
const internal = (name) => internalIdsFor(BLOCK_ORIGINAL[name])[0];

test('reference: the pinned client and every browser mob are covered', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  const types = records('facts').map((r) => r.type);
  for (const t of ['pig', 'cow', 'mooshroom', 'sheep', 'chicken', 'wolf', 'ocelot', 'horse', 'zombie', 'pigman', 'skeleton', 'spider', 'cave_spider', 'creeper', 'enderman', 'silverfish', 'witch', 'villager', 'iron_golem', 'snow_golem', 'slime', 'magma_cube', 'squid', 'bat', 'blaze', 'ghast', 'wither', 'ender_dragon']) assert.ok(types.includes(t), t);
  assert.ok(records('step').length > 400 && records('cadence').length === types.length && records('fall').length === types.length * 7);
});

test('reference: canTriggerWalking and the EntityMob swim/fall category match', () => {
  for (const r of records('facts')) {
    assert.equal(canTriggerWalking(jsType(r.type)), r.canTriggerWalking, r.type);
    assert.equal(isEntityMob(jsType(r.type)), r.swim === 'game.hostile.swim', r.type);
  }
});

test('reference: func_145780_a sound, volume and pitch for every mob on every block, with and without snow above', () => {
  let checked = 0;
  for (const r of records('step')) {
    if (r.type in horseTypes && r.type !== 'horse') continue; // same class: types differ only when ridden
    if (r.type === 'silverfish') continue; // its mob.silverfish.step override is unreachable: canTriggerWalking is false
    const above = r.snowAbove ? SNOW_LAYER : 0, got = mobStepSound(jsType(r.type), internal(r.block), above, entity(r.type));
    if (r.sounds.length === 0) assert.equal(got, null, `${r.type} on ${r.block}`);
    else assert.deepEqual({ ...got }, parse(r.sounds[0]), `${r.type} on ${r.block}${r.snowAbove ? ' under snow' : ''}`);
    checked++;
  }
  assert.ok(checked > 350);
});

test('reference: step cadence over a 20 tick walk at 0.1 blocks per tick', () => {
  for (const r of records('cadence')) {
    if ((r.type in horseTypes && r.type !== 'horse') || r.type === 'ender_dragon') continue; // the dragon flies with its own movement, never through moveWith
    const e = entity(r.type, { x: 64.5, y: 0, z: 64.5 }), world = { get: (x, y) => (y < 0 ? internal('stone') : 0) }, ticks = [], sounds = [];
    for (let t = 0; t < r.ticks; t++) {
      const from = { x: e.x, y: e.y, z: e.z };
      e.x += 0.1;
      const events = mobStepEvents(world, e, from);
      if (events.length) { ticks.push(t); sounds.push(events.map((ev) => ev.sound)); }
    }
    assert.deepEqual(ticks, r.stepTicks, r.type);
    assert.deepEqual(sounds, r.sounds.map((l) => l.map((s) => parse(s).name)), r.type);
    if (r.stepTicks.length) assert.equal(e.nextStep, r.nextStep, r.type);
  }
});

test('reference: a ridden horse counts wood steps, then gallops every third step; donkeys and mules stay soft', () => {
  for (const rec of [{ type: 'horse', expect: ['wood', 'wood', 'wood', 'wood', 'wood', 'gallop', null, null, 'gallop', null, null, 'gallop'] }, { type: 'donkey', expect: Array(12).fill('soft') }]) {
    const e = entity(rec.type);
    e.rider = {};
    const names = Array.from({ length: 12 }, () => mobStepSound('horse', 1, 0, e)?.name ?? null);
    assert.deepEqual(names, rec.expect.map((n) => (n ? `mob.horse.${n}` : null)), rec.type);
  }
  const bare = entity('horse');
  assert.equal(mobStepSound('horse', internal('planks'), 0, bare).name, 'mob.horse.wood');
  assert.equal(mobStepSound('horse', internal('planks'), SNOW_LAYER, bare).name, 'mob.horse.soft');
});

test('reference: fall sound names by distance, landing step sound, and the mobs whose fall does nothing', () => {
  const NO_FALL = new Set(['chicken', 'bat', 'ocelot', 'snow_golem', 'iron_golem', 'magma_cube']);
  const stone = internal('stone');
  for (const r of records('fall')) {
    if (r.type in horseTypes || r.fatal) continue; // EntityHorse.fall is covered by horse-reference.json
    const native = r.sounds.map(parse).filter((s) => s.name.includes('hurt.fall') || s.name.startsWith('step.'));
    if (NO_FALL.has(r.type)) { assert.deepEqual(native, [], `${r.type} falls silently`); continue; }
    if (r.type === 'ender_dragon' || r.type === 'wither' || r.type === 'ghast' || r.type === 'blaze' || r.type === 'squid') continue;
    const { points, sounds } = landingEffects(r.distance, { kind: isEntityMob(jsType(r.type)) ? 'hostile' : 'neutral', blockUnder: stone });
    assert.equal(Math.max(0, points), r.lost, `${r.type} ${r.distance}`);
    assert.deepEqual(sounds.map((s) => ({ ...s })), native, `${r.type} ${r.distance}`);
  }
});
