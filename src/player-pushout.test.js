import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalCube } from "./world.js";
import { pushOutOfBlocks } from "./entities.js";

const load = async (name) => JSON.parse(await readFile(new URL(`../public/research/${name}`, import.meta.url)));
const ref = await load("pushout-reference.json"), shadow = (await load("shadow-reference.json")).blocks;
// Internal block id for an original id (glass 20 is internal 9, stone 1 internal 3).
const internal = Object.fromEntries(Object.entries(shadow).map(([id, b]) => [b.mc, +id]));

test("normalCube agrees with the original Block.isNormalCube for every block this build has", () => {
  const cubes = ref.cases.filter((c) => c.case === "cube");
  assert.ok(cubes.length >= 45);
  for (const [id, b] of Object.entries(shadow)) {
    const c = cubes.find((c) => c.id === b.mc);
    assert.ok(c, `original ${b.mc}`);
    assert.equal(normalCube(+id), c.normal, `internal ${id} (original ${b.mc})`);
  }
});

test("pushOutOfBlocks matches EntityPlayerSP.func_145771_j at the four corners", () => {
  const pushes = ref.cases.filter((c) => c.case === "push");
  assert.ok(pushes.length >= 2000);
  const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let moved = 0;
  for (const c of pushes) {
    const cells = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    cells.set(key(64, c.level, 64), internal[c.centre]);
    c.sides.forEach((kind, i) => {
      const [dx, dz] = sides[i];
      if (kind === 1) cells.set(key(64 + dx, 0, 64 + dz), internal[1]);
      if (kind === 2) cells.set(key(64 + dx, 0, 64 + dz), internal[20]), cells.set(key(64 + dx, 1, 64 + dz), internal[1]);
    });
    const world = { get: (x, y, z) => (y < -1 ? internal[1] : cells.get(key(x, y, z)) ?? 0) },
      e = { x: c.x, y: c.y, z: c.z, vx: 0.0123, vz: -0.0456 };
    pushOutOfBlocks(world, e, 0.6);
    const label = `centre ${c.centre} level ${c.level} sides ${c.sides} at ${c.x},${c.y},${c.z}`;
    assert.equal(e.vx, c.vx, label + " vx");
    assert.equal(e.vz, c.vz, label + " vz");
    if (e.vx !== 0.0123 || e.vz !== -0.0456) moved++;
  }
  assert.ok(moved > 1000, "most layouts push");
});
