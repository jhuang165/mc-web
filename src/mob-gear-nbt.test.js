// Mob equipment, leashes and portal cooldowns in the Java chunk NBT: the unchanged 1.7.10 classes' output
// (public/research/mob-gear-nbt-reference.json, tools/probes/MobGearNbtProbe.java) replayed through javaMobFromNbt, EntityWorld and
// region import, and the exporter's NBT read back through the same importer. Evidence and gaps: public/research/mob-gear-nbt.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/mob-gear-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { javaMobFromNbt } from './java-mobs.js';
import { EntityWorld } from './entities.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, regionAddress, readRegion, decodeRegionChunk, regionSlot } from './region-file.js';
import { importJavaRegionArea, itemStackFromNbt } from './region-import.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { World } from './world.js';
import { Survival } from './survival.js';
import { exportJavaSave } from './region-export.js';
import { ORIGINAL_ITEMS } from './region-import.js';
import { toLiveStack } from './mob-equipment-live.js';

const tagOf = (hex) => decodeNbt(Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1, height: 256 };
const live = (record) => new EntityWorld(flat, [{ ...record, x: 64.5, y: 1, z: 64.5 }], () => 0.5).entities[0];
const rows = (equipment) => equipment.map((s) => (s ? [s.id, s.count, s.damage, (s.enchantments ?? []).map((e) => [e.id, e.lvl])] : null));
const mapped = (row) => !row || ORIGINAL_ITEMS[`${row[0]}:${row[2]}`] !== undefined || ORIGINAL_ITEMS[row[0]] !== undefined;
const f = Math.fround;

test('the probe covers the gear, leash and knot cases', () => {
  assert.deepEqual([reference.gear.length, reference.leash.length, reference.knotLoad.length], [18, 2, 1]);
});

for (const m of reference.gear) {
  test(`native ${m.kind} NBT imports with the native read-back`, () => {
    const type = m.id === 'PigZombie' ? 'pigman' : m.id === 'Skeleton' ? (m.skeletonType === 1 ? 'wither_skeleton' : 'skeleton') : 'zombie';
    for (const hex of [m.nbt]) { // nbt is the loaded mob written again (nbtWritten is the tag before any edit)
      const r = javaMobFromNbt(tagOf(hex), { convertItem: itemStackFromNbt });
      assert.equal(r.type, type);
      // Items the browser has no id for read as an empty slot; the rest keep id, count, raw damage and enchantments exactly.
      assert.deepEqual(rows(r.equipment), m.equipment.map((row) => (mapped(row) ? row : null)));
      assert.deepEqual(r.dropChances, m.dropChances.map(f));
      assert.equal(r.canPickUpLoot, m.canPickUpLoot);
      assert.equal(!!r.persistent, m.persistent);
      assert.equal(r.portalCooldown ?? 0, Math.max(0, m.portalCooldown));
    }
    // EntityWorld keeps the same state (its readGear clamps damage to the item's maximum, its portal cooldown to 300).
    const e = live(javaMobFromNbt(tagOf(m.nbt), { convertItem: itemStackFromNbt }));
    assert.equal(e.type, type);
    assert.equal(e.canPickUpLoot, m.canPickUpLoot);
    assert.deepEqual(e.dropChances, m.dropChances.map(f));
    assert.deepEqual(e.equipment.map((s, i) => s && [s.id, s.count, (s.enchantments ?? []).map((x) => [x.id, x.lvl])]),
      m.equipment.map((row) => (row && mapped(row) ? [row[0], row[1], row[3]] : null)));
    assert.equal(e.portalCooldown ?? 0, Math.max(0, Math.min(300, m.portalCooldown)));
  });
}

test('a tag with none of Equipment, DropChances and CanPickUpLoot keeps the type default gear', () => {
  const tag = new Map(tagOf(reference.gear.find((m) => m.kind === 'zombieEmpty').nbt));
  for (const k of ['Equipment', 'DropChances', 'CanPickUpLoot']) tag.delete(k);
  const r = javaMobFromNbt(tag, { convertItem: itemStackFromNbt });
  assert.equal(r.equipment, undefined);
  assert.equal(live(r).canPickUpLoot, false);
});

test('the leashed zombie NBT restores its holder and a knot never needs its own entity', async () => {
  const [knot, player] = ['knot', 'player'].map((h) => reference.leash.find((l) => l.holder === h));
  assert.equal(knot.knotWritesToChunk, false);
  assert.equal(knot.knotTag, '{}');
  assert.equal(knot.leash, '{X:5,Y:0,Z:0,}');
  const k = javaMobFromNbt(tagOf(knot.nbt), { shiftX: 16, shiftZ: 32 }), p = javaMobFromNbt(tagOf(player.nbt));
  assert.deepEqual(k.leash, { knot: { x: 21, y: 0, z: 32 } });
  assert.deepEqual(p.leash, { holder: 'player' });
  // The native knot compound (a foreign save's LeashKnot) is counted by region import, not reported lost, and the mobs' own Leash tags rebuild it.
  const chunk = new Chunk(0, 0), { x, z } = regionAddress(0, 0);
  const knotEntity = new Map([['id', { type: NBT.STRING, value: 'LeashKnot' }], ['TileX', { type: NBT.INT, value: 5 }], ['TileY', { type: NBT.INT, value: 0 }], ['TileZ', { type: NBT.INT, value: 0 }]]);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { entities: [tagOf(knot.nbt), knotEntity], tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual(report.entities.lost, []);
  assert.equal(report.entities.leashKnots, 1);
  // The import moves the region (the mob and its knot share the shift).
  const [m] = record.entities, sx = m.x - 5.5, sz = m.z - 0.5, spot = { x: 5 + sx, y: 0, z: 0 + sz };
  assert.deepEqual(record.entities.map((e) => e.leash), [{ knot: spot }]);
  const ew = new EntityWorld(flat, [{ ...m, x: 64.5, y: 1, z: 64.5, leash: { knot: { x: 64, y: 1, z: 64 } } }], () => 0.5);
  assert.deepEqual(ew.entities[0].leash, { knot: { x: 64, y: 1, z: 64 } });
  assert.ok(ew.knotAt(64, 1, 64) || (ew.leashRestore(ew.entities[0]), ew.knotAt(64, 1, 64)), 'the knot is made from the Leash tag');
});

test('the native LeashKnot compound loads at its Pos, as the unchanged class reads it', () => {
  assert.deepEqual([reference.knotLoad[0].created, reference.knotLoad[0].id, reference.knotLoad[0].x, reference.knotLoad[0].y, reference.knotLoad[0].z], [true, 'LeashKnot', 7.5, 65.5, -2.5]);
});

test('export then import round-trips equipment, drop chances, pickup, persistence, portal cooldown and leashes', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const live1 = (id) => ORIGINAL_ITEMS[`${id}:0`] ?? ORIGINAL_ITEMS[id];
  const gear = (stacks, dropChances, canPickUpLoot) => ({ equipment: stacks, dropChances, canPickUpLoot });
  const sword = { id: 276, count: 1, damage: 5, enchantments: [{ id: 16, lvl: 3 }, { id: 20, lvl: 1 }] };
  const helmet = { id: 306, count: 1, damage: 2, enchantments: [{ id: 0, lvl: 2 }] };
  const bow = { id: 261, count: 1, damage: 12, enchantments: [{ id: 48, lvl: 4 }] };
  assert.ok(live1(276) && live1(306) && live1(261));
  const mobs = [
    { type: 'zombie', health: 20, persistent: true, portalCooldown: 123, ...gear([sword, { id: 309, count: 1, damage: 7 }, null, { id: 307, count: 1, damage: 0, enchantments: [{ id: 4, lvl: 1 }] }, helmet], [f(1), f(0.5), f(0.25), f(0.1), 0], true), leash: { knot: { x: -4, y: 102, z: -2 } } },
    { type: 'skeleton', health: 20, ...gear([bow, null, null, null, helmet], [0, f(0.085), f(0.085), f(0.085), 2], false) },
    { type: 'wither_skeleton', health: 20, ...gear([{ id: 272, count: 1, damage: 3 }, null, null, null, null], Array(5).fill(f(0.085)), true) },
    { type: 'pigman', health: 20, angerLevel: 40, ...gear([{ id: 283, count: 1, damage: 0, enchantments: [{ id: 20, lvl: 2 }] }, null, { id: 316, count: 1, damage: 4 }, null, null], Array(5).fill(f(0.085)), false) },
    { type: 'zombie', health: 20, villager: true, growingAge: -1, ...gear([null, null, null, null, { id: 298, count: 1, damage: 0 }], Array(5).fill(f(0.085)), false) },
    { type: 'pig', health: 10, leash: { holder: 'player' }, portalCooldown: 7 },
  ].map((m, i) => ({ ...m, x: -2 - i * 0.75, y: 102, z: -2 }));
  const record = { id: 'mg', name: 'MG', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player, position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, entities: structuredClone(mobs), updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  assert.ok(!chunk.entities.some((e) => e.get('id').value === 'LeashKnot'), '1.7.10 never saves a knot entity');
  const zombie = chunk.entities[0];
  assert.equal(zombie.get('Equipment').value.items.length, 5);
  assert.equal(zombie.get('Equipment').value.items[2].size, 0, 'an empty slot is an empty compound');
  assert.equal(zombie.get('DropChances').value.items.length, 5);
  assert.equal(zombie.get('CanPickUpLoot').value, 1);
  assert.equal(zombie.get('PortalCooldown').value, 123);
  assert.deepEqual([...zombie.get('Leash').value.keys()], ['X', 'Y', 'Z']);
  assert.equal(chunk.entities[5].get('Leash').value.has('UUIDMost'), true);
  assert.equal(chunk.entities[5].get('PortalCooldown').value, 7);
  // Non-gear mobs still write the five empty compounds and 0.085 chances.
  assert.deepEqual(chunk.entities[5].get('DropChances').value.items, Array(5).fill(f(0.085)));
  const back = chunk.entities.map((e) => javaMobFromNbt(e, { shiftX: -w.originX, shiftZ: -w.originZ, convertItem: itemStackFromNbt }));
  assert.deepEqual(back.map((m) => m.type), mobs.map((m) => m.type));
  for (const [i, m] of mobs.entries()) {
    const b = back[i];
    if (m.equipment) {
      assert.deepEqual(rows(b.equipment), rows(m.equipment), `${m.type} #${i} equipment`);
      assert.deepEqual(b.dropChances, m.dropChances, `${m.type} #${i} drop chances`);
      assert.equal(b.canPickUpLoot, m.canPickUpLoot);
    }
    assert.equal(!!b.persistent, !!m.persistent);
    assert.equal(b.portalCooldown, m.portalCooldown);
    assert.deepEqual(b.leash, m.leash);
  }
  // The restored record is the same live mob, and exporting it again gives the same gear tags.
  const ew = new EntityWorld(flat, back.map((b) => ({ ...b, x: 64.5, y: 1, z: 64.5 })), () => 0.5);
  assert.deepEqual(rows(ew.entities[0].equipment), rows(mobs[0].equipment));
  assert.equal(ew.entities[0].canPickUpLoot, true);
  assert.equal(ew.entities[0].persistent, true);
});
