import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LADDER, WATER, BLOCKS, blockBounds, opaqueCube, normalCube, raycast } from "./world.js";
import { canPlaceLadder, placedLadderMeta, ladderSupported, clickedSide, isOnLadder, countsVertical } from "./ladders.js";
import { moveEntityWithHeading } from "./entities.js";
import { MATERIALS, RECIPES, FUELS } from "./survival.js";
import { lightOpacity } from "./lighting.js";
import { defaultClassify } from "./pathfinding.js";
import { blockSound, stepSound } from "./audio.js";
import { blockTile, TILES } from "./block-textures.js";
import { placeContainedLiquid } from "./buckets.js";

const f = Math.fround;
const reference = JSON.parse(await readFile(new URL("../public/research/ladder-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const near = (a, b, label, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);

// The probe's world: stone below y 0 and a wall at z = -1 (y 0..8); a ladder column at
// x = z = 0, y 0..5, metadata 3 (on the wall behind it).
const columnWorld = {
  get: (x, y, z) => (y < 0 || (z === -1 && y <= 8) ? 3 : x === 0 && z === 0 && y >= 0 && y <= 5 ? LADDER : 0),
  getMeta: (x, y, z) => (x === 0 && z === 0 && y >= 0 && y <= 5 ? 3 : 0),
  solid(x, y, z) { return this.get(x, y, z) !== 0; },
};
// Placement tests: stone neighbours of (8, 4, 8) from a mask (x-1, x+1, z-1, z+1).
const maskWorld = (mask, meta = 0) => ({
  get: (x, y, z) =>
    y === 4 && ((x === 7 && z === 8 && mask & 1) || (x === 9 && z === 8 && mask & 2) || (x === 8 && z === 7 && mask & 4) || (x === 8 && z === 9 && mask & 8)) ? 3 : x === 8 && y === 4 && z === 8 ? LADDER : 0,
  getMeta: () => meta,
});

test("BlockLadder facts, bounds and item data match the original class", () => {
  const [facts] = records("facts");
  assert.equal(facts.id, 65);
  assert.equal(BLOCKS[LADDER].name, "Ladder");
  assert.equal(MATERIALS[LADDER].hardness, facts.hardness);
  assert.equal(MATERIALS[LADDER].kind, undefined); // Material.circuits: no effective tool, no tool needed
  assert.equal(facts.requiresTool, false);
  assert.equal(lightOpacity(LADDER), facts.opacity);
  assert.equal(opaqueCube(LADDER), facts.opaque);
  assert.equal(normalCube(LADDER), facts.normalCube);
  assert.equal(defaultClassify(LADDER).passable, !facts.blocksMovement);
  assert.equal(facts.drop, 65);
  assert.equal(facts.quantity, 1);
  assert.equal(facts.damageDropped, 0);
  assert.equal(facts.render, 8);
  assert.equal("step." + stepSound(LADDER), facts.stepSound);
  assert.equal("dig." + blockSound(LADDER), facts.breakSound);
  assert.equal(facts.placeSound, facts.breakSound);
  assert.equal(FUELS[LADDER], undefined); // TileEntityFurnace: only Material.wood blocks burn
  assert.equal(TILES[blockTile(LADDER, 2)], "ladder");
  for (const r of records("bounds")) {
    const w = { get: () => LADDER, getMeta: () => r.meta };
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.collision, `meta ${r.meta}`);
    assert.deepEqual(r.selection, r.collision);
  }
  // CraftingManager: "# #", "###", "# #" of sticks makes three ladders.
  const recipe = RECIPES.find((r) => r.output === LADDER);
  assert.deepEqual([recipe.width, recipe.height, recipe.count], [3, 3, 3]);
  assert.deepEqual(recipe.pattern, [300, 0, 300, 300, 300, 300, 300, 0, 300]);
});

test("96 original placements and 64 support checks", () => {
  for (const r of records("place")) {
    const w = maskWorld(r.mask);
    assert.equal(canPlaceLadder(w, 8, 4, 8), r.canPlace, `mask ${r.mask}`);
    r.meta.forEach((m, side) => assert.equal(placedLadderMeta(w, 8, 4, 8, side), m, `mask ${r.mask} side ${side}`));
  }
  assert.equal(records("place").length, 16);
  for (const r of records("support")) assert.equal(!ladderSupported(maskWorld(r.mask, r.meta), 8, 4, 8), r.removed, `mask ${r.mask} meta ${r.meta}`);
  assert.equal(records("support").length, 64);
  // Clicked faces: offset from the clicked block to the placement cell.
  assert.deepEqual([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]].map((d) => clickedSide([5, 5, 5], d.map((v) => v + 5))), [0, 1, 2, 3, 4, 5]);
});

test("ten original climbing, sliding, sneaking and falling runs for EntityPlayerSP and EntityZombie", () => {
  const runs = records("move");
  assert.equal(runs.length, 10);
  for (const c of runs) {
    const player = c.type === "player";
    const e = {
      type: player ? "player" : "zombie", player, sneaking: c.sneak, x: c.start[0], y: c.start[1], z: c.start[2],
      vx: c.motion[0], vy: c.motion[1], vz: c.motion[2], onGround: c.start[1] === 0, collidedH: false,
      fallDistance: f(c.fall), rotationYaw: c.yaw, aiMoveSpeed: f(c.speed),
    };
    let step = 0;
    c.ticks.forEach((want, i) => {
      const px = e.x, py = e.y, pz = e.z;
      moveEntityWithHeading(columnWorld, e, 0.6, 1.8, f(c.forward));
      const label = `${c.name} ${c.type} tick ${i}`;
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) near(e[k], want[k], `${label} ${k}`);
      assert.equal(e.onGround, want.onGround, `${label} onGround`);
      assert.equal(e.collidedH, want.collidedH, `${label} collidedH`);
      assert.equal(isOnLadder(columnWorld, e.x, e.y, e.z), want.ladder, `${label} ladder`);
      near(e.fallDistance, want.fall, `${label} fall`, 1e-6);
      // Entity.moveEntity's distanceWalkedOnStepModified: vertical moves count on a ladder.
      const dx = e.x - px, dz = e.z - pz, dy = countsVertical(columnWorld, e.x, e.y, e.z) ? e.y - py : 0;
      step = f(step + f(Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.6));
      near(step, want.step, `${label} step`, 1e-6);
    });
  }
  // Climbing reaches the top, sneaking holds position, falls are capped at -0.15 a tick.
  const run = (name, type) => runs.find((r) => r.name === name && r.type === type).ticks;
  assert.ok(run("climb", "player").at(-1).y >= 6);
  assert.ok(run("sneak", "player").every((t) => t.y === 3));
  assert.ok(run("fall", "zombie").every((t, i, a) => i === 0 || a[i - 1].y - t.y <= 0.15 + 1e-9));
  assert.match(runs.find((r) => r.name === "climb" && r.type === "player").soundNames, /step\.ladder/);
});

test("the player's ray selects only a ladder's plate", () => {
  const w = { get: (x, y, z) => (x === 0 && y === 1 && z === 0 ? LADDER : 0), getMeta: () => 3 };
  // Looking down -z through the open part of the cell meets the plate at z < 0.125.
  const hit = raycast(w, { x: 0.5, y: 1.5, z: 1.5 }, { x: 0, y: 0, z: -1 });
  assert.deepEqual(hit.block, [0, 1, 0]);
  assert.ok(1.5 - hit.distance <= 0.125 + 0.025);
  // A ray along +x at z 0.5 misses the plate entirely.
  assert.equal(raycast(w, { x: -1, y: 1.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 4), null);
});

test("a bucket's liquid replaces a ladder (Material.circuits is not solid) and drops it", () => {
  const cells = new Map([["0,1,0", LADDER], ["0,1,-1", 3]]);
  const w = {
    get: (x, y, z) => cells.get([x, y, z].join()) ?? 0, getMeta: () => 3, inside: () => true,
    solid(x, y, z) { return this.get(x, y, z) !== 0; }, set: (x, y, z, b) => cells.set([x, y, z].join(), b),
  };
  const broken = [];
  assert.ok(placeContainedLiquid(w, 0, 1, 0, WATER, (...a) => broken.push(a)));
  assert.deepEqual(broken, [[0, 1, 0, LADDER]]);
  assert.equal(w.get(0, 1, 0), WATER);
  assert.equal(placeContainedLiquid(w, 0, 1, -1, WATER), false);
});
