// Batch 73 mpspawn73: the dedicated server has no flat mob cap any more. Natural spawning is limited per type by max * eligibleChunks / 256 over the union of
// the players' 17 x 17 chunk windows (SpawnerAnimals.findChunksForSpawning, bytecode-read: bipush 8 radius, sx.b() * HashMap.size() / 256), and the wire is bounded per player by
// tracker range. Facts: .shared-memory/notes/mpspawn73-b73-track.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { SPAWN_RUNAWAY_GUARD } from './entities.js';
import { MOB_LIMIT } from './multiplayer/server-mobs.js';
import { CREATURE_TYPES } from './spawn-lists.js';

const OLD_CAP = 80;
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const PATCHES = [20, 420, 820];
function fixture(patches = 1) {
  const world = new World('mpspawn73-b73');
  for (const x0 of PATCHES.slice(0, patches)) for (let x = x0; x <= x0 + 90; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: true });
  s.gameRules.doMobSpawning = 'false'; // spawnPass is called by hand below
  s.difficulty = 3; s.mobs.mobs.difficulty = 3; s.time = 18000;
  return s;
}
const join = (s, id, n, x, z = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); s.mobs.mobs.entities.length = 0; return p; }; // the join adds the generated population: start empty
const put = (s, type, x, z) => { const m = s.mobs.mobs.create(type, x, 10, z); m.persistent = false; s.mobs.mobs.entities.push(m); return m; };
const count = (s, name) => s.mobs.pass?.ctx.count(name) ?? 0;

test('MOB_LIMIT is the runaway guard, not 80', () => {
  assert.equal(MOB_LIMIT, SPAWN_RUNAWAY_GUARD);
  assert.ok(MOB_LIMIT > 1000);
});

test('the per-type cap counts are max * chunks / 256 (monster 70, creature 10, ambient 15, water 5)', () => {
  assert.deepEqual(CREATURE_TYPES.map(t => [t.name, t.max]), [['monster', 70], ['creature', 10], ['ambient', 15], ['waterCreature', 5]]);
  assert.deepEqual(CREATURE_TYPES.map(t => Math.trunc(t.max * 289 / 256)), [79, 11, 16, 5]);
});

test('past the old 80 mobs: animals and monsters of other types still spawn while their own cap allows', () => {
  const s = fixture(), p = join(s, 'a', 1, 64.5);
  for (let i = 0; i < 90; i++) put(s, 'pig', 40 + (i % 30) + 0.5, 50 + Math.floor(i / 30) * 3 + 0.5); // creature count 90 > 11: no more animals
  s.tick(); // creates the pass state, nothing spawns (doMobSpawning false)
  assert.ok(p);
  s.gameRules.doMobSpawning = 'true';
  const before = s.mobs.mobs.entities.length;
  for (let i = 0; i < 300; i++) s.mobs.spawnPass();
  const list = s.mobs.mobs.entities;
  assert.ok(list.length > OLD_CAP, `${list.length} mobs`);
  assert.equal(list.filter(e => e.type === 'pig').length, 90, 'no animal added over the creature cap');
  assert.ok(list.length > before, 'monsters spawned');
  const monsters = count(s, 'monster');
  assert.ok(monsters > 0 && monsters <= 79 + 4 * 3, `monsters ${monsters}`); // the cap test runs once per type pass, a group adds up to 4 past it
});

test('the cap uses the union of the players: two players 13 chunks apart raise the monster allowance with the union size', () => {
  const one = fixture(), two = fixture();
  join(one, 'a', 1, 30.5); join(two, 'a', 1, 30.5); join(two, 'b', 2, 110.5);
  one.tick(); two.tick();
  const size = two.mobs.eligibleChunks(), capOne = Math.trunc(70 * 289 / 256), capTwo = Math.trunc(70 * size / 256);
  assert.equal(one.mobs.eligibleChunks(), 289);
  assert.ok(size > 289 && size < 578 && capTwo > capOne + 5, `union ${size}, cap ${capTwo}`);
  for (const s of [one, two]) { for (let i = 0; i < capOne + 15; i++) put(s, 'zombie', 20 + (i % 40) + 0.5, 50 + Math.floor(i / 40) * 3 + 0.5); s.gameRules.doMobSpawning = 'true'; }
  for (let i = 0; i < 200; i++) { one.mobs.spawnPass(); two.mobs.spawnPass(); }
  const z = s => s.mobs.mobs.entities.filter(e => e.type === 'zombie').length;
  assert.equal(count(one, 'monster'), capOne + 15, 'one player: the monster cap 79 is already exceeded, nothing of the type spawns');
  assert.ok(count(two, 'monster') > capOne + 15, `two players: ${count(two, 'monster')} monsters, cap ${capTwo}`);
  assert.ok(count(two, 'monster') <= capTwo + 12);
  assert.ok(z(one) === capOne + 15);
});

test('eligible chunks do not depend on the view distance (radius 8 is a constant of SpawnerAnimals)', () => {
  const small = fixture(); small.rules.viewDistance = 3; join(small, 'a', 1, 64.5);
  const big = fixture(); big.rules.viewDistance = 16; join(big, 'a', 1, 64.5);
  assert.equal(small.mobs.eligibleChunks(), 289);
  assert.equal(big.mobs.eligibleChunks(), 289);
});

test('wire: a player\'s tracker packets do not grow with mobs out of their range (per-player range, no global budget)', () => {
  const size = (s, id) => JSON.stringify(s.players.get(id).mobPackets ?? []).length;
  const fill = (s, x0, n) => { for (let i = 0; i < n; i++) put(s, i % 3 ? 'zombie' : 'pig', x0 + (i % 20) * 1.5 + 0.5, 40 + Math.floor(i / 20) * 3 + 0.5); };
  const solo = fixture(); join(solo, 'a', 1, 20.5); fill(solo, 22, 100); solo.tick();
  const bytesSolo = size(solo, 'a');
  // The world is a 128-block window, so two players at its ends: each sees only the cluster within its tracker range.
  const crowd = fixture();
  join(crowd, 'a', 1, 20.5); join(crowd, 'b', 2, 120.5);
  fill(crowd, 8, 100); fill(crowd, 108, 100); crowd.tick();
  const bytesA = size(crowd, 'a');
  console.log(`mob packet bytes: one player/100 mobs ${bytesSolo}, two players/200 mobs ${bytesA} for a`);
  assert.ok(crowd.mobs.mobs.entities.length >= 200);
  assert.ok(bytesA <= bytesSolo * 1.25, `${bytesA} vs ${bytesSolo}`);
});
