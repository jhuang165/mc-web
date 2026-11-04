import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { exportJavaSave } from "./region-export.js";
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from "./region-file.js";
import { chunkFromNbt } from "./chunk-nbt.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { villagerFields } from "./villager.js";
import { generateVillagerOffers } from "./villager-offers.js";
import { JavaRandom } from "./java-random.js";

const flat = { numericSeed: 123, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const offersFor = (profession, seed) => generateVillagerOffers(profession, new JavaRandom(BigInt(seed)), { maxNewOffers: 6, shuffleRandom: new JavaRandom(BigInt(seed + 1)) });

test("a villager's Offers survive a browser save and reload; the customer and timers start over", () => {
  const offers = offersFor(1, 4);
  offers[0].uses = 3;
  const w = new EntityWorld(flat, [{ id: "mob-1", type: "villager", x: 64.5, y: 0, z: 64.5, health: 20, profession: 1, riches: 12, offers, customer: true, timeUntilReset: 30, needsInit: true }]);
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  const loaded = new EntityWorld(flat, saved).entities[0];
  assert.deepEqual(loaded.offers, offers);
  assert.equal(loaded.riches, 12);
  assert.deepEqual([loaded.customer, loaded.timeUntilReset, loaded.needsInit], [false, 0, false]);
  assert.equal(villagerFields(0, 0, "nope").offers, null);
  assert.deepEqual(villagerFields(0, 0, [offers[0], { buy: null }]).offers, [offers[0]]);
});

test("Java export writes Offers.Recipes in the 1.7.10 MerchantRecipe layout", async () => {
  const w = new World("17", "javaStreamed", 12);
  const offers = [
    { buy: { id: 340, count: 1, damage: 0, enchantments: [] }, buyB: { id: 388, count: 5, damage: 0, enchantments: [] }, sell: { id: 403, count: 1, damage: 0, enchantments: [], storedEnchantments: [{ id: 35, lvl: 2 }] }, uses: 2, maxUses: 9 },
    { buy: { id: 296, count: 18, damage: 0 }, buyB: null, sell: { id: 388, count: 1, damage: 0 }, uses: 0, maxUses: 7 },
    { buy: { id: 388, count: 7, damage: 0 }, buyB: null, sell: { id: 276, count: 1, damage: 0, enchantments: [{ id: 16, lvl: 1 }] }, uses: 7, maxUses: 7 },
  ];
  const record = { id: "export", name: "Export", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player: new Survival({}, "survival").serialize(), position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 },
    entities: [{ type: "villager", x: -2, y: 102, z: -2, health: 20, growingAge: 0, profession: 2, riches: 9, offers }, { type: "villager", x: -3, y: 102, z: -3, health: 20, profession: 0 }], updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const [first, second] = chunk.entities.filter((e) => e.get("id").value === "Villager");
  assert.equal(first.get("Profession").value, 2);
  assert.equal(first.get("Riches").value, 9);
  const recipes = first.get("Offers").value.get("Recipes").value.items;
  assert.equal(recipes.length, 3);
  const read = (r, key) => (r.has(key) ? { id: r.get(key).value.get("id").value, count: r.get(key).value.get("Count").value, damage: r.get(key).value.get("Damage").value, tag: r.get(key).value.get("tag")?.value } : null);
  assert.deepEqual([read(recipes[0], "buy").id, read(recipes[0], "buyB").id, read(recipes[0], "buyB").count, read(recipes[0], "sell").id], [340, 388, 5, 403]);
  assert.equal(recipes[0].get("uses").value, 2);
  assert.equal(recipes[0].get("maxUses").value, 9);
  assert.equal(read(recipes[0], "sell").tag.get("StoredEnchantments").value.items[0].get("lvl").value, 2);
  assert.equal(read(recipes[0], "buy").tag, undefined, "an empty enchantment list writes no tag");
  assert.equal(recipes[1].has("buyB"), false);
  assert.equal(read(recipes[2], "sell").tag.get("ench").value.items[0].get("id").value, 16);
  assert.equal(second.has("Offers"), false, "a villager that never traded has no Offers tag");
});
