// Batch 57 (trackerspawn). The b55 dimension records left world B untouched until the player arrived. The b57ts records (dimTick, dimTickLast; TrackerJointProbe with b57 on) tick world B
// from the start, after world A's tick and tracker update, as MinecraftServer.updateTimeLightAndEntities does: B's entities are created with the world, move and update their tracker entries every
// tick with nobody watching, one is born and one dies before the arrival, and the network spawns the arrival tick and the next. Replayed through the port's joint walk, tick by tick: the
// (kind, id) of every spawn and destroy the client gets, and the update that first moves each copy.
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
let KINDS = new Set(["spawn", "destroy"]);
const ALL = new Set(["spawn", "move", "moveLook", "look", "teleport", "velocity", "head", "destroy"]);
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
  const r = { m, o, applied: [], who: new Map(), firstRow: new Map(), age: new Map() };
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); if (r.age.has(a[0])) en.entry.ticks = r.age.get(a[0]); { const fr = r.firstRow.get(a[0]); if (fr) { const st = en.entry.tryStart.bind(en.entry); en.entry.tryStart = () => { en.entry.tryStart = st; st(); fr(); }; } } const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { r.applied.push(p); r.who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  return r;
}

// Runs one case through the port. `tweak(m)` mutates every mob tracker made. Returns [[tick, got, want]...] of mismatching ticks.
export function replay(name, tweak = null, kinds = ALL, only = null) {
  KINDS = kinds;
  const rec = ref[name], R = rec.respawnAt, D = rec.dimAt;
  let playerId = rec.ids2.player;
  let r = rig(playerId, tweak);
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v, ...rec.meta[n] }));
  const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
  let hosts = new Map();
  const bad = [];
  const want = (k) => (k === 0 ? [...rec.setup.flat(), ...rec.ticks[0][1]] : rec.ticks[k][1]).map((p) => p[0] + ":" + p[1]);
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
      const initial = s.inB ? s.born < D && tk === D : s.born === 0; // B's entities made before the arrival were loaded with the world
      if (!h) {
        h = host(s, s.id, s.rows[initial ? k : k + 1]);
        h.beforeP = initial && (s.inB || s.id < playerId);
        h.earlyP = !!s.net || !!s.by && byName[s.by] && hosts.get(s.by)?.beforeP === true;
        hosts.set(s.name, h);
        if (initial) r.firstRow.set(h, () => { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1]), { beforeP: b, earlyP: e }); });
      } else { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1]), { beforeP: b, earlyP: e }); }
      if (s.kind === "chicken") live.push(h); else (lists[LIST[s.kind]] ??= []).push(h);
    }
    r.applied.length = 0;
    r.m.update(live, player, () => [0.3, 0.7], null, { tracker: r.o, lists, world: grass });
    const keep = (x) => KINDS.has(x.split(":")[0]) && (!only || only(Number(x.split(":")[1])));
    const got = r.applied.map((p) => p.type + ":" + num(r.who.get(p))).filter(keep), w = want(k).filter(keep);
    if (JSON.stringify(got) !== JSON.stringify(w)) bad.push([tk, got, w]);
  }
  return bad;
}


// Entities made in B at or after the arrival tick (the arrival's own world population is ticking in the record; see below)
const fresh = (name) => { const r = ref[name]; const ids = new Set(Object.entries(r.meta).filter(([n, m]) => m.inB && r.inputs[n].born >= r.dimAt).map(([n]) => r.ids2[n])); return (id) => ids.has(id); };

for (const name of ["dimTick", "dimTickLast"]) {
  test(`${name}: spawn and destroy order equals the real EntityTracker's with world B ticking before the arrival`, () => {
    assert.deepEqual(replay(name, null, new Set(["spawn", "destroy"])).slice(0, 3), []);
  });
  test(`${name}: every packet (moves, looks, heads, velocity) of an entity made in B at or after the arrival equals the record, a network spawn included`, () => {
    assert.deepEqual(replay(name, null, ALL, fresh(name)).slice(0, 3), []);
  });
}

test("the b57ts record: B's entries ran before the arrival, a network spawn in the arrival tick is sent after the player joined and moves on the third tracker update", () => {
  const r = ref.dimTick, id = r.ids2, at = (t) => r.ticks.find(([k]) => k === t)[1].map((p) => p[0] + ":" + p[1]);
  assert.equal(r.tag, "b57ts");
  assert.ok(at(24).includes("spawn:" + id.nc2), "nc2: a network spawn in the arrival tick");
  assert.ok(at(24).includes("move:" + id.nc1) && !at(24).includes("move:" + id.bc1), "nc1 (made at 12) is mid-phase at 24, bc1 (made with the world) is not");
  assert.ok(at(25).includes("moveLook:" + id.bc1), "bc1's entry has run since tick 1: its updates fall on 25, 28, ...");
  assert.deepEqual([27, 28, 29].map((t) => at(t).includes("moveLook:" + id.nc2)), [true, false, false], "nc2's first update is the arrival tick, its next the third after it");
  assert.ok(!r.ticks.flatMap(([, ev]) => ev).some((p) => p[1] === id.ni1), "ni1 died in B before the arrival: no packet reaches the player");
});

test("mutation check: an entry that does not wait three updates breaks the replay", () => {
  assert.ok(replay("dimTick", (m) => { const c = m.create.bind(m); m.create = (...a) => { const en = c(...a); en.entry.ticks = 1; return en; }; }, ALL, fresh("dimTick")).length > 0);
});

// The b56 network-phase spawns (a mob, an item, an arrow made between ticks) in the player's own world: every packet kind, not only spawns and destroys, equals the record. The spawn
// is not early by an update: it goes out in the tick the record puts it in, and the copy's first moves follow on the entry's own updates.
for (const name of ["mobSpawn", "mobSpawnLast", "earlySpawn", "earlySpawnLast"]) test(`${name}: every packet kind of the port's walk equals the record`, () => {
  assert.deepEqual(replay(name).slice(0, 3), []);
});
