import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, collisionBounds, collisionBoxes, blockBounds, selectionBounds, opaqueCube, normalCube, solidBlock } from "./world.js";
import { fenceConnectsTo, fenceMask } from "./fences.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { lightOpacity } from "./lighting.js";
import { MATERIALS, ITEMS, SMELTING, craftingResult } from "./survival.js";
import { digSpeed, canHarvest } from "./mining.js";
import { STAIRS, isStair } from "./stairs.js";
import { blockCollisions } from "./block-collisions.js";
import { SMELT_EXPERIENCE } from "./experience.js";
import { harvestBlock, javaLikeRandom } from "./enchantment-effects.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import {
  NETHERRACK, SOUL_SAND, END_STONE, NETHER_BRICK, NETHER_FENCE, NETHER_BRICK_STAIRS, QUARTZ_ORE, QUARTZ_BLOCK, QUARTZ_STAIRS,
  NETHER_BRICK_ITEM, NETHER_QUARTZ, NETHER_ORIGINAL, quartzPlacedMeta, quartzDropDamage, quartzTexture, quartzOreXp, SOUL_SAND_COLLISION,
} from "./nether-blocks.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/nether-blocks-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const INTERNAL = Object.fromEntries(Object.entries(NETHER_ORIGINAL).map(([i, o]) => [o, Number(i)]));
const PICKAXES = { 270: [0, "pickaxe"], 274: [1, "pickaxe"], 257: [2, "pickaxe"], 278: [3, "pickaxe"], 285: [0, "pickaxe"] };
const SHOVELS = { 269: "shovel", 273: "shovel" };

test("the reference is the unchanged 1.7.10 client", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(records("facts").length, 11);
  assert.equal(records("fenceConnect").length, 171);
});

test("block facts: hardness, resistance, opacity, light and names", () => {
  for (const r of records("facts")) {
    const id = INTERNAL[r.id];
    if (!id) continue;
    assert.equal(MATERIALS[id].hardness, r.hardness, `hardness ${r.id}`);
    assert.equal(opaqueCube(id), r.opaque, `opaque ${r.id}`);
    assert.equal(normalCube(id), r.normalCube, `normal ${r.id}`);
    assert.equal(lightOpacity(id), r.lightOpacity, `opacity ${r.id}`);
    assert.deepEqual(toOriginal(id, 0)[0], r.id);
    assert.equal(fromOriginal(r.id, 0).id, id);
    assert.equal(r.requiresTool, id !== SOUL_SAND && id !== NETHER_FENCE ? true : r.requiresTool);
  }
  const n = ref.names;
  assert.equal(BLOCKS[NETHERRACK].name, n["tile.hellrock.name"]);
  assert.equal(BLOCKS[SOUL_SAND].name, n["tile.hellsand.name"]);
  assert.equal(BLOCKS[END_STONE].name, n["tile.whiteStone.name"]);
  assert.equal(ITEMS[NETHER_BRICK].name, n["tile.netherBrick.name"]);
  assert.equal(ITEMS[NETHER_FENCE].name, n["tile.netherFence.name"]);
  assert.equal(ITEMS[NETHER_BRICK_STAIRS].name, n["tile.stairsNetherBrick.name"]);
  assert.equal(ITEMS[QUARTZ_ORE].name, n["tile.netherquartz.name"]);
  assert.equal(ITEMS[QUARTZ_STAIRS].name, n["tile.stairsQuartz.name"]);
  assert.equal(ITEMS[NETHER_BRICK_ITEM].name, n["item.netherbrick.name"]);
  assert.equal(ITEMS[NETHER_QUARTZ].name, n["item.netherquartz.name"]);
  assert.deepEqual(ITEMS[QUARTZ_BLOCK].variants, [n["tile.quartzBlock.default.name"], n["tile.quartzBlock.chiseled.name"], n["tile.quartzBlock.lines.name"]]);
  assert.equal(ITEMS[1103].variants[6], n["tile.stoneSlab.netherBrick.name"]);
  assert.equal(ITEMS[1103].variants[7], n["tile.stoneSlab.quartz.name"]);
});

test("original item ids map to the internal items", () => {
  for (const [o, i] of Object.entries(INTERNAL)) assert.equal(ORIGINAL_ITEMS[o], i);
  assert.equal(ORIGINAL_ITEMS[405], NETHER_BRICK_ITEM);
  assert.equal(ORIGINAL_ITEMS[406], NETHER_QUARTZ);
});

test("mining speeds and harvest follow the original tool tables", () => {
  for (const r of records("mining")) {
    const id = INTERNAL[r.id];
    if (!id) continue;
    for (const [tool, [speed]] of Object.entries(r.tools)) {
      if (PICKAXES[tool]) {
        const t = { kind: "pickaxe", speed, tier: PICKAXES[tool][0] };
        if (id === SOUL_SAND) assert.equal(digSpeed(id, t), 1, `soul sand with pickaxe ${tool}`);
        else assert.equal(digSpeed(id, t), speed, `${r.id} pickaxe ${tool}`);
        if (id !== SOUL_SAND) assert.ok(canHarvest(id, MATERIALS[id], t));
      } else if (SHOVELS[tool]) {
        const t = { kind: "shovel", speed };
        assert.equal(digSpeed(id, t), speed, `${r.id} shovel ${tool}`);
      }
    }
    if (id !== SOUL_SAND) assert.equal(canHarvest(id, MATERIALS[id], { kind: "shovel", speed: 4 }), false);
  }
});

test("drops: every block drops itself, quartz blocks keep their damage except the pillar axes", () => {
  for (const r of records("drop")) {
    if (r.id === 44 || r.id === 155) continue;
    const id = INTERNAL[r.id];
    if (!id) continue;
    if (id === QUARTZ_ORE) assert.equal(MATERIALS[id].drop, NETHER_QUARTZ);
    else assert.equal(MATERIALS[id].drop ?? id, id);
  }
  for (const r of records("quartzPlace")) {
    assert.equal(quartzDropDamage(r.meta), r.damageDropped, `meta ${r.meta}`);
    for (let side = 0; side < 6; side++) assert.equal(quartzPlacedMeta(r.meta, side), r.placedBySide[side], `meta ${r.meta} side ${side}`);
  }
});

test("nether quartz ore: item 406, experience 2-5 and Fortune quantities replayed from the original", () => {
  let seed = 0x2545f491;
  const lcg = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (const r of records("harvest").filter((h) => h.id === 153)) {
    const rand = javaLikeRandom(lcg), drops = new Set(), xp = new Set();
    for (let i = 0; i < 4000; i++) {
      const out = harvestBlock(153, 0, { fortune: r.fortune, rand });
      assert.ok(out.drops.every((d) => d.id === 406 && d.damage === 0));
      drops.add(out.drops.length);
      xp.add(out.xp);
    }
    // The original's quantity set (400 samples, one Random(seed) per sample). Fortune II draws nextInt(4), a power of two whose
    // first value is correlated across consecutive seeds, so its native sample misses the 1: there the native set must only be
    // contained in ours; the formula (nextInt(fortune + 2) - 1, at least 0, plus one) bounds ours at fortune + 1.
    const native = Object.keys(r.drops).map((k) => Number(k.split("x")[1])).sort((a, b) => a - b), ours = [...drops].sort((a, b) => a - b);
    if (r.fortune === 2) { assert.ok(native.every((n) => drops.has(n))); assert.deepEqual(ours, [1, 2, 3]); }
    else assert.deepEqual(ours, native, `fortune ${r.fortune}`);
    assert.deepEqual([...xp].sort((a, b) => a - b), Object.keys(r.xp).map(Number).sort((a, b) => a - b));
  }
  // Silk Touch keeps the ore and the pillar axes collapse to the vertical pillar.
  assert.deepEqual(harvestBlock(153, 0, { silk: true, rand: javaLikeRandom(lcg) }).drops.map((d) => [d.id, d.damage]), [[153, 0]]);
  assert.deepEqual(harvestBlock(155, 3, { silk: true, rand: javaLikeRandom(lcg) }).drops.map((d) => [d.id, d.damage]), [[155, 2]]);
  const rnd = () => 0.999999;
  assert.equal(quartzOreXp(() => 0), 2);
  assert.equal(quartzOreXp(rnd), 5);
});

test("soul sand: collision box 0.875 high, selection box full", () => {
  const [b] = records("soulSandBoxes");
  assert.deepEqual([...SOUL_SAND_COLLISION], b.collision);
  const world = { get: () => SOUL_SAND, getMeta: () => 0 };
  assert.deepEqual(collisionBounds(world, 0, 0, 0), b.collision);
  assert.deepEqual(blockBounds(world, 0, 0, 0), b.selection);
});

test("soul sand: onEntityCollidedWithBlock multiplies the horizontal motion by 0.4 per overlapped cell", () => {
  const world = { get: (x, y, z) => (y === 0 ? SOUL_SAND : 0) };
  for (const r of records("soulSandSlow")) {
    const cells = r.entity === "zombie-two-cells" ? 2 : 1;
    const box = r.entity === "zombie-two-cells" ? [0.2, r.y, 0.2, 1.8, r.y + 1.8, 0.8] : [0.2, r.y, 0.2, 0.8, r.y + 1.8, 0.8];
    const e = r.entity === "item" ? { mx: r.before[0], my: r.before[1], mz: r.before[2] } : { vx: r.before[0], vy: r.before[1], vz: r.before[2] };
    const w = cells === 2 ? { get: (x, y) => (y === 0 && x <= 1 ? SOUL_SAND : 0) } : world;
    blockCollisions(w, box, e, undefined);
    const got = r.entity === "item" ? [e.mx, e.my, e.mz] : [e.vx, e.vy, e.vz];
    got.forEach((v, i) => assert.ok(Math.abs(v - r.after[i]) < 1e-12, `${r.entity} y ${r.y} axis ${i}: ${v} vs ${r.after[i]}`));
  }
  const player = { fire: 0 };
  let factor = 1;
  blockCollisions(world, [0.2, 0.5, 0.2, 0.8, 2.3, 0.8], player, { slow: (f) => { factor *= f; } });
  assert.equal(factor, 0.4);
});

test("block of quartz: placement metadata and the per-face icons", () => {
  for (const r of records("icons").filter((i) => i.id === 155)) {
    // Renderer face index (+x -x top bottom +z -z) from Minecraft side (bottom top north south west east).
    const bySide = { 0: 3, 1: 2, 2: 5, 3: 4, 4: 1, 5: 0 };
    for (let side = 0; side < 6; side++) assert.equal(quartzTexture(r.meta, bySide[side]), r.sides[side], `meta ${r.meta} side ${side}`);
  }
});

test("stairs: nether brick and quartz stairs are real stairs with the original hardness", () => {
  for (const r of records("stairPlace")) assert.ok(isStair(INTERNAL[r.id]));
  assert.equal(STAIRS[NETHER_BRICK_STAIRS].hardness, 2);
  assert.equal(STAIRS[QUARTZ_STAIRS].hardness, 0.800000011920929);
  assert.equal(MATERIALS[NETHER_BRICK_STAIRS]?.hardness ?? STAIRS[NETHER_BRICK_STAIRS].hardness, 2);
});

const cellsFor = (rec) => {
  const [w, h] = rec.shape;
  const size = Math.max(w, h) > 2 ? 3 : 2;
  const grid = Array(size * size).fill(null);
  rec.ingredients.forEach((ing, i) => {
    if (!ing) return;
    const x = i % w, y = Math.floor(i / w);
    const id = ing[0] === 405 ? NETHER_BRICK_ITEM : ing[0] === 406 ? NETHER_QUARTZ : ing[0] === 44 ? 1103 : INTERNAL[ing[0]];
    grid[y * size + x] = { id, count: 1, damage: ing[0] === 44 || ing[0] === 155 ? (ing[1] === 32767 ? 0 : ing[1]) : 0 };
  });
  return { grid, size };
};

test("crafting recipes match CraftingManager", () => {
  for (const rec of records("recipe")) {
    const { grid, size } = cellsFor(rec);
    const out = craftingResult(grid, size);
    const [oid, odmg, ocount] = rec.output;
    const id = oid === 44 ? 1103 : INTERNAL[oid];
    assert.ok(out, `no result for ${JSON.stringify(rec.output)}`);
    assert.equal(out.id, id, JSON.stringify(rec.output));
    assert.equal(out.count, ocount, JSON.stringify(rec.output));
    assert.equal(out.damage || 0, odmg, JSON.stringify(rec.output));
  }
  // Quartz block ingredients accept any damage in the stair and slab recipes.
  const chiseled = { id: QUARTZ_BLOCK, count: 1, damage: 1 };
  const stair = [chiseled, null, null, chiseled, chiseled, null, chiseled, chiseled, chiseled];
  assert.equal(craftingResult(stair, 3).id, QUARTZ_STAIRS);
  // A mixed pair of slabs does not make a chiseled block.
  assert.equal(craftingResult([{ id: 1103, count: 1, damage: 7 }, { id: 1103, count: 1, damage: 6 }, null, null], 2), null);
});

test("furnace: netherrack to nether brick, quartz ore to quartz, with the original experience", () => {
  for (const r of records("smelt")) {
    const id = INTERNAL[r.input[0]], out = r.output[0] === 405 ? NETHER_BRICK_ITEM : NETHER_QUARTZ;
    assert.equal(SMELTING[id], out);
    assert.equal(SMELT_EXPERIENCE[out], r.xp);
  }
});

test("nether brick fence connects to itself and solid blocks but not to oak fences", () => {
  for (const r of records("fenceConnect")) {
    const id = fromOriginal(r.id, 0)?.id;
    if (!id || BLOCKS[id]?.reserved) continue;
    assert.equal(fenceConnectsTo(id, NETHER_FENCE), !!r.nether, `${BLOCKS[id].name} (${r.id})`);
    assert.equal(fenceConnectsTo(id), !!r.oak, `oak ${BLOCKS[id].name} (${r.id})`);
  }
});

test("nether brick fence shapes: masks, collision boxes, bounds and selection", () => {
  for (const r of records("netherFenceShape")) {
    const n = fromOriginal(r.neighbour, 0).id;
    const cells = { "0,0,0": NETHER_FENCE };
    if (r.mask & 1) cells["0,0,-1"] = n;
    if (r.mask & 2) cells["0,0,1"] = n;
    if (r.mask & 4) cells["-1,0,0"] = n;
    if (r.mask & 8) cells["1,0,0"] = n;
    const w = { get: (x, y, z) => cells[`${x},${y},${z}`] ?? 0, getMeta: () => 0, solid(x, y, z) { return solidBlock(this.get(x, y, z)); } };
    // Oak fences (85) do not join a nether brick fence, so the arms stay away whatever the placed mask.
    assert.equal(fenceMask(w, 0, 0, 0), r.neighbour === 85 ? 0 : r.mask, `mask ${r.neighbour}/${r.mask}`);
    assert.deepEqual(collisionBoxes(w, 0, 0, 0), r.collision);
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.bounds);
    assert.deepEqual(selectionBounds(w, 0, 0, 0), r.selection);
  }
});
