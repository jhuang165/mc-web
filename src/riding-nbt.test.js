// Mobs on boats and minecarts, and villagers with Offers, through Java chunk NBT. Native layouts are replayed from
// public/research/riding-nbt-reference.json (tools/probes/RidingNbtProbe.java, VillagerNbtProbe.java; tools/verify-riding-nbt.mjs): the unchanged
// 1.7.10 classes write the rider with a nested "Riding" mount and read the chain back with mountEntity. Notes: boats.md, minecarts.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/riding-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt, chunkFromNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionSlot, regionAddress } from './region-file.js';
import { importJavaRegionArea, itemStackFromNbt } from './region-import.js';
import { exportJavaSave } from './region-export.js';
import { importedRuntime } from './world-import.js';
import { javaMobFromNbt } from './java-mobs.js';
import { World } from './world.js';
import { Survival } from './survival.js';
import { EntityWorld } from './entities.js';
import { Boats } from './boats.js';
import { Minecarts } from './minecarts.js';
import { linkVehicleRiders } from './vehicle-riders.js';
import { splitRuntime, joinRuntime } from './chunk-runtime.js';

const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const tagOf = (hex) => decodeNbt(bytes(hex)).tag.value;
const get = (map, key) => map.get(key)?.value;
const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), getMeta: () => 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }), height: 256 };
// Plain JSON of a tag (maps become objects, lists their items) for deep comparison of native and exported compounds.
const plain = (t) => (t instanceof Map ? Object.fromEntries([...t].map(([k, v]) => [k, plain(v)])) : t && typeof t === 'object' && 'type' in t && 'value' in t ? (t.type === NBT.LIST ? t.value.items.map(plain) : plain(t.value)) : t);
const chainOf = (tag) => { const out = [tag]; while (out[out.length - 1].has('Riding')) out.push(get(out[out.length - 1], 'Riding')); return out; };
const setPos = (member, x, z) => { const l = member.get('Pos').value.items; l[0] = x; l[2] = z; };
const readChunk = async (files, w, cx, cz) => { const a = regionAddress(cx, cz); return chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z)))); };

test('the probe saw a boat, a minecart, a chest cart and a three-deep chain, each skipped as a chunk entity while ridden', () => {
  assert.equal(reference.records.length, 4);
  assert.deepEqual(reference.records.map((r) => r.ids), [['Zombie', 'Boat'], ['Skeleton', 'MinecartRideable'], ['Zombie', 'MinecartChest'], ['Skeleton', 'Spider', 'Boat']]);
  for (const r of reference.records) assert.ok(r.riderSaved && !r.mountAloneSaved && r.mountMountSaved && r.linked, r.kind);
  assert.deepEqual(chainOf(tagOf(reference.records[3].riderNbt)).map((m) => get(m, 'id')), ['Skeleton', 'Spider', 'Boat']);
});

test('native Riding chains with a boat or a minecart mount import as vehicles with linked passengers', async () => {
  const chunk = new Chunk(0, 0);
  const entities = reference.records.map((r, i) => { const top = tagOf(r.riderNbt); for (const m of chainOf(top)) setPos(m, 3.5 + 3.5 * i, 4.5); return top; });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual(report.entities.lost, [], JSON.stringify(report.entities));
  assert.deepEqual(report.entities.converted, { Zombie: 2, Skeleton: 2, Spider: 1, Boat: 2, MinecartRideable: 1, MinecartChest: 1 }, JSON.stringify(report.entities));
  assert.equal(record.entities.length, 5);
  assert.equal(record.boats.length, 2);
  assert.deepEqual(record.minecarts.carts.map((c) => c.type), [0, 1]);
  // The first boat is the probe's: position (moved), motion and yaw as the native mount read-back said.
  const native = reference.records[0].mount, boat = record.boats[0];
  assert.deepEqual([boat.y, ...boat.motion, boat.rotation[0]], [native.y, native.mx, native.my, native.mz, native.yaw]);
  assert.deepEqual([(boat.x - 3.5) % 16, (boat.z - 4.5) % 16], [0, 0], 'moved by whole chunks with the area');
  const mobsOf = (t) => record.entities.filter((m) => m.type === t);
  assert.equal(mobsOf('zombie')[0].riding, `boat-${boat.id}`);
  assert.equal(mobsOf('skeleton')[0].riding, `cart-${record.minecarts.carts[0].id}`);
  assert.equal(mobsOf('zombie')[1].riding, `cart-${record.minecarts.carts[1].id}`);
  assert.equal(mobsOf('skeleton')[1].riding, mobsOf('spider')[0].id);
  assert.equal(mobsOf('spider')[0].riding, `boat-${record.boats[1].id}`);
  assert.equal(new Set([...record.boats.map((b) => b.id), ...record.minecarts.carts.map((c) => c.id), ...record.entities.map((m) => m.id)]).size, 9, 'every id is unique');

  // The sanitized record loads into live links: the whole chain sits in the boat and the carts.
  const runtime = importedRuntime(JSON.parse(JSON.stringify(record)));
  const boats = Boats.fromJSON(runtime.boats), carts = Minecarts.fromJSON(runtime.minecarts);
  const ew = new EntityWorld(flat, runtime.entities.map((m) => ({ ...m, x: 64.5, y: 1, z: 64.5 })), () => 0.5);
  linkVehicleRiders(ew.entities, boats.carts, carts.carts, (m) => ew.size(m)[1]);
  const live = (t, i = 0) => ew.entities.filter((e) => e.type === t)[i];
  assert.equal(live('zombie').ridingEntity, boats.carts[0]);
  assert.equal(boats.carts[0].passenger, live('zombie'));
  assert.equal(live('skeleton', 1).ridingEntity, live('spider'));
  assert.equal(live('spider').ridingEntity, boats.carts[1]);
  assert.equal(live('skeleton', 0).ridingEntity, carts.carts[0]);
  assert.equal(live('zombie', 1).ridingEntity, carts.carts[1]);
});

test('a browser boat and cart with passengers export as Riding mounts, a free boat stays a chunk entity, and the pair imports again', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const mobs = [
    { id: 'mob-1', type: 'zombie', x: -2, y: 101.7, z: -2, health: 20, riding: 'boat-3' },
    { id: 'mob-2', type: 'skeleton', x: -6, y: 101.7, z: -2, health: 20, riding: 'cart-7' },
    { id: 'mob-3', type: 'cow', x: -9, y: 102, z: -2, health: 10 },
  ];
  const boats = [{ id: 3, x: -2, y: 102, z: -2, motion: [0.125, 0, -0.25], rotation: [90, 0], fallDistance: 0, fire: -1, onGround: false },
    { id: 4, x: -12, y: 102, z: -2, motion: [0, 0, 0], rotation: [45, 0], fallDistance: 0, fire: -1, onGround: true }];
  const carts = [{ id: 7, type: 0, x: -6, y: 102, z: -2, motion: [0, 0, 0.25], rotation: [180, 0], fallDistance: 0, fire: -1, onGround: true, items: [] }];
  const record = { id: 'rb', name: 'RB', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player, position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 },
    entities: structuredClone(mobs), boats: structuredClone(boats), minecarts: { version: 1, carts: structuredClone(carts) }, updated: 1700000000000 };
  const { files, report } = await exportJavaSave(record, { world: w });
  assert.equal(report.unsupportedEntities, 0);
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, chunk = await readChunk(files, w, cx, cz);
  // The ridden boat and cart are not chunk entities (Entity.writeToNBTOptional); the free boat and the cow are.
  assert.deepEqual(chunk.entities.map((e) => get(e, 'id')).sort(), ['Boat', 'Cow', 'Skeleton', 'Zombie']);
  const zombie = chunk.entities.find((e) => get(e, 'id') === 'Zombie'), skeleton = chunk.entities.find((e) => get(e, 'id') === 'Skeleton');
  const mount = get(zombie, 'Riding'), cartMount = get(skeleton, 'Riding');
  assert.equal(get(mount, 'id'), 'Boat');
  assert.equal(get(cartMount, 'id'), 'MinecartRideable');
  // The mount compound carries exactly the keys the native one does (EntityBoat and EntityMinecartEmpty add none of their own).
  // (Entity's UUIDMost/UUIDLeast are the one difference: no entity this exporter writes carries them, and a load without them draws fresh ones.)
  const keys = (m) => [...m.keys()].filter((k) => !k.startsWith('UUID')).sort();
  assert.deepEqual(keys(mount), keys(get(tagOf(reference.records[0].riderNbt), 'Riding')));
  assert.deepEqual(keys(cartMount), keys(get(tagOf(reference.records[1].riderNbt), 'Riding')));
  assert.deepEqual(plain(mount.get('Motion')), [0.125, 0, -0.25]);
  assert.deepEqual(plain(mount.get('Rotation')), [90, 0]);
  assert.deepEqual(plain(mount.get('Pos')).map((v, i) => (i === 1 ? v : Math.round(v - [w.originX, 0, w.originZ][i]))), [-2, 102, -2]);

  const regions = [...files].filter(([n]) => n.startsWith('region/')).map(([n, b]) => ({ filename: n.split('/').pop(), bytes: b }));
  const imported = await importJavaRegionArea(regions, { area: { chunkX: cx, chunkZ: cz, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual(imported.report.entities.lost, []);
  const back = imported.record;
  assert.equal(back.boats.length, 2);
  assert.equal(back.minecarts.carts.length, 1);
  const riderBoat = back.boats.find((b) => back.entities.some((m) => m.riding === `boat-${b.id}`)), freeBoat = back.boats.find((b) => b !== riderBoat);
  // The default destination moves the area by whole chunks; the boats keep their distance.
  assert.deepEqual([riderBoat.x - freeBoat.x, riderBoat.y, riderBoat.z - freeBoat.z, riderBoat.motion, riderBoat.rotation], [10, 102, 0, [0.125, 0, -0.25], [90, 0]]);
  assert.deepEqual([freeBoat.onGround, freeBoat.rotation[0]], [true, 45]);
  assert.equal(back.entities.find((m) => m.type === 'skeleton').riding, `cart-${back.minecarts.carts[0].id}`);
  assert.equal(back.entities.find((m) => m.type === 'cow').riding, undefined);
});

test('a chunk-streamed save keeps a passenger and its vehicle linked by id across columns', () => {
  const record = { id: 'cr', entities: [{ id: 'mob-1', type: 'zombie', x: 17.9, y: 64, z: 3, health: 20, riding: 'boat-5' }, { id: 'mob-2', type: 'pig', x: 2, y: 64, z: 2, health: 10 }],
    boats: [{ id: 5, x: 17.5, y: 64.3, z: 3, motion: [0, 0, 0], rotation: [0, 0], onGround: true }, { id: 6, x: -40, y: 64.3, z: 3, onGround: false }],
    minecarts: { version: 1, carts: [{ id: 9, type: 0, x: 40, y: 64, z: 40, items: [] }] }, player: {} };
  const { metadata, columns } = splitRuntime(record);
  assert.ok(columns.length >= 4, 'the zombie and its boat are not in the pig\'s column');
  const joined = joinRuntime(metadata, JSON.parse(JSON.stringify(columns)));
  assert.deepEqual(joined.boats.map((b) => b.id), [5, 6]);
  assert.equal(joined.entities[0].riding, 'boat-5');
  const boats = Boats.fromJSON(joined.boats), carts = Minecarts.fromJSON(joined.minecarts), ew = new EntityWorld(flat, joined.entities.map((m) => ({ ...m })), () => 0.5);
  linkVehicleRiders(ew.entities, boats.carts, carts.carts, (m) => ew.size(m)[1]);
  assert.equal(ew.entities.find((e) => e.type === 'zombie').ridingEntity, boats.carts[0]);
  // Saved again, the passenger names the same boat.
  assert.equal(ew.serialize().find((m) => m.type === 'zombie').riding, 'boat-5');
});

test('native villagers with Offers import with their trades, uses, Profession, Riches and Age, and export the same NBT', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const natives = reference.villagers;
  assert.deepEqual(natives.map((v) => v.kind), ['none', 'farmer', 'smith']);
  const imported = natives.map((v) => javaMobFromNbt(tagOf(v.nbt), { shiftX: 0, shiftZ: 0, convertItem: (c) => itemStackFromNbt(c) }));
  for (const [i, v] of natives.entries()) {
    const m = imported[i];
    assert.deepEqual([m.type, m.profession, m.riches, m.growingAge], ['villager', v.profession, v.riches, v.age], v.kind);
    if (!v.hasOffers) { assert.equal(m.offers, undefined, 'a villager that never traded has no offers'); continue; }
    const nat = (s) => (s ? { id: s.id, count: s.count, damage: s.damage } : null);
    assert.deepEqual(m.offers.map((o) => ({ buy: nat(o.buy), buyB: o.buyB ? nat(o.buyB) : null, sell: nat(o.sell), uses: o.uses, maxUses: o.maxUses })),
      v.offers.map((o) => ({ buy: nat(o.buy), buyB: nat(o.buyB), sell: nat(o.sell), uses: o.uses, maxUses: o.maxUses })), v.kind);
    // The live villager keeps the trading state (a spent offer stays spent).
    const live = new EntityWorld(flat, [{ ...m, x: 64.5, y: 1, z: 64.5 }], () => 0.5).entities[0];
    assert.equal(live.offers.length, v.offers.length);
    assert.deepEqual(live.offers.map((o) => [o.uses, o.maxUses]), v.offers.map((o) => [o.uses, o.maxUses]));
  }
  // Export the imported records: Profession, Riches, Age and Offers equal the native compound (the same values in the same layout).
  const record = { id: 'vo', name: 'VO', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player, position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 },
    entities: imported.map((m, i) => ({ ...m, id: `mob-${i + 1}`, x: -2 - i * 2, y: 102, z: -2 })), updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const chunk = await readChunk(files, w, -1 + w.originX / 16, -1 + w.originZ / 16);
  const exported = chunk.entities.filter((e) => get(e, 'id') === 'Villager');
  assert.equal(exported.length, 3);
  for (const [i, v] of natives.entries()) {
    const nat = tagOf(v.nbt), out = exported[i];
    for (const k of ['Profession', 'Riches', 'Age']) assert.deepEqual(plain(out.get(k)), plain(nat.get(k)), `${v.kind} ${k}`);
    assert.deepEqual(out.has('Offers'), nat.has('Offers'), `${v.kind} has Offers`);
    if (nat.has('Offers')) assert.deepEqual(plain(out.get('Offers')), plain(nat.get('Offers')), `${v.kind} Offers`);
  }
});
