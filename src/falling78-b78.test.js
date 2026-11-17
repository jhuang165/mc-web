// Batch 78 falling78: more TileEntityData kinds, fluid/fire/portal falling blocks, item Fire, server falling tiles and the server eye aux 1002.
// Evidence: public/research/falling-block78-reference.json (Executed, tools/probes/FallingBlock78Probe.java).
import test from 'node:test';
import assert from 'node:assert/strict';
import ref from '../public/research/falling-block78-reference.json' with { type: 'json' };
import { NBT } from './nbt.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { FallingBlocks, spawnFalling } from './falling.js';
import { fromOriginal } from './block-registry.js';
import { World } from './world.js';
import { JavaRandom } from './java-random.js';
import { nbtToJson } from './spawner-data.js';
import { applyFallingTileData } from './falling-tiles.js';
import { MobSpawners } from './mob-spawner.js';
import { serverFallingTile } from './multiplayer/server-falling-tiles.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ITEM_EYE_OF_ENDER } from './eye-of-ender.js';

const tag = (type, value) => ({ type, value });
const compound = (o) => tag(NBT.COMPOUND, new Map(Object.entries(o)));
const apply = (orig, meta, data, host, x = 1, y = 60, z = 1) => applyFallingTileData({ block: fromOriginal(orig, meta).id, x, y, z, data: nbtToJson(compound(data)), dataByte: meta, host });
const flat = () => { const w = new World('78', 'flat', 12); for (let x = -3; x < 4; x++) for (let z = -3; z < 4; z++) for (let y = 1; y < 90; y++) w.set(x, y, z, y < 60 ? 1 : 0, false, 0); return w; };

test('water, lava, fire and portal have ItemBlocks natively (executed) and the port maps them', () => {
  for (const row of ref.item) assert.ok(row.item, `block ${row.block} has an item`);
  for (const id of [8, 9, 10, 11, 51, 90]) assert.ok(ORIGINAL_ITEMS[id] !== undefined, `original item ${id}`);
});

test('a falling fire block lands only where Block.canPlaceBlockAt allows; otherwise it drops its item (executed rows)', () => {
  const fireRows = ref.land.filter(([b, t, below]) => b === 51 && t === 0);
  assert.ok(fireRows.length > 0);
  const stone = [], glass = [];
  for (const [land, below, out] of [[true, 1, stone], [false, 20, glass]]) {
    const row = ref.land.find(([b, t, bl]) => b === 51 && t === 0 && bl === below);
    assert.equal(row[3], land, `native fire over ${below}`);
    const w = flat(); const f = fromOriginal(51, 0), under = fromOriginal(below, 0);
    w.set(0, 59, 0, under.id, false, under.meta);
    const drops = [], fb = new FallingBlocks(w, { drop: (s) => drops.push(s) }, []);
    const e = spawnFalling(f.id, f.meta, 0, 61, 0, new JavaRandom(1n)); e.ticks = 5; fb.entities ? fb.entities.push(e) : fb.list.push(e);
    for (let i = 0; i < 40; i++) fb.tick();
    out.push(w.get(0, 60, 0), drops.length);
    if (land) assert.equal(w.get(0, 60, 0), f.id); else { assert.equal(w.get(0, 60, 0), 0); assert.equal(drops.length, 1); }
  }
});

test('item Fire is 0 before the first tick and -1 after (executed rows)', () => {
  assert.deepEqual(ref.fire[0], [0, 0, 0]);
  for (const [ticks, fire] of ref.fire.slice(1)) assert.equal(fire, -1, `after ${ticks} ticks`);
});

test('TileEntityData per kind keeps unspecified values, ignores x/y/z and follows the native getters', () => {
  const spawners = new MobSpawners(); spawners.add({ x: 1, y: 60, z: 1, entityId: 'Pig' });
  assert.equal(apply(52, 0, { x: tag(NBT.INT, 99), EntityId: tag(NBT.STRING, 'Zombie'), Delay: tag(NBT.SHORT, 7) }, { spawners }), true);
  const sp = spawners.get(1, 60, 1);
  assert.equal(sp.entityId, 'Zombie'); assert.equal(sp.delay, 7); assert.equal(spawners.get(99, 60, 1), null);
  const note = { note: 3 };
  assert.equal(apply(25, 0, { note: tag(NBT.BYTE, 50) }, { music: { noteBlocks: { tile: () => note } } }), true);
  assert.equal(note.note, 24, 'clamped to 24');
  apply(25, 0, { Other: tag(NBT.BYTE, 1) }, { music: { noteBlocks: { tile: () => note } } });
  assert.equal(note.note, 24, 'a missing key keeps the note');
  const beacon = { primary: 1, secondary: 2, levels: 3 };
  apply(138, 0, { Primary: tag(NBT.INT, 5), Levels: tag(NBT.INT, 4) }, { beacons: { ensure: () => beacon } });
  assert.deepEqual(beacon, { primary: 5, secondary: 2, levels: 4 });
  const tiles = new Map();
  apply(149, 0, { OutputSignal: tag(NBT.INT, 9) }, { comparators: tiles });
  assert.equal(tiles.get('1,60,1').signal, 9);
  const jb = { record: null };
  apply(84, 0, { RecordItem: compound({ id: tag(NBT.SHORT, 2257), Count: tag(NBT.BYTE, 1), Damage: tag(NBT.SHORT, 0) }) }, { music: { jukeboxes: { tile: () => jb } } });
  assert.equal(jb.record?.id !== undefined, true);
  // a host without the store applies nothing
  assert.equal(apply(52, 0, { EntityId: tag(NBT.STRING, 'Pig') }, {}), false);
});

test('serverFallingTile applies the data over a dimension and marks the cell dirty; both server dimensions get the hook', () => {
  const spawners = new MobSpawners(); spawners.add({ x: 1, y: 60, z: 1, entityId: 'Pig' });
  const dim = { world: flat(), tiles: {}, tileEntities: { spawners }, redstone: null, dirtyTiles: new Set() };
  const b = fromOriginal(52, 0);
  serverFallingTile(dim)(1, 60, 1, b.id, nbtToJson(compound({ EntityId: tag(NBT.STRING, 'Ghast') })), 0);
  assert.equal(spawners.get(1, 60, 1).entityId, 'Ghast');
  assert.ok(dim.dirtyTiles.has('1,60,1'));
  const chest = fromOriginal(54, 2);
  serverFallingTile(dim)(2, 60, 2, chest.id, nbtToJson(compound({ Items: tag(NBT.LIST, { elementType: NBT.COMPOUND, items: [new Map(Object.entries({ Slot: tag(NBT.BYTE, 0), id: tag(NBT.SHORT, 1), Count: tag(NBT.BYTE, 3), Damage: tag(NBT.SHORT, 0) }))] }) })), 2);
  assert.ok(dim.tiles.chests['2,60,2'], 'chest created');
  const w = new World('mp78'); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w, gameMode: 'survival', mobs: false });
  assert.equal(typeof s.falling.tile, 'function');
});

test('the dedicated server forwards the eye of ender aux 1002 to every player within 64 blocks', { timeout: 120000 }, () => {
  const w = new World('mp78eye'); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w, gameMode: 'survival', mobs: false });
  const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2)), c = s.addPlayer('c', 'Cy', key(3));
  b.position.copy({ x: a.position.x + 5, y: a.position.y, z: a.position.z });
  c.position.copy({ x: a.position.x + 500, y: a.position.y, z: a.position.z });
  a.survival.inventory.main[0] = { id: ITEM_EYE_OF_ENDER, count: 2, damage: 0 }; a.survival.selected = 0;
  for (const p of [a, b, c]) p.itemsOut = [];
  assert.equal(s.dispense.throwHeld(a), true);
  const aux = (p) => p.itemsOut.filter((m) => m.type === 'aux').flatMap((m) => m.events).filter((e) => e.id === 1002);
  for (const p of [a, b]) {
    const ev = aux(p); assert.equal(ev.length, 1);
    assert.deepEqual([ev[0].x, ev[0].y, ev[0].z], [Math.trunc(a.position.x), Math.trunc(a.position.y), Math.trunc(a.position.z)].map((v, i) => (i === 1 ? ev[0].y : v)));
    assert.ok(Number.isInteger(ev[0].y));
  }
  assert.equal(aux(c).length, 0, 'out of range');
});
