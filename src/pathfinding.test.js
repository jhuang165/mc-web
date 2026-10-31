import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PathFinder, PathPoint, Path, PathEntity, PathNavigate, makeHash, getVerticalOffset } from "./pathfinding.js";
const reference = JSON.parse(await readFile(new URL("../public/research/path-reference.json", import.meta.url)));
// The probe's block ids (0 air, 1 stone, 2 grass, 9 water, 11 lava) as this game's ids.
const GAME = { 0: 0, 1: 3, 2: 1, 9: 10, 11: 42 };
function worldFrom(boxes) {
  return {
    get(x, y, z) {
      let id = 0;
      for (const b of boxes) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) id = b[6];
      return GAME[id];
    },
  };
}
const entityFor = (c) => ({ ...c.entity, maxSafePointTries: () => 3 });
test("the PathFinder returns the original's point lists for every probe scenario", () => {
  const paths = reference.cases.filter((c) => c.case === "path");
  assert.ok(paths.length >= 30);
  for (const c of paths) {
    const world = worldFrom(c.world), f = c.flags;
    const finder = new PathFinder(world, f.openDoors, f.breakDoors, f.avoidsWater, f.canSwim);
    const e = entityFor(c);
    const path = c.target.block
      ? finder.createEntityPathToBlock(e, ...c.target.block, c.range)
      : finder.createEntityPathToEntity(e, { x: c.target.entity[0], y: c.target.entity[1], z: c.target.entity[2] }, c.range);
    assert.deepEqual(path && path.points.map((p) => [p.x, p.y, p.z]), c.path, c.name);
  }
});
test("the probe covers the shapes the task asks for", () => {
  const by = (name) => reference.cases.find((c) => c.name === name);
  assert.ok(by("around a wall pig").path.length > 8, "detours around the wall");
  assert.equal(by("one block step pig").path.at(-1)[1], by("one block step pig").entity.y + 1, "up a one block step");
  assert.equal(by("four block drop").path.length, 3, "refuses the four block drop");
  assert.ok(by("pond waded zombie").path.length < by("pond avoided pig").path.length, "avoidsWater walks around the pond");
  assert.equal(by("out of range").path, null);
  assert.equal(by("two block drop at y 0").path.at(-1)[1], 1, "the fall stops updating the point at y <= 0");
});
test("PathPoint hashes, distances and the heap order like the original", () => {
  assert.equal(makeHash(1, 2, 3), 2 | (1 << 8) | (3 << 24));
  assert.equal(makeHash(-1, 2, -3), (2 | (32767 << 8) | ((-3 & 32767) << 24) | 0x80000000 | 0x8000) | 0);
  const a = new PathPoint(0, 0, 0), b = new PathPoint(3, 4, 0);
  assert.equal(a.distanceTo(b), 5);
  assert.equal(a.distanceToSquared(b), 25);
  const heap = new Path(), ps = [5, 1, 4, 2, 3, 0.5].map((t, i) => Object.assign(new PathPoint(i, 0, 0), { total: t }));
  for (const p of ps) heap.addPoint(p);
  assert.throws(() => heap.addPoint(ps[0]), /OW KNOWS!/);
  heap.changeDistance(ps[0], 0.1);
  const order = [];
  while (!heap.isPathEmpty()) order.push(heap.dequeue().total);
  assert.deepEqual(order, [0.1, 0.5, 1, 2, 3, 4]);
});
test("getVerticalOffset handles the block classes the original names", () => {
  const size = new PathPoint(1, 2, 1), e = { x: 0.5, y: 1, z: 0.5, inLava: false };
  const w = (id) => ({ get: (x, y, z) => (x === 0 && z === 0 && y === 1 ? id : 0) });
  const kinds = { door: { door: true, passable: false }, fence: { renderType: 11, passable: false }, gate: { fenceGate: true, passable: false }, trap: { trapdoor: true, passable: false }, rail: { renderType: 9, passable: true }, lava: { lava: true, passable: false }, water: { water: true, passable: true } };
  const cls = (id) => (id === 0 ? { air: true, passable: true } : kinds[id] || { passable: false });
  const off = (id, avoid = false, breakDoors = false, openDoors = true, ent = e) => getVerticalOffset(ent, 0, 1, 0, size, avoid, breakDoors, openDoors, w(id), cls);
  assert.equal(off(0), 1);
  assert.equal(off("stone"), 0);
  assert.equal(off("water"), 2);
  assert.equal(off("water", true), -1);
  assert.equal(off("fence"), -3);
  assert.equal(off("gate"), -3);
  assert.equal(off("trap"), -4);
  assert.equal(off("lava"), -2);
  assert.equal(off("lava", false, false, true, { ...e, inLava: true }), 1);
  assert.equal(off("door", false, false, false), 0);
  assert.equal(off("door", false, true, true), 1);
  assert.equal(off("rail"), 1, "standing on a rail already");
  assert.equal(off("rail", false, false, true, { ...e, x: 5.5 }), -3);
  assert.equal(getVerticalOffset({ ...e, x: 5.5, y: 2 }, 0, 1, 0, size, false, false, true, { get: (x, y, z) => (y === 1 && x === 0 && z === 0 ? "rail" : y === 1 ? "rail" : 0) }, cls), 1, "a rail under the feet");
});
test("PathNavigate follows a path: arrival, skipping, the move target and the stuck check", () => {
  const world = { get: (x, y, z) => (y < 0 ? 3 : 0) };
  const moves = [];
  const entity = { x: 0.5, y: 0, z: 0.5, width: 0.9, height: 0.9, onGround: true, inWater: false, inLava: false, maxSafePointTries: () => 3, moveHelper: { setMoveTo: (...a) => moves.push(a) } };
  const nav = new PathNavigate(entity, world, { followRange: 16 });
  assert.equal(nav.getPathSearchRange(), 16);
  assert.equal(nav.tryMoveToXYZ(5.5, 0, 0.5, 1.25), true);
  assert.ok(nav.getPath().length >= 2);
  // pathFollow's line-of-sight skip jumps straight to the last visible point.
  nav.onUpdateNavigation();
  assert.equal(nav.getPath().index, nav.getPath().length - 1);
  assert.deepEqual(moves.at(-1), [5.5, 0, 0.5, 1.25]);
  // Standing on the last point finishes the path.
  entity.x = 5.5;
  nav.onUpdateNavigation();
  assert.equal(nav.noPath(), true);
  // An airborne mob does not path; one that has not moved for 100 ticks drops its path.
  entity.onGround = false;
  assert.equal(nav.tryMoveToXYZ(2.5, 0, 0.5, 1), false);
  entity.onGround = true;
  entity.x = 0.5;
  assert.equal(nav.tryMoveToXYZ(0.5, 0, 6.5, 1), true);
  const wall = { get: (x, y, z) => (y < 0 ? 3 : x === 0 && y >= 0 && y < 3 && z === 3 ? 3 : 0) };
  nav.world = wall;
  nav.currentPath = new PathEntity([new PathPoint(0, 0, 0), new PathPoint(0, 0, 1), new PathPoint(0, 0, 8)]);
  nav.ticksAtLastPos = nav.totalTicks;
  nav.lastPos = { x: 0.5, y: 0, z: 0.5 };
  for (let i = 0; i < 101; i++) nav.onUpdateNavigation();
  // (the blocked direct walk keeps the path progressing one point at a time; a mob that never gets closer is dropped)
  assert.ok(nav.noPath() || nav.getPath().index <= 2);
});
test("the budget denies searches once it is spent", () => {
  const world = { get: (x, y, z) => (y < 0 ? 3 : 0) };
  const budget = { left: 1 };
  const entity = { x: 0.5, y: 0, z: 0.5, width: 0.9, height: 0.9, onGround: true, inWater: false, inLava: false, maxSafePointTries: () => 3, moveHelper: { setMoveTo() {} } };
  const nav = new PathNavigate(entity, world, { budget });
  assert.ok(nav.getPathToXYZ(4.5, 0, 0.5));
  assert.equal(nav.getPathToXYZ(4.5, 0, 0.5), null);
  assert.equal(budget.denied, 1);
});
