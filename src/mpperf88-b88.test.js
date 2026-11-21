// Batch 88 mpperf88: MC_MPPERF88 off / on / verify give the same mobs, packets and tracker results with fewer allocations per server tick.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fast88, mobShape88, MOB_NUMBER_FIELDS, arrowNear88, releaseWatcher88, targetStore88, mobTargetAt88 } from "./mpperf88-fast.js";
import { fast87, EntryStamps, mobTargetAt } from "./mpperf87-fast.js";
import { EntityWorld } from "./entities.js";
import { mobTargets } from "./projectiles.js";
import { SharedEntry } from "./multiplayer/server-mob-entries.js";
import { ServerHanging } from "./multiplayer/server-hanging.js";
import { buildPlayersScene, lcg } from "./mpperf77-scene.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const withMode = (mode, fn) => { const was = fast88.mode; fast88.mode = mode; try { return fn(); } finally { fast88.mode = was; } };
const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k, i) => k === Object.keys(b)[i] && Object.is(a[k], b[k]));

test("mobShape88: the keys, their order and every value (-0, NaN, non-numbers) stay; off hands the object back untouched", () => {
  const make = () => ({ id: "m", x: -0, y: NaN, z: 1.5, vx: Infinity, type: "pig", health: 10, yaw: undefined, fallDistance: "odd", limbSwing: null, extra: 3 });
  for (const mode of ["on", "verify", "off"]) withMode(mode, () => {
    const ref = make(), e = make();
    assert.equal(mobShape88(e), e);
    assert.ok(same(e, ref), mode);
    assert.ok(!("vy" in e) && !("rotationPitch" in e)); // a missing field is not added
  });
  assert.ok(MOB_NUMBER_FIELDS.includes("x") && Object.isFrozen(MOB_NUMBER_FIELDS));
});

test("EntityWorld.create: the same keys and values off / on / verify for every mob type", () => {
  const types = ["pig", "cow", "sheep", "chicken", "zombie", "skeleton", "creeper", "spider", "villager", "slime", "enderman", "wolf", "ocelot", "horse", "pigman", "ghast", "blaze", "magma_cube", "squid", "bat"];
  const made = (mode) => withMode(mode, () => {
    const w = new EntityWorld({ size: 128, height: 256 }, [], lcg(88));
    return types.map((t, k) => w.create(t, 10 + k * 0.25, 64, -0));
  });
  const off = made("off");
  for (const mode of ["on", "verify"]) {
    const got = made(mode);
    got.forEach((e, k) => {
      const a = { ...e, uuid: null }, b = { ...off[k], uuid: null }; // newUuid is not seeded by the world's random
      assert.deepEqual(Object.keys(a), Object.keys(b), types[k]);
      assert.ok(same(a, b) || JSON.stringify(a) === JSON.stringify(b), types[k]);
      assert.ok(Object.is(e.z, -0));
    });
  }
});

test("arrowNear88: the targets the for-of filter keeps, in list order (a dragon part's reach too)", () => {
  const r = lcg(8801), overlap = (b, a) => b[0] < a[3] && b[3] > a[0] && b[1] < a[4] && b[4] > a[1] && b[2] < a[5] && b[5] > a[2];
  for (let round = 0; round < 200; round++) {
    const asked = [], list = Array.from({ length: 30 }, (_, k) => { const x = r() * 10, y = r() * 4, z = r() * 10; return { k, box: [x, y, z, x + 1, y + 2, z + 1], ...(k % 5 === 0 ? { reach: (a) => (asked.push(k), (k + Math.floor(a[0])) % 2 === 0) } : {}) }; });
    const x = r() * 9, y = r() * 3, z = r() * 9, area = [x, y, z, x + 2, y + 2, z + 2];
    const ref = []; for (const t of list) { if (!overlap(t.box, area)) continue; if (t.reach && !t.reach(area)) continue; ref.push(t); }
    const refAsked = asked.splice(0);
    assert.deepEqual(arrowNear88(list, area, overlap, []), ref);
    assert.deepEqual(asked, refAsked); // reach is asked for the same parts in the same order
  }
});

test("releaseWatcher88: stale slots and a snapshot naming the watcher are cleared; live stamps and destinations stay", () => {
  for (const mode of ["on", "verify"]) withMode(mode, () => {
    const w1 = { id: 1 }, w2 = { id: 2 }, d12 = [w1, w2], d2 = [w2];
    // an entry whose packet list was emptied by track(): every slot is stale
    const a = { packets: [], stamps: new EntryStamps(), snap: d12 };
    const p1 = { k: 1 }, p2 = { k: 2 };
    a.packets.push(p1); a.stamps.put(a.packets, p1, 5, d12); a.packets.push(p2); a.stamps.put(a.packets, p2, 6, d12);
    a.packets.length = 0;
    // an entry with live packets and a stale slot behind them
    const b = { packets: [], stamps: new EntryStamps(), snap: d2 };
    const q1 = { k: 3 }, q2 = { k: 4 }, q3 = { k: 5 };
    b.packets.push(q1); b.stamps.put(b.packets, q1, 7, d12); b.packets.push(q2); b.stamps.put(b.packets, q2, 8, d2);
    b.packets.splice(0, 1); b.packets.push(q3); b.stamps.put(b.packets, q3, 9, d2); // q1 left the list but kept its slot
    const c = { packets: [], stamps: null, snap: undefined }; // an entry that never emitted with the flag on
    const entries = new Map([["a", { entry: a }], ["b", { entry: b }], ["c", { entry: c }]]);
    releaseWatcher88(entries, w1);
    assert.equal(a.stamps.n, 0); assert.ok(a.stamps.pk.every((p) => p === undefined) && a.stamps.dest.every((d) => d === undefined));
    assert.equal(a.snap, undefined);
    assert.equal(b.stamps.n, 2); assert.deepEqual([b.stamps.seqOf(q2), b.stamps.seqOf(q3), b.stamps.seqOf(q1)], [8, 9, 0]);
    assert.equal(b.stamps.destOf(q2), d2); assert.equal(b.stamps.pk[2], undefined); assert.equal(b.stamps.dest[2], undefined);
    assert.equal(b.snap, d2); // a snapshot without the watcher stays
    assert.equal(c.stamps, null);
    // the stamps go on working after the release
    b.packets.push(q1); b.stamps.put(b.packets, q1, 10, d2);
    assert.deepEqual([b.stamps.seqOf(q1), b.stamps.n], [10, 3]);
  });
  withMode("off", () => {
    const s = new EntryStamps(), en = { packets: [], stamps: s, snap: [1] }, p = { k: 1 };
    en.packets.push(p); s.put(en.packets, p, 3, [1]); en.packets.length = 0;
    releaseWatcher88(new Map([["x", { entry: en }]]), 1);
    assert.equal(s.n, 1); assert.equal(s.pk[0], p); assert.deepEqual(en.snap, [1]);
  });
});

test("SharedEntry after a release: destinations() makes a fresh snapshot with the same members", () => {
  withMode("on", () => {
    const e = { type: "pig", x: 1, y: 2, z: 3, rotationYaw: 0, rotationPitch: 0, health: 10 }, owner = { watchers: new Map() };
    const en = new SharedEntry(e, { range: 80 }, { log: null }, owner), w1 = { id: 1 }, w2 = { id: 2 };
    en.set.add(w1); en.set.add(w2);
    const p1 = { type: "move" }; en.emit(p1);
    en.set.delete(w1);
    releaseWatcher88(new Map([[e, { entry: en }]]), w1);
    assert.deepEqual(en.destOf(p1), [w1, w2]); // a packet still in the list keeps the destinations it was emitted with
    en.packets.length = 0; const p2 = { type: "move" }; en.emit(p2);
    assert.deepEqual(en.destOf(p2), [w2]);
  });
});

test("mobTargetAt88: the mpperf87 records; kept while the mob stays, replaced once marked; grows past 64 mobs; -0 is a move", () => {
  const was87 = fast87.mode; fast87.mode = "on";
  try {
    const r = lcg(8802), t = { width: 0.9, height: 1.3 };
    const mobs = Array.from({ length: 150 }, (_, k) => ({ x: r() * 40, y: r() * 4, z: r() * 40, growingAge: k % 3 ? 0 : -1 }));
    for (const mode of ["on", "verify"]) withMode(mode, () => {
      const st = {}, st87 = [], s = targetStore88(st);
      assert.equal(targetStore88(st), s);
      const a = mobs.map((e, i) => mobTargetAt88(s, i, e, t, e.growingAge < 0)), ref = mobs.map((e, i) => mobTargetAt(st87, i, e, t, e.growingAge < 0));
      a.forEach((rec, i) => { assert.deepEqual(Object.keys(rec), ["ref", "box"]); assert.equal(rec.ref, mobs[i]); assert.ok(rec.box.every((v, j) => Object.is(v, ref[i].box[j]))); });
      assert.ok(s.num.length >= 150 * 5);
      const b = mobs.map((e, i) => mobTargetAt88(s, i, e, t, e.growingAge < 0));
      assert.ok(b.every((rec, i) => rec === a[i]));
      b[4].thrower = true;
      const c4 = mobTargetAt88(s, 4, mobs[4], t, false);
      assert.notEqual(c4, b[4]); assert.equal(c4.box, b[4].box); assert.equal(c4.thrower, undefined);
      const m = { x: 0, y: 1, z: 2 }, z0 = mobTargetAt88(s, 200, m, t, false);
      m.x = -0;
      const z1 = mobTargetAt88(s, 200, m, t, false);
      assert.notEqual(z1, z0); assert.notEqual(z1.box, z0.box); assert.deepEqual(z1.box, z0.box); // Object.is(0, -0) is false: a fresh box with equal numbers
      const other = { ...mobs[0] }, o = mobTargetAt88(s, 0, other, t, mobs[0].growingAge < 0); // another mob at the same index
      assert.equal(o.ref, other); assert.notEqual(o, b[0]);
    });
    const list = mobs.map((e, k) => ({ ...e, type: ["pig", "cow", "zombie", "slime"][k % 4], size: 2, health: 10 }));
    const flat = (l) => l.map((x) => [x.ref, ...x.box]);
    const off = withMode("off", () => flat(mobTargets(list, null)));
    for (const mode of ["on", "verify"]) withMode(mode, () => { assert.deepEqual(flat(mobTargets(list.slice(), null)), off); });
  } finally { fast87.mode = was87; }
});

test("ServerHanging.track: the same hset / hdel deltas off / on / verify (players come, go, move out of range and change dimension)", () => {
  const run = (mode) => withMode(mode, () => {
    let n = 1000; const ids = { take: () => n++ };
    const knots = [{ x: 3, y: 5, z: 3 }, { summoned: true, px: 40.25, py: 6, pz: -12.5 }];
    const sh = new ServerHanging({ mobs: { mobs: { knotList: knots } }, rules: null }, ids);
    for (let k = 0; k < 12; k++) sh.h.entities.push({ id: 10 + k, kind: k % 3 ? "painting" : "frame", dir: k % 4, art: k % 5, tx: k * 9, ty: 5, tz: -k * 7, x: k * 9 + 0.5, z: -k * 7 + 0.5, item: k % 2 ? { id: 1, count: 1 } : null, rotation: k % 8 });
    const players = new Map([1, 2, 3].map((id) => [id, { id, position: { x: id * 30, y: 5, z: 0 } }]));
    for (const p of players.values()) sh.addPlayer(p);
    const out = [];
    for (let tick = 0; tick < 40; tick++) {
      if (tick === 5) sh.h.entities[3].dead = true;
      if (tick === 9) sh.h.entities[5].art = (sh.h.entities[5].art + 1) % 5;
      if (tick === 12) { sh.addPlayer({ id: 4 }); players.set(4, { id: 4, position: { x: 0, y: 5, z: 0 } }); }
      if (tick === 20) { sh.removePlayer({ id: 2 }); players.delete(2); }
      if (tick === 25) knots.pop();
      for (const p of players.values()) p.position.x += 7;
      const away = tick % 7 === 3 ? 3 : -1; // a player of another dimension this tick
      out.push([...sh.track((id) => (id === away ? null : players.get(id)))]);
    }
    return JSON.stringify(out);
  });
  const off = run("off");
  assert.ok(off.includes("hdel") && off.includes("hset"));
  assert.equal(run("on"), off);
  assert.equal(run("verify"), off);
});

// A seeded multiplayer scene with moving players, one of whom leaves: every packet each player is sent (chunk view, mobs, vehicles and hanging, dispense lanes). The
// players are moved by hand (the server takes positions from the client) and the view is 3 chunks, so columns load and unload; Math.random is seeded as in the benches.
function sceneHash(mode) {
  const real = Math.random, rs = lcg(12345); Math.random = () => rs();
  try {
    return withMode(mode, () => {
      const s = buildPlayersScene({ players: 4, mobs: 120, seed: 88, size: 120 }), h = createHash("sha256"), r = lcg(881);
      Object.defineProperty(s.chunkViews, "radius", { value: 3 }); s.chunkViews.watches.clear(); // the views restart at the next tick (the client holds every column)
      let unloads = 0;
      for (let tick = 0; tick < 60; tick++) {
        if (tick % 10 === 0) for (const id of s.players.keys()) s.input(id, { type: "input", controls: { ...IDLE_INPUT, forward: r() < 0.7 ? 1 : 0 }, yaw: r() * 6, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
        if (tick === 30) s.removePlayer("p1");
        for (const p of s.players.values()) { const k = +p.id.slice(1); p.position.x = Math.min(115, Math.max(5, p.position.x + 2.5 * Math.cos(tick / 9 + k))); p.position.z = Math.min(115, Math.max(5, p.position.z + 2.5 * Math.sin(tick / 7 + k))); }
        s.tick();
        for (const [id, p] of s.players) {
          if (p.chunkOut?.some((m) => m.type === "chunkUnload")) unloads++;
          h.update(JSON.stringify([tick, id, p.chunkOut ?? null, p.mobPackets ?? null, p.vehPackets ?? null, p.dispOut ?? null, p.position.x, p.position.z]));
          p.chunkOut = null; p.mobPackets = null; p.vehPackets = null; p.dispOut = null; p.dimOut = null;
        }
      }
      assert.ok(unloads > 5 && !s.players.has("p1"));
      return h.digest("hex");
    });
  } finally { Math.random = real; }
}

test("a seeded scene with moving players and a departure sends the same packets off / on / verify", () => {
  const off = sceneHash("off");
  assert.equal(sceneHash("on"), off);
  assert.equal(sceneHash("verify"), off);
});

test("seeded server scenes hash the same off / on / verify (MC_MPPERF83..88 all verify)", () => {
  const verifyAll = { MC_MPPERF83: "verify", MC_MPPERF84: "verify", MC_MPPERF85: "verify", MC_MPPERF86: "verify", MC_MPPERF87: "verify" };
  for (const scene of ["pen", "terrain"]) {
    const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=60"], { env: { ...process.env, MC_MPPERF88: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim();
    const off = hash("off");
    assert.match(off, /mode88=off mobs=\d+ \[/);
    const tail = (s) => s.split("mobs=").pop();
    assert.equal(tail(hash("on")), tail(off));
    assert.equal(tail(hash("verify")), tail(off));
  }
});
