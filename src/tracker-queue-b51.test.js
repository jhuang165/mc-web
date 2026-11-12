// Batch 51 (trackerqueue): natively one EntityTracker.updateTrackedEntities walks every tracked entity (mobs, items, orbs, arrows, vehicles) in the one HashSet, so their packets are
// queued together in that order and the client applies them as one stream (bytecode-read, mn.a). `MobTracker.update(..., joint)` runs the mob and object walks as that one loop.
// An item, arrow, thrown entity, TNT, falling block or rocket takes its entity id when it joins the world (Entity.<init>: nextEntityID++), not at the tracker's first sight.
import test from "node:test";
import assert from "node:assert/strict";
import { MobTracker, packetSeq } from "./entity-tracker.js";
import { ObjectTracker } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
import { EntityWorld } from "./entities.js";

const player = { x: 0.5, y: 4, z: 0.5 };
const size = () => [0.6, 1.8];
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const mob = (ids, i) => ({ type: "zombie", id: "mob-" + ids.take(), uuid: "u" + i, x: 2 + i * 0.1, y: 4, z: 0.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 10, onGround: true });
const item = (ids) => ({ entityId: ids.take(), x: 3, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true });

function setup() {
  const ids = new EntityIds(1), m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, ids);
  const live = [], things = [];
  const applied = [];
  const spy = (t) => { const c = t.create.bind(t); t.create = (...a) => { const en = c(...a); const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { applied.push(p); applied.who ??= new Map(); applied.who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; }; };
  spy(m); spy(o);
  return { ids, m, o, live, things, applied, tick: () => m.update(live, player, size, null, { tracker: o, lists: { item: things }, world: grass }) };
}

test("mobs and objects spawned in a mix enter the one queue in the order of their entity ids", () => {
  const { ids, live, things, applied, tick, m, o } = setup();
  live.push(mob(ids, 0)); things.push(item(ids)); live.push(mob(ids, 1)); things.push(item(ids)); // ids 1 2 3 4
  tick();
  const spawns = applied.filter((p) => p.type !== "destroy").slice(0, 4);
  const seqs = spawns.map(packetSeq);
  assert.deepEqual([...seqs].sort((a, b) => a - b), seqs); // applied in sending order
  const kinds = [...m.entries.values(), ...o.entries.values()].map((en) => en.entry.e.id);
  assert.equal(kinds.length, 4);
  // sending order = id order across both trackers: the item with id 2 sits between the two mobs
  const sent = [...m.clientList, ...o.clientList].sort((a, b) => a.joinSeq - b.joinSeq).map((en) => en.entry.e.id);
  assert.deepEqual(sent.map((id) => (typeof id === "string" ? Number(id.slice(4)) : id)), [1, 2, 3, 4]);
});

test("the location packets of mobs and objects go out in the one HashSet order and are applied in that order", () => {
  const { ids, live, things, applied, tick, m } = setup();
  for (let i = 0; i < 3; i++) { live.push(mob(ids, i)); things.push(item(ids)); }
  tick();
  let mixed = 0;
  for (let t = 0; t < 130; t++) {
    applied.length = 0;
    for (const e of live) e.x += 0.1; // mobs send every 3rd tick, items every 20th
    for (const e of things) e.x += 0.1;
    tick();
    const moves = applied.filter((p) => p.type === "move" || p.type === "teleport");
    const who = moves.map((p) => applied.who.get(p)), numeric = (id) => (typeof id === "string" ? Number(id.slice(4)) : id);
    const kinds = new Set(who.map((id) => typeof id));
    if (kinds.size > 1) mixed++;
    const walk = m.order.keys().map((e) => numeric(m.entries.get(e)?.entry.e.id ?? e.entityId ?? e.id));
    const rank = (id) => walk.indexOf(numeric(id));
    assert.deepEqual(who.map(rank), [...who.map(rank)].sort((a, b) => a - b), "tick " + t);
    assert.deepEqual(applied.map(packetSeq), applied.map(packetSeq).sort((a, b) => a - b));
  }
  assert.ok(mixed > 0, "a tick had mob and item packets together");
});

test("a removed object and a removed mob destroy in the same flush, one tick after their removal", () => {
  const { ids, live, things, tick, m, o } = setup();
  live.push(mob(ids, 0)); things.push(item(ids));
  tick(); tick();
  const [mm] = live, [ii] = things;
  const mc = m.entries.get(mm).client, oc = o.entries.get(ii).client;
  live.pop(); things.pop();
  tick();
  assert.ok(mc.present && oc.present, "still there the tick they left");
  tick();
  assert.ok(!mc.present && !oc.present, "gone with the next tick's flush");
});

test("the joint walk leaves each tracker's own packet stream as the separate walks made it", () => {
  const a = setup(), b = setup();
  for (const s of [a, b]) { for (let i = 0; i < 4; i++) { s.live.push(mob(s.ids, i)); s.things.push(item(s.ids)); } }
  const sep = (s) => { s.m.update(s.live, player, size); s.o.shareOrder(s.m); s.o.update({ item: s.things }, player, grass); };
  for (let t = 0; t < 8; t++) {
    for (const s of [a, b]) { s.live.forEach((e, i) => { e.x += 0.7 + i * 0.1; }); }
    a.tick(); sep(b);
  }
  const state = (s) => [...s.m.entries.values(), ...s.o.entries.values()].map((en) => [en.client.x, en.client.y, en.client.z]);
  assert.deepEqual(state(a), state(b));
});

test("an item, arrow or thrown entity takes its entity id when it joins the world", () => {
  const ids = new EntityIds(10);
  const world = { ids };
  for (const kind of ["item", "arrow", "thrown", "tnt", "falling", "rocket"]) {
    const e = { x: 0, y: 0, z: 0 };
    EntityWorld.prototype.joined.call(world, e, kind);
    assert.ok(Number.isInteger(e.entityId), kind);
  }
  assert.equal(ids.next, 16);
  const orb = { id: 99 }, again = { entityId: 5 };
  EntityWorld.prototype.joined.call(world, orb, "orb"); EntityWorld.prototype.joined.call(world, again, "item");
  assert.equal(ids.next, 16, "an entity that has an id keeps it");
  const o = new ObjectTracker(10, () => 0.5, ids);
  const e = { entityId: 3, x: 3, y: 4, z: 0.5, mx: 0, my: 0, mz: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
  o.ctx.world = grass; o.serverTick({ item: [e] }, player);
  assert.equal(o.entries.get(e).entry.e.id, 3, "the tracker uses the id the entity took");
  assert.equal(ids.next, 16, "and takes none of its own");
});
