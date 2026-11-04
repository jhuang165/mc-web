import test from "node:test";
import assert from "node:assert/strict";
import { VoxelScene } from "./scene.js";
import { movingParts } from "./piston-live.js";
import { fromOriginal } from "./block-registry.js";
import { pistonTile } from "./redstone.js";

// A headless VoxelScene: only what updateMoving / movingGeometry touch.
function stub() {
  const added = new Set(), disposed = [];
  const s = Object.create(VoxelScene.prototype);
  s.scene = { add: (m) => added.add(m), remove: (m) => added.delete(m) };
  s.material = null;
  s.world = { get: () => 0, getMeta: () => 0, height: 128 };
  s.light = { packed: () => 0xf0, world: s.world };
  return { s, added, disposed };
}
const tile = (o) => Object.assign(pistonTile(o.block, o.meta, o.facing, o.extending, !!o.renderHead), { progress: o.progress, lastProgress: o.lastProgress });

test("updateMoving caches geometry per part, only repositions each frame and disposes removed parts", () => {
  const { s, added } = stub();
  const t = tile({ block: 1, meta: 0, facing: 5, extending: true, progress: 0.5, lastProgress: 0 });
  const entry = (partial) => ({ x: 2, y: 3, z: 4, parts: movingParts(t, partial, fromOriginal) });
  let disposals = 0;
  s.setMovingBlocks([entry(0)]);
  s.updateMoving();
  assert.equal(added.size, 1);
  const mesh = [...added][0];
  mesh.geometry.addEventListener("dispose", () => disposals++);
  assert.ok(mesh.geometry.getAttribute("position").count >= 24, "a full cube");
  const first = mesh.position.x;
  s.setMovingBlocks([entry(1)]);
  s.updateMoving();
  assert.equal([...added][0], mesh, "same mesh, geometry reused");
  assert.notEqual(mesh.position.x, first);
  assert.equal(disposals, 0);
  s.setMovingBlocks([]);
  s.updateMoving();
  assert.equal(added.size, 0);
  assert.equal(disposals, 1);
});

test("a retracting sticky base draws the head and the base with the piston textures; a head shortens past half way", () => {
  const { s, added } = stub();
  const t = tile({ block: 29, meta: 5, facing: 5, extending: false, renderHead: true, progress: 0.25, lastProgress: 0 });
  const parts = movingParts(t, 0, fromOriginal);
  assert.equal(parts.length, 2);
  s.setMovingBlocks([{ x: 0, y: 70, z: 0, parts }]);
  s.updateMoving();
  assert.equal(added.size, 2);
  const before = [...added][0].geometry.getAttribute("position").array.slice();
  t.progress = t.lastProgress = 0.75;
  s.setMovingBlocks([{ x: 0, y: 70, z: 0, parts: movingParts(t, 0, fromOriginal) }]);
  s.updateMoving();
  const after = [...added].find((m) => true).geometry.getAttribute("position").array;
  assert.notDeepEqual(Array.from(before), Array.from(after), "the arm shortened and the head geometry was rebuilt");
});
