import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, collisionBoxes, collisionBoxList, collisionBounds, raycast, normalCube, opaqueCube, OAK_STAIRS, DARK_OAK_STAIRS } from "./world.js";
import {
  STAIRS, STAIR_FIRST, STAIR_LAST, STAIR_ITEM_BOXES, STAIR_SELECTION, isStair, stairBoxes, stairExcludedOctants,
  stairExplosionResistance, stairFacingMeta, stairPlacedMeta, stairPlacementMeta, stairRayTrace, stairRecipeResult,
  stairRotationYaw, stairShape, stairSolidTop,
} from "./stairs.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { MATERIALS, ITEMS } from "./survival.js";
import { CREATIVE_TABS, SEARCH_ORDER, entryId } from "./creative.js";
import { digSpeed, canHarvest } from "./mining.js";
import { populationCraftingResult, populationDrops } from "./population-content.js";
import { blockSound } from "./audio.js";
import { solidTop } from "./rails.js";
import { fenceConnectsTo } from "./fences.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/stairs-reference.json", import.meta.url)));
const ORIGINAL = [53, 67, 109, 128, 134, 135, 136, 108, 163, 164];
const byOriginal = new Map(ref.blocks.map((b) => [b.id, b]));
// Reference neighbour codes: 0 air/other, 1..8 a stair of metadata 0..7. Order x-1, x+1, z-1, z+1.
const AT = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const atFromCodes = (codes) => (dx, dz) => {
  const i = AT.findIndex(([a, b]) => a === dx && b === dz);
  return codes[i] > 0 ? codes[i] - 1 : -1;
};
// A cell map: [x, y, z] -> [id, meta].
function grid(cells = {}) {
  const map = new Map(Object.entries(cells));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => cell(x, y, z)[0] !== 0 };
}

test("registry: ten stair ids map to the original ids and keep the original metadata domain", () => {
  assert.equal(STAIR_FIRST, 87);
  assert.equal(STAIR_LAST, 96);
  assert.equal(ref.blocks.length, 10);
  assert.deepEqual(ref.blocks.map((b) => b.id), [...ORIGINAL].sort((a, b) => ref.blocks.findIndex((x) => x.id === a) - ref.blocks.findIndex((x) => x.id === b)));
  for (let id = 87; id <= 96; id++) {
    assert.ok(isStair(id));
    const original = STAIRS[id].original;
    assert.ok(ORIGINAL.includes(original), `${id}`);
    for (let meta = 0; meta < 8; meta++) {
      assert.deepEqual(toOriginal(id, meta), [original, meta], `${id}:${meta}`);
      const back = fromOriginal(original, meta);
      assert.deepEqual([back.id, back.meta], [id, meta]);
    }
    assert.ok(BLOCKS[id].name, `${id} is registered`);
  }
  assert.equal(OAK_STAIRS, 87);
  assert.equal(DARK_OAK_STAIRS, 96);
  assert.equal(isStair(86), false);
  assert.equal(isStair(97), false);
});

test("native block records: material, hardness, resistance, opacity, render type, sounds and drops", () => {
  for (const [id, s] of Object.entries(STAIRS)) {
    const r = byOriginal.get(s.original);
    assert.ok(r, `${id}`);
    assert.equal(r.renderType, 10);
    assert.equal(r.blockQueries.b, 10);
    assert.equal(r.blockQueries.c, false, "not an opaque cube");
    assert.equal(r.blockQueries.d, false, "not a normal block");
    assert.equal(r.lightOpacityField, 255);
    assert.equal(r.useNeighborBrightnessField, true);
    assert.equal(r.lightValueField, 0);
    assert.equal(r.hardness, s.hardness, `${s.name} hardness`);
    assert.equal(r.hardnessField, s.hardness);
    assert.equal(r.resistanceField, s.resistance, `${s.name} resistance`);
    assert.equal(Math.fround(r.explosionResistance), Math.fround(stairExplosionResistance(Number(id))));
    assert.equal(r.stepSound.name, s.sound, `${s.name} sound`);
    assert.equal(r.creativeTab, "buildingBlocks");
    assert.equal(r.tickRate, 10);
    assert.deepEqual(r.damageDropped, new Array(16).fill(0));
    assert.equal(r.dropItemId, -1, "drops itself");
    // Only the upside-down metadata (bit 2) has a solid top.
    assert.deepEqual(r.solidTop, Array.from({ length: 16 }, (_, m) => stairSolidTop(m)));
    // Game side.
    assert.equal(normalCube(Number(id)), false);
    assert.equal(opaqueCube(Number(id)), false);
    assert.equal(MATERIALS[id].hardness, s.hardness);
    assert.equal(MATERIALS[id].kind, s.kind);
    assert.equal(fenceConnectsTo(Number(id)), false, "a fence does not connect to stairs");
  }
  // The base block model of each stair (the planks damage selects the wood).
  assert.deepEqual(ref.blocks.map((b) => b.modelId), [5, 4, 98, 24, 5, 5, 5, 45, 5, 5]);
  assert.deepEqual(ref.blocks.map((b) => b.modelMeta), [0, 0, 0, 0, 1, 2, 3, 0, 4, 5]);
});

test("mining: wooden stairs are axe blocks, stone ones need a pickaxe (Material.rock)", () => {
  const axe = { kind: "axe", speed: 2 }, pick = { kind: "pickaxe", speed: 2, tier: 0 };
  for (const [id, s] of Object.entries(STAIRS)) {
    assert.equal(digSpeed(Number(id), s.kind === "axe" ? axe : pick), 2, `${s.name} effective tool`);
    assert.equal(digSpeed(Number(id), s.kind === "axe" ? pick : axe), 1, `${s.name} wrong tool`);
    if (s.kind === "pickaxe") assert.equal(canHarvest(Number(id), MATERIALS[id], null), false, `${s.name} needs a pickaxe`);
  }
});

test("drops: every metadata drops the stair itself with damage 0", () => {
  for (let id = 87; id <= 96; id++) for (let meta = 0; meta < 8; meta++) assert.equal(populationDrops(id, meta), null);
});

test("shape tables: every neighbour state of every metadata matches func_150147_e/145_f/144_g", () => {
  assert.equal(ref.renderShapes.length, ref.collisionShapes.length);
  assert.equal(ref.states.length, 16);
  let checked = 0;
  for (const state of ref.states) {
    assert.equal(state.render.length, 6561);
    for (let s = 0; s < 6561; s++) {
      const codes = [Math.floor(s / 729) % 9, Math.floor(s / 81) % 9, Math.floor(s / 9) % 9, s % 9];
      const boxes = stairShape(state.center, atFromCodes(codes));
      assert.deepEqual(boxes, ref.renderShapes[state.render[s]].boxes, `render meta ${state.center} state ${s}`);
      assert.deepEqual(boxes, ref.collisionShapes[state.collision[s]], `collision meta ${state.center} state ${s}`);
      checked++;
    }
  }
  assert.equal(checked, 104976);
});

test("mixed stair types and non-stair neighbours: only an equal-metadata stair connects", () => {
  assert.equal(ref.mixed.length, 4000);
  for (const [original, meta, neighbours, render, collision] of ref.mixed) {
    const cells = { "0,0,0": [fromOriginal(original, meta).id, meta] };
    neighbours.forEach(([nid, nm], i) => {
      if (nid) cells[`${AT[i][0]},0,${AT[i][1]}`] = [fromOriginal(nid, nm).id, nm];
    });
    const w = grid(cells), boxes = stairBoxes(w, 0, 0, 0);
    assert.deepEqual(boxes, ref.renderShapes[render].boxes, JSON.stringify([original, meta, neighbours]));
    assert.deepEqual(boxes, ref.collisionShapes[collision]);
    assert.deepEqual(collisionBoxes(w, 0, 0, 0), boxes);
    assert.deepEqual(collisionBoxList(w, 0, 0, 0), boxes);
  }
});

test("one-box callers get the union of the boxes and the stair stays inside its cell", () => {
  for (let meta = 0; meta < 8; meta++) {
    const w = grid({ "0,0,0": [OAK_STAIRS, meta] }), boxes = stairBoxes(w, 0, 0, 0), u = collisionBounds(w, 0, 0, 0);
    assert.deepEqual(u, [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i])))));
    assert.ok(boxes.length >= 2 && boxes.length <= 3);
    for (const b of boxes) assert.ok(b.every((v) => v >= 0 && v <= 1));
    // The step is exactly 0.5 high, so the 0.5 step height lets the player climb it.
    assert.equal(boxes[0][4] - boxes[0][1], 0.5);
  }
});

test("collisionRayTrace: 3072 native rays, the selection box and the stale bounds", () => {
  assert.equal(ref.raytraces.length, 16);
  let rays = 0;
  for (const r of ref.raytraces) {
    assert.deepEqual(r.selectedBox, [0, 0, 0, 1, 1, 1]);
    assert.deepEqual(STAIR_SELECTION, r.selectedBox);
    // The trace leaves the block's bounds at the last octant tried (the N-never-reset quirk).
    assert.deepEqual(r.boundsAfterTrace, [0.5, 0.5, 0.5, 1, 1, 1]);
    for (const [x0, y0, z0, x1, y1, z1, hit] of r.rays) {
      rays++;
      // The reference ray is relative to the block at (5, 5, 5); the hit vector is absolute.
      const got = stairRayTrace(r.meta, 5, 5, 5, [x0 + 5, y0 + 5, z0 + 5], [x1 + 5, y1 + 5, z1 + 5]);
      if (hit === null) assert.equal(got, null, `meta ${r.meta} ray ${[x0, y0, z0, x1, y1, z1]}`);
      else {
        assert.ok(got, `meta ${r.meta} ray ${[x0, y0, z0, x1, y1, z1]}`);
        assert.deepEqual([got.side, ...got.vec], hit, `meta ${r.meta} ray ${[x0, y0, z0, x1, y1, z1]}`);
      }
    }
  }
  assert.equal(rays, 3072);
});

test("the excluded octants per metadata match the ray traces and raycast skips empty octants", () => {
  const expected = [[2, 6], [3, 7], [2, 3], [6, 7], [0, 4], [1, 5], [0, 1], [4, 5]];
  for (let meta = 0; meta < 8; meta++) assert.deepEqual(stairExcludedOctants(meta), expected[(meta & 3) + (meta & 4 ? 4 : 0)]);
  // meta 0: an ordinary stair facing +x, empty top x-low half. A ray straight down at x=0.25 passes through it.
  const w = grid({ "0,0,0": [OAK_STAIRS, 0], "0,-1,0": [1, 0] });
  const down = raycast(w, { x: 0.25, y: 3, z: 0.25 }, { x: 0, y: -1, z: 0 }, 6);
  assert.deepEqual(down.block, [0, 0, 0]);
  assert.equal(down.hit[1], 0.5);
  // The high half (x >= 0.5) is filled up to y = 1.
  const high = raycast(w, { x: 0.75, y: 3, z: 0.25 }, { x: 0, y: -1, z: 0 }, 6);
  assert.deepEqual(high.block, [0, 0, 0]);
  assert.equal(high.hit[1], 1);
});

test("onBlockPlaced: the lower face or an upper-half side hit gives upside-down stairs", () => {
  assert.equal(ref.placement.onBlockPlaced.length, 216);
  for (const [side, hitY, meta, result] of ref.placement.onBlockPlaced)
    assert.equal(stairPlacedMeta(side, Math.fround(hitY), meta), result, `side ${side} hitY ${hitY} meta ${meta}`);
});

test("onBlockPlacedBy: facing from the yaw, 1304 native cases, bit 2 kept", () => {
  assert.equal(ref.placement.onBlockPlacedBy.length, 1304);
  for (const [yaw, existing, result] of ref.placement.onBlockPlacedBy)
    assert.equal(stairFacingMeta(Math.fround(yaw), existing), result, `yaw ${yaw} existing ${existing}`);
  // Camera yaw (radians, 0 faces north) converts to rotationYaw = 180 - degrees.
  assert.equal(stairRotationYaw(0), 180);
  assert.equal(stairRotationYaw(Math.PI / 2), 90);
  // Looking north (-z), south, west and east.
  assert.equal(stairPlacementMeta(0, 1, 0.5) & 3, stairFacingMeta(180));
  assert.equal(stairPlacementMeta(Math.PI, 1, 0.5) & 3, stairFacingMeta(0));
  assert.equal(stairPlacementMeta(0, 0, 0.5) & 4, 4);
  assert.equal(stairPlacementMeta(0, 2, 0.75) & 4, 4);
  assert.equal(stairPlacementMeta(0, 2, 0.25) & 4, 0);
});

test("recipes: six base blocks give four stairs, planks match their exact damage", () => {
  const item = (id, damage = 0) => ({ id, damage, count: 1 });
  const cases = [[87, 7, 0], [88, 12, 0], [89, 1101, 0], [90, 56, 0], [91, 7, 1], [92, 7, 2], [93, 7, 3], [94, 8, 0], [95, 7, 4], [96, 7, 5]];
  const left = [0, 3, 4, 6, 7, 8], right = [2, 4, 5, 6, 7, 8];
  for (const [id, base, damage] of cases)
    for (const pattern of [left, right]) {
      const cells = new Array(9).fill(null);
      for (const i of pattern) cells[i] = item(base, damage);
      assert.deepEqual(stairRecipeResult(cells, 3), { id, count: 4, damage: 0 });
      assert.deepEqual(populationCraftingResult(cells, 3), { id, count: 4, damage: 0 });
      // One more or fewer ingredient, a different shape, or the 2x2 grid does not craft stairs.
      const extra = [...cells];
      extra[pattern.length === 6 && !pattern.includes(1) ? 1 : 3] ??= item(base, damage);
      assert.equal(stairRecipeResult(extra.map((c, i) => (i === 1 ? item(base, damage) : c)), 3), null);
      assert.equal(stairRecipeResult(cells.map((c, i) => (i === pattern[0] ? null : c)), 3), null);
    }
  const row = new Array(9).fill(null);
  [0, 1, 2, 3, 4, 5].forEach((i) => (row[i] = item(7, 0)));
  assert.equal(stairRecipeResult(row, 3), null);
  const wrongDamage = new Array(9).fill(null);
  left.forEach((i) => (wrongDamage[i] = item(7, 6)));
  assert.equal(stairRecipeResult(wrongDamage, 3), null);
  const mixedPlanks = new Array(9).fill(null);
  left.forEach((i, k) => (mixedPlanks[i] = item(7, k === 0 ? 1 : 0)));
  assert.equal(stairRecipeResult(mixedPlanks, 3), null);
});

test("items, Creative order and sounds", () => {
  for (let id = 87; id <= 96; id++) assert.ok(ITEMS[id], `item ${id}`);
  const order = CREATIVE_TABS[0].items.map(entryId).filter(isStair);
  // 1.7.10 Building Blocks order: oak, cobblestone, brick, stone brick, sandstone, spruce, birch, jungle, acacia, dark oak.
  assert.deepEqual(order, [87, 88, 94, 89, 90, 91, 92, 93, 95, 96]);
  assert.deepEqual(SEARCH_ORDER.map(entryId).filter(isStair).sort((a, b) => a - b), [87, 88, 89, 90, 91, 92, 93, 94, 95, 96]);
  assert.equal(blockSound(87), "wood");
  assert.equal(blockSound(91), "wood");
  assert.equal(blockSound(96), "wood");
  assert.equal(blockSound(88), "stone");
  assert.equal(blockSound(94), "stone");
  assert.equal(STAIR_ITEM_BOXES.length, 2);
});

test("support: only an upside-down stair is a solid top", () => {
  for (let meta = 0; meta < 8; meta++) assert.equal(solidTop(grid({ "0,0,0": [OAK_STAIRS, meta] }), 0, 0, 0), (meta & 4) !== 0);
});
