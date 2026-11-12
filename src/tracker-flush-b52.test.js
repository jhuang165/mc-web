// Batch 52 (trackerflush). public/research/tracker-joint-reference.json is EXECUTED: the real EntityTracker (mn) with real entries for chickens, items, arrows, snowballs and orbs and a
// player stand-in, driven by a World.updateEntities stand-in (tools/probes/TrackerJointProbe.java, tools/verify-tracker-joint.mjs). The replay runs the port's joint walk
// (`MobTracker.update(..., joint)`) over the same scripted entities and compares, tick by tick, the sequence of packets (kind, entity id) the client gets: the one HashSet order of mobs
// and objects, spawns in id order, and the destroy flush (an entity removed before the player in the list is destroyed in its own tick, one after it a tick later).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker, OBJECT_KINDS } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
import { EntityWorld } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-joint-reference.json", import.meta.url), "utf8"));
const player = { x: 0.5, y: 0, z: 0.5 };
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const KINDS = new Set(["spawn", "move", "moveLook", "look", "teleport", "velocity", "head", "destroy"]);
const LIST = { item: "item", arrow: "arrow", snowball: "snowball", orb: "orb" };

function host(spec, id, row, before) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = row;
  if (spec.kind === "chicken") return { type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 4, onGround: true, beforeP: before };
  if (spec.kind === "item") return { entityId: id, x, y: y - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1, damage: 0 }, onGround: true, beforeP: before };
  if (spec.kind === "orb") return { id, x, posY: y, z, vx, vy, vz, y: y - 0.25, value: 5, beforeP: before };
  return { id, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch, beforeP: before };
}
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)?.[1] ?? "-1" + id) : id);

// Runs one case through the port; `tweak(m)` mutates the mob tracker. Returns [[tick, got, want]...] of mismatching ticks.
function replay(name, tweak = null) {
  const rec = ref[name], m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  const playerId = rec.ids.player;
  m.beforePlayer = (e) => e.beforeP === true;
  tweak?.(m);
  // the player's own entry sits in the same HashSet (its id takes a slot, which changes when the table doubles)
  const phantom = { phantom: true };
  m.order.add(phantom, playerId);
  const applied = [], who = new Map(), firstRow = new Map();
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); firstRow.get(a[0])?.(); const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { applied.push(p); who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v }));
  const hosts = new Map();
  const bad = [];
  const want = (k) => (k === 0 ? [...rec.setup.flat(), ...rec.ticks[0][1]] : rec.ticks[k][1]).filter((p) => KINDS.has(p[0])).map((p) => p[0] + ":" + p[1]);
  for (let k = 0; k < rec.ticks.length; k++) {
    const live = [], lists = { item: [], arrow: [], snowball: [], orb: [] };
    for (const s of specs) {
      if (s.born > k + 1 || (s.dies >= 0 && k + 1 >= s.dies)) continue;
      const before = s.id < playerId;
      let h = hosts.get(s.name);
      // Java's setup joins the entities at tick 0 and tick 1 is the first updateTrackedEntities: the entry is made from row 0 and that first walk sees row 1
      if (!h) { h = host(s, s.id, s.rows[k ? k + 1 : 0], before); hosts.set(s.name, h); if (!k) firstRow.set(h, () => Object.assign(h, host(s, s.id, s.rows[1], before))); } else Object.assign(h, host(s, s.id, s.rows[k + 1], before));
      if (s.kind === "chicken") live.push(h); else lists[LIST[s.kind]].push(h);
    }
    applied.length = 0;
    m.update(live, player, () => [0.3, 0.7], null, { tracker: o, lists, world: grass });
    let got = applied.map((p) => p.type + ":" + num(who.get(p))).filter((x) => KINDS.has(x.split(":")[0]));
    let w = want(k);
    // a player that joins last (playerLast) is sent the entries it has not seen in the HashSet order at its join, the port's player is there from the start: compare that tick as a set
    if (name === "playerLast" && k === 0) { got.sort(); w = [...w].sort(); }
    if (JSON.stringify(got) !== JSON.stringify(w)) bad.push([k, got, w]);
  }
  return bad;
}

for (const name of ["mix", "playerFirst", "playerLast"]) test(`${name}: the joint walk sends and flushes in the order of the real EntityTracker`, () => {
  const bad = replay(name);
  assert.deepEqual(bad.slice(0, 3), []);
});

test("the record covers both flush cases: before the player in its own tick, after it one tick later", () => {
  const rec = ref.mix, ids = rec.ids, dieAt = (n) => rec.inputs[n].dies;
  const destroyTick = (id) => rec.ticks.find(([, ev]) => ev.some((p) => p[0] === "destroy" && p[1] === id))[0];
  assert.ok(ids.i1 < ids.player && ids.c4 > ids.player);
  assert.equal(destroyTick(ids.i1), dieAt("i1"));
  assert.equal(destroyTick(ids.c4), dieAt("c4") + 1);
  assert.equal(destroyTick(rec.ids.i4), dieAt("i4") + 1);
  for (const n of ["playerFirst", "playerLast"]) {
    const r = ref[n];
    for (const [k, v] of Object.entries(r.inputs)) if (v.dies >= 0) assert.equal(r.ticks.find(([, ev]) => ev.some((p) => p[0] === "destroy" && p[1] === r.ids2[k]))[0], v.dies + (v.born === 0 && r.ids[k] < r.ids.player ? 0 : 1), n + " " + k);
  }
});

test("mutation check: flushing every destroy one tick late (the old rule) is caught by the replay", () => {
  const bad = replay("mix", (m) => { m.beforePlayer = () => false; });
  assert.ok(bad.length > 0);
});

test("EntityWorld.beforePlayer: what the world held when it opened is before the player, what spawns later after it", () => {
  const w = Object.create(EntityWorld.prototype);
  w.entities = [{ id: "a" }, { id: "b" }];
  w.orderSeqs = new WeakMap();
  w.playerStamp = w.orderStamp();
  const late = { id: "c" };
  w.entities.push(late);
  w.orderStamp();
  assert.equal(w.beforePlayer(w.entities[0]), true);
  assert.equal(w.beforePlayer(late), false);
  assert.equal(w.beforePlayer({ id: "never listed" }), false);
});

test("a restored item takes its entity id when the list walk first sees it, before the tracker does", () => {
  const w = Object.create(EntityWorld.prototype);
  w.ids = new EntityIds(5);
  w.entities = [];
  w.walks = new Map([["item", { list: () => [item], tick() {}, reap() {} }]]);
  const item = { x: 0, y: 0, z: 0, stack: { id: 1, count: 1 } };
  w.withBalls([]);
  assert.equal(item.entityId, 5);
  assert.equal(w.ids.next, 6);
});

test("an eye of ender and a fish hook take their entity id when thrown or loaded, not at the tracker's first sight", async () => {
  const { EyesOfEnder } = await import("./eye-of-ender-live.js");
  const { Fishing } = await import("./fishing-simulation.js");
  const { FISHING_ROD } = await import("./fishing-content.js");
  const { JavaRandom } = await import("./java-random.js");
  const ids = new EntityIds(100);
  const eyes = Object.assign(new EyesOfEnder(), { ids });
  const eye = eyes.launch(0.5, 64, 0.5, [20, 64, 20]);
  assert.equal(eye.entityId, 100);
  const saved = JSON.parse(JSON.stringify(eyes.serialize()));
  assert.ok(saved.eyes.every((e) => e.entityId === undefined), "the id is not saved: a loaded entity is a new one");
  const back = Object.assign(new EyesOfEnder(), { ids });
  back.load(saved);
  assert.equal(back.eyes[0].entityId, 101);
  const stone = 1, water = 9;
  const world = { get: (x, y, z) => (y < 58 ? stone : y < 63 ? water : 0), getMeta: () => 0, solid: (x, y, z) => y < 58, height: 256 };
  const host = {
    world, position: { x: 0.5, y: 63, z: 0.5 }, yaw: 0, pitch: 0.3, survival: { held: { id: FISHING_ROD, count: 1, damage: 0 }, health: 20, creative: false },
    mobs: null, itemRand: new JavaRandom(5), worldRand: new JavaRandom(9), fx: { spawn() {} }, canLightningStrike: () => false, canSeeSky: () => true,
    sound() {}, targets: () => [], hit: () => false, pull() {}, drop() {}, orb() {}, wear() {},
  };
  const fishing = Object.assign(new Fishing(), { ids });
  assert.equal(fishing.use(host), "cast");
  assert.equal(fishing.hook.entityId, 102);
  const other = Object.assign(new Fishing(), { ids });
  other.load(JSON.parse(JSON.stringify(fishing.serialize())));
  assert.equal(other.hook.entityId, 103);
});
