// Batch 65 mpdragon2: the crystal's explosion has no fire (createExplosion), the dragon egg moves on the server, a player waiting for the credits is out of the End's mob view,
// and a multiplayer client draws the flying eye's portal trail itself. Bytecode facts (not executable here): ChunkProviderHell/End.func_147416_a return null; the dragon's destroyBlocksInAABB
// is setBlockToAir only (no aux 2001).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { END_OFFSET } from './multiplayer/client-dimensions.js';
import { RemoteDispense } from './multiplayer/client-dispense.js';
import { serverDragonEgg } from './multiplayer/server-egg.js';
import { spawnEyeTrail } from './eye-of-ender-live.js';
import { JavaRandom } from './java-random.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const END_PORTAL = 149, EGG = 171;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) { s.input('a', input()); s.tick(); } };
function endFixture() {
  const world = new World('mp-dragon2-b65');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const end = s.dimensions.end.n;
  return { s, a, end, mobs: end.mobs.mobs };
}

test('an end crystal explodes without fire (World.createExplosion: flaming false, smoking true)', { timeout: 120000 }, () => {
  const { mobs } = endFixture();
  const crystal = mobs.entities.find(e => e.type === 'ender_crystal');
  mobs.attackEntityFrom(crystal, 1);
  const ex = mobs.events.filter(v => v.explode);
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].explode.size, ex[0].explode.flaming, ex[0].explode.smoking], [6, false, true]);
});

test('the server moves a clicked dragon egg to the first air cell and keeps its metadata', () => {
  const world = new World('egg-b65');
  const [x, y, z] = [10, 40, 10];
  world.set(x, y, z, EGG, true, 3);
  const random = new JavaRandom(12345n);
  assert.equal(serverDragonEgg(world, x, y, z, random), true);
  assert.equal(world.get(x, y, z), 0);
  let found = null;
  for (let i = x - 15; i <= x + 15; i++) for (let j = y - 7; j <= y + 7; j++) for (let k = z - 15; k <= z + 15; k++) if (world.get(i, j, k) === EGG) found = [i, j, k];
  assert.ok(found, 'the egg is somewhere within the search box');
  assert.equal(world.getMeta(...found), 3);
  assert.equal(serverDragonEgg(world, x, y, z, random), false, 'no egg left at the old cell');
});

test('a right click on a dragon egg through the simulation teleports it', { timeout: 120000 }, () => {
  const world = new World('egg-click-b65');
  world.spawn = () => ({ x: 64.5, y: 40, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  const a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 40, z: 64.5 }); a.previous.copy(a.position); a.moved = true;
  world.set(64, 41, 62, EGG, true, 0);
  assert.equal(s.edit(a, true), true);
  assert.equal(world.get(64, 41, 62), 0, 'the egg left its cell');
  let n = 0;
  for (let i = 49; i <= 79; i++) for (let j = 33; j <= 47; j++) for (let k = 47; k <= 77; k++) if (world.get(i, j, k) === EGG) n++;
  assert.equal(n, 1, 'exactly one egg in the search box');
});

test('a player waiting for the credits leaves the End mobs\' view (World.removeEntity), and is back in the Overworld\'s after the respawn', { timeout: 120000 }, () => {
  const { s, a, end } = endFixture();
  tick(s, 2);
  assert.equal(end.mobs.views.has(a.id), true);
  assert.equal(end.mobs.mobs.dragonViews().length, 1);
  a.world.set(60, 64, 60, END_PORTAL, true, 0);
  a.position.copy({ x: 60.5, y: 64, z: 60.5 }); a.previous.copy(a.position);
  tick(s);
  assert.equal(a.conquered, true);
  assert.equal(end.mobs.views.has(a.id), false, 'no target for the End mobs');
  assert.equal(end.mobs.mobs.dragonViews().length, 0, 'no wing hit or push');
  tick(s, 5);
  assert.equal(end.mobs.views.has(a.id), false, 'still out while the credits run');
  s.serverSurvival.respawn(a);
  assert.equal(a.dimension | 0, 0);
  assert.equal(end.mobs.views.has(a.id), false);
});

test('a client copy of a flying eye draws the portal trail every tick from its own motion', () => {
  const trail = [];
  const rd = new RemoteDispense({ eyeTrail: (row, vx, vy, vz) => trail.push([row.x, row.y, row.z, vx, vy, vz]) });
  rd.apply({ type: 'dispEnts', ents: [{ k: 'b', i: 5, kind: 'eyeOfEnder', x: 1, y: 70, z: 2 }] });
  rd.apply({ type: 'dispEnts', ents: [{ k: 'b', i: 5, kind: 'eyeOfEnder', x: 1.5, y: 70.25, z: 2.5 }] });
  rd.apply({ type: 'dispEnts', ents: [{ k: 'b', i: 6, kind: 'snowball', x: 1, y: 70, z: 2 }] });
  assert.equal(trail.length, 2, 'only eyes');
  assert.deepEqual(trail[1], [1.5, 70.25, 2.5, 0.5, 0.25, 0.5]);
  const spawned = [];
  spawnEyeTrail({ spawn: (...a) => spawned.push(a) }, { x: 1.5, y: 70.25, z: 2.5 }, 0.5, 0.25, 0.5, new JavaRandom(1n));
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][0], 'portal');
  assert.equal(spawned[0][2], 70.25 - 0.25 * 0.25 - 0.5);
  const bubbles = [];
  spawnEyeTrail({ spawn: (...a) => bubbles.push(a[0]) }, { x: 0, y: 0, z: 0 }, 0, 0, 0, undefined, true);
  assert.deepEqual(bubbles, ['bubble', 'bubble', 'bubble', 'bubble']);
});
