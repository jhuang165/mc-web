// b101 tiles101: item NBT kept raw through the dedicated server wire (cleanStack), world-import minecart items, item frames, dispensers and every container tile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NBT } from './nbt.js';
import { itemStackFromNbt, readContainerTile, hangingFromNbt } from './region-import.js';
import { stackNbt, writeContainerTile } from './region-export.js';
import { rawOf } from './item-tags.js';
import { copyStack } from './inventory.js';
import { cleanStack, wireStack } from './multiplayer/server-containers.js';
import { importedRuntime } from './world-import.js';
import { Hanging } from './hanging.js';

const t = (type, value) => ({ type, value });
const comp = (o) => t(NBT.COMPOUND, new Map(Object.entries(o)));
const lst = (items) => t(NBT.LIST, { elementType: items.length ? NBT.COMPOUND : NBT.END, items: items.map((o) => new Map(Object.entries(o))) });
const report = () => ({ unmappedItems: 0 });
const compound = (id, tagMap, count = 1) => new Map([['id', t(NBT.SHORT, id)], ['Count', t(NBT.BYTE, count)], ['Damage', t(NBT.SHORT, 0)], ['tag', t(NBT.COMPOUND, tagMap)]]);
const sword = () => itemStackFromNbt(compound(276, new Map([
  ['Unbreakable', t(NBT.INT, 1)],
  ['ench', lst([{ id: t(NBT.INT, 16), lvl: t(NBT.INT, 3), foo: t(NBT.INT, 1) }])],
  ['mod', comp({ k: t(NBT.LONG, 7n) })],
  ['display', comp({ Name: t(NBT.STRING, 'n'), extra: t(NBT.INT, 4) })],
])));
const star = () => itemStackFromNbt(compound(402, new Map([['Explosion', comp({ Type: t(NBT.INT, 1), Colors: t(NBT.INT_ARRAY, Int32Array.of(255)), Flicker: t(NBT.INT, 1), foo: t(NBT.STRING, 'x') })]])));
const tagOfStack = (s) => rawOf(t(NBT.COMPOUND, stackNbt(copyStack(s), 0, report(), false).get('tag').value));
const kept = (got, want, label) => { assert.ok(got, label); assert.deepEqual(tagOfStack(got), tagOfStack(want), label); };

test('the stacks used here carry the raw forms', () => {
  const s = sword();
  assert.ok(s.rawForms?.Unbreakable && s.enchantments[0].raw && s.extraRaw?.mod && s.displayExtraRaw?.extra);
  assert.ok(star().explosion);
});

test('server wire: cleanStack and wireStack keep rawForms, entry raw and unknown keys', () => {
  for (const s of [sword(), star()]) {
    kept(cleanStack(JSON.parse(JSON.stringify(s))), s, 'client -> server');
    kept(cleanStack(wireStack(s)), s, 'server -> client -> server');
    kept(wireStack(s), s, 'wireStack');
  }
  const bad = { ...sword(), rawForms: { Unbreakable: { t: 99, v: 1 } }, extraRaw: 5 };
  const c = cleanStack(JSON.parse(JSON.stringify(bad)));
  assert.equal(c.rawForms, undefined);
  assert.equal(c.extraRaw, undefined);
});

test('world import: minecart items keep enchantment entry raw and the raw forms', () => {
  const s = sword();
  const out = importedRuntime({ minecarts: { version: 1, carts: [{ x: 1, y: 2, z: 3, type: 1, items: [{ slot: 0, id: s.id, count: 1, damage: 0, ...JSON.parse(JSON.stringify(s)) }] }] } });
  const it = out.minecarts.carts[0].items[0];
  assert.deepEqual(it.enchantments, s.enchantments);
  assert.deepEqual(it.rawForms, s.rawForms);
  assert.deepEqual(it.extraRaw, s.extraRaw);
  assert.deepEqual(it.displayExtraRaw, s.displayExtraRaw);
});

test('item frame: placing, saving and loading keep the raw forms', () => {
  const held = sword(), h = new Hanging();
  const e = { kind: 'frame', item: null, rotation: 0 };
  assert.equal(h.interact(e, held).action, 'insert');
  kept(e.item, held, 'placed');
  assert.notEqual(e.item.enchantments, held.enchantments, 'a copy, not the held stack\'s arrays');
  assert.notEqual(e.item.rawForms, held.rawForms);
  const tag = new Map([['TileX', t(NBT.INT, 1)], ['TileY', t(NBT.INT, 2)], ['TileZ', t(NBT.INT, 3)], ['Direction', t(NBT.BYTE, 0)], ['Item', t(NBT.COMPOUND, stackNbt(e.item, undefined, report()))], ['ItemRotation', t(NBT.BYTE, 0)]]);
  kept(hangingFromNbt(tag, 'ItemFrame').item, held, 'saved and loaded');
});

test('every container tile saves and loads the raw forms', () => {
  for (const [name, size] of [['chests', 27], ['dispensers', 9], ['hoppers', 5], ['brewing', 4], ['furnaces', 3]]) {
    const items = Array(size).fill(null);
    items[0] = sword(); items[size - 1] = star();
    for (const dropper of name === 'dispensers' ? [false, true] : [false]) {
      const nbt = writeContainerTile(name, { items }, 1, 2, 3, { dropper });
      const back = readContainerTile(nbt.get('id').value, nbt);
      kept(back.record.items[0], items[0], `${name} sword`);
      kept(back.record.items[size - 1], items[size - 1], `${name} star`);
    }
  }
});

test('dispenser: the thrown stack keeps the raw forms', async () => {
  const { World } = await import('./world.js');
  const { fromOriginal } = await import('./block-registry.js');
  const { createRedstoneRuntime } = await import('./redstone-runtime.js');
  const world = new World('tiles101', 'meadow'), O = [20, 20, 20], dispensers = {}, thrown = [];
  for (let x = -3; x <= 3; x++) for (let y = -2; y <= 3; y++) for (let z = -3; z <= 3; z++) world.put(O[0] + x, O[1] + y, O[2] + z, 0, 0, false);
  const put = (dx, id, meta) => { const m = fromOriginal(id, meta); world.put(O[0] + dx, O[1], O[2], m.id, m.meta, false); };
  put(0, 23, 3);
  const s = sword(); s.id = 280; s.count = 2; // an inert item keeps the default throw
  dispensers[`${O[0]},${O[1]},${O[2]}`] = { items: [s, ...Array(8).fill(null)] };
  const runtime = createRedstoneRuntime({ world, game: { dispensers: () => dispensers, maxStack: () => 64, sound() {}, dispense: { spawnItem: (st) => thrown.push(st) } } });
  put(1, 152, 0);
  runtime.redstone.placed(O[0] + 1, O[1], O[2]);
  runtime.flush();
  for (let i = 0; i < 6; i++) runtime.tick();
  assert.equal(thrown.length, 1);
  const rest = dispensers[`${O[0]},${O[1]},${O[2]}`].items[0];
  for (const st of [thrown[0], rest]) { assert.deepEqual(st.rawForms, s.rawForms); assert.deepEqual(st.enchantments, s.enchantments); assert.deepEqual(st.extraRaw, s.extraRaw); }
});
