// Batch 53 (trackerjoint2). public/research/tracker-joint-reference.json now also holds EXECUTED joint records of vehicles, hanging entities, an eye of ender and a fish hook
// (cases `vehicles` and `vehiclesLast`, tag b53tj; tools/probes/TrackerJointProbe.java, tools/verify-tracker-joint.mjs): the real EntityTracker with real boats, minecarts, a
// painting, item frames, eyes and a hook among chickens and items. The replay runs the port's joint walk over the same scripted entities and compares, tick by tick, the (kind, entity id)
// of every packet the client gets. The player joins at the first update (`joinPlayer`): what the world held before it is sent to it in the HashSet order at that point, what spawns
// later at its spawn. Also: the player's stamp and id in EntityWorld (`playerJoined`).
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
// the port's list name of each probe kind
const LIST = { item: "item", arrow: "arrow", snowball: "snowball", orb: "orb", boat: "boat", cart0: "minecart", cart1: "minecart", painting: "painting", frame: "itemFrame", eye: "eyeOfEnder", hook: "fishHook", knot: "leashKnot", firework: "firework", falling: "falling", tnt: "tnt", potion: "potion" };

function host(spec, id, row, before) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = row;
  switch (spec.kind) {
    case "chicken": return { type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 4, onGround: true, beforeP: before };
    case "item": return { entityId: id, x, y: y - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1, damage: 0 }, onGround: true, beforeP: before };
    case "orb": return { id, x, posY: y, z, vx, vy, vz, y: y - 0.25, value: 5, beforeP: before };
    case "boat": case "cart0": case "cart1": return { entityId: id, x, posY: y, z, vx, vy, vz, yaw, pitch, type: spec.kind === "cart1" ? 1 : 0, beforeP: before };
    case "painting": case "frame": return { entityId: id, x: x + 0.5, y, z: z + 0.5, tx: x, ty: y, tz: z, dir: spec.dir, yaw: 0, art: 0, beforeP: before };
    case "knot": return { entityId: id, x: x + 0.5, y: y + 0.5, z: z + 0.5, tx: x, ty: y, tz: z, dir: 0, yaw: 0, beforeP: before };
    case "falling": return { entityId: id, x, y: y - OBJECT_KINDS.falling.yOff, z, mx: vx, my: vy, mz: vz, block: 3, meta: 0, beforeP: before };
    case "firework": case "tnt": case "potion": return { entityId: id, x, y: y - OBJECT_KINDS[spec.kind].yOff, z, mx: vx, my: vy, mz: vz, vx, vy, vz, damage: 16388, beforeP: before };
    case "eye": case "hook": return { entityId: id, x, y, z, vx, vy, vz, yaw, pitch, beforeP: before };
    default: return { id, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch, beforeP: before };
  }
}
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)?.[1] ?? "-1" + id) : id);

// Runs one case through the port; `tweak(m)` mutates the mob tracker. Returns [[tick, got, want]...] of mismatching ticks.
function replay(name, tweak = null) {
  const rec = ref[name], m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  const playerId = rec.ids.player;
  m.beforePlayer = (e) => e.beforeP === true;
  m.joinPlayer(playerId);
  tweak?.(m);
  const applied = [], who = new Map(), firstRow = new Map();
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); { const fr = firstRow.get(a[0]); if (fr) { const st = en.entry.tryStart.bind(en.entry); en.entry.tryStart = () => { en.entry.tryStart = st; st(); fr(); }; } } const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { applied.push(p); who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v }));
  const hosts = new Map();
  const bad = [];
  const want = (k) => (k === 0 ? [...rec.setup.flat(), ...rec.ticks[0][1]] : rec.ticks[k][1]).filter((p) => KINDS.has(p[0])).map((p) => p[0] + ":" + p[1]);
  for (let k = 0; k < rec.ticks.length; k++) {
    const live = [], lists = {};
    for (const s of specs) {
      if (s.born > k + 1 || (s.dies >= 0 && k + 1 >= s.dies)) continue;
      const before = s.id < playerId;
      let h = hosts.get(s.name);
      // Java's setup joins the entities at tick 0 and tick 1 is the first updateTrackedEntities: the entry is made from row 0 and that first walk sees row 1
      if (!h) { h = host(s, s.id, s.rows[k ? k + 1 : 0], before); hosts.set(s.name, h); if (!k) firstRow.set(h, () => Object.assign(h, host(s, s.id, s.rows[1], before))); } else Object.assign(h, host(s, s.id, s.rows[k + 1], before));
      if (s.kind === "chicken") live.push(h); else (lists[LIST[s.kind]] ??= []).push(h);
    }
    applied.length = 0;
    m.update(live, player, () => [0.3, 0.7], null, { tracker: o, lists, world: grass });
    const got = applied.map((p) => p.type + ":" + num(who.get(p))).filter((x) => KINDS.has(x.split(":")[0])), w = want(k);
    if (JSON.stringify(got) !== JSON.stringify(w)) bad.push([k, got, w]);
  }
  return bad;
}

for (const name of ["extras", "extrasLast", "vehicles", "vehiclesLast", "mix", "playerFirst", "playerLast"]) test(`${name}: the joint walk sends and flushes in the order of the real EntityTracker`, () => {
  assert.deepEqual(replay(name).slice(0, 3), []);
});

test("the b53tj record holds every kind, destroys before and after the player, and spawns after the join", () => {
  for (const name of ["vehicles", "vehiclesLast"]) {
    const r = ref[name];
    assert.equal(r.tag, "b53tj");
    const kinds = new Set(Object.values(r.inputs).map((v) => v.kind));
    for (const k of ["boat", "cart0", "cart1", "painting", "frame", "eye", "hook"]) assert.ok(kinds.has(k), name + " " + k);
    const spawned = new Set([...r.setup.flat(), ...r.ticks.flatMap(([, ev]) => ev)].filter((p) => p[0] === "spawn").map((p) => p[1]));
    for (const id of Object.values(r.ids2)) if (id !== r.ids.player) assert.ok(spawned.has(id), name + " spawn " + id);
    assert.ok(r.ticks.flatMap(([, ev]) => ev).filter((p) => p[0] === "destroy").length >= 7);
  }
  const r = ref.vehicles, destroyTick = (id) => r.ticks.find(([, ev]) => ev.some((p) => p[0] === "destroy" && p[1] === id))[0];
  assert.ok(r.ids.p1 < r.ids.player && r.ids.k2 > r.ids.player);
  assert.equal(destroyTick(r.ids.p1), r.inputs.p1.dies, "a painting before the player: flushed in its own tick");
  assert.equal(destroyTick(r.ids.k2), r.inputs.k2.dies + 1, "a cart after the player: a tick later");
  assert.equal(destroyTick(r.ids2.h1), r.inputs.h1.dies + 1, "the hook spawned after the join: a tick later");
});

test("the join order matters: sending the world's entities in id order at the join (the old rule) is caught by the replay", () => {
  const bad = replay("vehiclesLast", (m) => { m.pendingJoin = false; m.addPlayerKey(); });
  assert.ok(bad.length > 0);
});

test("mutation check: the player's entry left out of the set (no slot) is caught", () => {
  const bad = replay("vehiclesLast", (m) => { m.addPlayerKey = () => {}; });
  const all = ["vehicles", "mix", "playerLast"].map((n) => replay(n, (m) => { m.addPlayerKey = () => {}; }).length).reduce((a, b) => a + b, 0) + bad.length;
  assert.ok(all > 0);
});

function world() {
  const w = Object.create(EntityWorld.prototype);
  w.ids = new EntityIds(10);
  w.entities = [{ id: "a" }, { id: "b" }];
  w.orderSeqs = new WeakMap();
  return w;
}

test("EntityWorld.playerJoined: the player takes a stamp in orderSeqs and an entity id; a respawn takes a new id and moves to the end, a dimension change keeps the id", () => {
  const w = world();
  w.playerJoined();
  const id = w.ids.playerId;
  assert.equal(id, 10);
  assert.equal(w.ids.next, 11);
  assert.ok(w.orderSeqs.get(w.playerKey) > w.orderSeqs.get(w.entities[1]));
  assert.equal(w.beforePlayer(w.entities[0]), true);
  const late = { id: "c" };
  w.entities.push(late);
  w.orderStamp();
  assert.equal(w.beforePlayer(late), false);
  w.playerJoined(true); // respawn
  assert.equal(w.ids.playerId, 11);
  assert.equal(w.beforePlayer(late), true, "the new player is after everything that exists");
  const other = world(); other.ids = w.ids; // the new dimension's list: same counter, the player keeps its id
  other.playerJoined();
  assert.equal(other.ids.playerId, 11);
  assert.equal(w.ids.next, 12);
});

test("a tracker rejoin after the first update puts the new id in the set at once", () => {
  const m = new MobTracker(10);
  m.joinPlayer(5);
  m.update([], player, () => [0.3, 0.7]);
  assert.ok(m.order.has(m.playerKey));
  m.joinPlayer(9);
  assert.equal(m.order.keys().filter((k) => k === m.playerKey).length, 1);
  assert.equal(m.order.keys_.get(m.playerKey).hash, m.order.hash(9));
});

test("the b54rt record holds knots, rockets, falling blocks, TNT and potions, destroyed before and after the player", () => {
  for (const name of ["extras", "extrasLast"]) {
    const r = ref[name];
    assert.equal(r.tag, "b54rt");
    const kinds = new Set(Object.values(r.inputs).map((v) => v.kind));
    for (const k of ["knot", "firework", "falling", "tnt", "potion"]) assert.ok(kinds.has(k), name + " " + k);
    const ev = [...r.setup.flat(), ...r.ticks.flatMap(([, e]) => e)];
    const spawned = new Set(ev.filter((p) => p[0] === "spawn").map((p) => p[1]));
    for (const id of Object.values(r.ids2)) if (id !== r.ids.player) assert.ok(spawned.has(id), name + " spawn " + id);
    assert.ok(ev.filter((p) => p[0] === "destroy").length >= 8);
  }
});
