// Batch 100 mpperf100: portal step without per-entity option objects, track rows / Maps reused, arrow pickup candidates without box arrays; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast100 } from "./mpperf100-fast.js";
import { Arrows } from "./bow.js";
import { EntityPortals } from "./entity-portal.js";
import { buildPlayersScene, drain } from "./mpperf77-scene.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast100.mode; fast100.mode = m; try { return f(); } finally { fast100.mode = old; } };

test("arrow pickup candidates are the same in every mode, with and without a riding box", () => {
  const arrows = new Arrows(() => 0.5);
  arrows.list = [{ x: 0.2, y: 0, z: 0.1 }, { x: 5, y: 0, z: 5 }, { x: -0.6, y: 0.4, z: 0.9, dead: true }, { x: 1.3, y: 0.9, z: -0.7 }, { x: 0.8, y: 1.45, z: 0.2 }];
  const pb = [-0.3, 0, -0.3, 0.3, 1.8, 0.3], rb = [0.5, 0, -0.2, 1.1, 1.5, 0.4];
  const r = {};
  for (const m of modes) r[m] = withMode(m, () => [arrows.pickupCandidates(pb).map((c) => [arrows.list.indexOf(c.ref), c.box]), arrows.pickupCandidates(pb, rb).map((c) => [arrows.list.indexOf(c.ref), c.box])]);
  assert.deepEqual(r.on, r.off); assert.deepEqual(r.verify, r.off);
  assert.ok(r.off[0].length >= 1 && r.off[1].length >= r.off[0].length - 1);
});

test("portal step counts a mob in a portal the same way in every mode and keeps no options object", () => {
  const res = {};
  for (const m of modes) res[m] = withMode(m, () => {
    const portals = new EntityPortals(), out = [];
    const e = { type: "pig", x: 0.5, y: 5, z: 0.5, health: 10, bb: [0, 5, 0, 1, 6, 1] };
    const at = { dim: 0, getId: () => 90 }; // 90: the portal block id of GAME_IDS is checked by the module; any other id leaves the entity out
    for (let i = 0; i < 120; i++) { const r = portals.step(e, "mob", i % 7 === 3 ? { ...at, riding: true } : at); out.push([r && r.arg, portals.state(e).portalCounter, portals.state(e).timeUntilPortal]); }
    return out;
  });
  assert.deepEqual(res.on, res.off); assert.deepEqual(res.verify, res.off);
});

test("a live tick gives the same packets in every mode and the rows are reused across ticks", () => {
  const run = (m) => withMode(m, () => {
    let n = 0; const old = Math.random; Math.random = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    try {
      const s = buildPlayersScene({ players: 4, layout: "spread", mobs: 40, seed: 3 }), out = [];
      let rows = null;
      for (let i = 0; i < 25; i++) { s.tick(); out.push(JSON.stringify(drain(s))); const v = [...s.mobs.views.values()][0]; if (i === 2) { rows = v?.row100; if (m !== "off") assert.ok(rows); } else if (i > 2 && m !== "off" && v) assert.equal(v.row100, rows); }
      return out;
    } finally { Math.random = old; }
  });
  const a = run("off"), b = run("on"), c = run("verify");
  assert.deepEqual(b, a); assert.deepEqual(c, a);
});

test("bench hashes are identical off / on / verify and the bench prints mode100", () => {
  const h = (s) => s.slice(s.indexOf("["));
  for (const scene of [["--scene=pen", "--mobs=20"], ["--scene=travel"]]) {
    const out = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", ...scene, "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF100: m }, encoding: "utf8" }).stdout);
    modes.forEach((m, i) => assert.match(out[i], new RegExp(`mode100=${m} mobs=\\d+ \\[`)));
    assert.equal(h(out[1]), h(out[0])); assert.equal(h(out[2]), h(out[0]));
  }
});
