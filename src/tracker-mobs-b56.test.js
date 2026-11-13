// Batch 56 (trackermobs). public/research/tracker-joint-reference.json now also holds EXECUTED records (tag b56tm) of the real EntityTracker (mn):
//  - mobSpawn, mobSpawnLast: MOBS spawned by an entity before the player's slot (m1, m2), after it (m3), in the tile entity pass (m4: after the loop) and in the network phase (m5: before the
//    tick's loop), with a thrown item and an arrow from the network phase (n1, n2); every spawn goes out at once, so those before the flush precede the tick's destroys;
//  - horseMeta, horseMetaLast: an EntityHorse whose data watcher 16 (flag bits) changes at scripted ticks; the entry sends the S1C in its own update (S0F carries the list at the spawn).
// The replay runs the port's joint walk over the same scripted entities and compares, tick by tick, (kind, id) of the spawns and destroys the client gets, and the horse's flag values.
// Bytecode-read stand-ins: the World.updateEntities loop, the player's flush, the network phase (TrackerJointProbe).
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
const LIST = { item: "item", arrow: "arrow", snowball: "snowball", orb: "orb", boat: "boat", cart0: "minecart", cart1: "minecart", painting: "painting", frame: "itemFrame" };
const MOB = new Set(["chicken", "horse"]);
const num = (id) => (typeof id === "string" ? Number(/(\d+)$/.exec(id)?.[1] ?? "-1" + id) : id);

function host(spec, id, row, t) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = row;
  switch (spec.kind) {
    case "chicken": return { type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 4, onGround: true };
    case "horse": { const f = spec.flags[Math.min(t, spec.flags.length - 1)]; return { type: "horse", id: "mob-" + id, uuid: "u" + id, x, y, z, rotationYaw: yaw, rotationPitch: pitch, rotationYawHead: yaw, health: 15, onGround: true, horse: { tame: !!(f & 2), saddled: !!(f & 4), chested: !!(f & 8), bred: !!(f & 16), eating: !!(f & 32) }, rearing: !!(f & 64), mouthTicks: f & 128 ? 5 : 0 }; }
    case "item": return { entityId: id, x, y: y - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1, damage: 0 }, onGround: true };
    case "orb": return { id, x, posY: y, z, vx, vy, vz, y: y - 0.25, value: 5 };
    case "boat": case "cart0": case "cart1": return { entityId: id, x, posY: y, z, vx, vy, vz, yaw, pitch, type: spec.kind === "cart1" ? 1 : 0 };
    case "painting": case "frame": return { entityId: id, x: x + 0.5, y, z: z + 0.5, tx: x, ty: y, tz: z, dir: spec.dir, yaw: 0, art: 0 };
    default: return { id, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch };
  }
}

// `tweak(m)` mutates the mob tracker. Returns the mismatching ticks [[tick, got, want]...].
function replay(name, tweak = null) {
  const rec = ref[name];
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  m.beforePlayer = (e) => e.beforeP === true;
  m.spawnEarly = (e) => e.earlyP === true;
  tweak?.(m);
  const playerId = rec.ids2.player;
  m.joinPlayer(playerId);
  const applied = [], who = new Map(), firstRow = new Map();
  for (const t of [m, o]) {
    const c = t.create.bind(t);
    t.create = (...a) => { const en = c(...a); { const fr = firstRow.get(a[0]); if (fr) { const st = en.entry.tryStart.bind(en.entry); en.entry.tryStart = () => { en.entry.tryStart = st; st(); fr(); }; } } const ap = en.client.apply.bind(en.client); en.client.apply = (p, ctx) => { applied.push(p); who.set(p, en.entry.e.id); return ap(p, ctx); }; return en; };
  }
  const specs = Object.entries(rec.inputs).map(([n, v]) => ({ name: n, id: rec.ids2[n], ...v, ...rec.meta[n] }));
  const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
  const hosts = new Map(), bad = [];
  const kinds = new Set(["spawn", "destroy"]);
  const flagsOf = (p) => { const w = p.slice(2).find((x) => Array.isArray(x) && x[0] === 16); return w ? w[1] : null; };
  const wantOf = (k) => (k === 0 ? [...rec.setup.flat(), ...rec.ticks[0][1]] : rec.ticks[k][1]).flatMap((p) => {
    if (kinds.has(p[0])) { const f = p[0] === "spawn" ? flagsOf(p) : null; return [p[0] + ":" + p[1], ...(f === null ? [] : ["flags:" + p[1] + ":" + f])]; }
    return p[0] === "meta" && p.length === 3 && p[2][0] === 16 ? ["flags:" + p[1] + ":" + p[2][1]] : [];
  });
  const gotOf = () => applied.flatMap((p) => {
    const id = num(who.get(p));
    if (p.type === "spawn" || p.type === "destroy") return [p.type + ":" + id, ...(p.horseFlags !== undefined ? ["flags:" + id + ":" + p.horseFlags] : [])];
    return p.type === "meta" && p.horseFlags !== undefined ? ["flags:" + id + ":" + p.horseFlags] : [];
  });
  for (let k = 0; k < rec.ticks.length; k++) {
    const tk = k + 1, live = [], lists = {};
    for (const s of specs) {
      if (s.born > tk || (s.dies >= 0 && tk >= s.dies)) continue;
      let h = hosts.get(s.name);
      const initial = s.born === 0;
      if (!h) {
        h = host(s, s.id, s.rows[initial ? k : k + 1], initial ? k : k + 1);
        h.beforeP = initial && s.id < playerId;
        h.earlyP = !!s.net || (!!s.by && byName[s.by] && hosts.get(s.by)?.beforeP === true);
        hosts.set(s.name, h);
        if (initial) firstRow.set(h, () => { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1], k + 1), { beforeP: b, earlyP: e }); });
      } else { const b = h.beforeP, e = h.earlyP; Object.assign(h, host(s, s.id, s.rows[k + 1], k + 1), { beforeP: b, earlyP: e }); }
      if (MOB.has(s.kind)) live.push(h); else (lists[LIST[s.kind]] ??= []).push(h);
    }
    applied.length = 0;
    m.update(live, player, () => [0.3, 0.7], null, { tracker: o, lists, world: grass });
    const got = gotOf(), want = wantOf(k);
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push([tk, got, want]);
  }
  return bad;
}

for (const name of ["mobSpawn", "mobSpawnLast", "horseMeta", "horseMetaLast"]) test(`${name}: spawn, destroy and horse flag packets equal the real EntityTracker's`, () => {
  assert.deepEqual(replay(name).slice(0, 3), []);
});

test("the b56tm record: a mob spawned before the player's slot or in the network phase precedes the flush, one after the slot or in the tile pass follows it", () => {
  const rec = ref.mobSpawn, id = rec.ids2;
  assert.equal(rec.tag, "b56tm");
  const at = (t) => rec.ticks.find(([k]) => k === t)[1].filter((p) => p[0] === "spawn" || p[0] === "destroy").map((p) => p[0][0] + p[1]);
  assert.deepEqual(at(31), ["s" + id.m1, "d" + id.a1], "by c1, before the player");
  assert.deepEqual(at(34).slice(0, 2), ["s" + id.n1, "s" + id.m2], "the network item, then the mob spawned by c2");
  assert.ok(at(34).indexOf("d" + id.i1) > 1, "i1's destroy follows both");
  assert.deepEqual(at(38), ["s" + id.n2, "d" + id.s1, "s" + id.m3], "the network arrow first; by c4 (after the player): the flush, then the spawn");
  assert.deepEqual(at(41), ["d" + id.c3, "s" + id.m4], "the tile pass: after the flush");
  assert.equal(at(47)[0], "s" + id.m5, "the network phase: first in the tick");
});

test("the b56tm record: a horse flag change is an S1C of the tick it changed in; the spawn carries the list", () => {
  const rec = ref.horseMeta, h1 = rec.ids2.h1, h2 = rec.ids2.h2;
  const metas = (t) => rec.ticks.find(([k]) => k === t)[1].filter((p) => p[0] === "meta" && p.length === 3).map((p) => p[1] + ":" + p[2][1]);
  assert.deepEqual(metas(6), [h1 + ":2"]);
  assert.deepEqual(metas(9), [h1 + ":6"]);
  assert.deepEqual(metas(7), []);
  assert.deepEqual(metas(26), [h1 + ":70", h2 + ":6"], "mixed: rearing on h1 while h2 (spawned at 20 with 6) is already 70 at 24");
});

// EntityWorld: the early / late marks
function world() {
  const w = Object.create(EntityWorld.prototype);
  w.ids = new EntityIds(10); w.orderSeqs = new WeakMap(); w.entities = [];
  const a = { id: "a" }, b = { id: "b" };
  w.entities = [a, b];
  w.walks = new Map([["item", { list: () => [] }]]);
  w.playerJoined();
  w.orderSeqs.set(a, 1); w.orderSeqs.set(b, w.orderSeqs.get(w.playerKey) + 1);
  return { w, a, b };
}

test("EntityWorld: an object spawned in the update of an entity before the player's slot or in the network phase is early; after the slot or in the tile pass it is not", () => {
  const { w, a, b } = world();
  const spawn = (slot, tile = false) => { const e = { entityId: undefined }; w.tilePass = tile; if (slot) { w.tickOrder = []; w.slot = slot; } else { w.tickOrder = null; w.slot = null; } w.joined(e, "item"); w.tickOrder = null; w.tilePass = false; return w.earlySpawns?.has(e) === true; };
  assert.equal(spawn(a), true);
  assert.equal(spawn(b), false);
  assert.equal(spawn(null), true, "the network phase");
  assert.equal(spawn(null, true), false, "the tile entity pass");
  const fresh = world().w; fresh.playerStamp = undefined;
  const e = {}; fresh.joined(e, "item");
  assert.equal(fresh.earlySpawns?.has(e) === true, false, "no player yet: the world's opening population");
});

test("EntityWorld: a mob that appears in the list is marked by where it appeared", () => {
  const { w, a, b } = world();
  w.noteMobSpawns(false);
  const mark = (slot, early) => { const e = { id: "m" + Math.random() }; w.entities.push(e); w.slot = slot; w.noteMobSpawns(early === undefined ? !!slot && w.beforePlayer(slot) : early); w.slot = null; return w.earlySpawns?.has(e) === true; };
  assert.equal(mark(a), true, "a baby bred by an entity before the player");
  assert.equal(mark(b), false, "a reinforcement made after the player's slot");
  assert.equal(mark(null, true), true, "natural spawning before the loop / the network phase");
  assert.equal(mark(null, false), false, "the tile entity pass");
});

test("mutation check: without the early rule the mob replay differs; without the flag S1C and spawn list the horse replay differs", () => {
  assert.ok(replay("mobSpawn", (m) => { m.spawnEarly = null; }).length > 0);
  assert.ok(replay("horseMeta", (m) => { const c = m.create.bind(m); m.create = (...a) => { const en = c(...a); const s = en.entry.send.bind(en.entry); en.entry.send = (p) => (p.type === "meta" && p.horseFlags !== undefined ? undefined : s(p)); return en; }; }).length > 0);
});

test("main.js reports the tile entity pass: the spawner pass marks its mobs late, the network part of the hook ends the tile pass", async () => {
  const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /serverDigTicked = true;\s*mobs\?\.endTilePass\?\.\(\)/);
  assert.match(main, /mobs\.noteMobSpawns\?\.\(false\);[^\n]*\n\s*if \(spawned\.length\)/);
});
