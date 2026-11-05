// Sugar cane, cactus and the version 8 decoration, replayed against public/research/plant-reference.json
// (tools/verify-plants.mjs runs tools/probes/PlantProbe.java on the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { World, SAND, GRAVEL, CACTUS, REEDS, WATER, LAVA, FIRE, SAPLING, WEB, LADDER, SNOW_LAYER, ICE, YELLOW_FLOWER, FENCE, SIZE, HEIGHT, solidBlock, blockBounds, raycast } from "./world.js";
import { JRandom } from "./lakes.js";
import {
  Plants, REEDS_ITEM, PAPER, SUGAR, CACTUS_COLLISION, CACTUS_SELECTION, REED_BOUNDS, materialSolid, replaceable, reedCanStay, cactusCanStay, cactusCanPlace,
  reedTarget, canPlaceReeds, touchesCactus, CACTUS_DAMAGE, generateReeds, generateCactus, generateSand, decorateSand,
} from "./plants.js";
import { ITEMS, MATERIALS, craftingResult, smeltingResult } from "./survival.js";
import { smeltExperience } from "./experience.js";
import { makeStack } from "./inventory.js";
import { lightOpacity } from "./lighting.js";
import { MockWorld, MC_OF } from "../tools/plant-fixtures.mjs";
import { digSpeed } from "./mining.js";
import { blockSound } from "./audio.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";

const reference = JSON.parse(await readFile(new URL("../public/research/plant-reference.json", import.meta.url)));
const records = (name) => reference.records.filter((r) => r.case === name);

const MC_ITEM = { [REEDS_ITEM]: 338, [CACTUS]: 81, [SAND]: 12, [GRAVEL]: 13, 313: 318, [PAPER]: 339, [SUGAR]: 353, 314: 340, 315: 334, 351: 351 };
const GAME_ITEM = Object.fromEntries(Object.entries(MC_ITEM).map(([g, m]) => [m, Number(g)]));
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const side = (mask, x, z) => SIDES.some(([dx, dz], i) => mask & (1 << i) && x === dx && z === dz);
// PlantProbe.around, cactusAround and pond.
const around = (soil, mask, liquid) => (x, y, z) => y < 63 ? [1, 0] : y === 63 && x === 0 && z === 0 ? [soil, 0] : y === 63 && side(mask, x, z) ? [liquid, 0] : y === 63 ? [1, 0] : [0, 0];
const cactusAround = (soil, n, nmeta, mask) => (x, y, z) => y < 63 ? [1, 0] : y === 63 ? [x === 0 && z === 0 ? soil : 1, 0] : y === 64 && side(mask, x, z) ? [n, nmeta] : [0, 0];
const pond = (top) => (x, y, z) => y < 60 ? [1, 0] : y < 63 ? [3, 0] : y === 63 ? [x * x + z * z <= 10 ? 9 : top, 0] : [0, 0];
const stacks = (list) => list.map((s) => [MC_ITEM[s.id], s.count, s.damage || 0]);
function plants(w) {
  const drops = [];
  return { p: new Plants(w, { drop: (s) => drops.push(...s) }), drops };
}
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-12, `${m}: ${a} vs ${b}`);

test("block facts: sugar cane and cactus", () => {
  const facts = Object.fromEntries(records("facts").map((r) => [r.id, r]));
  const reed = facts[83], cactus = facts[81];
  assert.equal(MATERIALS[REEDS].hardness, reed.hardness);
  assert.equal(MATERIALS[REEDS].drop, GAME_ITEM[reed.drop]);
  assert.equal(Math.fround(MATERIALS[CACTUS].hardness), Math.fround(cactus.hardness)); // float 0.4F
  assert.equal(MATERIALS[CACTUS].drop ?? CACTUS, GAME_ITEM[cactus.drop]);
  assert.equal(lightOpacity(REEDS), reed.opacity);
  assert.equal(lightOpacity(CACTUS), cactus.opacity);
  assert.equal(materialSolid(REEDS), reed.solid);
  assert.equal(materialSolid(CACTUS), cactus.solid);
  assert.equal(replaceable(REEDS), reed.replaceable);
  assert.equal(replaceable(CACTUS), cactus.replaceable);
  assert.ok(reed.ticksRandomly && cactus.ticksRandomly);
  assert.equal(blockSound(REEDS), reed.breakSound.slice(4));
  assert.equal(blockSound(CACTUS), cactus.breakSound.slice(4));
  assert.equal(blockSound(SAND), facts[12].breakSound.slice(4));
  assert.equal(blockSound(GRAVEL), facts[13].breakSound.slice(4));
  // Material.plants: axe speed and the 1.5 sword speed; Material.cactus: neither.
  assert.equal(digSpeed(REEDS, { kind: "axe", speed: 4 }), 4);
  assert.equal(digSpeed(REEDS, { kind: "sword", speed: 4 }), 1.5);
  assert.equal(digSpeed(CACTUS, { kind: "axe", speed: 4 }), 1);
  assert.equal(digSpeed(CACTUS, { kind: "sword", speed: 4 }), 1);
});

test("cactus and sugar cane bounds", () => {
  for (const r of records("cactusBounds")) {
    const [x, y, z] = r.at, w = new MockWorld(() => [0, 0]);
    w.put(x, y, z, CACTUS);
    const b = blockBounds(w, x, y, z);
    assert.deepEqual(b.map((v, i) => v + r.at[i % 3]), r.collision);
    assert.deepEqual([...CACTUS_SELECTION].map((v, i) => v + r.at[i % 3]), r.selection);
    assert.equal(r.reedCollision, null);
    assert.equal(solidBlock(REEDS), false);
    assert.equal(solidBlock(CACTUS), true);
  }
  assert.deepEqual([...CACTUS_COLLISION], [0.0625, 0, 0.0625, 0.9375, 0.9375, 0.9375]);
  assert.deepEqual([...REED_BOUNDS], records("reedBounds")[0].bounds);
});

test("BlockReed support: canPlaceBlockAt, canBlockStay and the neighbour break", () => {
  const rs = records("reedSupport");
  assert.equal(rs.length, 171);
  for (const r of rs) {
    const w = new MockWorld(around(r.soil, r.mask, r.liquid)), { p, drops } = plants(w), m = JSON.stringify(r);
    w.put(0, 64, 0, REEDS, 0);
    assert.equal(reedCanStay(w, 0, 64, 0), r.canPlace, m);
    assert.equal(reedCanStay(w, 0, 64, 0), r.canStay, m);
    p.neighbourChanged(0, 64, 0);
    assert.equal(MC_OF[w.get(0, 64, 0)], r.after, m);
    assert.deepEqual(stacks(drops), r.drops, m);
  }
});

test("BlockCactus support: placing cell, sides and soil", () => {
  const rs = records("cactusSupport");
  assert.equal(rs.length, 97);
  for (const r of rs) {
    const b = cactusAround(r.soil, r.neighbour, r.neighbourMeta, r.mask);
    const w = new MockWorld((x, y, z) => r.cell && x === 0 && z === 0 && y === 64 ? [r.cell, r.cellMeta] : b(x, y, z)), { p, drops } = plants(w), m = JSON.stringify(r);
    assert.equal(cactusCanPlace(w, 0, 64, 0), r.canPlace, m);
    assert.equal(cactusCanStay(w, 0, 64, 0), r.canStay, m);
    w.put(0, 64, 0, CACTUS, 0);
    p.neighbourChanged(0, 64, 0);
    assert.equal(MC_OF[w.get(0, 64, 0)] ?? w.get(0, 64, 0), r.after, m);
    assert.deepEqual(stacks(drops), r.drops, m);
  }
});

test("growth: age 15, three high, roofs, support and the new cactus's neighbour check", () => {
  const bases = {
    "reed-single": around(2, 1, 9), "reed-column": around(2, 1, 9), "reed-meta": around(3, 8, 9), "reed-unsupported": around(2, 0, 9),
    "reed-on-reed-unsupported": around(2, 0, 9), "reed-tall": around(12, 4, 9),
    "reed-roof": (x, y, z) => x === 0 && z === 0 && y === 65 ? [1, 0] : around(2, 1, 9)(x, y, z),
    "cactus-single": cactusAround(12, 0, 0, 0), "cactus-column": cactusAround(12, 0, 0, 0), "cactus-meta": cactusAround(12, 0, 0, 0),
    "cactus-grows-into-stone-neighbour": (x, y, z) => x === 1 && z === 0 && y === 65 ? [1, 0] : cactusAround(12, 0, 0, 0)(x, y, z),
    "cactus-unsupported": cactusAround(2, 0, 0, 0), "cactus-tall": cactusAround(12, 0, 0, 0),
  };
  const rs = records("growth");
  assert.equal(rs.length, Object.keys(bases).length);
  for (const r of rs) {
    const w = new MockWorld(bases[r.name]), { p, drops } = plants(w), id = r.block === 83 ? REEDS : CACTUS;
    r.start.forEach((meta, i) => w.put(0, 64 + i, 0, id, meta));
    r.columns.forEach((expected, t) => {
      const y = 64 + r.order[t % r.order.length];
      if (w.get(0, y, 0) === id) assert.ok(p.randomTick(0, y, 0));
      const col = [];
      for (let yy = 64; yy < 68 && w.get(0, yy, 0); yy++) col.push(`${MC_OF[w.get(0, yy, 0)]}:${w.getMeta(0, yy, 0)}`);
      assert.equal(col.join(" "), expected, `${r.name} tick ${t}`);
    });
    assert.deepEqual(stacks(drops), r.drops, r.name);
  }
  // Other blocks are left to the next random-tick handler.
  assert.equal(new Plants(new MockWorld(() => [0, 0])).randomTick(0, 0, 0, 3), false);
});

test("cactus contact: DamageSource.cactus deals 1; items and orbs have 5 health", () => {
  const r = records("cactusDamage")[0];
  assert.equal(r.hits, `cactus|${CACTUS_DAMAGE}.0`);
  assert.equal(r.itemHitsToDie, 5);
  assert.equal(r.orbHitsToDie, 5);
  const w = new MockWorld(() => [0, 0]);
  w.put(0, 64, 0, CACTUS);
  // A player-sized box (0.6 x 1.8) resting against the 1/16 inset: touching (0.001 contraction, inclusive cells).
  assert.ok(touchesCactus(w, [0.9375 - 0.0005, 64, 0.2, 1.5375, 65.8, 0.8]));
  assert.ok(!touchesCactus(w, [1.0005, 64, 0.2, 1.6005, 65.8, 0.8]));
  // Standing on top: the collision top is 15/16, so the feet are inside the cactus cell.
  assert.ok(touchesCactus(w, [0.2, 64.9375, 0.2, 0.8, 66.7375, 0.8]));
});

test("ItemReed.onItemUse: replaceable cell, snow and tall grass in place, water beside the soil", () => {
  const offset = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  const uses = { "grass-top": [0, 63, 0, 1, 0, 0], "stone-top": [1, 63, 0, 1, 0, 0], "grass-side": [0, 63, 0, 2, 0, 0], tallgrass: [0, 64, 0, 0, 31, 1], "snow0-side": [0, 64, 0, 3, 78, 0],
    "snow1-top": [0, 64, 0, 1, 78, 1], "reed-top": [0, 64, 0, 1, 83, 0], flower: [0, 64, 0, 1, 37, 0], occupied: [0, 63, 0, 1, 1, 0], "water-side": [-1, 63, 0, 1, 0, 0] };
  const rs = records("itemReed");
  assert.equal(rs.length, 10);
  for (const r of rs) {
    const [x, y, z, s, extra, extraMeta] = uses[r.name], b = around(2, 1, 9);
    const w = new MockWorld((px, py, pz) => px === 0 && pz === 0 && py === 64 && extra ? [extra, extraMeta] : b(px, py, pz));
    const block = [x, y, z], adjacent = block.map((v, i) => v + offset[s][i]), q = reedTarget(w, block, adjacent);
    let count = 3;
    if (q && canPlaceReeds(w, ...q) && w.set(...q, REEDS, true, 0)) count--;
    assert.equal(r.result, true);
    assert.deepEqual(w.sets, r.sets.map((e) => e.slice(0, 5)), r.name);
    assert.equal(count, r.count, r.name);
  }
});

test("WorldGenReed, WorldGenSand and WorldGenCactus on the probe fixtures", () => {
  for (const r of records("genReed")) {
    const w = new MockWorld(pond(2)), rand = new JRandom(r.seed);
    assert.equal(generateReeds(w, rand, ...r.at), r.result);
    assert.deepEqual(w.sets, r.sets.map((e) => e.slice(0, 5)), `reeds ${r.seed}`);
    assert.equal(rand.next(32), r.next);
  }
  for (const r of records("genSand")) {
    const w = new MockWorld(pond(2)), rand = new JRandom(r.seed);
    assert.equal(generateSand(w, rand, ...r.at, 7), r.result);
    const sha = createHash("sha256").update(JSON.stringify(w.sets.map((e) => [...e, 2]))).digest("hex");
    assert.equal(w.sets.length, r.count, `sand ${r.seed}`);
    assert.equal(sha, r.sets, `sand ${r.seed}`);
    assert.equal(rand.next(32), r.next);
  }
  for (const r of records("genCactus")) {
    const w = new MockWorld((x, y, z) => y < 63 ? [12, 0] : y === 63 ? [(x + z + r.seed) % 7 === 0 ? 1 : 12, 0] : [0, 0]), rand = new JRandom(r.seed);
    assert.equal(generateCactus(w, rand, 0, 64, 0), r.result);
    assert.deepEqual(w.sets, r.sets.map((e) => e.slice(0, 5)), `cactus ${r.seed}`);
    assert.equal(rand.next(32), r.next);
  }
});

test("smelting cactus green and the paper, sugar and book recipes", () => {
  const s = records("smelt")[0], out = smeltingResult(makeStack(CACTUS));
  assert.deepEqual([out.id, out.count, out.damage], s.result);
  assert.equal(smeltExperience(out), s.xp);
  const rs = records("craft");
  assert.equal(rs.length, 12);
  for (const r of rs) {
    const cells = r.grid.flat().map((id) => (id ? makeStack(GAME_ITEM[id], 1) : null)), res = craftingResult(cells, 3);
    assert.deepEqual(res ? [MC_ITEM[res.id], res.count, res.damage || 0] : null, r.result, JSON.stringify(r.grid));
  }
  assert.equal(ITEMS[REEDS_ITEM].texture, "reeds");
  assert.equal(ITEMS[PAPER].texture, "paper");
  assert.equal(ITEMS[SUGAR].texture, "sugar");
  assert.equal(ITEMS[314].texture, "book_normal");
});

test("creative tabs and search keep the original registration order", () => {
  const decorations = CREATIVE_TABS[1].items, misc = CREATIVE_TABS[4].items, materials = CREATIVE_TABS[10].items;
  // The jukebox (84) and then the oak fence (85) follow the cactus (81) in block-id order.
  assert.deepEqual(decorations.slice(decorations.indexOf(SNOW_LAYER), decorations.indexOf(SNOW_LAYER) + 4), [SNOW_LAYER, CACTUS, 1178, FENCE]);
  assert.deepEqual(misc.slice(misc.indexOf(343), misc.indexOf(343) + 3), [343, PAPER, 314]);
  assert.deepEqual(materials.slice(materials.indexOf(307), materials.indexOf(307) + 3), [307, REEDS_ITEM, 316]);
  // Pumpkin (361) and melon seeds (362) follow sugar (353), as in creative-reference.json.
  assert.deepEqual(materials.slice(materials.indexOf(SUGAR),materials.indexOf(SUGAR)+3), [SUGAR, 361, 362]);
  const at = (id) => SEARCH_ORDER.indexOf(id);
  assert.deepEqual(SEARCH_ORDER.slice(at(23), at(23) + 3), [23, CACTUS, 24]);
  assert.deepEqual(SEARCH_ORDER.slice(at(307), at(307) + 4), [307, REEDS_ITEM, PAPER, 314]);
  assert.equal(SEARCH_ORDER[at(311) + 1], SUGAR);
  // The sugar cane block itself has no creative entry (Block.reeds has no tab; the item places it).
  assert.ok(!SEARCH_ORDER.includes(REEDS));
});

test("a running world: support breaks cascade, water loss drops cane, a placed neighbour breaks cactus", () => {
  const w = new World("plants", "meadow", 7);
  for (let x = 30; x < 40; x++) for (let z = 30; z < 40; z++) for (let y = 1; y < HEIGHT; y++) w.put(x, y, z, y < 20 ? 2 : 0, 0, false);
  const drops = [], p = new Plants(w, { drop: (s) => drops.push(...s) }).watch();
  w.set(34, 19, 34, SAND);
  w.set(35, 19, 34, WATER);
  for (let y = 20; y < 23; y++) w.set(34, y, 34, REEDS);
  assert.equal(w.get(34, 22, 34), REEDS);
  // Removing the water notifies only the water's neighbours, so the cane waits for its random
  // tick (BlockReed.updateTick -> func_150170_e); then each one above follows through onChange.
  w.set(35, 19, 34, 2);
  assert.equal(w.get(34, 20, 34), REEDS);
  assert.ok(p.randomTick(34, 20, 34));
  assert.deepEqual([20, 21, 22].map((y) => w.get(34, y, 34)), [0, 0, 0]);
  assert.equal(drops.filter((d) => d.id === REEDS_ITEM).length, 3);
  // Cactus on sand breaks when a solid block goes beside it, but not for a torch.
  w.set(36, 19, 36, SAND);
  w.set(36, 20, 36, CACTUS);
  w.set(37, 20, 36, 20);
  assert.equal(w.get(36, 20, 36), CACTUS);
  w.set(36, 20, 37, 3);
  assert.equal(w.get(36, 20, 36), 0);
  assert.equal(drops.filter((d) => d.id === CACTUS).length, 1);
  assert.ok(p instanceof Plants);
  // Rays: sugar cane only inside its 0.125 inset; cactus over the full cube (it never sets block bounds).
  w.set(33, 19, 32, SAND);
  w.set(32, 19, 32, WATER);
  w.set(33, 20, 32, REEDS);
  w.set(33, 20, 31, CACTUS);
  w.set(33, 19, 31, SAND);
  const reedEdge = raycast(w, { x: 33.05, y: 25, z: 32.5 }, { x: 0, y: -1, z: 0 }, 10);
  assert.deepEqual(reedEdge?.block, [33, 19, 32]);
  const reedMid = raycast(w, { x: 33.5, y: 25, z: 32.5 }, { x: 0, y: -1, z: 0 }, 10);
  assert.deepEqual(reedMid?.block, [33, 20, 32]);
  const cactusEdge = raycast(w, { x: 33.02, y: 25, z: 31.5 }, { x: 0, y: -1, z: 0 }, 10);
  assert.deepEqual(cactusEdge?.block, [33, 20, 31]);
});

test("generation version 8 adds beaches and sugar cane by water; versions 4 to 7 are untouched", () => {
  const sha = (w) => createHash("sha1").update(w.snapshot().data).digest("hex").slice(0, 12);
  // sha1 of the block array before this change.
  const pinned = {
    4: ["ea4ae0578e79", "de21ca021ce6", "ed79be5969e0", "5fa3e6f6a18d"], 5: ["08a2947897be", "ee85cecbc9dd", "6ccaa0e0dec5", "39a9b41c4c8b"],
    6: ["08a2947897be", "0b856ae2c967", "6ccaa0e0dec5", "c5b6a32301f4"], 7: ["90671d1466ac", "e9205c582d1c", "4518b3b5efeb", "b72c8a0d31f0"],
  };
  for (const [v, hashes] of Object.entries(pinned)) {
    const got = [["Overworld", "meadow"], ["Overworld", "snowy"], ["Minecraft", "meadow"], ["Minecraft", "snowy"]].map(([s, b]) => sha(new World(s, b, Number(v))));
    assert.deepEqual(got, hashes, `version ${v}`);
  }
  assert.equal(new World("x").generationVersion, 8);
  let reeds = 0, sand = 0;
  for (const seed of ["Overworld", "Minecraft", "d"]) {
    const a = new World(seed, "meadow", 8), b = new World(seed, "meadow", 8), old = new World(seed, "meadow", 7);
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.equal(a.edits.size, 0);
    const A = a.snapshot().data, O = old.snapshot().data;
    for (let i = 0; i < A.length; i++) {
      if (A[i] === O[i]) continue;
      // Only sand over dirt or grass, sugar cane in air, and the knock-on changes of the later
      // decorators (trees and flowers, which read the new ground).
      if (A[i] === SAND) assert.ok([1, 2].includes(O[i]), `${seed} sand over ${O[i]}`);
      if (A[i] === REEDS) reeds++;
      if (A[i] === SAND) sand++;
    }
    for (let x = 0; x < SIZE; x++)
      for (let z = 0; z < SIZE; z++)
        for (let y = 1; y < HEIGHT; y++) if (a.get(x, y, z) === REEDS) assert.ok(reedCanStay(a, x, y, z), `${seed} cane at ${x},${y},${z}`);
  }
  assert.ok(sand > 0, "beaches");
  assert.ok(reeds > 0, "sugar cane");
  // decorateSand returns one generator per chunk touching the world.
  assert.equal(decorateSand(new World("d", "meadow", 7)).length, (SIZE / 16 + 1) ** 2);
});
