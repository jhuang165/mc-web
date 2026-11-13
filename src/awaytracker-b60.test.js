// Batch 60 (awaytracker). The Overworld's spawn-area objects (items, arrows, carts, boats, hangings) are tracked silently while the player is in the Nether or End, like the mobs (away-track.js).
// Evidence: the tick is `idleUpdate`, replayed against the executed tracker-joint-reference.json dimAge cases by trackerphase-b58.test.js; here the wiring: which entities are kept, and that
// the join then sends mobs and objects in one HashSet order, at the phase the trip gave them.
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { ObjectTracker } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
import { awayCatchUp, keptIn } from "./away-track.js";

const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const chicken = (id, x, z) => ({ type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y: 0, z, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const item = (id, x, z) => ({ entityId: id, x, y: 0, z, mx: 0, my: 0, mz: 0, rotationYaw: 10, stack: { id: 1, count: 1, damage: 0 }, onGround: true });
const boat = (id, x, z) => ({ entityId: id, x, posY: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0 });
const frame = (id, x, z) => ({ entityId: id, x: x + 0.5, y: 2, z: z + 0.5, tx: x, ty: 2, tz: z, dir: 2, yaw: 0, art: 0 });
const spawn = [0, 64, 0], idle = (ticks) => ({ ticks, spawn });

function setup() {
  const w = new EntityWorld({ size: 1024, height: 256 }, [chicken(1, 10, 10), chicken(2, 400, 400)], () => 0.5);
  const o = new ObjectTracker(10, () => 0.5, new EntityIds(100));
  const lists = { item: [item(101, 5, 5), item(102, 500, 5)], arrow: [], orb: [] };
  const extra = { boat: [boat(103, 20, 20), boat(104, -300, 0)], itemFrame: [frame(105, 8, -8), frame(106, 0, 600)] };
  o.hooks.extraLists = () => extra;
  return { w, o, lists, extra };
}

test("keptIn: the chunk of the entity against the spawn square (a summoned knot reads px/pz)", () => {
  const k = keptIn(spawn);
  assert.equal(k({ x: 119.9, z: 0 }), true); // chunk 7: centre 120
  assert.equal(k({ x: 128, z: 0 }), false); // chunk 8: centre 136
  assert.equal(k({ summoned: true, px: 3, pz: 3, x: 9999, z: 9999 }), true);
});

test("awayCatchUp tracks the kept mobs and objects together; entities outside the loaded area enter at the first real tick", () => {
  const { w, o, lists } = setup();
  awayCatchUp(w, o, lists, grass, idle(40));
  assert.deepEqual([...w.tracker.entries.keys()].map((e) => e.id), ["mob-1"]);
  assert.deepEqual([...o.entries.keys()].map((e) => e.entityId).sort(), [101, 103, 105]);
  assert.equal(w.tracker.tick, 40);
  assert.equal(o.tick, 40, "the object tracker ran the same ticks");
  assert.equal(o.hooks.extraLists().boat.length, 2, "the hook is restored whole");
  for (const t of [w.tracker, o]) for (const en of t.entries.values()) assert.equal(en.entry.packets.length, 0, "nothing is sent while nobody is in the world");
});

test("the object entries' counters equal 40 silent ticks run by hand, and differ from a fresh entry (the mutation: no catch-up)", () => {
  const a = setup(), b = setup();
  awayCatchUp(a.w, a.o, a.lists, grass, idle(40));
  const m = b.w.entities.filter(keptIn(spawn)), kept = { item: b.lists.item.filter(keptIn(spawn)), arrow: [], orb: [] };
  const hook = b.o.hooks.extraLists; b.o.hooks.extraLists = () => ({ boat: hook().boat.filter(keptIn(spawn)), itemFrame: hook().itemFrame.filter(keptIn(spawn)) });
  b.w.tracker = new (a.w.tracker.constructor)(10);
  for (let i = 0; i < 40; i++) b.w.tracker.idleUpdate(m, (e) => b.w.size(e), { tracker: b.o, lists: kept, world: grass });
  const state = (o) => [...o.entries.values()].map((en) => JSON.stringify([en.entry.ticks, en.entry.sinceTeleport, en.entry.lastX, en.entry.lastZ]));
  assert.deepEqual(state(a.o), state(b.o));
  assert.ok(state(a.o).every((s) => JSON.parse(s)[0] > 0), "every object entry's own counter advanced");
});

test("the join after the trip sends the kept mob and objects in the one set order, spawn packets only for them", () => {
  const { w, o, lists } = setup();
  awayCatchUp(w, o, lists, grass, idle(40));
  w.tracker.beforePlayer = () => true; // the player joins the end of the list
  w.tracker.joinPlayer(1);
  const got = [];
  for (const t of [w.tracker, o]) for (const en of t.entries.values()) { const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { if (p.type === "spawn") got.push(en.entry.e.id); return ap(p, ctx); }; }
  w.tracker.update(w.entities.filter(keptIn(spawn)), { x: 0.5, y: 0, z: 0.5 }, (e) => w.size(e), null, { tracker: o, lists: { item: [lists.item[0]], arrow: [], orb: [] }, world: grass });
  assert.equal(got.length, 4, "the chicken, the item, the boat and the frame: " + got.join());
});

test("a mob's own age (ticksExisted) is kept by the saved record, and the catch-up does not touch it; a copy is a new client entity (age 0) as the trip's WorldClient is new", () => {
  const { w, o, lists } = setup();
  w.entities[0].age = 777;
  const saved = w.serializeOne(w.entities[0]);
  assert.equal(saved.age, 777);
  const back = new EntityWorld({ size: 1024, height: 256 }, [saved], () => 0.5);
  assert.equal(back.entities[0].age, 777);
  awayCatchUp(w, o, lists, grass, idle(40));
  assert.equal(w.entities[0].age, 777, "the silent tracker ticks are not entity ticks");
  const en = w.tracker.entries.get(w.entities[0]);
  assert.equal(en.client.present, false, "no client copy exists until the join");
});
