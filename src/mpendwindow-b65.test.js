// Batch 65 mpendwindow: the server End is the whole main island (a 256 x 256 window), and an End saved by 0.93.0 (128 x 128 window) still loads as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { restoreReplica } from './multiplayer/client.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { END_WINDOWS, FiniteDimensionWorld, END } from './multiplayer/client-dimensions.js';
import { DimensionWorld } from './dimension-world.js';
import { LightVolume } from './lighting.js';
import { buildExitPortal } from './multiplayer/server-end.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const OBSIDIAN = 22, STONE = 152, FULL = END_WINDOWS.full, OLD = END_WINDOWS.legacy;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const newSim = (saved = {}) => { const world = new World('mp-endwindow-b65'); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return new DedicatedSimulation(saved, { world, gameMode: 'creative', mobs: false }); };

test('a new End is 256 x 256 with the origin at native (-128, -128); the light grid is as wide', { timeout: 120000 }, () => {
  const s = newSim(), a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const w = a.world;
  assert.equal(w.size, 256); assert.equal(w.chunks.size, 256); assert.equal(w.maxX, 256);
  assert.equal(w.endWindow, 'full'); assert.deepEqual([w.originX, w.originZ], [-128, -128]);
  assert.equal(w.inside(255, 10, 255), true); assert.equal(w.inside(256, 10, 0), false);
  const light = s.dimensions.end.n.light;
  assert.equal(light.size, 256); assert.equal(light.sky.length, 256 * 256 * w.height);
  // the platform of the native entrance (100, 48..50, 0): 5 x 5 obsidian, the player stands on it
  const px = 100 + 128, pz = 128;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.equal(w.get(px + dx, 48, pz + dz), OBSIDIAN);
  assert.deepEqual([a.position.x, a.position.z], [px, pz]);
  assert.equal(s.dimensions.end.n.world, w);
});

test('the island is whole: end stone lies beyond the old window on every side, the replica agrees, and the wire names the layout', { timeout: 120000 }, () => {
  const s = newSim(), a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const w = a.world;
  // native cells outside the 0.93.0 window (x < -25 or x > 102 or z < -96 or z > 31)
  const outside = { west: 0, east: 0, north: 0, south: 0 };
  for (let x = 0; x < 256; x += 2) for (let z = 0; z < 256; z += 2) {
    const nx = x - 128, nz = z - 128;
    let hit = false;
    for (let y = 30; y < 90 && !hit; y++) if (w.get(x, y, z) === STONE) hit = true;
    if (!hit) continue;
    if (nx < -25) outside.west++; if (nx > 102) outside.east++; if (nz < -96) outside.north++; if (nz > 31) outside.south++;
  }
  assert.ok(outside.west > 200 && outside.south > 200, JSON.stringify(outside)); // the generator's island is centred near the origin
  const snap = s.snapshot('a');
  assert.equal(snap.dimension, 1); assert.equal(snap.window, 'full'); assert.equal(snap.columns.length, 256);
  const replica = restoreReplica(JSON.parse(JSON.stringify(snap)));
  assert.equal(replica.size, 256); assert.deepEqual([replica.originX, replica.originZ], [-128, -128]);
  assert.equal(replica.get(100 + 128, 48, 128), OBSIDIAN);
  assert.equal(replica.displayX, -128);
  // a replica cell at the far corner of the old island is the server's cell
  assert.equal(replica.get(5, 60, 5), w.get(5, 60, 5));
  new LightVolume(replica); // the client scene builds the same grid
});

test('every spike inside the window has its crystal, the exit portal and the dragon centre are at native (0, 0)', { timeout: 120000 }, () => {
  const s = newSim(), a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const end = s.dimensions.end.n, mobs = end.mobs.mobs;
  const crystals = mobs.entities.filter(e => e.type === 'ender_crystal');
  const expected = new DimensionWorld('mp-endwindow-b65', END).endCrystals(10, { cx0: -8, cx1: 7, cz0: -8, cz1: 7 })
    .filter(c => c.x + 128 >= 1 && c.x + 128 < 255 && c.z + 128 >= 1 && c.z + 128 < 255);
  assert.ok(crystals.length > 0);
  assert.equal(crystals.length, expected.length, 'one crystal per spike of the window');
  // b64's window kept at most 10; this one reaches into every direction of the island
  assert.ok(crystals.some(c => c.x - 128 < -25 || c.x - 128 > 102 || c.z - 128 < -96 || c.z - 128 > 31), 'a crystal beyond the old window');
  const dragon = mobs.entities.find(e => e.type === 'ender_dragon');
  assert.deepEqual([dragon.x, dragon.z], [128, 128]); assert.deepEqual(mobs.dragonCenter, { x: 128, z: 128 });
  // the portal the dying dragon builds is clamped to the window only at its very edge
  assert.deepEqual(mobs.dragonPortalAt(128, 128), [128, 128]);
  assert.deepEqual(mobs.dragonPortalAt(-300, 400), [6, 249]);
  buildExitPortal(end.world, 0, 0); // the dying dragon's portal at native (0, 0) lies at the middle of the window
  let portal = 0; for (let x = 120; x <= 136; x++) for (let z = 120; z <= 136; z++) for (let y = 0; y < 128; y++) if (end.world.get(x, y, z) === 149) portal++;
  assert.ok(portal >= 20, 'exit portal cells round the native centre, ' + portal);
  assert.equal(s.dimensions.end.saveField().dragon, 'alive'); assert.equal(s.dimensions.end.saveField().window, 'full');
});

test('an End saved by 0.93.0 loads as the 128 x 128 window it was stored in', { timeout: 120000 }, () => {
  // make a save, then rewrite the End record into the 0.93.0 shape: no `window`, edits in the old window's coordinates, no dragon alive
  const first = newSim(), a = first.addPlayer('a', 'Alice', key(1));
  first.dimensions.arrive(a, 1);
  a.world.set(1, 100, 1, 1, true, 0);
  const saved = JSON.parse(JSON.stringify(first.save()));
  const end = saved.dimensions.end;
  delete end.window; end.dragon = 'dead'; end.mobs = [];
  const oldX = 100 + OLD.x, oldZ = OLD.z; // the platform's centre in the old window
  end.edits = [[`${oldX},60,${oldZ}`, 1]]; // one stone block of the old End
  const me = saved.players.find(([k]) => k === key(1))[1]; me.x = oldX + 0.5; me.z = oldZ + 0.5;
  const again = newSim(saved), back = again.addPlayer('a2', 'Alice', key(1));
  assert.equal(back.dimension, 1);
  const w = back.world;
  assert.equal(w.size, 128); assert.equal(w.endWindow, 'legacy'); assert.deepEqual([w.originX, w.originZ], [-25, -96]);
  assert.equal(w.get(oldX, 60, oldZ), 1, 'the old edit is where it was');
  const snap = again.snapshot('a2');
  assert.equal(snap.window, 'legacy'); assert.equal(snap.columns.length, 64);
  const replica = restoreReplica(JSON.parse(JSON.stringify(snap)));
  assert.equal(replica.size, 128); assert.equal(replica.originX, -25);
  assert.equal(again.dimensions.end.n.light.size, 128);
  assert.equal(again.dimensions.end.saveField().window, 'legacy');
  // a snapshot from an older server has no `window` at all: the same legacy reading
  const bare = { ...snap }; delete bare.window;
  assert.equal(restoreReplica(JSON.parse(JSON.stringify(bare))).size, 128);
  assert.equal(new FiniteDimensionWorld('x', END).size, 128);
});

test('the Nether and the Overworld keep the 128 grid', () => {
  const nether = new FiniteDimensionWorld('mp-endwindow-b65', -1);
  assert.equal(nether.size, 128); assert.equal(nether.chunks.size, 64); assert.equal(nether.originX, 0);
  const over = new World('mp-endwindow-b65'); assert.equal(over.size, 128);
  assert.equal(new LightVolume(nether).size, 128);
});
