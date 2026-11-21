// Batch 93 mpperf93: MC_MPPERF93 off / on / verify give the same push candidates, portal steps and bench states with fewer allocations per server tick.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast93 } from "./mpperf93-fast.js";
import { FineGrid } from "./push-grid.js";
import { EntityPortals } from "./entity-portal.js";
import { ENTITY_TYPES } from "./entities.js";
import { GAME_IDS } from "./dimensions.js";

const withMode = (mode, fn) => { const was = fast93.mode; fast93.mode = mode; try { return fn(); } finally { fast93.mode = was; } };
const mk = (n, seed) => { let s = seed; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); return Array.from({ length: n }, () => ({ type: "pig", x: r() * 60, y: 4, z: r() * 60 })); };
const half = () => 0.5;
const near = (o) => [o.x - 1, 0, o.z - 1, o.x + 1, 9, o.z + 1];

test("FineGrid over the same list keeps its index and cell maps, over another list builds new ones; answers equal off", () => {
  for (const mode of ["on", "verify"]) withMode(mode, () => {
    const list = mk(120, 7), g1 = new FineGrid(list, half);
    const ref = list.map((o) => g1.query(near(o)).slice());
    const idx = g1.idxOf, cells = g1.cells;
    for (const o of list) { o.x += 0.9; o.z -= 0.4; } // moved: other cells
    const g2 = new FineGrid(list, half, g1);
    assert.equal(g2.idxOf, idx); assert.equal(g2.cells, cells);
    const g3 = withMode("off", () => new FineGrid(list, half));
    assert.notEqual(g3.idxOf, idx);
    for (const o of list) assert.deepEqual(g2.query(near(o)).slice(), g3.query(near(o)).slice());
    g2.touch(list[3]); list[3].x += 20; g2.touch(list[3]); g3.touch(list[3]);
    assert.deepEqual(g2.query(near(list[3])).slice(), g3.query(near(list[3])).slice());
    const other = list.slice(1), g4 = new FineGrid(other, half, g2); // another list: fresh index
    assert.notEqual(g4.idxOf, idx); assert.equal(g4.idxOf.get(other[0]), 0);
    const g5 = new FineGrid(other.slice().reverse(), half, g4);
    assert.notEqual(g5.idxOf, g4.idxOf);
    assert.ok(ref.length === 120);
  });
  withMode("off", () => { const list = mk(30, 3), g1 = new FineGrid(list, half); assert.notEqual(new FineGrid(list, half, g1).idxOf, g1.idxOf); });
});

test("a grid that wandered over many cells drops its cell map", () => withMode("on", () => {
  const list = mk(10, 5); let g = new FineGrid(list, half), cells = g.cells;
  for (let k = 0; k < 40; k++) { for (const o of list) { o.x += 40; o.z += 40; } g = new FineGrid(list, half, g); if (g.cells !== cells) return; }
  assert.fail("cell map never dropped");
}));

const portalWorld = (nether) => ({ dim: 0, getId: (x, y, z) => (nether && x === 3 ? GAME_IDS.portal : 0) });
test("EntityPortals.step: same results, records and cooldowns off / on / verify (mob, item, cart; moving across a portal)", () => {
  const run = (mode) => withMode(mode, () => {
    const p = new EntityPortals(), out = [];
    const ents = [["mob", { type: "pig", x: 2.9, y: 1, z: 0.5, growingAge: 0 }], ["mob", { type: "pig", x: 3.2, y: 1, z: 0.5, growingAge: -5 }], ["mob", { type: "nope", x: 3, y: 1, z: 0 }],
      ["item", { x: 3.1, y: 1, z: 0 }], ["cart", { x: 3, y: 1, z: 0, bb: [2.3, 1, -0.5, 3.7, 1.7, 0.5] }], ["cart", { x: 3, y: 1, z: 0 }]];
    for (let t = 0; t < 90; t++) for (const [kind, e] of ents) {
      e.x += 0.01; if (t % 30 === 29) e.x -= 0.5;
      out.push(JSON.stringify([kind, p.step(e, kind, { ...portalWorld(true), dim: 0 }), e.portalCooldown ?? null, p.state(e).portalCounter]));
    }
    return out;
  });
  const off = run("off");
  assert.ok(off.some((s) => s.includes('"arg"')), "scenario reaches a travel");
  assert.deepEqual(run("on"), off); assert.deepEqual(run("verify"), off);
});

test("bench state hashes are identical off / on / verify and the bench prints mode93", () => {
  const hash = (m, scene) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=70"], { env: { ...process.env, MC_MPPERF93: m }, encoding: "utf8" }).stdout.trim().split("mobs=").pop();
  for (const scene of ["pen", "travel"]) {
    const off = hash("off", scene);
    assert.match(off, /\[".{16}",".{16}"\]$/);
    assert.equal(hash("on", scene), off, scene); assert.equal(hash("verify", scene), off, scene);
  }
  assert.match(spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF93: "off" }, encoding: "utf8" }).stdout, /mode93=off/);
});
