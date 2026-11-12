// Batch 49: the order the entity tracker walks its entries in. Native EntityTracker.trackedEntities is a HashSet<EntityTrackerEntry> whose hashCode is the entity id (bytecode-read),
// so updateTrackedEntities visits entries in java.util.HashMap bucket order. tracker-order-reference.json is EXECUTED: the real EntityTrackerEntry in a real HashSet under
// add / remove histories (tools/probes/TrackerOrderProbe.java, JDK recorded in `javaVersion`). java-hashset-order.js replays it; the tracker uses that helper for its walk.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaHashSetOrder, hashSetOrderOf } from "./java-hashset-order.js";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker } from "./object-tracker.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-order-reference.json", import.meta.url), "utf8"));
const CASES = Object.keys(ref).filter((k) => ref[k]?.ops);

test("the reference is the executed probe: real EntityTrackerEntry objects on a recorded JDK", () => {
  assert.equal(ref.classes.my.name, "EntityTrackerEntry");
  assert.equal(ref.classes.mn.name, "EntityTracker");
  assert.match(ref.javaVersion, /^\d+/);
  assert.ok(CASES.length >= 10);
  for (const k of CASES) assert.equal(ref[k].ops.length, ref[k].orders.length);
});

test("the Java 8+ model reproduces the iteration order after every operation of every executed history", () => {
  let checked = 0;
  for (const k of CASES) {
    const set = new JavaHashSetOrder("java8");
    ref[k].ops.forEach(([op, id], i) => {
      if (op === "add") set.add(id, id); else set.remove(id);
      assert.deepEqual(set.keys(), ref[k].orders[i], `${k} after op ${i} ${op} ${id}`);
      checked++;
    });
  }
  assert.ok(checked > 700, `${checked} operations`);
});

test("sequential ids walk in id order, spawn order differs from bucket order, and removal keeps the capacity", () => {
  assert.deepEqual(ref.sequential.orders.at(-1), Array.from({ length: 60 }, (_, i) => i + 1));
  assert.deepEqual(ref.small.orders.at(-1), [1, 17, 33, 2, 3, 20, 5]); // added 3, 2, 20, 1, 17, 33, 5
  const set = new JavaHashSetOrder();
  for (let i = 0; i < 30; i++) set.add(i, 100 + i * 3);
  assert.equal(set.capacity, 64); // 13th and 25th adds doubled it
  for (let i = 0; i < 22; i++) set.remove(i);
  assert.equal(set.capacity, 64); // HashMap never shrinks
  assert.deepEqual(hashSetOrderOf(ref.noShrink.ops), ref.noShrink.orders.at(-1));
});

test("a chain of nine in a table under 64 doubles it (executed 'collide'); the same id added again joins the end of its chain (executed 'readd')", () => {
  const set = new JavaHashSetOrder();
  for (let i = 0; i < 9; i++) set.add(i, 1 + i * 16);
  assert.equal(set.capacity, 32);
  assert.deepEqual(hashSetOrderOf(ref.readd.ops), ref.readd.orders.at(-1));
  assert.deepEqual(ref.readd.orders.at(-1), [1, 33, 17, 2]);
});

test("the Java 7 model is not executed here: it adds at the front of a chain and hashes differently, so it disagrees with the reference", () => {
  assert.deepEqual(hashSetOrderOf([["add", 1], ["add", 17]], "java7"), [17, 1]); // front insertion (OpenJDK 7 source)
  assert.deepEqual(hashSetOrderOf([["add", 1], ["add", 17]], "java8"), [1, 17]);
  const seven = new JavaHashSetOrder("java7");
  ref.sequential.ops.forEach(([, id]) => seven.add(id, id));
  assert.notDeepEqual(seven.keys(), ref.sequential.orders.at(-1));
  assert.throws(() => new JavaHashSetOrder("java6"));
});

// the tracker scenario: mobs listed 3, 2, 35, 1 (spawn order) send in bucket order 1, 2, 3, 35. The log records the order of the entries' sendLocation calls and of the
// packets they emit (moves and teleports carry no id, so each packet is tagged with the entry that was sending).
const mob = (n, x) => ({ type: "pig", id: `mob-${n}`, uuid: `u${n}`, x, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 10, onGround: true });
function spy(tracker, sent) {
  for (const en of tracker.entries.values()) {
    if (en.spied) continue;
    en.spied = true;
    const send = en.entry.sendLocation.bind(en.entry), emit = en.entry.emit.bind(en.entry);
    let current = null;
    en.entry.sendLocation = (...a) => { current = en.entry.e.id; sent.calls.push(current); const r = send(...a); current = null; return r; };
    en.entry.emit = (p) => { if (current !== null && p.type !== "spawn") sent.packets.push([current, p.type]); return emit(p); };
  }
}
function walked(tracker, mobs, ticks, player = { x: 0.5, y: 4, z: 0.5 }) {
  const sent = { calls: [], packets: [] };
  tracker.update(mobs, player, () => [0.9, 0.9]); // the entries start here
  spy(tracker, sent);
  for (let t = 0; t < ticks; t++) { mobs.forEach((m, i) => { m.x += 0.4 + i * 0.01; }); tracker.update(mobs, player, () => [0.9, 0.9]); }
  return sent;
}
const firstSeen = (ids) => ids.filter((id, i) => ids.indexOf(id) === i);
test("mob entries send their location in HashSet order of the entity ids, not in live list order", () => {
  const mobs = [3, 2, 35, 1].map((n, i) => mob(n, 3 + i));
  const tracker = new MobTracker(10);
  const sent = walked(tracker, mobs, 4);
  assert.deepEqual(sent.calls.slice(0, 4), ["mob-1", "mob-2", "mob-3", "mob-35"]); // 3 and 35 share bucket 3: the earlier spawn first
  assert.deepEqual(firstSeen(sent.packets.map(([id]) => id)), ["mob-1", "mob-2", "mob-3", "mob-35"]);
  assert.ok(sent.packets.length >= 4);
  // the same mobs with the list reversed: 35 now spawned before 3, so that chain flips, the rest is unchanged
  const reversed = [3, 2, 35, 1].map((n, i) => mob(n, 3 + i)).reverse();
  const t2 = new MobTracker(10), sent2 = walked(t2, reversed, 4);
  assert.deepEqual(sent2.calls.slice(0, 4), ["mob-1", "mob-2", "mob-35", "mob-3"]);
});

test("a despawned mob leaves the set and a later spawn takes its bucket's chain end; capacity grows past twelve entries", () => {
  const mobs = [];
  for (let n = 1; n <= 13; n++) mobs.push(mob(n, 2 + n * 0.3));
  const tracker = new MobTracker(10);
  tracker.update(mobs, { x: 0.5, y: 4, z: 0.5 }, () => [0.9, 0.9]);
  assert.equal(tracker.order.capacity, 32);
  const gone = mobs.splice(0, 12);
  tracker.update(mobs, { x: 0.5, y: 4, z: 0.5 }, () => [0.9, 0.9]);
  assert.equal(tracker.order.capacity, 32); // no shrink
  assert.equal(tracker.entries.size, 1);
  const late = mob(33, 3); // 33 shares bucket 1 with... 13 is in bucket 13: 33 & 31 = 1, free; a spawn of 45 shares 13
  mobs.push(late, mob(45, 4));
  tracker.update(mobs, { x: 0.5, y: 4, z: 0.5 }, () => [0.9, 0.9]);
  assert.deepEqual(tracker.walk().map((e) => e.id), ["mob-33", "mob-13", "mob-45"]);
  assert.equal(gone.length, 12);
});

test("object entries (items, arrows...) walk in the same bucket order of their ids", () => {
  const tracker = new ObjectTracker(10, () => 0.5);
  const orb = (id, x) => ({ x, y: 4, posY: 4, z: 0.5, vx: 0, vy: 0, vz: 0, value: 1, age: 0, health: 5, fire: 0, bb: [0, 0, 0, 0, 0, 0], id });
  const orbs = [orb(18, 3), orb(2, 4), orb(34, 5), orb(1, 6)]; // 18, 2 and 34 share bucket 2 of 16: chain 18, 2, 34 in insertion order
  const player = { x: 0.5, y: 4, z: 0.5 };
  tracker.serverTick({ orb: orbs }, player);
  const sent = { calls: [], packets: [] };
  spy(tracker, sent);
  for (let t = 0; t < 3; t++) { orbs.forEach((o) => { o.vy = 0.2; o.posY = o.y += 0.5; }); tracker.serverTick({ orb: orbs }, player); }
  assert.deepEqual(sent.calls.slice(0, 4), [1, 18, 2, 34]);
  assert.deepEqual(tracker.walk().map((e) => e.id), [1, 18, 2, 34]);
});
