// Batch 64 mpend2: the End on the dedicated server, second round. Native End coordinates for what a player sees, the End's projectile lane in the save, the flying eye of ender,
// and the End's natural spawns with mobs switched on (the batch 63 test ran with mobs off, so "only endermen" held for an empty list).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { restoreReplica } from './multiplayer/client.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { END_WINDOWS } from './multiplayer/client-dimensions.js';
const END_OFFSET = END_WINDOWS.full; // b65 mpendwindow: a new End is the 256 window
import { strongholdsOf } from './multiplayer/server-eyes.js';
import { nearestStronghold, ITEM_EYE_OF_ENDER } from './eye-of-ender.js';
import { JavaRandom } from './java-random.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(options = {}, saved = {}) {
  const world = new World('mp-end-b64'); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode: options.mode ?? 'survival', mobs: options.mobs ?? false });
}
const ticks = (s, n) => { for (let i = 0; i < n; i++) s.tick(); };
const give = (p, count = 5) => { p.survival.inventory.main[0] = { id: ITEM_EYE_OF_ENDER, count, damage: 0 }; p.survival.selected = 0; };

test('the End replica knows its native coordinates (origin and display offset); the Nether and the Overworld keep none', { timeout: 120000 }, () => {
  const s = fixture();
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const w = a.world;
  assert.equal(w.originX, -END_OFFSET.x); assert.equal(w.originZ, -END_OFFSET.z);
  assert.equal(a.position.x + w.displayX, 100, 'F3 shows the native platform x'); assert.equal(a.position.z + w.displayZ, 0);
  const replica = restoreReplica(a.dimOut.find(m => m.type === 'dimRespawn').world);
  assert.equal(replica.originX, -END_OFFSET.x, 'the client replica has the same origin');
  const b = s.addPlayer('b', 'Bob', key(2));
  s.dimensions.arrive(b, -1);
  assert.equal(b.world.originX, 0); assert.equal(b.world.displayX, 0);
  assert.equal(s.world.originX ?? 0, 0);
});

test('the End has its own projectile lane: an arrow flies, is saved with the world and comes back in a new simulation', { timeout: 120000 }, () => {
  const s = fixture();
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const end = s.dimensions.end.n;
  assert.equal(end.dispense.dim, 1);
  assert.equal(end.dispense.world, end.world, 'the End instance reads the End world');
  assert.equal(s.dispense.laneFor(1), end.dispense);
  // an arrow stuck in the End's floor (the platform) and one in the Overworld lane
  const lane = s.dispense.laneFor(1);
  lane.arrows.list.push(lane.arrows.make({ x: a.position.x, y: a.position.y + 1, z: a.position.z, mx: 0.1, my: 0, mz: 0, yaw: 90, pitch: 0, rand: new JavaRandom(1n) }, new JavaRandom(1n), { shooter: null, pickup: 1 }));
  assert.equal(lane.arrows.list.length, 1);
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.ok(saved.projectiles?.lanes?.[1]?.arrows?.length === 1, 'dimension 1 lane saved');
  // reload: nobody is in the End yet, the arrow waits in a stand-in lane, then the End's instance adopts it
  const again = fixture({}, saved);
  assert.equal(again.dispense.laneFor(1).arrows.list.length, 1, 'stand-in lane holds the saved End arrow');
  const back = again.addPlayer('a2', 'Alice', key(1));
  assert.equal(back.dimension, 1);
  const inst = again.dimensions.end.n.dispense;
  assert.equal(inst.arrows.list.length, 1, 'the End instance adopted it');
  assert.equal(again.dispense.extra.has(1), false);
  assert.equal(again.save().projectiles.lanes[1].arrows.length, 1, 'and saves it again');
});

test('an eye of ender thrown in the air flies to the nearest stronghold; others see it; it drops or shatters; the stack is used up', { timeout: 120000 }, () => {
  const s = fixture();
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: a.position.x + 5, y: a.position.y, z: a.position.z });
  give(a, 3);
  const goal = nearestStronghold(strongholdsOf(s.world.seed), Math.trunc(a.position.x), Math.trunc(a.position.y + 1.62), Math.trunc(a.position.z));
  assert.ok(goal, 'the seed has strongholds');
  assert.equal(s.dispense.throwHeld(a), true);
  assert.equal(a.survival.inventory.main[0].count, 2, 'one eye used');
  const eyes = s.dispense.eyeSystem.system.eyes;
  assert.equal(eyes.length, 1);
  const eye = eyes[0];
  assert.ok(Math.abs(eye.y - (a.position.y + 1.62)) < 1e-5, 'spawned at eye height');
  const flat = Math.hypot(goal[0] - eye.x, goal[2] - eye.z);
  if (flat > 12) { assert.ok(Math.abs(Math.hypot(eye.tx - eye.x, eye.tz - eye.z) - 12) < 1e-6, 'aims 12 along the line'); assert.equal(eye.ty, eye.y + 8); } else assert.equal(eye.tx, goal[0]);
  assert.ok((eye.tx - eye.x) * (goal[0] - eye.x) + (eye.tz - eye.z) * (goal[2] - eye.z) > 0, 'towards the stronghold');
  s.input('a', input()); s.input('b', input());
  s.tick();
  assert.ok(b.dispOut?.some(m => m.type === 'dispEnts' && m.ents.some(e => e.kind === 'eyeOfEnder')), 'Bob sees the eye');
  // the saved eye comes back
  assert.ok(s.save().projectiles?.lanes?.[0]?.eyes?.eyes?.length === 1, 'an eye in flight is saved');
  eye.drops = true;
  ticks(s, 85);
  assert.equal(s.dispense.eyeSystem.system.eyes.length, 0, 'flight over');
  assert.ok(s.items.items.some(i => i.stack?.id === ITEM_EYE_OF_ENDER), 'it dropped as an item');
});

test('a shattering eye tells the clients (eyeShatter); about one in five shatters; Creative keeps the stack; nothing in the Nether', { timeout: 120000 }, () => {
  const s = fixture({ mode: 'creative' });
  const a = s.addPlayer('a', 'Alice', key(1));
  give(a, 1);
  let shatters = 0, drops = 0;
  for (let i = 0; i < 100; i++) {
    s.dispense.throwHeld(a);
    const eye = s.dispense.eyeSystem.system.eyes.at(-1);
    if (eye.drops) drops++; else shatters++;
    eye.age = 80; // the next tick is the last
  }
  assert.equal(a.survival.inventory.main[0].count, 1, 'Creative keeps the stack');
  assert.ok(shatters >= 8 && shatters <= 35, `about 1 in 5 shatters (${shatters} of 100)`);
  s.dispense.fx.length = 0;
  s.tick();
  assert.equal(s.dispense.fx.filter(e => e.k === 'eyeShatter').length, 0, 'fx are flushed in the tick');
  const t = fixture();
  const n = t.addPlayer('n', 'Nora', key(3));
  give(n, 2);
  t.dimensions.arrive(n, -1);
  assert.equal(t.dispense.throwHeld(n), true);
  assert.equal(n.survival.inventory.main[0].count, 2, 'no stronghold search in the Nether: the eye is kept');
  assert.equal(t.dispense._eyes?.active ?? false, false);
});

test('a shatter reaches the player as a dispFx event', { timeout: 120000 }, () => {
  const s = fixture();
  const a = s.addPlayer('a', 'Alice', key(1));
  give(a, 2);
  s.dispense.throwHeld(a);
  const eye = s.dispense.eyeSystem.system.eyes[0];
  eye.drops = false; eye.age = 80;
  s.input('a', input());
  s.tick();
  const fx = (a.dispOut ?? []).filter(m => m.type === 'dispFx').flatMap(m => m.events);
  assert.ok(fx.some(e => e.k === 'eyeShatter' && Number.isInteger(e.x)), 'eyeShatter event');
});

test('with mobs on, the End spawns enderman and only enderman, and they are really there', { timeout: 300000 }, () => {
  const s = fixture({ mobs: true });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  s.input('a', input());
  const seen = new Set();
  for (let i = 0; i < 600; i++) { s.tick(); for (const e of s.dimensions.end.n.mobs.mobs.entities) if (e.type !== 'ender_dragon' && e.type !== 'ender_crystal') seen.add(e.type); } // b64 lead: mpdragon's dragon and crystals are placed by population, not spawned
  assert.ok(s.dimensions.end.n.mobs.mobs.entities.length > 0, 'something spawned');
  assert.deepEqual([...seen], ['enderman']);
});
