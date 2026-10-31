import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LADDER, SNOW_LAYER, World, collides, collisionBounds, blockBounds, solidBlock } from "./world.js";
import { moveEntity, moveEntityWithHeading } from "./entities.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/playerstep-reference.json", import.meta.url)));
const near = (a, b, label, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);

// Original block ids/metadata of the probe's obstacles in this build's ids.
const internal = (id, meta) => (id === 1 ? 3 : id === 60 ? (meta > 0 ? 30 : 29) : id === 54 ? 41 : id === 65 ? LADDER : id === 78 ? SNOW_LAYER : null);
// Stone below y 0, the obstacle at (64, 0, 65) and an optional stone riser at (64, 0, 66).
function probeWorld(c) {
  const id = internal(c.id, c.meta),
    get = (x, y, z) => (y < 0 ? 3 : x === 64 && y === 0 && z === 65 ? id : c.riser && x === 64 && y === 0 && z === 66 ? 3 : 0),
    getMeta = (x, y, z) => (x === 64 && y === 0 && z === 65 && id !== 3 && id !== 29 && id !== 30 ? c.meta : 0);
  return { get, getMeta, solid: (x, y, z) => solidBlock(get(x, y, z), getMeta(x, y, z)), surface: () => 0 };
}
const player = (c) => ({ x: 64.5, y: 0, z: 64.5, vx: 0, vy: 0, vz: 0, onGround: c.onGround ?? true, collidedH: false, fallDistance: 0, sneaking: !!c.sneak, ySize: f(c.ySize ?? 0), rotationYaw: 0, aiMoveSpeed: 0 });

test("Entity.moveEntity's step-up for the player matches the unchanged 1.7.10 classes on partial blocks", () => {
  const moves = ref.cases.filter((c) => c.case === "move");
  assert.ok(moves.length >= 400);
  let stepped = 0, refused = 0;
  for (const c of moves) {
    const e = player(c);
    moveEntity(probeWorld(c), e, 0.6, 1.8, 0.03, -0.0784, c.dz);
    const label = `${c.block} dz=${c.dz} ySize=${c.ySize} onGround=${c.onGround} sneak=${c.sneak}`;
    // posY is minY + yOffset (0 here) - ySize; this build keeps the feet and ySize apart.
    near(e.y - e.ySize, c.end.y, label + " y");
    near(e.x, c.end.x, label + " x");
    near(e.z, c.end.z, label + " z");
    assert.equal(e.ySize, f(c.end.ySize), label + " ySize");
    assert.equal(e.onGround, c.end.onGround, label + " onGround");
    assert.equal(e.collidedH, c.end.collidedH, label + " collidedH");
    for (const k of ["vx", "vy", "vz"]) assert.equal(e[k] === 0, c.end[k] === 0, `${label} ${k} zeroed`);
    if (c.end.y + c.end.ySize > 0.01) stepped++;
    else if (c.ySize >= 0.2 && !c.sneak && c.end.collidedH && /snow[1-4]/.test(c.block)) refused++;
  }
  assert.ok(stepped >= 100, "the cases must step");
  assert.ok(refused >= 10, "a lowered eye must refuse a step");
});

test("walking into farmland, snow, chests, ladders and stone matches the original moveEntityWithHeading", () => {
  const walks = ref.cases.filter((c) => c.case === "walk");
  assert.ok(walks.length >= 12);
  for (const c of walks) {
    const w = probeWorld(c), e = player(c);
    e.aiMoveSpeed = f(c.speed);
    c.ticks.forEach((want, i) => {
      e.px = e.x; e.pz = e.z;
      moveEntityWithHeading(w, e, 0.6, 1.8, f(0.98));
      const label = `walk ${c.block} speed ${c.speed} riser ${c.riser} tick ${i}`;
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) near(e[k], want[k], `${label} ${k}`, 1e-11);
      assert.equal(e.onGround, want.onGround, label);
      assert.equal(e.collidedH, want.collidedH, label);
    });
  }
  // Snow up to four layers (0.5) is walked onto; five layers and farmland need a jump.
  const top = (b) => Math.max(...walks.find((c) => c.block === b).ticks.map((t) => t.y));
  for (const b of ["snow1", "snow2", "snow3", "snow4"]) assert.ok(top(b) > 0, b);
  for (const b of ["snow5", "snow7", "farmland", "stone", "chest"]) assert.equal(top(b), 0, b);
});

test("farmland collides as a full cube but keeps its 15/16 selection box", () => {
  const w = new World("farm", "meadow", 8);
  w.put(10, 30, 10, 29);
  assert.deepEqual(collisionBounds(w, 10, 30, 10), [0, 0, 0, 1, 1, 1]);
  assert.equal(blockBounds(w, 10, 30, 10)[4], 15 / 16);
  // The player's box with its feet at 30.95 overlaps the full-height collision box.
  for (let y = 31; y < 40; y++) w.put(10, y, 10, 0);
  assert.ok(collides(w, 10.5, 30.95, 10.5));
  assert.ok(!collides(w, 10.5, 31, 10.5));
});
