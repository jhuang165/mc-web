import test from 'node:test';
import assert from 'node:assert/strict';
import { mobStepEvents, mobStepSound, canTriggerWalking, MOB_STEP_SOUNDS } from './mob-steps.js';
import { footstepSound } from './block-sounds.js';
import { LADDER } from './world.js';

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
  const [s] = mobStepEvents(flat(), e, { x: e.x - 0.1, y: e.y, z: e.z }, { hostile: true, random });
  assert.equal(s.sound, 'game.hostile.swim');
  assert.equal(s.volume, Math.fround(Math.sqrt(Math.fround(Math.fround(0.04) * 0.2)) * Math.fround(0.35)));
  assert.equal(s.pitch, Math.fround(1 + Math.fround(0.5) * 0.4));
  const pig = mob('pig', { inWater: true, vy: 9 });
  pig.stepDistance = 1.5;
  const [p] = mobStepEvents(flat(), pig, { x: pig.x - 0.1, y: pig.y, z: pig.z }, { random: () => 0.5 });
  assert.equal(p.sound, 'game.neutral.swim');
  assert.equal(p.volume, 1, 'the volume is capped at 1');
});
