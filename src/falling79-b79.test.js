// Batch 79 falling79: TileEntityData per tile kind replayed against the native landed tile, flowing fluid ids, item Fire of a loaded item.
// Evidence: public/research/falling-tiles79-reference.json (Executed, tools/probes/FallingBlock78Probe.java Tiles79: the real EntityFallingBlock.onUpdate lands each block on a world double and the landed tile's writeToNBT is recorded).
import test from 'node:test';
import assert from 'node:assert/strict';
import ref from '../public/research/falling-tiles79-reference.json' with { type: 'json' };
import { NBT, decodeNbt } from './nbt.js';
import { nbtToJson } from './spawner-data.js';
import { fromOriginal } from './block-registry.js';
import { applyFallingTileData } from './falling-tiles.js';
import { itemStackFromNbt, itemFromOriginal } from './region-import.js';
import { Signs } from './signs.js';
import { MobSpawners, spawnerJSON } from './mob-spawner.js';
import { Skulls } from './skull.js';
import { Beacons } from './pyramid.js';
import { potFromNbt, potContents } from './stone-utility.js';
import { newCommandBlock, readCommandBlock } from './command-block.js';
import { readNoteTile } from './note-blocks.js';
import { readJukeboxStack } from './jukebox.js';
import { isDisc, canonicalDisc } from './note-jukebox-content.js';
import { World } from './world.js';
import { nbtGet } from './nbt-get.js';

const X = 3, Y = 60, Z = 3;
const decode = (hex) => decodeNbt(Buffer.from(hex, 'hex')).tag.value;
const SIZES = { chest: 27, furnace: 3, dispenser: 9, dropper: 9, hopper: 5, brewing: 4 };
const STORE = { chest: 'chests', furnace: 'furnaces', dispenser: 'dispensers', dropper: 'dispensers', hopper: 'hoppers', brewing: 'brewing' };
const itemsOf = (list) => list.map((s, i) => (s ? [i, s.id, s.damage, s.count] : null)).filter(Boolean);
const str = (m, k) => { const t = m.get(k); return t?.type === NBT.STRING ? t.value : null; };

// What the native landed tile holds, in the port's terms.
function nativeProj(name, t) {
  if (SIZES[name]) {
    const items = [];
    for (const e of t.get('Items')?.value.items ?? []) {
      const slot = nbtGet(e, 'Slot', NBT.BYTE, 0) & 255, s = itemStackFromNbt(e, { allowEmpty: true });
      if (s) items.push([slot, s.id, s.damage, s.count]);
    }
    // a dispenser or dropper keeps an empty CustomName natively (hasCustomInventoryName is false for it) and the port keeps "" too: both read as no name
    const out = { items: items.sort((a, b) => a[0] - b[0]), name: str(t, 'CustomName') || null };
    if (name === 'furnace') Object.assign(out, { burn: nbtGet(t, 'BurnTime', NBT.SHORT, 0), cook: nbtGet(t, 'CookTime', NBT.SHORT, 0) });
    // a placed hopper's fresh TransferCooldown is -1 natively and 0 in the port (both idle: TileEntityHopper.updateEntity sets it to 0 on its first tick)
    if (name === 'hopper') { const c = nbtGet(t, 'TransferCooldown', NBT.INT, 0); out.cooldown = c === -1 ? 0 : c; }
    if (name === 'brewing') out.brewTime = nbtGet(t, 'BrewTime', NBT.SHORT, 0);
    return out;
  }
  switch (name) {
    case 'sign': return { text: [1, 2, 3, 4].map((i) => str(t, `Text${i}`)) };
    case 'spawner': {
      const pairs = ['EntityId', 'Delay', 'MinSpawnDelay', 'MaxSpawnDelay', 'SpawnCount', 'MaxNearbyEntities', 'RequiredPlayerRange', 'SpawnRange'].map((k) => [k, t.get(k).value]);
      const out = Object.fromEntries(pairs);
      // the port keeps SpawnData as { type: EntityId, weight: 1, props } and each potential as { type: Type, weight: Weight, props: Properties }
      if (t.has('SpawnData')) out.SpawnData = { type: out.EntityId, weight: 1, props: nbtToJson({ type: NBT.COMPOUND, value: t.get('SpawnData').value }) };
      if (t.has('SpawnPotentials')) out.SpawnPotentials = t.get('SpawnPotentials').value.items.map((i) => ({ type: i.get('Type').value, weight: i.get('Weight').value, props: nbtToJson({ type: NBT.COMPOUND, value: i.get('Properties')?.value ?? new Map() }) }));
      return out;
    }
    case 'skull': {
      const o = t.get('Owner')?.value;
      const ty = t.get('SkullType').value; return { type: ty >= 0 && ty <= 4 ? ty : 0, rot: t.get('Rot').value & 15, owner: o ? [str(o, 'Name'), str(o, 'Id')] : null };
    }
    case 'flowerpot': return { pot: potFromNbt({ Item: t.get('Item').value, Data: t.get('Data').value }, itemFromOriginal) }; // b81: undrawn items keep their drop stack
    case 'command': return (({ command, successCount, customName, trackOutput, lastOutput }) => ({ command, successCount, customName, trackOutput, lastOutput }))(readCommandBlock(t));
    case 'note': return { note: readNoteTile(t).note };
    case 'jukebox': { const { record } = readJukeboxStack(t, (c) => { const m = itemFromOriginal(c.get('id').value, 0); return m ? { id: m.id, count: c.get('Count')?.value ?? 0, damage: 0 } : null; }); return { record: record ? { id: isDisc(record.id) ? canonicalDisc(record.id) : record.id, count: record.count, damage: 0 } : null }; } // b95 tiles95: native holds any stack
    case 'beacon': return { primary: t.get('Primary').value, secondary: t.get('Secondary').value, levels: t.get('Levels').value };
    case 'comparator': return { signal: t.get('OutputSignal').value };
    default: return null;
  }
}

function freshHost(name) {
  const world = new World('79', 'flat', 12);
  const host = { survival: {}, signs: new Signs(), spawners: new MobSpawners(), skulls: new Skulls(), beacons: new Beacons(), world, comparators: new Map() };
  const cmd = new Map(), notes = new Map(), boxes = new Map();
  host.commandBlocks = { tile: (x, y, z) => cmd.get(`${x},${y},${z}`) ?? (cmd.set(`${x},${y},${z}`, newCommandBlock()), cmd.get(`${x},${y},${z}`)) };
  host.music = { noteBlocks: { tile: (x, y, z) => notes.get(`${x},${y},${z}`) ?? (notes.set(`${x},${y},${z}`, { note: 0 }), notes.get(`${x},${y},${z}`)) }, jukeboxes: { tile: (x, y, z) => boxes.get(`${x},${y},${z}`) ?? (boxes.set(`${x},${y},${z}`, { record: null }), boxes.get(`${x},${y},${z}`)) } };
  // the landed block's fresh tile exists before the data arrives (Chunk.func_150807_a)
  if (name === 'sign') host.signs.create(X, Y, Z);
  if (name === 'spawner') host.spawners.add({ x: X, y: Y, z: Z });
  if (name === 'skull') host.skulls.create(X, Y, Z, 0, 0, '', null);
  if (name === 'beacon') host.beacons.ensure(X, Y, Z);
  return { host, cmd, notes, boxes };
}
function portProj(name, ctx, rec) {
  const { host } = ctx, key = `${X},${Y},${Z}`;
  if (SIZES[name]) {
    const e = host.survival[STORE[name]]?.[key];
    if (!e) return { missing: true };
    const out = { items: itemsOf(e.items ?? []), name: e.name || null };
    if (name === 'furnace') Object.assign(out, { burn: e.burn ?? 0, cook: e.cook ?? 0 });
    if (name === 'hopper') out.cooldown = e.cooldown ?? 0;
    if (name === 'brewing') out.brewTime = e.brewTime ?? 0;
    return out;
  }
  switch (name) {
    case 'sign': return { text: host.signs.tile(X, Y, Z).text };
    case 'spawner': return spawnerJSON(host.spawners.get(X, Y, Z));
    case 'skull': { const s = host.skulls.tile(X, Y, Z); return { type: s.type, rot: s.rot, owner: s.profile ? [s.profile.name ?? null, s.profile.id ?? null] : null }; }
    case 'flowerpot': return { pot: potContents(host.world, X, Y, Z) };
    case 'command': return (({ command, successCount, customName, trackOutput, lastOutput }) => ({ command, successCount, customName, trackOutput, lastOutput }))(ctx.cmd.get(key) ?? newCommandBlock());
    case 'note': return { note: ctx.notes.get(key)?.note ?? 0 };
    case 'jukebox': { const r = ctx.boxes.get(key)?.record; return { record: r ? { id: r.id, count: r.count, damage: r.damage } : null }; } // b96 tiles96: the projection compares id, count and the port damage; the tag and raw Damage are checked in tiles96-b96.test.js
    case 'beacon': { const b = host.beacons.get(X, Y, Z); return { primary: b.primary, secondary: b.secondary, levels: b.levels }; }
    case 'comparator': return { signal: host.comparators.get(key)?.signal ?? 0 };
    default: return null;
  }
}
export function replayRow(r) {
  const ctx = freshHost(r.name), cell = fromOriginal(r.block, r.meta);
  if (r.data) applyFallingTileData({ block: cell.id, x: X, y: Y, z: Z, data: nbtToJson({ type: NBT.COMPOUND, value: decode(r.data) }), dataByte: r.meta, host: ctx.host });
  return { port: portProj(r.name, ctx), native: nativeProj(r.name, decode(r.tile)) };
}

// Rows the native game cannot finish: xj.h throws out of readFromNBT (an invalid LastOutput), which ends the tick with a crash report; the port leaves the fresh tile instead.
const crashes = ref.tile.filter((r) => r.error);
const isCachedName = (r, res) => r.name === 'skull' && r.label.startsWith('extratype') && res.native.owner?.[0] === 'Notch';

test('every landed-tile row replays: the port state after applyFallingTileData equals the native tile (executed rows)', () => {
  const kinds = new Map(), bad = [];
  for (const r of ref.tile) {
    if (r.name === 'plain' || r.data === null || r.error) continue;
    assert.equal(r.landed, true, `${r.name} ${r.label} landed natively`);
    const res = replayRow(r);
    kinds.set(r.name, (kinds.get(r.name) ?? 0) + 1);
    // Skull ExtraType resolves a name through the server's profile cache or the Mojang API; the executed row has Notch cached under a made-up UUID, which the port cannot know: name only.
    if (isCachedName(r, res)) { if (res.port.owner?.[0] !== 'Notch') bad.push([r.name, r.label, 'ExtraType name']); continue; }
    if (JSON.stringify(res.port) !== JSON.stringify(res.native)) bad.push([r.name, r.label, JSON.stringify(res.port), JSON.stringify(res.native)]);
  }
  assert.deepEqual(bad, []);
  for (const k of ['chest', 'furnace', 'dispenser', 'dropper', 'hopper', 'brewing', 'sign', 'spawner', 'skull', 'flowerpot', 'command', 'note', 'jukebox', 'beacon', 'comparator']) assert.ok(kinds.get(k) >= 10, `${k} rows`);
});

test('a block with no tile entity ignores TileEntityData, as native does (executed)', () => {
  for (const r of ref.tile.filter((x) => x.name === 'plain')) {
    assert.equal(r.tile, null);
    assert.equal(applyFallingTileData({ block: fromOriginal(r.block, 0).id, x: X, y: Y, z: Z, data: nbtToJson({ type: NBT.COMPOUND, value: decode(r.data) }), dataByte: 0, host: freshHost('plain').host }), false);
  }
});

test('rows where native xj.h throws (invalid LastOutput) leave the port tile fresh', () => {
  assert.ok(crashes.length >= 4);
  for (const r of crashes) {
    assert.match(r.error, /Malformed|EOF/);
    const ctx = freshHost(r.name);
    assert.equal(applyFallingTileData({ block: fromOriginal(r.block, r.meta).id, x: X, y: Y, z: Z, data: nbtToJson({ type: NBT.COMPOUND, value: decode(r.data) }), dataByte: r.meta, host: ctx.host }), false);
    assert.deepEqual(portProj(r.name, ctx), nativeProj(r.name, decode(r.base)));
  }
});

// ---- flowing fluid ids (native ItemBlocks 8, 9, 10, 11 are four distinct items, Executed: falling-tiles79-reference.json drop rows) ----
test('flowing water and lava drops keep native ids 8 and 10 through the falling drop, item load and export', async () => {
  const { fallingDropStack } = await import('./falling-drops.js');
  const { writeContainerTile } = await import('./region-export.js');
  const { PlayerInventory } = await import('./inventory.js');
  const { ITEMS } = await import('./survival.js');
  const rows = Object.fromEntries(ref.drop.map((r) => [r.block, r.items]));
  for (const [orig, want] of [[8, 8], [9, 9], [10, 10], [11, 11]]) {
    assert.equal(rows[orig], `${want}x1`, `native drop of block ${orig}`);
    const m = fromOriginal(orig, 0);
    const stack = fallingDropStack({ block: m.id, meta: 0, ...(m.state?.flowing ? { flowing: true } : {}) });
    const back = new PlayerInventory(ITEMS).read(stack, true);
    const tile = writeContainerTile('chests', { items: [back] }, 0, 0, 0);
    const first = tile.get('Items').value.items[0];
    assert.equal(first.get('id').value, want, `export of block ${orig}`);
    // import side: the saved id 8/10 comes back as a stack that exports 8/10 again
    const imported = itemStackFromNbt(first);
    assert.equal(imported.rawId, orig === 8 || orig === 10 ? orig : undefined);
    const again = writeContainerTile('chests', { items: [imported] }, 0, 0, 0).get('Items').value.items[0];
    assert.equal(again.get('id').value, want);
  }
});

// ---- item Fire (native Entity.fire is saved as is; an item loaded with Age > 0 that never ticks writes the saved Fire back) ----
test('an unticked loaded item keeps its saved Fire; a ticked one falls back to the age rule', async () => {
  const { ItemEntities } = await import('./item-entities.js');
  const items = new ItemEntities(() => 0.5);
  items.load([{ stack: { id: 3, count: 1, damage: 0 }, x: 1, y: 70, z: 1, age: 100, fire: 0 }, { stack: { id: 3, count: 1, damage: 0 }, x: 2, y: 70, z: 2, age: 100, fire: 17 }], (s) => s);
  const [a, b] = items.serialize();
  assert.equal(a.fire, 0);
  assert.equal(b.fire, 17);
  items.items[0].ticks = 1;
  items.items[0].fire = -1; // what a tick's move leaves (Entity.moveEntity: a counter <= 0 rests at -fireResistance)
  assert.equal(items.serialize()[0].fire, undefined); // ticked, at -1: export falls back to the age rule (b80 fluids80: any other counter is written, fluids80-b80.test.js)
});

test('a falling record of Tile 8 keeps flowing through FallingBlocks save and restore', async () => {
  const { FallingBlocks } = await import('./falling.js');
  const w = new World(1, 1, 1);
  const rec = { block: 10, meta: 0, flowing: true, x: 3.5, y: 70, z: 3.5, vx: 0, vy: 0, vz: 0, ticks: 0, onGround: false, fallDistance: 0 };
  const fb = new FallingBlocks(w, {}, [rec]);
  assert.equal(fb.serialize?.()[0]?.flowing ?? fb.save?.()[0]?.flowing, true);
});
