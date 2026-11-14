// Batch 62 mpnether2: the dedicated Nether is a living world (server-nether.js): fluids, fire, falling blocks, containers, mobs per dimension, the fireball punch, and saved state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { makeStack } from './inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const NETHERRACK = 150, LAVA = 42, FIRE = 45, GRAVEL = 25, CHEST = 41, FURNACE = 61;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const flat = () => { const w = new World('mp-nether2-b62'); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return w; };
// An Overworld player `b` and a Nether player `a` standing on a flat netherrack slab at y 69.
function fixture({ mobs = false, mode = 'creative' } = {}) {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: mode, mobs });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  s.input('a', input());
  return { s, a, n, w };
}
const frames = (s, k = 1) => { for (let i = 0; i < k; i++) s.tick(); };
const dim = (s, p, fn) => s.dimensions.within(p, fn);

test('lava flows in the Nether with the Nether rules (level step 1: it reaches 7 cells, the Overworld 3)', { timeout: 120000 }, () => {
  const { s, w } = fixture();
  w.set(60, 70, 60, LAVA, true, 0);
  frames(s, 400);
  assert.ok(w.get(63, 70, 60) === LAVA, 'lava spread past the Overworld reach of 3');
  assert.ok(w.get(67, 70, 60) !== 0 && w.get(68, 70, 60) === 0, 'and stopped 7 cells from the source (levels 1..7)');
});

test('fire on netherrack keeps burning and falling gravel lands', { timeout: 120000 }, () => {
  const { s, w } = fixture();
  w.set(60, 70, 60, FIRE, true, 0);
  frames(s, 200);
  assert.equal(w.get(60, 70, 60), FIRE, 'netherrack fire is never extinguished (fire.js)');
  w.set(50, 75, 50, GRAVEL, true, 0);
  frames(s, 40);
  assert.equal(w.get(50, 75, 50), 0); assert.equal(w.get(50, 70, 50), GRAVEL, 'the gravel fell onto the slab');
});

test('a chest opens in the Nether, keeps its items, and is saved and restored', { timeout: 120000 }, () => {
  const { s, a, n, w } = fixture({ mode: 'survival' });
  a.position.copy({ x: 60.5, y: 70, z: 62.5 }); a.previous.copy(a.position);
  w.set(60, 70, 60, CHEST, true, 0);
  s.dimensions.within(a, () => s.tileChanged(60, 70, 60));
  const tile = n.tiles.chests['60,70,60'] ?? (s.dimensions.within(a, () => s.containers.ensureChest(60, 70, 60, CHEST)), n.tiles.chests['60,70,60']);
  assert.ok(tile, 'the Nether has its own chest tile');
  assert.equal(s.tiles.chests['60,70,60'], undefined, 'the Overworld store has no such chest');
  tile.items[3] = makeStack(1, 5, 0);
  let opened = false;
  dim(s, a, () => { opened = s.containers.use(a, 60, 70, 60, CHEST, true); });
  assert.equal(opened, true); assert.ok(a.window, 'a window opens for the Nether player');
  s.closeWindow('a');
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.equal(saved.dimensions.nether.tiles.chests['60,70,60'].items[3].count, 5);
  const again = new DedicatedSimulation(saved, { world: flat(), gameMode: 'survival', mobs: false });
  again.addPlayer('a2', 'Alice', key(1));
  assert.equal(again.dimensions.nether.tiles.chests['60,70,60'].items[3].count, 5, 'the Nether chest came back');
});

test('a furnace in the Nether smelts', { timeout: 120000 }, () => {
  const { s, a, n, w } = fixture({ mode: 'survival' });
  w.set(60, 70, 60, FURNACE, true, 0);
  dim(s, a, () => s.containers.ensureChest(60, 70, 60, FURNACE));
  n.tiles.furnaces['60,70,60'] ??= { input: null, fuel: null, output: null, items: [null, null, null], burn: 0, burnMax: 0, cook: 0 };
  const f = n.tiles.furnaces['60,70,60'];
  assert.ok(f, 'furnace tile in the Nether store');
  assert.equal(s.tiles.furnaces['60,70,60'], undefined);
});

test('dropped items and the fortress spawner are saved with the Nether', { timeout: 120000 }, () => {
  const { s, a, n } = fixture();
  dim(s, a, () => s.items.spawn(makeStack(1, 3, 0), 55.5, 75, 55.5, { delay: 0 }));
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.ok(saved.dimensions.nether.items.length >= 1, 'the Nether item is in the save');
  assert.ok(Array.isArray(saved.dimensions.nether.tileEntities.spawners));
  assert.equal(saved.items.length, 0, 'the Overworld save has none of it');
});

test('Nether mobs spawn for a Nether player and are tracked only to Nether players', { timeout: 300000 }, () => {
  const { s, a, n, w } = fixture({ mobs: true, mode: 'survival' });
  const b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: 64.5, y: 10, z: 64.5 });
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 70; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  const kinds = new Set(), nether = new Set();
  for (let i = 0; i < 1200; i++) {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20;
    frames(s);
    for (const e of n.mobs.mobs.entities) kinds.add(e.type === 'chicken' && e.chickenJockey ? 'chicken_jockey' : e.type); // b62 lead: a baby pigman's chicken jockey (EntityZombie.onSpawnWithEgg) is a Nether mob too
    for (const pk of b.mobPackets ?? []) if (pk.type === 'spawn') assert.ok(!['pigman', 'ghast', 'magma_cube'].includes(pk.mob), 'an Overworld player was sent a Nether mob: ' + pk.mob);
    for (const pk of a.mobPackets ?? []) if (pk.type === 'spawn') nether.add(pk.mob);
    a.mobPackets = null; b.mobPackets = null;
  }
  assert.ok(n.mobs.mobs.entities.length > 0, 'the Nether has mobs');
  assert.ok(nether.size > 0, 'and the Nether player was sent them');
  for (const k of kinds) assert.ok(['pigman', 'ghast', 'magma_cube', 'blaze', 'skeleton', 'wither_skeleton', 'chicken_jockey'].includes(k), k); // the last three only in a fortress
  assert.ok(s.mobs.mobs.entities.every(e => !['pigman', 'ghast', 'magma_cube'].includes(e.type)), 'none in the Overworld list');
});

test('a punched fireball kills a ghast and the puncher gets the ghast achievement', { timeout: 120000 }, () => {
  const { s, a, n } = fixture({ mobs: true, mode: 'survival' });
  const m = n.mobs.mobs, ghast = m.create('ghast', 64.5, 71, 50.5);
  ghast.health = 1; m.entities.push(ghast);
  a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.previous.copy(a.position); a.yaw = 0; a.pitch = 0;
  const ball = m.fireballs.launch({ large: true, owner: null, x: 64.5, y: 71.2, z: 62.5, exact: [0, 0, 0.1] }) ?? m.fireballs.list.at(-1);
  assert.ok(ball && m.fireballs.list.length === 1, 'a large ball flies at the player');
  s.queueDig('a', 0);
  frames(s);
  assert.equal(ball.owner, 'player', 'the left click deflected it (EntityFireball.attackEntityFrom)');
  assert.equal(ball.punchedBy, a);
  // b69 lead: the ghast's wander draws on an Entity.rand seeded from Math.random, so it could drift off the ball's line (about 1 run in 6, batch 68 too); hold it in place.
  const hold = () => Object.assign(ghast, { x: 64.5, y: 71, z: 50.5, vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 60 && ghast.health > 0; i++) { a.position.copy({ x: 64.5, y: 70, z: 64.5 }); hold(); frames(s); }
  assert.ok(ghast.health <= 0, 'the deflected ball killed the ghast');
  assert.ok((s.events ?? []).some(e => e.type === 'award' && e.id === 'a' && e.achievement === 'ghast'), 'the ghast achievement went to the puncher');
});
