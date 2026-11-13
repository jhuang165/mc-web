// Batch 55 (dimtracker). public/research/tracker-joint-reference.json now holds EXECUTED records (tag b55dt) of
//  - a respawn (cases respawn, respawnLast): the real mn.b(old player) and mn.a(new EntityPlayerMP with a new id at the END of loadedEntityList);
//  - a dimension change (dimension, dimensionLast): the real mn.b in world A and mn.a in world B, which has its own HashSet; the player keeps its id and joins the end of B's list;
//  - spawns made in an entity's own update (earlySpawn, earlySpawnLast): sent at the spawner's slot, so before the player's flush when the spawner is before the player.
// (tools/probes/TrackerJointProbe.java runX, tools/verify-tracker-joint.mjs.) The replay runs the port's joint walk over the same scripted entities and compares, tick by tick, the (kind, id)
// of every spawn and destroy packet the client gets. The respawn and transfer calls of ServerConfigurationManager and the entity loop are stand-ins; the mn calls are executed.
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
const KINDS = new Set(["spawn", "destroy"]);
const LIST = { item: "item", arrow: "arrow", snowball: "snowball", orb: "orb", boat: "boat", cart0: "minecart", cart1: "minecart", painting: "painting", frame: "itemFrame" };

function host(spec, id, row) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = row;
  switch (spec.kind) {
    case "chicken": return { type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 4, onGround: true };
    case "item": return { entityId: id, x, y: y - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
    case "orb": return { id, x, posY: y, z, vx, vy, vz, y: y - 0.25, value: 5 };
    case "boat": case "cart0": case "cart1": return { entityId: id, x, posY: y, z, vx, vy, vz, yaw, pitch, type: spec.kind === "cart1" ? 1 : 0 };
    case "painting": case "frame": return { entityId: id, x: x + 0.5, y, z: z + 0.5, tx: x, ty: y, tz: z, dir: spec.dir, yaw: 0, art: 0 };
    default: return { id, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch };
  }
}
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)?.[1] ?? "-1" + id) : id);

// A client world and its trackers: what a login, a respawn's client or a dimension change's new world has.
function rig(playerId, tweak) {
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  m.beforePlayer = (e) => e.beforeP === true;
  m.spawnEarly = (e) => e.earlyP === true;
  tweak?.(m);
  m.joinPlayer(playerId);
  const r = { m, o, applied: [], who: new Map(), firstRow: new Map() };
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); r.firstRow.get(a[0])?.(); const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { r.applied.push(p); r.who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  return r;
}

// Runs one case through the port. `tweak(m)` mutates every mob tracker made. Returns [[tick, got, want]...] of mismatching ticks.
function replay(name, tweak = null) {
  const rec = ref[name], R = rec.respawnAt, D = rec.dimAt;
  let playerId = rec.ids2.player;
  let r = rig(playerId, tweak);
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v, ...rec.meta[n] }));
  const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
  let hosts = new Map();
  const bad = [];
  const want = (k) => (k === 0 ? [...rec.setup.flat(), ...rec.ticks[0][1]] : rec.ticks[k][1]).filter((p) => KINDS.has(p[0])).map((p) => p[0] + ":" + p[1]);
  const born = (s) => (s.inB ? Math.max(s.born, D) : s.born);
  for (let k = 0; k < rec.ticks.length; k++) {
    const tk = k + 1;
    if (tk === R) { // the new EntityPlayerMP: a new id at the end of the list; everything the world holds is before it
      playerId = rec.ids2.player2;
      r.m.joinPlayer(playerId);
      for (const h of hosts.values()) h.beforeP = true;
    }
    if (tk === D) { // a new client world, a new tracker pair, the same player id; the world's entities were loaded before the player joined its list
      r = rig(playerId, tweak); hosts = new Map();
    }
    const live = [], lists = {};
    for (const s of specs) {
      if (D && (s.inB ? tk < D : tk >= D)) continue;
      if (born(s) > tk || (s.dies >= 0 && tk >= s.dies)) continue;
      let h = hosts.get(s.name);
      const initial = born(s) === 0 || (s.inB && s.born === 0 && tk === D);
      if (!h) {
        h = host(s, s.id, s.rows[initial ? k : k + 1]);
        h.beforeP = initial && (s.inB || s.id < playerId);
        h.earlyP = !!s.by && byName[s.by] && hosts.get(s.by)?.beforeP === true;
        hosts.set(s.name, h);
        if (initial) r.firstRow.set(h, () => { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1]), { beforeP: b, earlyP: e }); });
      } else { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1]), { beforeP: b, earlyP: e }); }
      if (s.kind === "chicken") live.push(h); else (lists[LIST[s.kind]] ??= []).push(h);
    }
    r.applied.length = 0;
    r.m.update(live, player, () => [0.3, 0.7], null, { tracker: r.o, lists, world: grass });
    const got = r.applied.map((p) => p.type + ":" + num(r.who.get(p))).filter((x) => KINDS.has(x.split(":")[0])), w = want(k);
    if (JSON.stringify(got) !== JSON.stringify(w)) bad.push([tk, got, w]);
  }
  return bad;
}

for (const name of ["respawn", "respawnLast", "dimension", "dimensionLast", "earlySpawn", "earlySpawnLast"]) test(`${name}: spawn and destroy order equals the real EntityTracker's`, () => {
  assert.deepEqual(replay(name).slice(0, 3), []);
});

test("the b55dt record: a respawn sends the new player every entry in set order, a dimension change the new world's, a spawn before the player's slot precedes the flush", () => {
  const spawnsAt = (r, t) => r.ticks.find(([k]) => k === t)[1].filter((p) => p[0] === "spawn").map((p) => p[1]);
  const re = ref.respawn;
  assert.equal(re.tag, "b55dt");
  assert.ok(re.ids2.player2 > re.ids2.player, "a respawn is a new entity id");
  assert.ok(spawnsAt(re, re.respawnAt).length >= 14, "every entry the world holds is sent again");
  const di = ref.dimension;
  assert.equal(spawnsAt(di, di.dimAt).length, 6, "the new world's six entities");
  assert.ok(spawnsAt(di, di.dimAt).every((id) => id > di.ids2.player), "ids drawn after the player's, hashed into B's own set");
  const es = ref.earlySpawn, at = (t) => es.ticks.find(([k]) => k === t)[1].filter((p) => p[0] === "spawn" || p[0] === "destroy").map((p) => p[0][0] + p[1]);
  assert.deepEqual(at(31).slice(0, 2), ["s" + es.ids2.e1, "d" + es.ids2.a1], "spawn by c1 (before the player) precedes a1's flush");
  assert.deepEqual(at(38).slice(0, 2), ["d" + es.ids2.s1, "s" + es.ids2.e3], "spawn by c4 (after the player) follows s1's flush");
});

test("mutation check: without the early-spawn rule or the respawn re-send the replay differs", () => {
  assert.ok(replay("earlySpawn", (m) => { m.spawnEarly = null; }).length > 0);
  assert.ok(replay("respawn", (m) => { m.resendWorld = function () { this.resendPending = false; }; }).length > 0);
  assert.ok(replay("dimensionLast", (m) => { m.pendingJoin = false; m.addPlayerKey(); }).length > 0);
});

test("leaveWorld: the old world's copies go, the player's entry leaves the set, the id stays for the new world", () => {
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  m.beforePlayer = () => true;
  m.joinPlayer(40);
  const mobs = [{ type: "chicken", id: "mob-5", uuid: "u5", x: 2.5, y: 0, z: 3.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true }];
  const items = [host({ kind: "item" }, 20, [3.5, 1, 2.5, 0, 0, 0, 0, 0])];
  m.update(mobs, player, () => [0.3, 0.7], null, { tracker: o, lists: { item: items }, world: grass });
  const copies = [...m.entries.values(), ...o.entries.values()].map((en) => en.client);
  assert.equal(copies.length, 2); assert.ok(copies.every((c) => c.present));
  assert.ok(m.playerKey && m.order.keys().includes(m.playerKey));
  m.leaveWorld([o]);
  assert.ok(copies.every((c) => !c.present), "the client world is replaced");
  assert.equal(m.clientList.size + o.clientList.size, 0);
  assert.ok(!m.order.keys().includes(m.playerKey ?? {}));
  const w = Object.create(EntityWorld.prototype); w.tracker = m;
  assert.doesNotThrow(() => w.leaveWorld([o]));
  assert.doesNotThrow(() => Object.create(EntityWorld.prototype).leaveWorld());
});

test("EntityWorld: a spawn made in the update of an entity before the player's slot is early, one after it is not, outside the pass (network phase) is early since b56", () => {
  const w = Object.create(EntityWorld.prototype);
  w.ids = new EntityIds(10); w.orderSeqs = new WeakMap(); w.entities = [];
  const a = { id: "a" }, b = { id: "b" };
  w.entities = [a, b];
  w.walks = new Map([["item", { list: () => [] }]]);
  w.playerJoined();
  w.orderSeqs.set(a, 1); w.orderSeqs.set(b, w.orderSeqs.get(w.playerKey) + 1);
  const spawn = (slot) => { const e = { entityId: undefined }; w.tickOrder = []; w.slot = slot; w.joined(e, "item"); w.tickOrder = null; return w.earlySpawns?.has(e) === true; };
  assert.equal(spawn(a), true);
  assert.equal(spawn(b), false);
  const e = {}; w.slot = null; w.joined(e, "item");
  assert.equal(w.earlySpawns?.has(e) === true, true, "b56: the network phase between ticks sends before the next flush (tracker-mobs-b56.test.js for the tile pass)");
});
