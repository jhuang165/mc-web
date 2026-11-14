// Batch 66 mpend3: an End saved by 0.93.0 (128 x 128 window) is upgraded into the 256 x 256 window on load: stored cells, tiles, entities, orbs, the dragon and the player move
// to the same native places; the new area comes from the generator; spikes the old window did not hold get crystals only while the dragon is alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { END_WINDOWS } from './multiplayer/client-dimensions.js';
import { DimensionWorld } from './dimension-world.js';
import { newChest } from './chest.js';
import { upgradeLegacyEnd, UPGRADE_SHIFT } from './multiplayer/server-end-upgrade.js';
import { legacyCrystalKeys, windowOf } from './multiplayer/server-dragon.js';

const SEED = 'mp-end3-b66', key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const OLD = END_WINDOWS.legacy, FULL = END_WINDOWS.full;
const newSim = (saved = {}) => { const world = new World(SEED); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return new DedicatedSimulation(saved, { world, gameMode: 'creative', mobs: false }); };
const lx = nx => nx + OLD.x, lz = nz => nz + OLD.z; // native -> legacy local
const nx = x => x - FULL.x, nz = z => z - FULL.z; // full local -> native

// The legacy crystals as 0.93.0 made them: every crystal of the old window, less `destroyed` native keys. Returns the End record and the native keys of the crystals it holds.
function legacySave({ dragon, destroyed = 1, withPlayer = true }) {
  // rows come from a real End (a new 256 one): a dragon row and a crystal row, moved to the legacy coordinates below
  const fresh = newSim(), a = fresh.addPlayer('a', 'Alice', key(1));
  fresh.dimensions.arrive(a, 1);
  const rows = JSON.parse(JSON.stringify(fresh.dimensions.end.n.mobs.save()));
  const dragonRow = rows.find(r => r.type === 'ender_dragon'), crystalRow = rows.find(r => r.type === 'ender_crystal');
  const source = new DimensionWorld(SEED, 1);
  const oldWindow = { originX: -OLD.x, originZ: -OLD.z, size: 128 };
  const crystals = source.endCrystals(10, windowOf(oldWindow)).filter(c => lx(c.x) >= 1 && lx(c.x) < 127 && lz(c.z) >= 1 && lz(c.z) < 127);
  const kept = crystals.slice(destroyed);
  const mobs = kept.map((c, i) => ({ ...crystalRow, id: `crystal-${i}`, x: lx(c.x), y: c.y, z: lz(c.z) }));
  if (dragon === 'alive') mobs.push({ ...dragonRow, x: lx(0), z: lz(0), dragonSave: { ...dragonRow.dragonSave, tx: lx(0), tz: lz(0) } });
  const end = {
    window: 'legacy', dragon,
    edits: [[`${lx(100)},60,${lz(0)}`, 1], [`${lx(101)},61,${lz(0)}`, 54], [`${lx(99)},61,${lz(0)}`, 175]],
    tiles: { furnaces: {}, chests: { [`${lx(101)},61,${lz(0)}`]: newChest(3) }, dispensers: {}, brewing: {}, hoppers: {} },
    signs: [{ x: lx(99), y: 61, z: lz(0), text: ['old', 'end', '', ''] }], skulls: [], tileEntities: { beacons: [], spawners: [] },
    items: [{ stack: { id: 1, count: 3, damage: 0 }, x: lx(98) + 0.5, y: 61, z: lz(2) + 0.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0, hover: 0 }],
    fluidTicks: { version: 1, time: 0, entries: [] }, fireTicks: { version: 1, time: 0, entries: [] }, falling: [], fallingTicks: { version: 1, time: 0, entries: [] }, farms: [],
    redstone: { version: 1, clock: 0, time: 0, rand: { version: 1, seed: '25212215193', gaussian: null }, pending: [], deferred: [], events: [[], []], eventIndex: 0, torches: [], lit: [], comparators: [], pistons: [] },
    mobs, xpOrbs: [{ x: lx(97) + 0.5, y: 61, z: lz(3) + 0.5, value: 3, age: 0, health: 5, fire: 0, vx: 0, vy: 0, vz: 0, onGround: true, id: 0 }], vehicles: { carts: { version: 1, carts: [] }, boats: [] },
  };
  const saved = JSON.parse(JSON.stringify(fresh.save()));
  saved.dimensions = { end };
  saved.players = withPlayer ? [[key(1), { ...saved.players[0][1], dimension: 1, position: { x: lx(100) + 0.5, y: 50, z: lz(0) + 0.5 } }]] : [];
  return { saved, kept: new Set(kept.map(c => `${c.x},${c.z}`)), crystals };
}

test('the upgrade moves every stored coordinate by the window difference and leaves the input alone', () => {
  assert.deepEqual(UPGRADE_SHIFT, { x: 103, z: 32 });
  const input = { dimensions: { end: { window: 'legacy', edits: [['5,60,7', 1]], tiles: { chests: { '5,61,7': {} } }, redstone: { lit: ['1,2,3'], pending: [[1, 2, 3, 4]], events: [[[1, 2, 3, 4, 5, 6]], []], comparators: [['4,5,6', 2]], pistons: [[7, 8, 9, 10]], torches: [[1, 2, 3, 9]] },
    farms: [['9,60,9', 3]], mobs: [{ x: 1, y: 2, z: 3, vx: 0.5, dragonSave: { tx: 4, tz: 5, ty: 80 } }], fluidTicks: { entries: [{ x: 1, y: 2, z: 3 }] } } },
  projectiles: { lanes: { 0: { arrows: [{ x: 9, z: 9, xTile: 1, zTile: 2 }] }, 1: { arrows: [{ x: 10, y: 5, z: 11, xTile: 1, yTile: 2, zTile: 3, mx: 0.1 }] } } },
  players: [['a', { dimension: 1, position: { x: 1, y: 2, z: 3 } }], ['b', { position: { x: 1, y: 2, z: 3 } }]] };
  const copy = JSON.stringify(input), out = upgradeLegacyEnd(input);
  assert.equal(JSON.stringify(input), copy);
  const e = out.dimensions.end;
  assert.equal(e.window, 'full'); assert.deepEqual(e.edits, [['108,60,39', 1]]); assert.deepEqual(Object.keys(e.tiles.chests), ['108,61,39']);
  assert.deepEqual(e.redstone, { lit: ['104,2,35'], pending: [[104, 2, 35, 4]], events: [[[104, 2, 35, 4, 5, 6]], []], comparators: [['107,5,38', 2]], pistons: [[110, 8, 41, 10]], torches: [[104, 2, 35, 9]] });
  assert.deepEqual(e.farms, [['112,60,41', 3]]);
  assert.deepEqual(e.mobs, [{ x: 104, y: 2, z: 35, vx: 0.5, dragonSave: { tx: 107, tz: 37, ty: 80 } }]);
  assert.deepEqual(e.fluidTicks.entries, [{ x: 104, y: 2, z: 35 }]);
  assert.deepEqual(out.projectiles.lanes[1].arrows, [{ x: 113, y: 5, z: 43, xTile: 104, yTile: 2, zTile: 35, mx: 0.1 }]);
  assert.deepEqual(out.projectiles.lanes[0].arrows, [{ x: 9, z: 9, xTile: 1, zTile: 2 }]); // the Overworld lane is untouched
  assert.deepEqual(out.players[0][1].position, { x: 104, y: 2, z: 35 }); assert.deepEqual(out.players[1][1].position, { x: 1, y: 2, z: 3 });
  assert.equal(upgradeLegacyEnd(out), out, 'an End that is full already is returned as it is'); // (window full, no second shift)
  assert.equal(upgradeLegacyEnd({ dimensions: {} }).dimensions.end, undefined);
});

test('a legacy End with a living dragon loads as 256: cells, tiles, mobs, orbs and the player keep their native places; new spikes get crystals', { timeout: 240000 }, () => {
  const { saved, kept, crystals } = legacySave({ dragon: 'alive' });
  assert.ok(crystals.length >= 1 && crystals.length < 20, 'the old window held some spikes: ' + crystals.length);
  const sim = newSim(saved), p = sim.addPlayer('a', 'Alice', key(1));
  assert.equal(p.dimension, 1);
  const w = p.world, end = sim.dimensions.end.n;
  assert.equal(w.size, 256); assert.equal(w.endWindow, 'full');
  assert.deepEqual([p.position.x - FULL.x, p.position.z - FULL.z], [100.5, 0.5]); // the player stands where they stood natively
  assert.equal(w.get(100 + FULL.x, 60, FULL.z), 1, 'the old edit is at its native cell'); assert.equal(w.get(101 + FULL.x, 61, FULL.z), 54);
  assert.ok(end.tiles.chests[`${101 + FULL.x},61,${FULL.z}`], 'the chest tile moved with it'); assert.equal(end.tiles.chests[`${lx(101)},61,${lz(0)}`], undefined);
  assert.ok(end.tileEntities.signs.tile(99 + FULL.x, 61, FULL.z), 'the sign moved');
  assert.deepEqual(end.items.items.map(e => [e.x - FULL.x, e.z - FULL.z]), [[98.5, 2.5]]);
  assert.deepEqual(end.xp.serialize().map(o => [o.x - FULL.x, o.z - FULL.z]), [[97.5, 3.5]]);
  // the terrain beyond the old window is generated: end stone west of native x -25 (the old window's edge)
  let west = 0; for (let x = 0; x < FULL.x - OLD.x - 5 + 1; x += 2) for (let z = 0; z < 256; z += 4) for (let y = 40; y < 80; y++) if (w.get(x, y, z) === 152) { west++; break; }
  assert.ok(west > 50, 'end stone in the newly visible area: ' + west);
  // mobs: one dragon at the native centre with its target, and one crystal for every spike of the 256 window except the one the players destroyed
  const mobs = end.mobs.mobs.entities, dragons = mobs.filter(e => e.type === 'ender_dragon'), cs = mobs.filter(e => e.type === 'ender_crystal');
  assert.equal(dragons.length, 1); assert.deepEqual([dragons[0].x, dragons[0].z], [128, 128]);
  const expected = new DimensionWorld(SEED, 1).endCrystals(10, { cx0: -8, cx1: 7, cz0: -8, cz1: 7 }).filter(c => c.x + 128 >= 1 && c.x + 128 < 255 && c.z + 128 >= 1 && c.z + 128 < 255);
  const gone = [...legacyCrystalKeys(new DimensionWorld(SEED, 1))].filter(k => !kept.has(k));
  assert.equal(gone.length, 1); // exactly the crystal the fixture destroyed
  assert.equal(cs.length, expected.length - gone.length, 'one per spike, less the destroyed one');
  assert.ok(!cs.some(c => `${c.x - 128},${c.z - 128}` === gone[0]), 'the destroyed crystal stays destroyed');
  assert.equal(new Set(cs.map(c => `${c.x},${c.z}`)).size, cs.length, 'no crystal twice');
  assert.ok(cs.length > kept.size, 'crystals were added for the spikes outside the old window');
  assert.equal(sim.dimensions.end.saveField().window, 'full'); assert.equal(sim.dimensions.end.saveField().upgradedFrom, undefined);
  // saving and loading again is stable: no second shift, no second batch of crystals
  const again = newSim(JSON.parse(JSON.stringify(sim.save()))), q = again.addPlayer('a2', 'Alice', key(1));
  assert.deepEqual([q.position.x - FULL.x, q.position.z - FULL.z], [100.5, 0.5]);
  const mobs2 = again.dimensions.end.n.mobs.mobs.entities;
  assert.equal(mobs2.filter(e => e.type === 'ender_crystal').length, cs.length); assert.equal(mobs2.filter(e => e.type === 'ender_dragon').length, 1);
  assert.equal(q.world.get(100 + FULL.x, 60, FULL.z), 1);
});

test('a legacy End whose dragon is dead gets no crystals, and an unbuilt End keeps the pending crystals through a save', { timeout: 240000 }, () => {
  const { saved } = legacySave({ dragon: 'dead', withPlayer: false });
  const sim = newSim(saved);
  const rec = sim.save().dimensions.end; // nobody went to the End: the record is written as upgraded, with the crystal note still on it
  assert.equal(rec.window, 'full'); assert.equal(rec.upgradedFrom, 'legacy');
  const p = sim.addPlayer('a', 'Alice', key(1)); sim.dimensions.arrive(p, 1);
  const cs = sim.dimensions.end.n.mobs.mobs.entities.filter(e => e.type === 'ender_crystal');
  assert.equal(cs.length, saved.dimensions.end.mobs.length, 'only the saved crystals, none added');
  assert.equal(sim.dimensions.end.n.mobs.mobs.entities.some(e => e.type === 'ender_dragon'), false);
});

test('a living dragon End that was saved before anyone built it still gets its new crystals on the first visit', { timeout: 240000 }, () => {
  const { saved, kept } = legacySave({ dragon: 'alive', withPlayer: false });
  const first = newSim(saved), mid = JSON.parse(JSON.stringify(first.save())); // saved while unbuilt
  assert.equal(mid.dimensions.end.upgradedFrom, 'legacy');
  const sim = newSim(mid), p = sim.addPlayer('a', 'Alice', key(1)); sim.dimensions.arrive(p, 1);
  assert.ok(sim.dimensions.end.n.mobs.mobs.entities.filter(e => e.type === 'ender_crystal').length > kept.size);
});
