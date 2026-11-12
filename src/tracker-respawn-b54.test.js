// Batch 54 (respawntracker). (1) A respawn is a new EntityPlayerMP: the world's entries are sent to it again in HashSet order (EntityTracker.addEntityToTracker -> tryStartWachingThis per entry),
// the client copies spawn afresh. (2) The serverTick (non-joint) path sends the mobs the world held at the player's join in HashSet order, like the joint path. (3) Replay of the
// executed joint record for the kinds added in batch 54 lives in tracker-joint2-b53.test.js (cases extras, extrasLast).
import test from "node:test";
import assert from "node:assert/strict";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker, OBJECT_KINDS } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";

const player = { x: 0.5, y: 0, z: 0.5 };
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const chicken = (n, x = 2.5) => ({ type: "chicken", id: "mob-" + n, uuid: "u" + n, x, y: 0, z: 3.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const item = (id) => ({ entityId: id, x: 3.5, y: 1 - OBJECT_KINDS.item.yOff, z: 2.5, mx: 0, my: 0, mz: 0, rotationYaw: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true });
const SIZE = () => [0.3, 0.7];
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)[1]) : id);

// records the spawn packets the client applies, in order
function spy(...ts) {
  const log = [];
  for (const t of ts) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { if (p.type === "spawn") log.push(num(en.entry.e.entityId ?? en.entry.e.id)); return ap(p, ctx); }; return en; };
  }
  return log;
}

test("serverTick: the mobs held at the join are sent in HashSet order, not creation order", () => {
  const m = new MobTracker(10);
  const log = spy(m);
  m.beforePlayer = () => true;
  m.joinPlayer(40);
  const mobs = [chicken(5), chicken(20), chicken(7), chicken(34)]; // buckets 5, 4, 7, 2
  m.update(mobs, player, SIZE);
  assert.deepEqual(log, [34, 20, 5, 7]);
  assert.deepEqual(log, m.order.keys().filter((k) => m.entries.has(k)).map((k) => num(k.id)));
  const late = chicken(9);
  m.update([...mobs, late], player, SIZE);
  assert.equal(log.at(-1), 9, "a spawn after the join is sent at its spawn");
});

test("serverTick: without a world the join keeps creation order (nothing is before the player)", () => {
  const m = new MobTracker(10);
  const log = spy(m);
  m.joinPlayer(40);
  m.update([chicken(5), chicken(20)], player, SIZE);
  assert.deepEqual(log, [5, 20]);
});

test("a respawn sends every entry to the new player again in HashSet order (serverTick path)", () => {
  const m = new MobTracker(10);
  const log = spy(m);
  m.beforePlayer = () => true;
  m.joinPlayer(40);
  const mobs = [chicken(5), chicken(20), chicken(7), chicken(34)];
  m.update(mobs, player, SIZE);
  const copies = [...m.entries.values()].map((en) => en.client);
  log.length = 0;
  m.joinPlayer(41); // respawn: a new EntityPlayerMP with a new entity id
  assert.equal(log.length, 0, "nothing is sent before the next update");
  m.update(mobs, player, SIZE);
  assert.deepEqual(log, [34, 20, 5, 7]);
  assert.deepEqual([...m.entries.values()].map((en) => en.client), copies, "the copies are reset in place");
  assert.ok(copies.every((c) => c.present));
  log.length = 0;
  m.update(mobs, player, SIZE);
  assert.equal(log.length, 0, "only once");
});

test("a respawn re-sends the entries of both trackers in the one set order and drops what waited to be destroyed (joint path)", () => {
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  const log = spy(m, o);
  m.beforePlayer = () => false;
  m.joinPlayer(40);
  const mobs = [chicken(5), chicken(18)], gone = item(21), items = [item(20), item(35)];
  const run = (live, its) => m.update(live, player, SIZE, null, { tracker: o, lists: { item: its }, world: grass });
  run(mobs, [...items, gone]);
  run(mobs, items); // `gone` left: its destroy is queued
  log.length = 0;
  m.joinPlayer(41);
  run(mobs, items);
  const want = m.order.keys().filter((k) => m.entries.has(k) || o.entries.has(k)).map((k) => num(k.entityId ?? k.id));
  assert.deepEqual(log, want);
  assert.equal(log.length, 4);
  assert.equal(m.dying.length + o.dying.length, 0);
  assert.ok(![...o.entries.keys()].includes(gone));
});

test("a respawn before the first update changes nothing but the player's id", () => {
  const m = new MobTracker(10);
  const log = spy(m);
  m.joinPlayer(40); m.joinPlayer(41);
  assert.equal(m.resendPending, undefined);
  m.update([chicken(5)], player, SIZE);
  assert.deepEqual(log, [5]);
});
