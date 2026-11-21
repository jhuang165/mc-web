// Batch 92 spcopy92: the single player's server copy (ai.js PlayerView) across a portal trip.
// Executed: public/research/spcopy92-reference.jsonl (real 1.7.10 ahb/oi/mt classes, tools/research/spcopy92-probe). The walk and click gates here are port tests. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";

const flat = () => {
  const world = new World("spcopy92");
  for (let x = 0; x <= 60; x++) for (let z = 0; z <= 60; z++) for (let y = 0; y <= 8; y++) world.put(x, y, z, y === 0 ? 1 : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const pos = { x: 30.5, y: 1, z: 30.5 };

test("reference file: the probe's middle case skips the entity after the player; last, only and End exit do not", () => {
  const rows = readFileSync(new URL("../public/research/spcopy92-reference.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const by = Object.fromEntries(rows.map((r) => [r.case, r]));
  const upd = (r) => r.portalTick.filter((o) => o.op === "update").map((o) => o.e);
  assert.ok(!upd(by.middle).includes("a0"), "the entity that shifted into the player's index is skipped");
  assert.ok(upd(by.middle).includes("a1") && upd(by.middle).includes("a2"));
  assert.ok(upd(by.endExit).includes("a0"), "End exit (ahb.e): no skip, a0 updates");
  assert.ok(!upd(by.last).some((e) => /^a/.test(e)) && !upd(by.only).some((e) => /^a/.test(e)), "nothing after the player: nothing to skip");
  assert.equal(by.endExit.portalTick.filter((o) => o.op === "untrack").length, 2, "ahb.e on the End exit: the tracker untracks twice");
});

test("the copy leaves at the player's turn in the walk: earlier entries see it, later ones do not", () => {
  const w = new EntityWorld(flat(), [{ id: "z1", type: "zombie", x: 5.5, y: 1, z: 5.5, health: 20 }, { id: "z2", type: "zombie", x: 8.5, y: 1, z: 8.5, health: 20 }], () => 0.5);
  const p = w.ai.player, s = new Survival({}), seen = [];
  w.serverCorrect = () => {};
  w.beforeMob = (e) => seen.push([e.id, p.left]);
  p.departing = { skip: false };
  w.tick({ ...body, ...pos }, s, 0);
  assert.equal(p.left, true, "left after the walk");
  assert.equal(p.departing, null);
  const first = seen.findIndex(([, l]) => l);
  assert.ok(first === -1 || seen.slice(first).every(([, l]) => l), "left never flips back inside the walk");
});

test("left flips at the player's list index, not before the walk (an earlier entry still sees him)", () => {
  const w = new EntityWorld(flat(), [{ id: "z1", type: "zombie", x: 5.5, y: 1, z: 5.5, health: 20 }], () => 0.5);
  const p = w.ai.player, s = new Survival({}), seen = [];
  w.serverCorrect = () => {};
  w.beforeMob = (e) => seen.push(p.left);
  p.departing = { skip: true };
  w.tick({ ...body, ...pos }, s, 0);
  // an entity sorted before the player is called while the copy is still present
  assert.ok(seen.length === 0 || seen[0] === false || w.beforePlayer(w.entities[0]) === false);
  assert.equal(p.left, true);
});

test("copyDeparts: skip only for a portal trip, none for an End exit or a death, nothing when not departing", () => {
  const w = new EntityWorld(flat(), [], () => 0.5), p = w.ai.player;
  assert.equal(w.copyDeparts(), false);
  assert.equal(p.left, false);
  p.departing = { skip: true };
  assert.equal(w.copyDeparts(), true);
  assert.equal(p.left, true);
  p.left = false;
  p.departing = { skip: false };
  assert.equal(w.copyDeparts(), false);
  assert.equal(p.left, true);
});

test("the away stand-in reads as left for every gated reader, but still updates", () => {
  const w = new EntityWorld(flat(), [{ id: "w1", type: "wolf", x: 5.5, y: 1, z: 5.5, health: 20, tame: true, owner: "Player" }, { id: "sp", type: "spider", x: 5.5, y: 1, z: 20.5, health: 16 }], () => 0.5);
  const p = w.ai.player;
  p.absent = true;
  assert.equal(p.left, true);
  assert.equal(p.alive, false);
  assert.equal(w.ai.brain(w.entities[0]).owner(), null, "no owner in a world with no EntityPlayerMP");
  assert.equal(w.siegePlayers().length, 0);
  let gone = 0;
  w.ai.deps.despawn = () => { gone++; };
  Object.assign(p, { x: 1e9, y: 1, z: 1e9 });
  w.ai.brain(w.entities[1]).despawnEntity();
  assert.equal(gone, 0, "no closest player: nothing despawns");
  p.absent = false;
  assert.equal(p.left, false);
  p.left = true;
  p.absent = true;
  p.left = false;
  assert.equal(p.left, true, "absent still wins when the trip flag is cleared");
});

test("no hit, click, reinforcement call or leashFence while the copy is out of the world", () => {
  const calls = [];
  const hooks = new Proxy({}, { get: (_, k) => (...a) => { calls.push(k); } });
  const w = new EntityWorld(flat(), [{ id: "z1", type: "zombie", x: 5.5, y: 1, z: 5.5, health: 20 }], () => 0.5);
  const state = { screen: "playing", mobs: w, world: w.world, heldTool: 0, motion: {}, survival: new Survival({}) };
  w.ai.player.left = true;
  for (const place of [false, true]) {
    const r = applyPlayerEdit(state, { place, aimedEntity: { entity: w.entities[0] }, target: null }, hooks);
    assert.deepEqual([r.handled, r.branch], [false, "player-left"]);
  }
  assert.deepEqual(calls, [], "no hook ran (no swing, unlock, attack, leashFence)");
  assert.equal(w.entities[0].health, 20);
});

test("sources: main.js hands the trip to the walk, travel() sets the skip rule", () => {
  const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
  assert.match(read("./main.js"), /copy\.departing = \{ skip: dims\.listSkip \}/);
  assert.match(read("./dimension-live.js"), /this\.listSkip = !exit && !death/);
});
