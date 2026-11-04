import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/villager-offers-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { generateVillagerOffers } from "./villager-offers.js";

// The probe enumerates EnchantmentHelper.getEnchantmentLevel in numeric-id order;
// that projection does not measure the original ench NBT list's ordering.
const observedOffers=offers=>{
  const copy=structuredClone(offers);
  for(const r of copy)for(const s of [r.buy,r.buyB,r.sell])s?.enchantments?.sort((a,b)=>a.id-b.id);
  return copy;
};

test("initial villager offers reproduce native profession trades and both Random streams", () => {
  const cases = reference.cases;
  assert.equal(cases.length, 400);
  const professions = new Set(cases.map((c) => c.profession));
  assert.deepEqual([...professions].sort(), [0, 1, 2, 3, 4]);
  for (const fixture of cases) {
    const random = new JavaRandom(BigInt(fixture.seed));
    const shuffleRandom = new JavaRandom(BigInt(fixture.shuffleSeed));
    const offers = generateVillagerOffers(fixture.profession, random, {
      maxNewOffers: fixture.limit,
      shuffleRandom,
    });
    const label = `profession=${fixture.profession}, seed=${fixture.seed}, limit=${fixture.limit}`;
    assert.deepEqual(observedOffers(offers), fixture.offers, label);
    assert.equal(random.nextInt(), fixture.nextEntityInt, `${label} Entity.rand continuation`);
    assert.equal(shuffleRandom.nextInt(), fixture.nextShuffleInt, `${label} Collections shuffle continuation`);
  }
});

test("the default generator only adds the first shuffled trade, and returns original IDs", () => {
  const random = new JavaRandom(0n), shuffleRandom = new JavaRandom(13n);
  const offers = generateVillagerOffers(1, random, { shuffleRandom });
  assert.equal(offers.length, 1);
  assert.ok(offers[0].buy.id > 0);
  assert.equal(offers[0].maxUses, 7);
});

test("invalid profession, random source, and limit are rejected", () => {
  assert.throws(() => generateVillagerOffers(5, new JavaRandom(1n)), RangeError);
  assert.throws(() => generateVillagerOffers(0, null), TypeError);
  assert.throws(() => generateVillagerOffers(0, new JavaRandom(1n), { maxNewOffers: -1 }), RangeError);
});
