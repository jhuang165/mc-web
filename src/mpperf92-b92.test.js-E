// Batch 92 mpperf92: MC_MPPERF92 off / on / verify give the same target boxes, paths and mob states with fewer allocations per server tick.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fast92, bumpTargetEpoch92, carryTargets92 } from "./mpperf92-fast.js";
import { targetStore88 } from "./mpperf88-fast.js";
import { boxStore } from "./mpperf84-fast.js";
import { mobTargets } from "./projectiles.js";
import { ENTITY_TYPES } from "./entities.js";
import { PathNavigate } from "./pathfinding.js";

const withMode = (mode, fn) => { const was = fast92.mode; fast92.mode = mode; try { return fn(); } finally { fast92.mode = was; } };
const HW = Math.fround(Math.fround(ENTITY_TYPES.pig.width) / 2);
const mob = (x, z) => ({ type: "pig", x, y: 4, z, growingAge: 0 });
const boxes = (list) => list.map((t) => t.box.slice());

test("mobTargets: a moved mob's box is replaced inside one tick and rewritten in place after a mob tick; the numbers match off", () => {
  for (const mode of ["on", "verify"]) withMode(mode, () => {
    const ents = [mob(0, 0), mob(5, 5), mob(9, 1)], ref = ents.map((e) => ({ ...e }));
    const a = mobTargets(ents, null), keep = a.map((t) => t.box), keepRec = a.slice();
    assert.deepEqual(boxes(a), withMode("off", () => boxes(mobTargets(ref, null))));
    ents[1].x = 6; ents[1].z = 7; // moved between two lists of one tick (a teleport): the list in hand keeps its own box
    const b = mobTargets(ents, null);
    assert.notEqual(b[1].box, keep[1]);
    assert.equal(keep[1][0], 5 - HW);
    assert.equal(b[0], keepRec[0]); assert.equal(b[0].box, keep[0]); // not moved: the very record
    assert.deepEqual(boxes(b), withMode("off", () => { ref[1].x = 6; ref[1].z = 7; return boxes(mobTargets(ref, null)); }));
    bumpTargetEpoch92(boxStore(ents)); // a mob tick passed
    ents[1].x = 7; ents[0].z = 2;
    const c = mobTargets(ents, null);
    assert.equal(c[1].box, b[1].box); assert.equal(c[1], b[1]); // rewritten in place: no new array, no new record
    assert.equal(c[0].box, b[0].box);
    assert.equal(c[1].box[0], 7 - HW); assert.equal(c[0].box[2], 2 - HW);
    ents[1].x = 8; // same epoch again: replaced, the list c keeps its numbers
    const d = mobTargets(ents, null);
    assert.notEqual(d[1].box, c[1].box); assert.equal(c[1].box[0], 7 - HW);
  });
});

test("mobTargets: a store that never saw a mob tick never rewrites a box; -0 is a move; a different mob in the slot is a new box", () => {
  withMode("on", () => {
    const ents = [mob(1, 1)], a = mobTargets(ents, null)[0].box;
    for (let i = 0; i < 3; i++) { ents[0].x += 1; const b = mobTargets(ents, null)[0].box; assert.notEqual(b, a); }
    assert.equal(targetStore88(boxStore(ents)).epoch, undefined);
    bumpTargetEpoch92(boxStore(ents)); mobTargets(ents, null);
    ents[0].x = 0; bumpTargetEpoch92(boxStore(ents)); const z = mobTargets(ents, null)[0]; const zb = z.box;
    ents[0].x = -0; bumpTargetEpoch92(boxStore(ents)); const nz = mobTargets(ents, null)[0];
    assert.equal(nz.box, zb); assert.ok(Object.is(nz.box[0], -0 - HW));
    assert.ok(Object.is(nz.box[1], 4));
    const other = mob(1, 1); ents[0] = other; bumpTargetEpoch92(boxStore(ents));
    assert.notEqual(mobTargets(ents, null)[0].box, zb);
  });
});

test("carryTargets92: the next list inherits the store; off does not", () => {
  withMode("on", () => {
    const ents = [mob(1, 1), mob(2, 2)], first = mobTargets(ents, null)[1];
    const next = ents.filter(() => true); carryTargets92(ents, next);
    assert.equal(mobTargets(next, null)[1], first); // unchanged mob: the same record
    const shifted = ents.slice(1); carryTargets92(next, shifted);
    assert.notEqual(mobTargets(shifted, null)[0], first); // slot 0 now holds another mob: rebuilt
    assert.equal(mobTargets(shifted, null)[0].ref, ents[1]);
  });
  withMode("off", () => {
    const ents = [mob(1, 1)], first = mobTargets(ents, null)[0], next = ents.filter(() => true); carryTargets92(ents, next);
    assert.notEqual(mobTargets(next, null)[0], first);
  });
});

const reference = JSON.parse(await readFile(new URL("../public/research/path-reference.json", import.meta.url)));
const GAME = { 0: 0, 1: 3, 2: 1, 9: 10, 11: 42 };
const worldFrom = (bx) => ({ get(x, y, z) { let id = 0; for (const b of bx) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) id = b[6]; return GAME[id]; } });

test("Navigator.finder: every probe path comes out the same off / on / verify, over repeated searches with different flags", () => {
  const paths = reference.cases.filter((c) => c.case === "path");
  const run = (mode) => withMode(mode, () => paths.map((c) => {
    const e = { ...c.entity, maxSafePointTries: () => 3 }, nav = new PathNavigate(e, worldFrom(c.world), { followRange: c.range });
    nav.canPassOpenDoors = c.flags.openDoors; nav.canPassClosedDoors = c.flags.breakDoors; nav.avoidsWater = c.flags.avoidsWater; nav.canSwim = c.flags.canSwim;
    const finder = nav.finder();
    const path = c.target.block ? finder.createEntityPathToBlock(e, ...c.target.block, c.range) : finder.createEntityPathToEntity(e, { x: c.target.entity[0], y: c.target.entity[1], z: c.target.entity[2] }, c.range);
    return path && path.points.map((p) => [p.x, p.y, p.z]);
  }));
  const want = paths.map((c) => c.path);
  assert.deepEqual(run("off"), want); assert.deepEqual(run("on"), want); assert.deepEqual(run("verify"), want);
});

test("Navigator.finder: one shared finder, reset; a finder with a search open is not handed out again; the memo table is pooled and clean", () => {
  withMode("verify", () => {
    const nav = new PathNavigate({ x: 0, y: 1, z: 0, width: 0.6, height: 1.8 }, worldFrom([]), { followRange: 16 });
    const a = nav.finder(); a.pathOptions[3] = {}; a.path.count = 5; a.expanded = 9; a.tries = 4;
    const b = nav.finder();
    assert.equal(a, b); // reset by finder(): verify compared every field with a fresh PathFinder
    a.beginMemo({ x: 0, y: 1, z: 0 }, 16);
    assert.notEqual(nav.finder(), a); // a search is open on it
    const m = a.memo; assert.ok(m.slots !== null);
    a.endMemo();
    a.beginMemo({ x: 0, y: 1, z: 0 }, 16); assert.equal(a.memo, m); a.endMemo(); // the pooled table
    a.beginMemo({ x: 0, y: 1, z: 0 }, 16); const inner = new PathNavigate({}, worldFrom([]), {}).finder(); inner.beginMemo({ x: 0, y: 1, z: 0 }, 16); assert.notEqual(inner.memo, a.memo); inner.endMemo(); a.endMemo();
  });
  withMode("off", () => { const nav = new PathNavigate({}, worldFrom([]), {}); assert.notEqual(nav.finder(), nav.finder()); });
});

test("bench state hashes are identical off / on / verify (Math.random seeded alike in each run)", () => {
  const hash = (m, scene) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=70"], { env: { ...process.env, MC_MPPERF92: m }, encoding: "utf8" }).stdout.trim().split("mobs=").pop();
  for (const scene of ["pen", "travel"]) {
    const off = hash("off", scene);
    assert.match(off, /\[".{16}",".{16}"\]$/);
    assert.equal(hash("on", scene), off, scene); assert.equal(hash("verify", scene), off, scene);
  }
  assert.match(spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF92: "off" }, encoding: "utf8" }).stdout, /mode92=off/);
});
