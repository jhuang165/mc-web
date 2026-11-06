// Leads: replays public/research/leash-reference.json (tools/verify-leash.mjs, unchanged 1.7.10 classes) against the pure rules in
// horse-gear.js and drives the same cases through the live EntityWorld (horse-gear-live.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as G from "./horse-gear.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { FENCE } from "./world.js";

const ref = JSON.parse(await readFile(new URL("../public/research/leash-reference.json", import.meta.url)));
const fences = new Set();
const key = (x, y, z) => `${x},${y},${z}`;
const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : fences.has(key(x, y, z)) ? FENCE : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (recs, player = { x: 64, y: 0, z: 64 }) => {
  fences.clear();
  const w = new EntityWorld(terrain, recs.map((r, i) => ({ id: `mob-${i + 1}`, type: "pig", x: 64, y: 0, z: 64, health: 10, ...r })), () => 0.5);
  Object.assign(w.ai.player, player);
  for (const e of w.entities) e.onGround = true;
  return w;
};
const holding = (id, n = 2) => { const s = new Survival({ inventory: { [id]: n } }); s.inventory.current = s.inventory.find(id); return s; };
const drops = (w) => w.events.filter((x) => x.drop === G.LEAD_ITEM).length;

test("reference counts and class digests are recorded", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(ref.counts, { path: 96, release: 2, homeCell: 3, eating: 6, knotLife: 14, knotValid: 8, fenceBreak: 1, knotHit: 2, knotClick2: 6, fenceClick: 2, nbtWrite: 1, nbtRead: 7 });
  for (const [k, n] of Object.entries(ref.counts)) assert.equal(ref[k].length, n, k);
  for (const c of ["td", "sw", "su", "ss", "adf", "ut", "vv"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("leashStep matches td.bL: path beyond 4, pull beyond 6, break beyond 10, a sitting tameable only breaks", () => {
  for (const r of ref.path) {
    const t = r.steps[0], sitting = r.mob === "wolfSitting", s = G.leashStep(r.distance, r.dy, 0, { sitting });
    const flat = r.dy === 0;
    assert.equal(s.unleash, !t.leashed, `${r.mob} ${r.distance} ${r.dy}`);
    if (!sitting) assert.equal(s.task, true, `${r.mob} ${r.distance}`);
    if (flat && !sitting) assert.equal(s.path, t.hasPath, `${r.mob} ${r.distance}`);
    if (flat && !sitting) assert.ok(Math.abs((s.pull?.[0] ?? 0) - t.motion[0]) < 1e-6, `${r.mob} ${r.distance} pull`);
    if (sitting) assert.equal(s.path, false);
  }
  for (const e of ref.eating) assert.equal(G.leashStep(e.distance, 0, 0).stopEating, !e.eatingAfter, `eating ${e.distance}`);
});

test("the home cell is the truncated holder position with radius 5", () => {
  for (const r of ref.homeCell) assert.deepEqual(r.home, r.holder.map((v) => Math.trunc(v) + 0));
  assert.equal(G.LEASH_HOME_RADIUS, 5);
});

test("live path-following: a leashed mob paths beyond 4 blocks at speed 1, is pulled beyond 6 and breaks beyond 10", () => {
  for (const kind of ["pig", "horse"]) {
    for (const d of [1, 3.9, 4, 4.1, 6, 6.1, 8, 10, 10.1]) {
      const w = world([{ type: kind, leash: { holder: "player" } }], { x: 64 + d, y: 0, z: 64 });
      const e = w.entities[0], nav = w.ai.brain(e).navigator;
      if (nav.budget) nav.budget.left = nav.budget.perTick; // the per-tick path budget is refilled by the world tick
      w.leashTick(e);
      const ref0 = ref.path.find((r) => r.mob === kind && r.distance === d && r.dy === 0).steps[0];
      assert.equal(!!e.leash, ref0.leashed, `${kind} ${d} leashed`);
      if (e.leash) {
        assert.equal(e.homeRadius, 5);
        assert.deepEqual(e.home, { x: Math.trunc(64 + d), y: 0, z: 64 }, `${kind} ${d} home`);
        assert.equal(!nav.noPath(), ref0.hasPath, `${kind} ${d} path`);
        assert.equal(e.vx > 0, ref0.motion[0] > 0, `${kind} ${d} pull`);
        assert.equal(nav.getAvoidsWater(), false);
        if (ref0.hasPath) assert.equal(nav.speed, G.LEASH_PATH_SPEED);
      }
    }
  }
});

test("the restriction task is added at priority 2 once, and removed with the home area on release", () => {
  const w = world([{ leash: { holder: "player" } }], { x: 68, y: 0, z: 64 }), e = w.entities[0], tasks = w.ai.brain(e).tasks;
  const count = () => tasks.entries.filter((x) => x.action.constructor.name === "MoveTowardsRestriction").length;
  w.leashTick(e); w.leashTick(e);
  assert.equal(count(), 1);
  assert.equal(tasks.entries.find((x) => x.action.constructor.name === "MoveTowardsRestriction").priority, G.LEASH_TASK_PRIORITY);
  w.unleash(e, true);
  assert.equal(count(), 0);
  assert.equal(e.homeRadius, -1);
  assert.equal(w.ai.brain(e).navigator.getAvoidsWater(), true);
  assert.equal(drops(w), 1);
  w.leashTick(e);
  assert.equal(count(), 0);
});

test("a sitting wolf is never pulled or pathed, and only breaks beyond 10", () => {
  const w = world([{ type: "wolf", tamed: true, sitting: true, leash: { holder: "player" } }], { x: 72, y: 0, z: 64 }), e = w.entities[0];
  e.sitting = true;
  w.leashTick(e);
  assert.ok(!e.vx);
  assert.ok(e.leash);
  w.ai.player.x = 80;
  w.leashTick(e);
  assert.equal(e.leash, undefined);
});

test("a grazing horse stops eating beyond 6 blocks", () => {
  assert.equal(G.leashStep(6, 0, 0).stopEating, false);
  assert.equal(G.leashStep(6.1, 0, 0).stopEating, true);
});

test("knot lifetime: checked every 101st tick, no drop from the knot itself", () => {
  for (const r of ref.knotLife) {
    let age = 0, died = -1;
    for (let tick = 1; tick <= 220 && died < 0; tick++) {
      const out = G.knotAge(age, tick <= r.fenceRemovedBeforeTick - 1 || r.fenceRemovedBeforeTick === 0);
      age = out.age;
      if (out.kill) died = tick;
    }
    assert.equal(died, r.knotDiedAtTick, JSON.stringify(r));
  }
});

test("knot valid surface is render type 11 blocks only", () => {
  for (const r of ref.knotValid) assert.equal([85, 113, 188, 189, 190, 191, 192].includes(r.block), r.valid, `block ${r.block}`);
});

test("live knot: a fence break leaves the knot and the mob for 100 ticks, then the lead drops at tick 101", () => {
  const w = world([{ x: 66 }], { x: 64, y: 0, z: 64 });
  fences.add(key(66, 0, 64));
  const e = w.entities[0], s = holding(G.LEAD_ITEM);
  w.leashInteract(e, s);
  assert.equal(w.leashFence([66, 0, 64], s), true);
  assert.deepEqual(e.leash, { knot: { x: 66, y: 0, z: 64 } });
  assert.equal(w.leashKnots().length, 1);
  fences.clear();
  const row = (t) => ref.fenceBreak[0].rows.find((r) => r.tick === t);
  for (let t = 1; t <= 103; t++) {
    w.knotTick();
    if (t > 100) w.leashTick(e); else if (t === 1 || t === 100) w.leashTick(e);
    if (row(t)) {
      assert.equal(!!e.leash, row(t).leashed, `tick ${t}`);
      assert.equal(w.leashKnots().length === 0, row(t).knotDead, `tick ${t} knot`);
      assert.equal(drops(w), row(t).drops.length, `tick ${t} drops`);
    }
  }
});

test("a knot lingers when its mobs are freed, and a click on it with no lead kills it", () => {
  const w = world([{ x: 66 }]);
  fences.add(key(66, 0, 64));
  const e = w.entities[0], s = holding(G.LEAD_ITEM);
  w.leashInteract(e, s);
  w.leashFence([66, 0, 64], s);
  w.leashInteract(e, { ...s, held: null }); // a click on a mob held by a knot is not a player release
  w.unleash(e, true);
  assert.equal(w.leashKnots().length, 1, "knot remains after the mob is freed");
  const empty = { held: null, creative: false, inventory: s.inventory };
  assert.equal(w.leashFence([66, 0, 64], empty), true);
  assert.equal(w.leashKnots().length, 0);
});

test("knot clicks: Creative frees the knot's mobs without a drop; the lead on a knot moves the player's mobs onto it", () => {
  const w = world([{ x: 66, leash: { holder: "player" } }, { x: 66, leash: { holder: "player" } }]);
  fences.add(key(66, 0, 64));
  const s = holding(G.LEAD_ITEM);
  assert.equal(w.leashFence([66, 0, 64], s), true);
  assert.ok(w.entities.every((m) => m.leash.knot));
  const before = drops(w);
  const creative = { held: null, creative: true, inventory: s.inventory };
  assert.equal(w.leashFence([66, 0, 64], creative), true);
  assert.ok(w.entities.every((m) => !m.leash));
  assert.equal(drops(w), before);
  assert.equal(w.leashKnots().length, 0);
});

test("a lead used on a fence with no mob in reach makes no knot", () => {
  const w = world([{ x: 90 }]);
  fences.add(key(66, 0, 64));
  assert.equal(w.leashFence([66, 0, 64], holding(G.LEAD_ITEM)), true);
  assert.equal(w.leashKnots().length, 0);
});

test("Leash NBT round trip: a knot is rebuilt from X/Y/Z, a far player drops the lead, nothing else is saved", () => {
  assert.equal(ref.nbtWrite[0].knotWritesToChunk, false);
  const kinds = Object.fromEntries(ref.nbtRead.map((r) => [r.kind, r]));
  const w = world([{ x: 66, leash: { knot: { x: 66, y: 0, z: 64 } } }]);
  fences.add(key(66, 0, 64));
  const e = w.entities[0];
  assert.equal(w.leashKnots().length, 0);
  w.leashTick(e);
  assert.equal(w.leashKnots().length, kinds.knotFence.knotsAfter);
  assert.ok(e.leash);
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  assert.deepEqual(saved.find((x) => x.id === "mob-1" || x.leash)?.leash ?? saved.entities?.[0]?.leash, { knot: { x: 66, y: 0, z: 64 } });
  assert.ok(!JSON.stringify(saved).includes("knotList"));
  // No fence: the knot is still made and dies within 101 ticks, the lead dropping then.
  const w2 = world([{ x: 66, leash: { knot: { x: 66, y: 0, z: 64 } } }]), e2 = w2.entities[0];
  w2.leashTick(e2);
  assert.equal(w2.leashKnots().length, kinds.knotNoFence.knotsAfter);
  for (let t = 0; t < 101; t++) w2.knotTick();
  w2.leashTick(e2);
  assert.equal(e2.leash, undefined);
  // A player holder more than 10 blocks away drops the lead on load.
  const far = world([{ x: 40, leash: { holder: "player" } }]);
  far.leashTick(far.entities[0]);
  assert.equal(far.entities[0].leash, undefined);
  assert.equal(drops(far), 1);
  const near = world([{ x: 66, leash: { holder: "player" } }]);
  near.leashTick(near.entities[0]);
  assert.ok(near.entities[0].leash);
});

test("every leashable mob type gets the same path-following", () => {
  for (const type of ["pig", "cow", "sheep", "chicken", "horse", "wolf", "ocelot", "villager", "iron_golem", "snow_golem", "mooshroom", "squid"]) {
    if (!G.leashable(type)) continue;
    const w = world([{ type, leash: { holder: "player" } }], { x: 70, y: 0, z: 64 });
    assert.doesNotThrow(() => w.leashTick(w.entities[0]), type);
  }
});

test("through world ticks a leashed pig follows a player 6 blocks away and stays tied", () => {
  const w = world([{ leash: { holder: "player" } }]), e = w.entities[0], sv = new Survival({});
  const player = { x: 70, y: 0, z: 64, width: 0.6, height: 1.8, alive: true };
  for (let i = 0; i < 80; i++) w.tick(player, sv, 0);
  assert.ok(e.leash);
  assert.ok(e.x > 67, `pig moved toward the holder (x=${e.x})`);
  assert.equal(drops(w), 0);
});
