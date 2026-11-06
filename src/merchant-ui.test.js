import test from "node:test";
import assert from "node:assert/strict";
import { MerchantContainer, MERCHANT_LAYOUT, offerStackToLive, merchantDecorationsHtml, offerItemAt } from "./merchant-ui.js";
import { liveStackToNative } from "./anvil-container.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";

// The native container rules are replayed in villager-trading-live.test.js; these cover the browser item
// mapping, the shift-click routes written for the real inventory, and the view model.
const original = (id, count = 1, damage = 0) => ({ id, count, damage, enchantments: [] });
const live = (id, count = 1, damage = 0) => offerStackToLive(original(id, count, damage));
const recipe = (buy, buyB, sell, uses = 0, maxUses = 7) => ({ buy, buyB, sell, uses, maxUses });
function setup(offers) {
  const inventory = new Survival({}, "survival").inventory, calls = { used: [], hover: [], closed: 0 };
  const merchant = { offers: () => offers, useRecipe: (r) => { r.uses++; calls.used.push(r); }, hover: (has) => calls.hover.push(has), close: () => calls.closed++ };
  return { inventory, calls, c: new MerchantContainer(inventory, merchant) };
}

test("emerald and common trade goods map to browser items and back", () => {
  for (const id of [388, 296, 265, 266, 319, 297]) {
    const stack = live(id, 3);
    assert.ok(stack, `original ${id} has a browser item`);
    assert.equal(liveStackToNative(stack).id, id);
  }
  assert.equal(offerStackToLive(original(4000)), null, "an item the build lacks has no browser stack");
});

test("slot layout matches ContainerMerchant", () => {
  const { c } = setup([]);
  assert.equal(c.slots.length, 39);
  assert.deepEqual(c.slots.slice(0, 3).map((s) => [s.number, s.x, s.y]), [[0, 36, 53], [1, 62, 53], [2, 120, 53]]);
  assert.deepEqual([c.slots[3].x, c.slots[3].y, c.slots[30].x, c.slots[30].y], [8, 84, 8, 142]);
  assert.equal(c.slots[2].valid(), false);
  assert.deepEqual(MERCHANT_LAYOUT.next, [147, 23]);
});

test("paying in either slot order shows the result and taking it spends the payment and uses the recipe", () => {
  const offers = [recipe(original(296, 18), null, original(388, 1)), recipe(original(388, 3), original(265, 2), original(266, 5))];
  const { c, calls, inventory } = setup(offers);
  c.slots[0].put(live(296, 20));
  assert.equal(c.slots[2].stack.count, 1);
  assert.equal(liveStackToNative(c.slots[2].stack).id, 388);
  c.click(2, 0, 0);
  assert.equal(inventory.cursor.count, 1);
  assert.equal(c.slots[0].stack.count, 2);
  assert.equal(calls.used.length, 1);
  assert.equal(offers[0].uses, 1);
  inventory.cursor = null;
  c.slots[0].put(null);
  c.select(1);
  c.slots[1].put(live(388, 3));
  assert.equal(c.slots[2].stack, null, "one payment of a two-payment recipe is not enough");
  c.slots[0].put(live(265, 2));
  assert.equal(liveStackToNative(c.slots[2].stack).id, 266, "swapped slots match like doTrade(b, a)");
  c.click(2, 0, 1);
  assert.deepEqual([c.slots[0].stack, c.slots[1].stack, c.slots[2].stack], [null, null, null]);
  assert.equal(offers[1].uses, 1);
});

test("a spent recipe yields no result, and shift-clicking routes like transferStackInSlot", () => {
  const spent = recipe(original(296, 1), null, original(388, 1), 7, 7);
  const { c, inventory } = setup([spent, recipe(original(265, 1), null, original(388, 1))]);
  c.slots[0].put(live(296, 1));
  assert.equal(c.slots[2].stack, null);
  c.click(0, 0, 1); // payment slot -> player slots
  assert.equal(c.slots[0].stack, null);
  assert.ok(inventory.main.some((s) => s && liveStackToNative(s).id === 296));
  const slot = c.slots.findIndex((s, i) => i >= 3 && s.stack && liveStackToNative(s.stack).id === 296);
  assert.equal(slot, 3, "payment slots fill the player slots from the top of the main inventory");
  c.select(1);
  inventory.main.fill(null);
  c.slots[3].put(live(265, 1)); // main inventory slot -> hotbar
  c.click(3, 0, 1);
  assert.equal(c.slots[3].stack, null);
  assert.ok(inventory.main.slice(0, 9).some(Boolean));
});

test("closing releases the customer and drops both payment stacks", () => {
  const { c, calls } = setup([recipe(original(296, 18), null, original(388, 1))]);
  c.slots[0].put(live(296, 4));
  c.slots[1].put(live(265, 1));
  c.close();
  assert.equal(calls.closed, 1);
  assert.equal(c.drops.length, 2);
  assert.deepEqual([c.slots[0].stack, c.slots[1].stack], [null, null]);
});

test("the view lists the selected offer, step availability and spent state", () => {
  const offers = [recipe(original(296, 18), null, original(388, 1)), recipe(original(388, 3), original(265, 2), original(4000, 1), 7, 7)];
  const { c } = setup(offers);
  let v = c.view();
  assert.deepEqual([v.index, v.count, v.previous, v.next, v.recipe.disabled], [0, 2, false, true, false]);
  assert.equal(c.step(1), true);
  v = c.view();
  assert.deepEqual([v.index, v.previous, v.next, v.recipe.disabled], [1, true, false, true]);
  assert.equal(v.recipe.sell.live, null, "an unmapped result is shown by original id only");
  assert.equal(c.step(1), false);
  assert.deepEqual(offerItemAt(v, 40, 30).original, 388);
  assert.equal(offerItemAt(v, 100, 100), null);
  assert.match(merchantDecorationsHtml(), /data-merchant-step="1"/);
});
