import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stepBlock, isFenceLike } from "./step-block.js";
import { fromOriginal } from "./block-registry.js";
import { mobStepEvents } from "./mob-steps.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/step-block-reference.json", import.meta.url)));
const internal = (id, meta) => fromOriginal(id, meta)?.id ?? null;

// A world with `upper` in cell cy, `lower` below it and stone further down (the probe's layout).
function world(c) {
  const up = internal(c.upperId, 0), lo = internal(c.lowerId, 0);
  return { get: (x, y, z) => (x !== 64 || z !== 64 ? 0 : y === c.cy ? up : y === c.cy - 1 ? lo : y < c.cy - 1 ? 3 : 0) };
}

test("the probe covers fences, walls, gates, slabs, snow, carpet, soul sand, farmland and ladders (executed)", () => {
  assert.ok(ref.cases.length > 5000);
  for (const n of ["fence", "wall", "gate", "slab", "snow0", "carpet", "soul_sand", "farmland", "ladder", "vine", "nether_fence"]) assert.ok(ref.cases.some((c) => c.upper === n), n);
});

test("Entity.moveEntity's step block, air test and ladder test match the unchanged 1.7.10 classes (executed)", () => {
  let steps = 0, replaced = 0, silent = 0, ladders = 0;
  for (const c of ref.cases) {
    const w = world(c), label = `${c.upper} over ${c.lower} feet ${c.feet} yOffset ${c.yOffset} ${c.kind}`;
    assert.equal(w.get(64, c.cy, 64), internal(c.upperId, 0), label);
    const posY = c.endY - f(c.yOffset);
    const sb = stepBlock(w, 64.5, posY, 64.5);
    if (c.kind === "dist") {
      // distanceWalkedOnStepModified += sqrt(dx^2 + dy^2 [ladder only] + dz^2) * 0.6, in float.
      const dy = c.endY - c.startY, dx = 0.001;
      const expected = f(f(Math.sqrt(dx * dx + (sb.ladder ? dy * dy : 0) + dx * dx)) * 0.6);
      assert.ok(Math.abs(c.q - expected) < 1e-6, `${label}: q ${c.q} vs ${expected} (dy ${dy})`);
      if (sb.ladder) ladders++;
      continue;
    }
    // Sneaking while onGround before the move (flag20): no step at all.
    if (c.kind === "sneak") { assert.equal(c.step, null, label); continue; }
    if (sb.id === 0) { assert.equal(c.step, null, label); silent++; continue; }
    assert.ok(c.step, label);
    assert.deepEqual([c.step.x, c.step.y, c.step.z], [sb.x, sb.y, sb.z], label);
    assert.equal(fromOriginal(c.step.block, 0)?.id ?? internal(c.step.block, 0), sb.id, label);
    steps++;
    if (sb.replaced) replaced++;
  }
  assert.ok(steps > 1000 && replaced > 100 && silent > 100 && ladders > 20, `${steps} ${replaced} ${silent} ${ladders}`);
});

test("fence-like render types are 11, 32 and 21 only (iron bars, panes and stairs are not)", () => {
  for (const [id, yes] of [[85, true], [113, true], [139, true], [107, true], [101, false], [53, false], [44, false], [65, false]]) assert.equal(isFenceLike(internal(id, 0)), yes, `${id}`);
});

test("a mob standing on a fence top steps on the fence block, not in silence", () => {
  const fence = internal(85, 0), stone = 3;
  const w = { get: (x, y, z) => (y === 0 ? stone : y === 1 ? fence : 0) };
  const e = { type: "zombie", x: 0.5, y: 2.5, z: 0.5, stepDistance: 0 };
  const evs = mobStepEvents(w, e, { x: -2, y: 2.5, z: 0.5 }, { random: Math.random });
  assert.equal(evs.length, 1);
  assert.equal(evs[0].sound, "mob.zombie.step");
});
