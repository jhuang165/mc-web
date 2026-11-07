// Every item that the 1.7.10 EntityVillager trade tables can offer maps to a browser item that has a name and an icon
// (no "?" placeholder in the merchant screen). The ids come from generating offers over many seeds for every profession.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JavaRandom } from "./java-random.js";
import { generateVillagerOffers } from "./villager-offers.js";
import { offerStackToLive } from "./merchant-ui.js";
import { ITEMS } from "./survival.js";
import { stackName } from "./item-names.js";
import { itemTexture } from "./first-person.js";

// EntityVillager.addDefaultEquipmentAndRecipies tables (bB buy, bC sell lists, blacksmithSellingList, villagersSellingList).
const NATIVE_TABLE_IDS = [
  35, 263, 264, 265, 266, 295, 296, 319, 339, 340, 350, 361, 362, 363, 365, 367, 368, 381, 387, // villager buys
  20, 47, 89, 256, 257, 258, 259, 260, 262, 267, 276, 277, 278, 279, 292, 293, 297, 298, 299, 300, 301, 302, 303, 304, 305,
  306, 307, 308, 309, 310, 311, 312, 313, 320, 329, 331, 345, 347, 357, 359, 360, 364, 366, 381, 384, // villager sells
  13, 318, 388, 403, // gravel + emerald -> flint, emerald, enchanted book
];

function harvest() {
  const ids = new Set(NATIVE_TABLE_IDS);
  for (let profession = 0; profession <= 4; profession++)
    for (let seed = 1; seed <= 300; seed++) {
      const offers = generateVillagerOffers(profession, new JavaRandom(BigInt(seed)), { maxNewOffers: 40, shuffleRandom: new JavaRandom(BigInt(seed * 7)) });
      for (const o of offers) for (const s of [o.buy, o.buyB, o.sell]) if (s) ids.add(s.id);
    }
  return [...ids].sort((a, b) => a - b);
}

test("every item in the native trade tables has a browser item, a name and an icon", () => {
  const ids = harvest();
  assert.ok(ids.length >= 66, `harvested ${ids.length} ids`);
  const problems = [];
  for (const id of ids) {
    const live = offerStackToLive({ id, count: 1, damage: 0, enchantments: [] });
    if (!live) { problems.push(`${id}: no browser item`); continue; }
    if (!stackName(live, ITEMS)) problems.push(`${id}: no name`);
    const def = ITEMS[live.id];
    if (!def) { problems.push(`${id}: no ITEMS entry`); continue; }
    if (!def.block) {
      const tex = itemTexture(live.id, live.damage);
      if (!tex) problems.push(`${id}: ${def.name} has no texture`);
      else if (!fs.existsSync(new URL(`../public${tex}`, import.meta.url))) problems.push(`${id}: ${tex} missing on disk`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the previously unmapped trade items 350, 387, 347, 384 and 89 now resolve", () => {
  const names = Object.fromEntries([350, 387, 347, 384, 89].map((id) => [id, stackName(offerStackToLive({ id, count: 1, damage: 0 }), ITEMS)]));
  assert.equal(names[350], "Cooked Fish");
  assert.equal(names[347], "Clock");
  assert.equal(names[384], "Bottle o' Enchanting");
  assert.equal(names[89], "Glowstone");
  assert.ok(names[387]);
});
