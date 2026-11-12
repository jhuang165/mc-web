// Batch 49: a mob's death drops join the loaded-entity list at the hurt call (EntityLivingBase.onDeath -> dropFewItems -> entityDropItem), not at the end of the step;
// the items a blast's kills drop are not in the blast's own entity list; each item and orb owns its Entity.rand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entityListReference, replayEntityList, entityListDivergence } from "./entity-list-replay.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { explodeNonLiving } from "./explosion-simulation.js";

// Executed: tools/probes/EntityListProbe.java b49hd-* (the real EntityCow with 1 health, a player shell attacker, outOfWorld damage, an arrow, a TNT blast; hurt calls before and after the walk).
const rec = (n) => entityListReference.find((r) => r.name === n);
const NAMES = entityListReference.filter((r) => r.name.startsWith("b49hd-")).map((r) => r.name);

test("batch 49 (executed records): ten kills replay exactly (player hit, /kill damage, arrow, blast of two cows, kill then spawn), before and after the walk", () => {
  assert.equal(NAMES.length, 10);
  for (const n of NAMES) assert.equal(entityListDivergence(rec(n), replayEntityList(rec(n))), null, n);
});

test("batch 49 (executed record): a kill followed by another spawn in the same call lists the drop first; the old end-of-step timing lists it second", () => {
  for (const n of ["b49hd-kill-then-spawn", "b49hd-kill-then-spawn-post"]) {
    const r = rec(n), spawned = r.rows[2][3];
    assert.equal(spawned.length, 2, n);
    assert.notEqual(spawned[0][7], 4, "the cow's drop (not the 4-stone item) is the first entity to join");
    assert.equal(spawned[1][7], 4, n);
    assert.notEqual(entityListDivergence(r, replayEntityList(r, null, "hurtCall")), null, n + " diverges with the old timing");
  }
});

test("batch 49 (executed record): the items a blast's kills drop are not in the blast's entity list (a pushed or killed item would show)", () => {
  const r = rec("b49hd-blast-two-cows"), spawned = r.rows[0][3];
  assert.equal(spawned.length, 6);
  assert.ok(spawned.every((s) => s[8] === 1), "every drop was updated once, none was blasted (the blast's push would show in its motion)");
  assert.ok(spawned.every((s) => s[3] === -0.24121700339107122), "all with the floor push-out motion only");
});

test("batch 49: explodeNonLiving leaves the items spawned after the blast collected its list alone, and keeps their list place", () => {
  const world = { solid: () => false, get: () => 0, getMeta: () => 0, isLoaded: () => true, isTicking: () => true };
  const items = new ItemEntities(() => 0.5), orbs = new ExperienceOrbs([], () => 0.5), at = (x) => items.spawn({ id: 3, count: 1, damage: 0 }, x, 1, 0.5, { motion: [0, 0, 0] });
  const old = at(1.5), born = at(1.6);
  const state = { world, items, xpOrbs: orbs, arrows: { explode() {} }, projectiles: { explode() {} }, mobs: null };
  explodeNonLiving(state, 0.5, 1, 0.5, 4, null, false, null, 1);
  assert.notEqual(old.mx, 0, "the older item is pushed");
  assert.deepEqual([born.mx, born.my, born.mz], [0, 0, 0], "the item born after the list was collected is not");
  assert.deepEqual(items.items, [old, born], "and keeps its place");
  const again = at(1.7);
  explodeNonLiving(state, 0.5, 1, 0.5, 4, null, false, null);
  assert.notEqual(again.mx, 0, "without itemsBefore every item is in the blast");
});

test("batch 49: emitLoot spawns at the call with a host hook, queues without one; xp (breeding, death) and wool and eggs take the same path", () => {
  const w = new EntityWorld(new World("b49-emit", "meadow"), []);
  const got = [];
  w.emitLoot({ drop: 334, count: 1, position: { x: 0, y: 0, z: 0 } });
  assert.equal(w.events.length, 1, "no hook: queued for drain()");
  w.spawnLoot = (evs) => got.push(...evs);
  w.emitLoot({ drop: 335, count: 1, position: { x: 0, y: 0, z: 0 } });
  w.emitLoot({ xp: 3, position: { x: 0, y: 0, z: 0 } });
  assert.deepEqual(got.map((e) => e.drop ?? e.xp), [335, 3]);
  assert.equal(w.events.length, 1, "spawned events do not wait in the queue");
  // the dying cow itself: onDeath spawns before attackEntityFrom returns
  const cow = w.create("cow", 1.5, 0, 1.5);
  cow.growingAge = 0; cow.health = 1; w.entities.push(cow);
  got.length = 0; w.events.length = 0;
  w.attackEntityFrom(cow, 5, { name: "generic" });
  assert.ok(cow.health <= 0);
  assert.ok(got.length > 0 && got.every((e) => e.drop), "the cow's loot spawned inside the hurt call");
  assert.ok(!w.events.some((e) => e.drop), "none left for the drain");
});

test("batch 49: items and orbs of the live game own an Entity.rand each; an injected generator stays shared", () => {
  const items = new ItemEntities(), orbs = new ExperienceOrbs();
  const a = { x: 0 }, b = { x: 1 };
  assert.equal(items.rng(a), items.rng(a));
  assert.notEqual(items.rng(a), items.rng(b));
  const da = [items.rng(a)(), items.rng(a)()], db = [items.rng(b)(), items.rng(b)()];
  assert.notDeepEqual(da, db, "two entities do not share one stream");
  assert.equal(orbs.rng(a), orbs.rng(a));
  assert.notEqual(orbs.rng(a), orbs.rng(b));
  const fixed = () => 0.25, shared = new ItemEntities(fixed), sharedOrbs = new ExperienceOrbs([], fixed);
  assert.equal(shared.rng(a), fixed);
  assert.equal(sharedOrbs.rng(b), fixed);
});

test("batch 49: the constructors' motion draws stay on the host generator (EntityItem and EntityXPOrb use Math.random, bytecode-read), not on an entity's own", () => {
  // EntityItem(world, x, y, z): hover, yaw, (r * 0.2 - 0.1) for x and z, y 0.2; EntityXPOrb: yaw, then (r * 0.2 - 0.1) * 2, (r * 0.2) * 2, (r * 0.2 - 0.1) * 2 (each a float).
  const host = [0.9, 0.1, 0.8, 0.3, 0.7];
  let n = 0;
  const items = new ItemEntities(() => host[n++ % host.length]);
  const it = items.spawn({ id: 3, count: 1, damage: 0 }, 0, 1, 0);
  assert.equal(it.my, 0.2);
  assert.equal(it.mx, Math.fround(0.9 * 0.2 - 0.1));
  assert.equal(it.mz, Math.fround(0.1 * 0.2 - 0.1));
  const o = newOrb(5, 0, 1, 0, () => 0.5);
  assert.equal(o.vy, Math.fround(Math.fround(0.5 * 0.2) * 2));
});
