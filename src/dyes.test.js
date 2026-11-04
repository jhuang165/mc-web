import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, DYE, DYES, WOOL, RED_FLOWER, RED_FLOWERS, YELLOW_FLOWER, BLOCKS, isPlant, isFlower } from "./world.js";
import { Survival, ITEMS, craftingResult, MATERIALS } from "./survival.js";
import { PlayerInventory, makeStack } from "./inventory.js";
import { EntityWorld } from "./entities.js";
import { JRandom, PerlinNoise, chooseFlower, flowerCanStay, growGrass, plainsFlowerNoise } from "./flowers.js";
import { CREATIVE_TABS } from "./creative.js";
import { blockTile, TILES } from "./block-textures.js";
import { itemTexture } from "./first-person.js";

const reference = JSON.parse(await readFile(new URL("../public/research/dyes-reference.json", import.meta.url)));
const ids = { yellow: YELLOW_FLOWER, red: RED_FLOWER };

// Original [id, damage] to game [id, damage]; null for items this build lacks.
const GAME = { 37: [YELLOW_FLOWER, 0], 38: null, 351: null, 35: null, 352: [311, 0], 1: [3, 0] };
const game = ([id, , damage]) => (id === 38 ? [RED_FLOWER, damage] : id === 351 ? [DYE, damage] : id === 35 ? [WOOL, damage] : GAME[id]);
const cells = (items, size) => {
  const grid = Array(size * size).fill(null);
  items.forEach((s, i) => (grid[i] = makeStack(s[0], 1, s[1])));
  return grid;
};
// RecipesDyes results only; the reference also lists carpet, buttons and the like, which this build lacks.
const dyeResult = ([id]) => id === 351 || id === 35;
// Non-dye RecipesDyes-universe results this build has: one stone makes a stone button (77, item 1111), two a stone pressure plate (70, item 1109), three six stone slabs (44, item 1103).
const OTHER = { 77: 1111, 70: 1109, 44: 1103 };

test("dye and wool recipes match the original CraftingManager for every grid of up to three items", () => {
  const u = reference.universe.map(game), expected = new Map(reference.recipes.map(([picks, out]) => [picks.join(), out]));
  let checked = 0, matched = 0;
  const check = (picks) => {
    const out = craftingResult(cells(picks.map((i) => u[i]), 3), 3), want = expected.get(picks.join());
    checked++;
    if (want && dyeResult(want)) {
      matched++;
      const [id, count, damage] = want;
      assert.deepEqual(out && [out.id, out.count, out.damage], [id === 35 ? WOOL : DYE, count, damage], picks.map((i) => reference.universe[i]).join(" "));
    } else if (want && OTHER[want[0]]) assert.deepEqual(out && [out.id, out.count], [OTHER[want[0]], want[1]], picks.map((i) => reference.universe[i]).join(" "));
    else assert.equal(out, null, picks.map((i) => reference.universe[i]).join(" "));
  };
  const n = u.length;
  for (let a = 0; a < n; a++) {
    check([a]);
    for (let b = a; b < n; b++) {
      check([a, b]);
      for (let c = b; c < n; c++) check([a, b, c]);
    }
  }
  assert.equal(matched, reference.recipes.filter(([, out]) => dyeResult(out)).filter(([picks]) => picks.length < 4).length);
  assert.ok(checked > 15000);
});

test("four-dye grids give the original magenta recipe and nothing else", () => {
  const small = [...Array(16).keys(), 42].map((i) => game(reference.universe[i]));
  const expected = new Map(reference.recipes.filter(([p]) => p.length === 4).map(([p, out]) => [p.join(), out]));
  let hits = 0;
  for (let a = 0; a < small.length; a++)
    for (let b = a; b < small.length; b++)
      for (let c = b; c < small.length; c++)
        for (let d = c; d < small.length; d++) {
          const out = craftingResult(cells([small[a], small[b], small[c], small[d]], 3), 3);
          if (out) { hits++; assert.deepEqual([out.id, out.count, out.damage], [DYE, 4, 13]); }
        }
  assert.equal(hits, 1);
  assert.equal(expected.size, 1);
});

test("dye damage names and textures follow ItemDye, and wool takes colour 15 - damage", () => {
  assert.deepEqual(DYES.map((d) => d.texture), reference.dyeTextures);
  assert.equal(ITEMS[DYE].variants.length, 16);
  assert.equal(ITEMS[DYE].variants[15], "Bone Meal");
  for (let d = 0; d < 16; d++) {
    const out = craftingResult([makeStack(DYE, 1, d), makeStack(WOOL, 1, 0), null, null], 2);
    assert.deepEqual([out.id, out.damage], [WOOL, 15 - d]);
  }
  // Only white wool takes a dye: the recipe ingredient is damage 0.
  assert.equal(craftingResult([makeStack(DYE, 1, 1), makeStack(WOOL, 1, 3), null, null], 2), null);
  assert.equal(itemTexture(DYE, 12), "/media/1.7.10/items/dye_powder_light_blue.png");
  assert.equal(itemTexture(RED_FLOWER, 8), "/media/1.7.10/blocks/flower_oxeye_daisy.png");
});

test("bone makes three bone meal; legacy bone meal saves become dye damage 15", () => {
  const out = craftingResult([makeStack(311, 1), null, null, null], 2);
  assert.deepEqual([out.id, out.count, out.damage], [DYE, 3, 15]);
  assert.equal(ITEMS[310], undefined);
  const inv = new PlayerInventory(ITEMS, [{ id: 310, count: 5 }]);
  assert.deepEqual(inv.main[0], makeStack(DYE, 5, 15));
});

test("the plains and default flower choice and the plains noise reproduce the original", () => {
  const name = (r) => (r[0] === 37 ? [YELLOW_FLOWER, 0] : [RED_FLOWER, r[1]]);
  for (const [key, biome] of [["base", "alpine"], ["plains", "meadow"]]) {
    const c = reference.flowerChoice[key], random = new JRandom(c.seed);
    c.points.forEach(([x, y, z], i) => {
      const [kind, meta] = chooseFlower(biome, random, x, z);
      assert.deepEqual([ids[kind], meta], name(c.results[i]), key + " " + i);
    });
  }
  const noise = plainsFlowerNoise();
  reference.noise.points.forEach(([x, z], i) => assert.equal(noise.sample(x / 200, z / 200), reference.noise.values[i], "noise " + i));
  assert.ok(reference.flowerChoice.plains.results.some((r) => r[0] === 38 && r[1] >= 4 && r[1] <= 7));
  assert.ok(new PerlinNoise(new JRandom(1), 2).sample(0.3, 0.7) !== 0);
});

test("flowers are plants that break instantly, drop themselves and keep their species", () => {
  assert.ok(isPlant(YELLOW_FLOWER) && isPlant(RED_FLOWER) && isFlower(RED_FLOWER));
  assert.equal(MATERIALS[RED_FLOWER].hardness, 0);
  assert.equal(ITEMS[RED_FLOWER].variants.length, RED_FLOWERS.length);
  assert.equal(BLOCKS[YELLOW_FLOWER].name, "Dandelion");
  for (let m = 0; m < 9; m++) assert.equal(TILES[blockTile(RED_FLOWER, 0, false, m)], "flower_" + RED_FLOWERS[m].texture);
  assert.equal(TILES[blockTile(YELLOW_FLOWER, 0)], "flower_dandelion");
});

test("a flower stays only on grass, dirt or farmland with light", () => {
  const w = new World("Flowers", "meadow", 3);
  const x = 40, z = 40, y = w.surface(x, z);
  for (let yy = y - 1; yy < 64; yy++) w.put(x, yy, z, yy === y - 1 ? 1 : 0, 0, false);
  assert.ok(flowerCanStay(w, ids, x, y, z));
  w.put(x, y - 1, z, 3, 0, false);
  assert.ok(!flowerCanStay(w, ids, x, y, z));
  for (const ground of [1, 2, 29, 30]) { w.put(x, y - 1, z, ground, 0, false); assert.ok(flowerCanStay(w, ids, x, y, z), "ground " + ground); }
  w.put(x, y + 3, z, 3, 0, false);
  assert.ok(!flowerCanStay(w, ids, x, y, z));
  w.put(x + 1, y, z, 20, 0, false);
  assert.ok(flowerCanStay(w, ids, x, y, z));
});

test("flower generation arrives with generation version 4 and only on grass or dirt", () => {
  const count = (w) => w.snapshot().data.filter((b) => b === YELLOW_FLOWER || b === RED_FLOWER).length;
  assert.equal(count(new World("Farm", "meadow", 3)), 0);
  const a = new World("Farm", "meadow", 4), b = new World("Farm", "meadow", 4);
  assert.ok(count(a) > 100);
  assert.deepEqual(a.snapshot(), b.snapshot());
  for (let x = 0; x < 128; x++)
    for (let z = 0; z < 128; z++)
      for (let y = 1; y < 64; y++) {
        const id = a.get(x, y, z);
        if (isFlower(id)) { assert.ok([1, 2].includes(a.get(x, y - 1, z)), `${x},${y},${z}`); assert.ok(id === YELLOW_FLOWER || a.getMeta(x, y, z) <= 8); }
      }
  assert.ok(count(new World("Farm", "alpine", 4)) > 0);
  // Older terrain is untouched: the version 3 world is the version 4 world without flowers.
  const old = new World("Farm", "meadow", 3);
  const A = a.snapshot().data, O = old.snapshot().data;
  for (let i = 0; i < O.length; i++) if (!isFlower(A[i])) assert.equal(A[i], O[i]);
});

test("bone meal on grass plants tall grass and flowers on air above grass only", () => {
  const w = new World("Bone", "meadow", 3);
  const x = 60, z = 60, y = w.surface(x, z) - 1;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    for (let yy = y; yy < 20 + y; yy++) w.put(x + dx, yy, z + dz, yy === y ? 1 : 0, 0, false);
  }
  const placed = growGrass(w, ids, new JRandom(5), "meadow", x, y, z);
  assert.ok(placed.length > 5);
  for (const [px, py, pz] of placed) {
    const b = w.get(px, py, pz);
    assert.ok(b === 39 || isFlower(b));
    assert.equal(w.get(px, py - 1, pz), 1);
  }
  assert.ok(placed.some(([px, py, pz]) => w.get(px, py, pz) === 39));
  const again = growGrass(w, ids, new JRandom(5), "meadow", x, y, z);
  assert.ok(again.length < placed.length);
  // Stone is not ground a plant can stay on.
  const dirt = new World("Bone", "meadow", 3);
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) dirt.put(x + dx, y, z + dz, 3, 0, false);
  assert.equal(growGrass(dirt, ids, new JRandom(5), "meadow", x, y, z).length, 0);
});

const sheepWorld = (extra) => new EntityWorld({ numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }, [{ id: "mob-1", type: "sheep", x: 64, y: 0, z: 64, health: 8, color: 0, ...extra }]);

test("dye sets an unsheared sheep's fleece to 15 - damage and uses one dye in survival only", () => {
  const w = sheepWorld({ color: 0 }), e = w.entities[0], p = new Survival({ slots: [makeStack(DYE, 3, 1)] });
  assert.equal(w.dye(e, makeStack(351 + 1, 1, 1), p), false);
  assert.equal(w.dye(e, p.held, p), true);
  assert.equal(e.color, 14);
  assert.equal(p.held.count, 2);
  // Same colour: nothing is used, but the click is still handled.
  assert.equal(w.dye(e, p.held, p), true);
  assert.equal(p.held.count, 2);
  // A sheared sheep keeps its colour.
  e.sheared = true;
  assert.equal(w.dye(e, makeStack(DYE, 1, 15), p), true);
  assert.equal(e.color, 14);
  // Creative never loses the dye.
  const cw = sheepWorld({ color: 5 }), c = new Survival({ slots: [makeStack(DYE, 3, 0)] }, "creative");
  assert.equal(cw.dye(cw.entities[0], c.held, c), true);
  assert.equal(cw.entities[0].color, 15);
  assert.equal(c.held.count, 3);
});

test("creative lists flowers in Decorations and the sixteen dyes in Materials", () => {
  const decorations = CREATIVE_TABS[1].items, materials = CREATIVE_TABS[10].items;
  assert.deepEqual(decorations.slice(decorations.indexOf(YELLOW_FLOWER),decorations.indexOf(YELLOW_FLOWER)+10), [YELLOW_FLOWER, RED_FLOWER, ...Array.from({ length: 8 }, (_, i) => [RED_FLOWER, i + 1])]);
  // Sugar (Items.sugar, 353) follows the dyes (351) in the original id order.
  const dye = materials.indexOf(DYE);
  assert.deepEqual(materials.slice(dye, dye + 16), [DYE, ...Array.from({ length: 15 }, (_, i) => [DYE, i + 1])]);
  assert.equal(ITEMS[materials[dye + 16]].name, "Sugar");
});
