import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference48 as reference, firstDivergence } from "./enderman-wolf-replay.js";
import { pushServerPlayer } from "./piston-push.js";

// enderman-wolf-b48pp-reference.json: EndermanWolfProbe, set b48pp (EW_SET=b48pp), executed on the unchanged obfuscated 1.7.10 jar. The probe world holds a real
// TileEntityPiston (aps) in a BlockPistonMoving cell; each tick records the mobs, the server copy (b47sp rules) and the tile's progress/lastProgress.
test("b48pp reference covers mobs, lifts, walls, retracting tiles and the server copy", () => {
  assert.equal(reference.records.length, 25);
  for (const k of ["cow-east", "pig", "zombie", "horse", "wall", "lift", "ceiling", "retract", "head", "calf", "two-tiles", "copy-stay", "copy-follow", "copy-wall", "copy-thrown", "ledge", "copy-lift", "copy-fly", "copy-herd"]) {
    assert.ok(reference.records.some((r) => r.name.includes(k)), k);
  }
});
for (const r of reference.records) {
  test(`piston push b48: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

test("a push with no world just moves the server copy", () => {
  const copy = { x: 0, y: 0, z: 0, motion: { x: 0, y: -0.0784, z: 0 } };
  pushServerPlayer(null, copy, 0.5, 0, 0.25);
  assert.deepEqual([copy.x, copy.y, copy.z], [0.5, 0, 0.25]);
});
