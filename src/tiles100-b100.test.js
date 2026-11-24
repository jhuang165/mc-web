// b100 tiles100: numeric tags the port reads tolerantly (Unbreakable, map_is_scaling, ench id/lvl) and extra keys inside ench / Explosion / Fireworks compounds
// are written back as read (1.7.10 ItemStack keeps the whole `tag`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { NBT } from './nbt.js';
import { readItemTag, itemStackFromNbt } from './region-import.js';
import { stackNbt } from './region-export.js';
import { rawOf } from './item-tags.js';
import { copyStack } from './inventory.js';
import { skullFields, enchPair } from './mob-equipment.js';

const t = (type, value) => ({ type, value });
const comp = (o) => t(NBT.COMPOUND, new Map(Object.entries(o)));
const lst = (items) => t(NBT.LIST, { elementType: items.length ? NBT.COMPOUND : NBT.END, items: items.map((o) => new Map(Object.entries(o))) });
const report = () => ({ unmappedItems: 0 });
const roundTrip = (tagMap, id = 276) => {
  const c = new Map([['id', t(NBT.SHORT, id)], ['Count', t(NBT.BYTE, 1)], ['Damage', t(NBT.SHORT, 0)], ['tag', t(NBT.COMPOUND, tagMap)]]);
  const stack = itemStackFromNbt(c);
  return { stack, out: stackNbt(copyStack(stack), 0, report(), false).get('tag').value };
};
const same = (a, b) => assert.deepEqual(rawOf(a), rawOf(b));

test('Unbreakable and map_is_scaling keep their width', () => {
  for (const [type, v] of [[NBT.INT, 1], [NBT.SHORT, 1], [NBT.LONG, 1n], [NBT.BYTE, 5], [NBT.DOUBLE, 1]]) {
    const { stack, out } = roundTrip(new Map([['Unbreakable', t(type, v)]]));
    assert.equal(stack.unbreakable, true);
    same(out.get('Unbreakable'), t(type, v));
  }
  const { stack, out } = roundTrip(new Map([['map_is_scaling', t(NBT.INT, 1)]]), 358);
  assert.equal(stack.mapScaling, true);
  same(out.get('map_is_scaling'), t(NBT.INT, 1));
  // an edited value writes the canonical byte again
  const edited = copyStack({ ...stack, mapScaling: false });
  same(stackNbt(edited, 0, report()).get('tag').value.get('map_is_scaling'), t(NBT.BYTE, 0));
  // the plain byte stays a byte
  same(roundTrip(new Map([['Unbreakable', t(NBT.BYTE, 1)]])).out.get('Unbreakable'), t(NBT.BYTE, 1));
});

test('ench entries keep int widths and extra keys; an edited level writes canonical', () => {
  const entry = { id: t(NBT.INT, 16), lvl: t(NBT.INT, 3), foo: t(NBT.INT, 1) };
  const { stack, out } = roundTrip(new Map([['ench', lst([entry, { id: t(NBT.SHORT, 34), lvl: t(NBT.SHORT, 2) }])]]));
  assert.deepEqual([stack.enchantments[0].id, stack.enchantments[0].lvl, stack.enchantments[1].raw], [16, 3, undefined]);
  same(out.get('ench'), lst([entry, { id: t(NBT.SHORT, 34), lvl: t(NBT.SHORT, 2) }]));
  const edited = copyStack({ ...stack, enchantments: [{ ...stack.enchantments[0], lvl: 5 }] });
  same(stackNbt(edited, 0, report()).get('tag').value.get('ench'), lst([{ id: t(NBT.SHORT, 16), lvl: t(NBT.SHORT, 5) }]));
  const book = roundTrip(new Map([['StoredEnchantments', lst([{ id: t(NBT.BYTE, 16), lvl: t(NBT.LONG, 3n), x: t(NBT.STRING, 'k') }])]]), 403);
  same(book.out.get('StoredEnchantments'), lst([{ id: t(NBT.BYTE, 16), lvl: t(NBT.LONG, 3n), x: t(NBT.STRING, 'k') }]));
});

test('Explosion and Fireworks keep unknown keys and widths', () => {
  const ex = { Type: t(NBT.INT, 1), Colors: t(NBT.INT_ARRAY, Int32Array.of(255)), Flicker: t(NBT.INT, 1), foo: t(NBT.STRING, 'x') };
  const star = roundTrip(new Map([['Explosion', comp(ex)]]), 402);
  assert.equal(star.stack.explosion.type, 1);
  same(star.out.get('Explosion'), comp(ex));
  const fw = { Flight: t(NBT.BYTE, 2), Explosions: lst([ex]), bar: t(NBT.INT, 9) };
  const rocket = roundTrip(new Map([['Fireworks', comp(fw)]]), 401);
  same(rocket.out.get('Fireworks'), comp(fw));
  // a model edit (flight) writes the canonical compound
  const edited = copyStack({ ...rocket.stack, fireworks: { ...rocket.stack.fireworks, flight: 3 } });
  assert.equal(stackNbt(edited, 0, report()).get('tag').value.get('Fireworks').value.has('bar'), false);
});

test('copy points keep the raw forms (chest slot copy, mob gear, /give tag)', () => {
  const stack = roundTrip(new Map()).stack;
  readItemTag(stack, new Map([['Unbreakable', t(NBT.INT, 1)], ['ench', lst([{ id: t(NBT.INT, 16), lvl: t(NBT.INT, 3) }])]]));
  assert.ok(skullFields(stack).rawForms.Unbreakable);
  assert.ok(enchPair(stack.enchantments[0]).raw);
  const copy = copyStack(stack);
  const tag = stackNbt(copy, 0, report()).get('tag').value;
  same(tag.get('Unbreakable'), t(NBT.INT, 1));
  same(tag.get('ench'), lst([{ id: t(NBT.INT, 16), lvl: t(NBT.INT, 3) }]));
});
