// Hoppers and comparators over the brewing stand (TileEntityBrewingStand as ISidedInventory, Minecraft Java 1.7.10):
// the top reaches only the ingredient slot 3, the other sides only the bottle slots 0-2; extraction is always allowed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { containerAt, insertStack, inventorySignal } from "./inventory-transfer.js";
import { BREWING_STAND, ITEM_NETHER_WART } from "./brewing.js";

const POTION = 385, STONE = 1;
const host = (brewing) => ({ world: { get: (x, y, z) => (x === 0 && y === 0 && z === 0 ? BREWING_STAND : 0) }, brewing: () => brewing, chests: () => ({}), furnaces: () => ({}), dispensers: () => ({}), hoppers: () => ({}) });
const max = (s) => (s.id === POTION ? 1 : 64);

test("hoppers fill the brewing stand by side: ingredient from above, bottles from the sides", () => {
  const brewing = {}, inv = containerAt(host(brewing), 0, 0, 0);
  assert.ok(inv && inv.sides);
  // Down-facing hopper above inserts through side 1 (up face of the stand).
  assert.equal(insertStack(inv, { id: ITEM_NETHER_WART, count: 1, damage: 0 }, 1, max), null);
  assert.equal(brewing["0,0,0"].items[3].id, ITEM_NETHER_WART);
  // A potion from above has nowhere to go (slot 3 refuses non-ingredients).
  assert.equal(insertStack(inv, { id: POTION, count: 1, damage: 0 }, 1, max)?.id, POTION);
  // From a side: bottles fill 0, 1, 2 in order; non-potions are refused.
  for (let i = 0; i < 3; i++) assert.equal(insertStack(inv, { id: POTION, count: 1, damage: 0 }, 4, max), null);
  assert.deepEqual(brewing["0,0,0"].items.slice(0, 3).map((s) => s.id), [POTION, POTION, POTION]);
  assert.equal(insertStack(inv, { id: STONE, count: 1, damage: 0 }, 4, max)?.id, STONE);
  assert.equal(inventorySignal(inv, max), 1 + Math.floor((3 + 1 / 64) / 4 * 14));
});
