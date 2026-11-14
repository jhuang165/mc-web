import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JavaRandom } from './java-random.js';
import { Village, VillageCollection, VillageDoorInfo } from './village.js';
import { VillageSiege } from './village-siege.js';
import { EntityWorld } from './entities.js';
import { mapLegacyReputation } from './multiplayer/server-villagers.js';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/siege-reference.json', import.meta.url), 'utf8'));
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);

// The reference's World.rand logs every draw; the replay logs the same tokens (bound * 65536 + value, or the float bits).
class LogRandom extends JavaRandom {
  log = [];
  nextInt(bound) { const r = super.nextInt(bound); this.log.push(bound * 65536 + r); return r; }
  nextFloat() { const r = super.nextFloat(); f32[0] = r; this.log.push(u32[0] | 0); return r; }
}
const hash = (log) => log.reduce((h, t) => (Math.imul(31, h) + t) | 0, 0);

function build(rec) {
  const col = new VillageCollection({});
  for (const v of rec.villages) {
    const vil = new Village({});
    for (const d of v.doors) vil.addDoor(new VillageDoorInfo(...d));
    vil.tickCounter = v.tick; vil.numVillagers = v.pop;
    assert.deepEqual(vil.center, v.center, 'the village centre the original computed');
    assert.equal(vil.radius, v.radius);
    col.villages.push(vil);
  }
  return col;
}
function replay(rec) {
  const rand = new LogRandom(rec.seed), col = build(rec);
  let day = false, angle = 0;
  const siege = new VillageSiege({ isDaytime: () => day, celestialAngle: () => angle, rand, villages: col, players: () => rec.players.map(([x, y, z]) => ({ x, y, z })) });
  const rows = [];
  for (const [d, a] of rec.script) {
    day = d === 1; angle = Math.fround(a); rand.log = [];
    siege.tick();
    rows.push([siege.state, siege.spawnsLeft, siege.delay, siege.setUp ? 1 : 0, rand.log.length, hash(rand.log), 0]);
  }
  return rows;
}

test('the reference was recorded from the unchanged VillageSiege class', () => {
  assert.equal(ref.target, 'Minecraft Java 1.7.10');
  assert.equal(ref.classes.wb.name, 'VillageSiege');
  assert.equal(ref.records.length, 45);
});

test('every recorded tick replays: state, timers and each World.rand draw', () => {
  for (const rec of ref.records) assert.deepEqual(replay(rec), rec.rows, `${rec.case} seed ${rec.seed} ${rec.variant ?? rec.dx ?? ''}`);
});

test('the original never spawns a zombie: its spawn-spot search drops the vector it builds', () => {
  assert.ok(ref.records.every((r) => r.rows.every((row) => row[6] === 0)));
  assert.ok(ref.records.every((r) => r.rows.every((row) => row[3] === 0)), 'no siege is ever set up');
  assert.ok(ref.records.some((r) => r.case === 'cycle' && r.rows.some((row) => row[0] === 1)), 'a 1-in-10 roll did start state 1 in some run');
  assert.ok(ref.records.some((r) => r.rows.some((row) => row[4] === 32)), 'the ring and spot searches ran (10 x 2 floats... 30 ints, 32 draws)');
});

test('the village conditions: 10 doors, a door added 20 ticks ago, 20 villagers, a player inside range', () => {
  const draws = (variant) => ref.records.find((r) => r.variant === variant).rows[0][4];
  for (const v of ['ok', 'ten doors', 'door added 20 ticks ago', '20 villagers']) assert.equal(draws(v), 32, v);
  for (const v of ['nine doors', 'door added 19 ticks ago', '19 villagers', 'player far away', 'player 40 blocks out', 'no player']) assert.equal(draws(v), 0, v);
  assert.equal(draws('two players'), 64);
});

test('daytime resets to state 0; state 2 stays until day', () => {
  let day = true;
  const rand = new LogRandom(5), siege = new VillageSiege({ isDaytime: () => day, celestialAngle: () => 0.5, rand, villages: { villages: [] }, players: () => [] });
  siege.tick();
  assert.equal(siege.state, 0);
  day = false;
  for (let i = 0; i < 40 && siege.state === 0; i++) siege.tick();
  assert.notEqual(siege.state, 0);
  const s = siege.state;
  for (let i = 0; i < 5; i++) siege.tick();
  assert.equal(siege.state, s === 1 ? 1 : 2);
});

test('EntityWorld ticks the siege once per tick after the village tick, from the world clock and its players', () => {
  const cells = new Map(), w = { numericSeed: 1, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0), getMeta: () => 1, set() {}, solid: (x, y, z) => y < 0, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }) };
  const ew = new EntityWorld(w, null, () => 0.5), order = [];
  const tick = ew.villages.tick.bind(ew.villages);
  ew.villages.tick = () => { order.push('villages'); tick(); };
  ew.siege.tick = () => order.push('siege');
  const survival = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage: () => true, count: () => 0 };
  ew.tick({ x: 0, y: 0, z: 0 }, survival);
  assert.deepEqual(order, ['villages', 'siege']);
  assert.equal(ew.siegeTime(), 18000);
  assert.equal(ew.siegePlayers().length, 1);
});

test('a single-player village reputation key "Player" becomes the named legacy owner on the server', () => {
  const json = () => ({ tick: 1, villages: [{ players: [['Player', -20], ['Zed', 3]] }, { players: [['Player', 5], ['Alex', 4]] }, { players: [] }] });
  const a = json();
  assert.equal(mapLegacyReputation(a, 'Alex'), 2);
  assert.deepEqual(a.villages[0].players, [['Zed', 3], ['Alex', -20]]);
  assert.deepEqual(a.villages[1].players, [['Alex', 9]], 'a name that already has a score is summed');
  const b = json();
  assert.equal(mapLegacyReputation(b, null), 0);
  assert.equal(mapLegacyReputation(b, 'Player'), 0);
  assert.deepEqual(b, json());
  const c = { villages: [{ players: [['Player', 9], ['Alex', 8]] }] };
  mapLegacyReputation(c, 'Alex');
  assert.deepEqual(c.villages[0].players, [['Alex', 10]], 'clamped to the 10 maximum');
});

test('the dedicated server runs the siege for its players on the server clock, and loads a legacy reputation under the owner name', () => {
  const world = new World('sieges-b67');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const saved = { villages: { tick: 5, villages: [{ pop: 1, radius: 20, golems: 0, stable: 0, tick: 5, mtick: 0, c: [64, 10, 64], ac: [64, 10, 64], doors: [[64, 10, 64, 0, 2, 5]], players: [['Player', -7]] }] } };
  const s = new DedicatedSimulation(saved, { world, gameMode: 'survival', mobs: true, legacyOwner: 'Alex' });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer('a', 'Alex', '00000000-0000-0000-0000-000000000001');
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  assert.equal(s.mobs.mobs.villages.villages[0].playerReputation('Alex'), -7);
  assert.equal(s.mobs.mobs.villages.villages[0].playerReputation('Player'), 0);
  let seen = 0;
  const tick = s.mobs.mobs.siege.tick.bind(s.mobs.mobs.siege);
  s.mobs.mobs.siege.tick = () => { seen++; tick(); };
  s.tick(); s.tick();
  assert.ok(seen >= 2);
  assert.deepEqual(s.mobs.mobs.siegePlayers().map(q => [q.x, q.z]), [[64.5, 64.5]]);
});
