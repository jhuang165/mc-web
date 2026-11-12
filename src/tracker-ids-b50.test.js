// Batch 50 (trackerids): natively ONE EntityTracker holds every tracked entity (mobs, items, orbs, arrows, vehicles, hanging) in one HashSet, and one static counter
// (Entity.nextEntityID) numbers them. tracker-ids-reference.json is EXECUTED (tools/probes/TrackerIdsProbe.java: the real EntityTrackerEntry for entities of a mob class and an
// object class built through the real Entity constructor, in one real HashSet). The port keeps a MobTracker and an ObjectTracker; they share the world's EntityIds counter
// and one JavaHashSetOrder (MobTracker.shareOrder), each walking its own entries in the relative order of the one set.
// Also here: the destroy packet is flushed one tick late (bytecode-read: MinecraftServer.v runs WorldServer.tick, updateEntities, then EntityTracker.updateTrackedEntities; the
// S13 sits in EntityPlayerMP.destroyedItemsNetCache until the player's next update, mw.h) so the client copy of a removed entity lives one more tick, and the client steps its
// copies in the order their spawn packets arrived.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-ids-reference.json", import.meta.url), "utf8"));
const CASES = ["interleaved", "grown", "high", "million"];
const player = { x: 0.5, y: 4, z: 0.5 };
const size = () => [0.6, 1.8];
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 }; // the client world of the object tracker tests

function replay(name, { share = true } = {}) {
  const rec = ref[name], ids = new EntityIds(rec.ids[0]);
  const mobsT = new MobTracker(10), objT = new ObjectTracker(10, () => 0.5, ids);
  if (share) objT.shareOrder(mobsT);
  objT.ctx.world = grass; objT.ctx.player = null;
  const mobs = [], items = [], spawned = []; // spawned[i]: the i-th entity of the script
  const known = new Map(); // an object's id is the one its entry took when the tracker first saw it
  const idOf = (e) => (typeof e.id === "string" ? Number(e.id.slice(4)) : known.get(e) ?? (known.set(e, objT.entries.get(e).entry.e.id), known.get(e)));
  const orders = [];
  for (const tok of rec.steps) {
    if (tok.startsWith("-")) {
      const e = spawned[Number(tok.slice(1)) - 1];
      if (mobs.includes(e)) mobs.splice(mobs.indexOf(e), 1); else items.splice(items.indexOf(e), 1);
    } else if (tok === "m") {
      const e = { type: "zombie", id: "mob-" + ids.take(), uuid: "u" + spawned.length, x: 2 + spawned.length * 0.1, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 10, onGround: true };
      mobs.push(e); spawned.push(e);
    } else {
      // an object has no id until the tracker first sees it (the spawn tick): the port's items carry none
      const e = { x: 2 + spawned.length * 0.1, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
      items.push(e); spawned.push(e);
    }
    mobsT.serverTick(mobs, player, size); objT.serverTick({ item: items }, player);
    for (const e of items) idOf(e);
    orders.push(mobsT.order.keys().map(idOf));
    // each tracker's own walk is the part of the one set's order that belongs to it
    if (share) {
      assert.deepEqual(mobsT.walk().map(idOf), orders.at(-1).filter((id) => mobs.some((m) => idOf(m) === id)));
      assert.deepEqual(objT.walk().map(idOf), orders.at(-1).filter((id) => items.some((m) => idOf(m) === id)));
    }
    mobsT.clientTick(); objT.clientTick();
  }
  return { orders, ids: spawned.map(idOf) };
}

test("the reference is the executed probe: real EntityTrackerEntry objects of two classes in one HashSet on a recorded JDK", () => {
  assert.equal(ref.classes.my.name, "EntityTrackerEntry");
  assert.match(ref.javaVersion, /^\d+/);
  for (const k of CASES) {
    assert.equal(ref[k].steps.length, ref[k].orders.length);
    const spawns = ref[k].steps.filter((t) => !t.startsWith("-")).length;
    assert.deepEqual(ref[k].ids, Array.from({ length: spawns }, (_, i) => ref[k].ids[0] + i)); // one counter, consecutive across both classes
  }
});

test("mobs and objects share one id counter and one HashSet: the combined walk matches the executed order after every spawn and untrack", () => {
  let checked = 0;
  for (const k of CASES) {
    const got = replay(k);
    assert.deepEqual(got.ids, ref[k].ids, `${k} ids`);
    got.orders.forEach((o, i) => { assert.deepEqual(o, ref[k].orders[i], `${k} after step ${i} ${ref[k].steps[i]}`); checked++; });
  }
  assert.ok(checked > 100, `${checked} steps`);
});

test("the ids past 65536 reorder the walk (so the sharing is not trivially id order)", () => {
  const last = ref.high.orders.at(-1);
  assert.notDeepEqual(last, [...last].sort((a, b) => a - b));
  assert.deepEqual(replay("high").orders.at(-1), last);
});

test("without the shared set the two trackers keep separate orders and the item ids count from 1 << 24 (the old behaviour is still available)", () => {
  const objT = new ObjectTracker(10, () => 0.5);
  const e = { x: 2, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
  objT.serverTick({ item: [e] }, player);
  assert.equal(objT.entries.get(e).entry.e.id, 1 << 24);
});

test("shareOrder moves the entries a tracker already has into the shared set", () => {
  const mobsT = new MobTracker(10), objT = new ObjectTracker(10, () => 0.5, new EntityIds(100));
  const item = { x: 2, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
  const mob = { type: "zombie", id: "mob-3", uuid: "u", x: 3, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 10, onGround: true };
  objT.serverTick({ item: [item] }, player); mobsT.serverTick([mob], player, size);
  objT.shareOrder(mobsT);
  assert.equal(objT.order, mobsT.order);
  assert.deepEqual(mobsT.order.keys(), [mob, item]); // ids 3 and 100: buckets 3 and 4
  assert.deepEqual(objT.walk(), [item]); assert.deepEqual(mobsT.walk(), [mob]);
});

// destroy one tick late
const crystal = (n, x = 5) => ({ type: "ender_crystal", id: `mob-${n}`, uuid: `c${n}`, x, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 5, onGround: false });

test("a mob that leaves the world keeps its client copy until the player's next update flushes the S13", () => {
  const tracker = new MobTracker(10), c = crystal(1), live = [c];
  tracker.serverTick(live, player, size); tracker.clientTick();
  assert.ok(tracker.clientIfTracked(c));
  live.length = 0;
  tracker.serverTick(live, player, size); tracker.clientTick(); // the tick the crystal is removed: S13 queued, not yet applied
  assert.ok(tracker.clientIfTracked(c), "the copy is still there");
  assert.equal(tracker.entries.size, 0);
  tracker.serverTick(live, player, size); tracker.clientTick(); // the next tick
  assert.equal(tracker.clientIfTracked(c), null);
  assert.equal(tracker.dying.length, 0);
});

test("a destroyed crystal copy stays targetable for the client dragon one more tick", () => {
  const tracker = new MobTracker(10), dragon = { type: "ender_dragon", id: "mob-2", uuid: "d", x: 6, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 200, onGround: false };
  const c = crystal(1, 8), live = [dragon, c];
  const sizes = (e) => (e.type === "ender_dragon" ? [16, 8] : [2, 2]);
  tracker.serverTick(live, player, sizes); tracker.clientTick();
  const copy = tracker.clientIfTracked(dragon);
  assert.ok(copy?.dragon);
  copy.rand = { nextInt: () => 0, nextFloat: () => 0.5, next: () => 0 }; // every roll finds a crystal
  tracker.serverTick(live, player, sizes); tracker.clientTick();
  assert.equal(copy.dragon.healer, tracker.clientIfTracked(c));
  live.pop();
  tracker.serverTick(live, player, sizes); tracker.clientTick();
  assert.ok(copy.dragon.healer?.present, "the copy of the removed crystal is still in the client world this tick");
  tracker.serverTick(live, player, sizes); tracker.clientTick();
  assert.equal(copy.dragon.healer, null);
});

test("a removed object's copy is still a hit target for one tick, and its entry stops walking at once", () => {
  const objT = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  objT.ctx.world = grass; objT.ctx.player = null;
  const e = { x: 2, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
  const items = [e];
  objT.serverTick({ item: items }, player); objT.clientTick();
  assert.ok(objT.clientEntity(e));
  items.length = 0;
  objT.serverTick({ item: items }, player); objT.clientTick();
  assert.equal(objT.walk().length, 0);
  assert.ok(objT.dying.length === 1 && objT.dying[0].client.present);
  objT.serverTick({ item: items }, player); objT.clientTick();
  assert.equal(objT.dying.length, 0);
});

// client step order
test("the client steps its copies in the order their spawn packets arrived, not the order the entries were created", () => {
  const tracker = new MobTracker(10);
  const far = { ...crystal(1, 200), type: "pig", uuid: "far" }, near = { ...crystal(2, 3), type: "pig", uuid: "near" };
  const live = [far, near], at = { x: 0.5, y: 4, z: 0.5 };
  tracker.serverTick(live, at, size); tracker.clientTick();
  assert.deepEqual([...tracker.clientList].map((en) => en.live.uuid), ["near"]); // the far one is outside the watched chunks
  const closer = { x: 150, y: 4, z: 0.5 };
  tracker.serverTick(live, closer, size); tracker.clientTick();
  assert.deepEqual([...tracker.clientList].map((en) => en.live.uuid), ["near", "far"]); // the far one's spawn packet came later though its entry was created first
  assert.deepEqual([...tracker.entries.keys()].map((e) => e.uuid), ["far", "near"]);
});

test("one flush applies the packets of several entries in the order they were sent", () => {
  const tracker = new MobTracker(10);
  const a = { ...crystal(1, 3), type: "pig", uuid: "a" }, b = { ...crystal(2, 4), type: "pig", uuid: "b" }, applied = [];
  tracker.serverTick([a, b], player, size);
  for (const en of tracker.entries.values()) { const apply = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { applied.push(en.live.uuid + ":" + p.type); return apply(p, ctx); }; }
  // both entries queue a look packet; the later entry's was sent first
  const ea = tracker.entries.get(a).entry, eb = tracker.entries.get(b).entry;
  eb.emit({ type: "head", head: 8 }); ea.emit({ type: "head", head: 4 });
  tracker.clientTick();
  assert.deepEqual(applied, ["b:head", "a:head"]);
});
