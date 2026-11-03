import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnchantingContainer } from './enchanting-container.js';
import { liveStackToNative, nativeStackToLive } from './anvil-container.js';
import { Survival } from './survival.js';
import { makeStack } from './inventory.js';
import { Experience } from './experience.js';
import { JavaRandom } from './java-random.js';
import { ENCHANT_SLOT, ENCHANT_PLAYER_SLOTS, ENCHANT_REACH_SQUARED, withinEnchantReach } from './enchanting-table.js';
import { BLOCKS } from './world.js';
import { fromOriginal } from './block-registry.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/enchanting-table-reference.json', import.meta.url)));
const pairs = (a) => a.map(([id, lvl]) => ({ id, lvl }));
const fromRow = (r) => r && nativeStackToLive({ id: r[0], count: r[1], damage: r[2], ...(r[3].length ? { enchantments: pairs(r[3]) } : {}), ...(r[4].length ? { storedEnchantments: pairs(r[4]) } : {}) });
const toRow = (s) => {
  const n = s && liveStackToNative(s);
  return n && [n.id, n.count, n.damage, (n.enchantments ?? []).map((e) => [e.id, e.lvl]), (n.storedEnchantments ?? []).map((e) => [e.id, e.lvl])];
};
const newInventory = () => new Survival({}, 'survival').inventory;
const BOOKSHELF = fromOriginal(47).id, TABLE = fromOriginal(116).id;

// A live world double over the probe's 5 x 2 x 5 fixture (air everywhere else).
const fixtureWorld = ([tx, ty, tz], cells) => ({
  get(x, y, z) {
    const dx = x - tx, dy = y - ty, dz = z - tz;
    if (dy < 0 || dy > 1 || Math.abs(dx) > 2 || Math.abs(dz) > 2) return 0;
    const mc = cells[(dy * 5 + dz + 2) * 5 + dx + 2];
    return mc === 0 ? 0 : mc === 47 ? BOOKSHELF : mc === 116 ? TABLE : 1000 + mc; // other blocks: never air, never a shelf
  },
});

test('ContainerEnchantment slot layout, limits and reach match the original', () => {
  const inventory = newInventory(), c = new EnchantingContainer({ inventory, world: { get: () => 0 }, x: 0, y: 0, z: 0 });
  assert.equal(c.slots.length, ref.layout.slotCount);
  ref.layout.slots.forEach(([n, x, y, limit], i) => {
    assert.deepEqual([c.slots[i].number, c.slots[i].x, c.slots[i].y, c.slots[i].limit], [n, x, y, i === 0 ? 1 : 64], `slot ${i} limit ${limit}`);
    assert.equal(c.slots[i].valid(makeStack(1, 1)), true);
  });
  assert.deepEqual([ENCHANT_SLOT.x, ENCHANT_SLOT.y, ENCHANT_PLAYER_SLOTS.x, ENCHANT_PLAYER_SLOTS.y], [25, 47, 8, 84]);
  assert.equal(ENCHANT_REACH_SQUARED, 64);
  for (const [dx, dy, dz, ok, gone] of ref.reach.rows) {
    if (gone) continue;
    assert.equal(withinEnchantReach({ x: 10.5 + dx, y: 64.5 + dy, z: 10.5 + dz }, 10, 64, 10), ok, `${dx},${dy},${dz}`);
  }
});

test('replays ContainerEnchantment click, shift-click, hotbar-key and enchant sequences with the container Random', () => {
  assert.equal(ref.containers.length, 300);
  let enchants = 0, accepted = 0, paid = 0, books = 0;
  ref.containers.forEach((cs, ci) => {
    const inventory = newInventory();
    inventory.main = cs.main.map(fromRow);
    inventory.cursor = fromRow(cs.held);
    inventory.random = new JavaRandom(cs.seed);
    const xp = new Experience({ total: 777, level: cs.level, progress: 0.25 });
    const container = new EnchantingContainer({
      inventory, world: fixtureWorld(cs.pos, cs.cells), x: cs.pos[0], y: cs.pos[1], z: cs.pos[2],
      creative: () => cs.creative, experienceLevel: () => xp.level,
      payExperienceLevels: (n) => { xp.addLevels(-n); paid++; },
    });
    cs.steps.forEach(([op, table, cursor, levels, nameSeed, xpRow, main], si) => {
      const label = `case ${ci} step ${si} ${JSON.stringify(op)}`;
      if (op[0] === 'click') container.click(op[1], op[2], op[3]);
      else if (op[0] === 'enchant') {
        enchants++;
        const before = container.item?.id, ok = container.enchant(op[1]);
        assert.equal(ok, op[2], label);
        if (ok) accepted++;
        if (before === 314 && container.item?.id === 365) books++;
      } else container.setItem(fromRow(op[1]));
      assert.deepEqual(toRow(container.item), table, `${label} table`);
      assert.deepEqual(toRow(inventory.cursor), cursor, `${label} cursor`);
      assert.deepEqual(container.levels, levels, `${label} levels`);
      assert.equal(String(container.nameSeed), nameSeed, `${label} nameSeed`);
      assert.deepEqual([xp.level, xp.total, xp.progress], xpRow, `${label} xp`);
      assert.deepEqual(inventory.main.map(toRow), main, `${label} inventory`);
    });
    assert.equal(inventory.random.nextInt(), cs.next, `case ${ci} random state`);
  });
  assert.ok(enchants > 800 && accepted > 150 && paid > 100 && books > 0, `${enchants} ${accepted} ${paid} ${books}`);
});

const flat = { get: () => 0 };
const make = ({ level = 30, creative = false, world = flat, seed = 1234 } = {}) => {
  const inventory = newInventory();
  inventory.random = new JavaRandom(seed);
  const state = { level, paid: [], used: [] };
  const container = new EnchantingContainer({
    inventory, world, x: 0, y: 64, z: 0, creative: () => creative, experienceLevel: () => state.level,
    payExperienceLevels: (n) => { state.paid.push(n); state.level = Math.max(0, state.level - n); },
    onUse: (e) => state.used.push(e),
  });
  return { inventory, container, state };
};
const SHELVES = (() => {
  const cells = {};
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) for (const dy of [0, 1]) cells[`${dx},${64 + dy},${dz}`] = BOOKSHELF;
  return { get: (x, y, z) => cells[`${x},${y},${z}`] ?? 0 };
})();

test('enchanting pays the native level cost, applies the roll and refuses a second enchantment', () => {
  const { container, state } = make({ world: SHELVES });
  assert.equal(container.bookshelves, 32);
  container.setItem(makeStack(103, 1, 0)); // diamond pickaxe
  const levels = container.levels;
  assert.ok(levels.every((l) => l >= 1 && l <= 30) && levels[2] >= levels[0], String(levels));
  assert.equal(container.canEnchant(2), true);
  assert.equal(container.enchant(2), true);
  assert.deepEqual(state.paid, [levels[2]]);
  assert.equal(state.level, 30 - levels[2]);
  assert.ok(container.item.enchantments.length >= 1);
  assert.equal(state.used.length, 1);
  assert.equal(state.used[0].cost, levels[2]);
  // An enchanted item is not enchantable: no options, no charge.
  assert.deepEqual(container.levels, [0, 0, 0]);
  assert.equal(container.enchant(0), false);
  assert.equal(state.paid.length, 1);
});

test('too few levels refuse the click; Creative skips the check', () => {
  const poor = make({ world: SHELVES, level: 0 });
  poor.container.setItem(makeStack(103, 1, 0));
  assert.equal(poor.container.enchant(1), false);
  assert.equal(poor.container.item.enchantments, undefined);
  const creative = make({ world: SHELVES, level: 0, creative: true });
  creative.container.setItem(makeStack(103, 1, 0));
  assert.equal(creative.container.canEnchant(1), true);
  assert.equal(creative.container.enchant(1), true);
  assert.ok(creative.container.item.enchantments.length >= 1);
});

test('a book becomes an enchanted book (live 365) with stored enchantments', () => {
  const { container, state } = make({ world: SHELVES });
  container.setItem(makeStack(314, 1, 0)); // book
  assert.equal(container.enchant(1), true);
  assert.equal(container.item.id, 365);
  assert.ok(container.item.stored.length >= 1);
  assert.deepEqual(container.item.stored, container.item.storedEnchantments);
  assert.equal(state.paid.length, 1);
});

test('items that cannot be enchanted offer no options and the item changes reroll from the container Random', () => {
  const { container, inventory } = make();
  const before = inventory.random.save();
  container.setItem(makeStack(300, 1, 0)); // stick
  assert.deepEqual(container.levels, [0, 0, 0]);
  assert.deepEqual(inventory.random.save(), before, 'a stick draws nothing');
  container.setItem(makeStack(103, 1, 0));
  assert.notDeepEqual(inventory.random.save(), before, 'an enchantable item draws a nameSeed and three slot levels');
  const first = container.nameSeed;
  container.setItem(makeStack(103, 1, 0));
  assert.notEqual(container.nameSeed, first);
  container.setItem(null);
  assert.deepEqual(container.levels, [0, 0, 0]);
});

test('shift-click moves one item to the table slot and back; close returns the input', () => {
  const { container, inventory } = make();
  inventory.main[0] = makeStack(314, 5, 0);
  assert.ok(container.click(28, 0, 1)); // hotbar slot 0 -> table
  assert.equal(container.item.count, 1);
  assert.equal(inventory.main[0].count, 4);
  container.click(28, 0, 1); // a second book cannot enter a full table slot
  assert.equal(inventory.main[0].count, 4);
  container.click(0, 0, 1); // table -> inventory
  assert.equal(container.item, null);
  assert.equal(inventory.main[0].count, 5);
  container.setItem(makeStack(103, 1, 0));
  container.close();
  assert.equal(container.item, null);
  assert.deepEqual(container.drops.map((s) => s.id), [103]);
});
