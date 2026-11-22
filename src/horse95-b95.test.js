// b95 horse95: root cause of the rare drift of a killed saddled horse on its kill tick (about 1.5-3% of live-AI runs).
//  Native wi.bh() (javap -c -p wi, Bytecode-read): `l != null && cu()` (a rider AND a saddle) || cm() (rearing) || cn() (eating). It has no health test, so a dying horse WITHOUT a rider runs its AI
//  (wander included) for its 20 death ticks; with a saddled rider it never does. The port matches: the "drift" is an unridden saddled corpse starting a wander, as an alive twin does.
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./lighting.js";

const flat = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
const tick = (w) => w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
const make = (seed, riderKind) => {
  const w = new EntityWorld(flat(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.25, jump: 0.7, maxHealth: 53 } }], () => 0.5);
  const h = w.entities[0];
  setEntityRandom(h, new JavaRandom(seed));
  if (riderKind === "player") assert.ok(w.horseSeats.mount(h, { player: true, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null }));
  return { w, h };
};
const run = (seed, kind, kill) => { const { w, h } = make(seed, kind); for (let i = 0; i < 3; i++) tick(w); const x = h.x, z = h.z; if (kill) w.kill(h); for (let i = 0; i < 4; i++) tick(w); return Math.hypot(h.x - x, h.z - z); };

test("seeds 37 and 70: the killed unridden horse runs its AI and wanders (wi.bh has no health test); no AI step is skipped", () => {
  for (const seed of [37, 70]) {
    const { w, h } = make(seed, null);
    for (let i = 0; i < 3; i++) tick(w);
    const x = h.x, z = h.z;
    w.kill(h);
    tick(w);
    assert.ok(h.death >= 1 && !h.aiSkipped, `seed ${seed} dying with AI running`);
    assert.ok(Math.hypot(h.x - x, h.z - z) > 0.01, `seed ${seed} corpse wandered`);
  }
});

test("a killed horse with a saddled player rider never drifts, on any of 150 seeds (wi.bh: rider and saddle block the AI)", () => {
  for (let seed = 1; seed <= 150; seed++) assert.ok(run(seed, "player", true) < 1e-6, `seed ${seed}`);
});

// ---- 1. a rider whose eyes are in water steps off a horse (sv.C 278-310, Executed in horse95-reference.json) ----
import { readFileSync } from "node:fs";
import { makeSide, spawn, serverClick } from "../tools/sweep-use75.mjs";
import { WATER } from "./world.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/horse95-reference.json", import.meta.url), "utf8"));
const first = (name) => ref.scenarios.find((s) => s.name === name).ticks.findIndex((t) => !t.linked);

const ridden = (waterTop) => {
  const side = makeSide(), e = spawn(side, "horse");
  e.horse.tame = true; e.horse.saddled = true; e.horse.speed = 0.3; e.horse.jump = 0.7; e.health = 30; e.growingAge = 0; e.onGround = true;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 10; y <= waterTop; y++) side.s.world.put(x, y, z, WATER, 0, false);
  side.p.survival.inventory.main[0] = null;
  serverClick(side, e);
  return { side, e };
};
const runN = (side, n) => { for (let i = 0; i < n; i++) side.s.tick(); };

test("the reference: a shallow pool never unseats the rider, eyes in the water do (walkIn, startInside, deep)", () => {
  assert.equal(first("dryControl"), -1);
  assert.equal(first("walkIn"), -1, "2 deep: the eyes stay above the surface");
  assert.equal(first("startInside"), 0);
  assert.ok(first("deep") > 0);
});

test("dedicated server: a player riding a horse with the eyes in water is let go in the first tick", () => {
  const { side, e } = ridden(13); // 4 cells deep: the seated eye (about y + 3.9) is under the surface at 14
  assert.ok(side.p.mount && e.rider, "mounted");
  runN(side, 2);
  assert.equal(side.p.mount, null);
  assert.equal(e.rider, null);
});

test("dedicated server: eyes above the water keep the rider on (2 cells deep, 30 ticks)", () => {
  const { side, e } = ridden(11);
  assert.ok(side.p.mount && e.rider);
  runN(side, 30);
  assert.ok(side.p.mount && e.rider, "still riding");
});
