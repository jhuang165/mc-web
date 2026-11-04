import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/villager-trading-reference.json" with { type: "json" };
import {
  addOrReplaceOffer, executeTrade, findMatchingOffer, forceDisableOffer, increaseMaxUses, prefersReplacement,
  isOfferDisabled, persistOffer, restoreOffer, sameTrade,
} from "./villager-trading.js";

const recipe = (buy, buyCount, sell, sellCount = 1, buyB = null, buyBCount = 0) => ({
  buy: { id: buy, count: buyCount, damage: 0 },
  buyB: buyB === null ? null : { id: buyB, count: buyBCount, damage: 0 },
  sell: { id: sell, count: sellCount, damage: 0 },
  uses: 0,
  maxUses: 7,
});

test("MerchantRecipeList input matching matches native item/count/index fixtures", () => {
  const offers = [recipe(265, 3, 264), recipe(265, 5, 266, 1, 388, 1)];
  const scenarios = [
    [{ id: 265, count: 5, damage: 1 }, null, 0],
    [{ id: 265, count: 2 }, null, 0],
    [{ id: 265, count: 5 }, { id: 388, count: 1 }, 0],
    [{ id: 265, count: 5 }, null, 1],
    [{ id: 265, count: 5 }, null, -1],
    [{ id: 265, count: 3, damage: 0, tag: { CustomName: "other" } }, null, 0],
  ];
  assert.deepEqual(scenarios.map(([a, b, i]) => findMatchingOffer(offers, a, b, i)), reference.matching.results);
});

test("a completed trade consumes both inputs, returns a copy and increments uses once", () => {
  const offer = recipe(265, 3, 264, 2, 388, 2);
  const first = { id: 265, count: 7, damage: 5 }, second = { id: 388, count: 4 };
  assert.deepEqual(executeTrade(offer, first, second), { id: 264, count: 2, damage: 0 });
  assert.equal(first.count, 4);
  assert.equal(second.count, 2);
  assert.equal(offer.uses, 1);
  assert.equal(isOfferDisabled(offer), false);
  offer.uses = 6;
  const lastTrade = executeTrade(offer, { id: 265, count: 3 }, { id: 388, count: 2 });
  assert.equal(lastTrade.id, 264);
  assert.equal(offer.uses, 7);
  assert.equal(isOfferDisabled(offer), true);
  const failed = { id: 388, count: 2 };
  assert.equal(executeTrade(offer, { id: 265, count: 2 }, failed), null);
  assert.equal(offer.uses, 7);
  assert.equal(failed.count, 2);
});

test("uses disable at maxUses and native use-limit changes/force-disable match the probe", () => {
  const offer = recipe(265, 3, 264);
  for (let i = 0; i < 7; i++) offer.uses++;
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => ({ uses: i + 1, disabled: i + 1 >= offer.maxUses })), reference.recipeUse.afterUses);
  assert.equal(increaseMaxUses(offer, 3), 10);
  assert.equal(isOfferDisabled(offer), reference.recipeUse.disabledAfterIncrease);
  forceDisableOffer(offer);
  assert.equal(offer.uses, 10);
  assert.equal(isOfferDisabled(offer), true);
});

test("Offers NBT roundtrip preserves both inputs, output, uses and maxUses", () => {
  const offer = recipe(265, 3, 264, 1, 388, 2);
  offer.buy.tag = { CustomName: "tagged input" };
  offer.buyB.tag = null;
  offer.sell.tag = null;
  offer.uses = 10;
  offer.maxUses = 10;
  const restored = restoreOffer(persistOffer(offer));
  assert.deepEqual(restored, offer);
  const { disabled: _nativeComputedDisabled, ...nativeNbt } = reference.recipeUse.nbtRoundTrip;
  assert.deepEqual(persistOffer(restored), nativeNbt);
  assert.equal(sameTrade(offer, restored), true);
  const legacy = restoreOffer({ buy: offer.buy, sell: offer.sell });
  assert.equal(legacy.uses, 0);
  assert.equal(legacy.maxUses, 7);
});

test("MerchantRecipeList replacement follows native same-item and cost ordering", () => {
  const cases = [
    [recipe(265, 2, 264, 1, 388, 5), recipe(265, 3, 264, 1, 388, 4), 1, 3, 4, 264],
    [recipe(265, 2, 264, 1, 388, 5), recipe(265, 1, 264, 1, 388, 4), 1, 1, 4, 264],
    [recipe(265, 2, 264, 1, 388, 5), recipe(265, 3, 265, 1, 388, 4), 2, 2, 5, 264],
  ];
  const actual = cases.map(([old, next]) => {
    const list = [old];
    addOrReplaceOffer(list, next);
    return { size: list.length, buyCount: list[0].buy.count, buyBCount: list[0].buyB.count, outputId: list[0].sell.id };
  });
  const single = [recipe(265, 2, 264), recipe(265, 3, 264)];
  const singles = [single[0]];
  addOrReplaceOffer(singles, single[1]);
  actual.push({ size: singles.length, buyCount: singles[0].buy.count, buyBCount: 0, outputId: singles[0].sell.id });
  assert.deepEqual(actual, reference.replacement.rows);
  assert.deepEqual([
    prefersReplacement(recipe(265, 2, 264, 1, 388, 5), recipe(265, 3, 264, 1, 388, 4)),
    prefersReplacement(recipe(265, 3, 264, 1, 388, 4), recipe(265, 2, 264, 1, 388, 5)),
    prefersReplacement(recipe(265, 2, 264, 1, 388, 5), recipe(265, 2, 264, 1, 388, 5)),
    prefersReplacement(recipe(265, 2, 264), recipe(265, 2, 264)),
  ], reference.preference.results.slice(0, 4));
  assert.equal(reference.preference.results[4], false); // native comparator rejects a different output item
  assert.equal(prefersReplacement(recipe(265, 2, 265), recipe(265, 3, 264)), false); // the list checks identity first
});
