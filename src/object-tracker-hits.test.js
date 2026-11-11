// Batch 44: the client copies of arrows, thrown entities, firework rockets and fishing hooks do their own onUpdate (the tracker only moves and ends
// them with S12/S18/S13/S1A), replayed against the executed 1.7.10 classes (tools/probes/TrackerHitsProbe.java,
// public/research/tracker-hits-reference.json): the unchanged EntityTrackerEntry tracking a real server entity, the real class as the client entity
// ticked with its own onUpdate on a client world that records every spawnParticle and makeFireworks call, its Entity.rand seeded with Random(12345).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS, nativeStack, objectView } from "./object-tracker.js";
import { makeRocket } from "./fireworks.js";
import { WATER } from "./world.js";
import { fromOriginal } from "./block-registry.js";
const STONE = fromOriginal(1, 0).id; // the probe's floor is native stone (aji.e(1))

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-hits-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { snowballImpact: "snowball", eggImpact: "egg", pearlImpact: "enderPearl", potionImpact: "potion", arrowStick: "arrow", arrowCritTrail: "arrow", arrowWater: "arrow", rocketSparks: "firework", hookFloor: "fishHook", hookWater: "fishHook",
  arrow_cow: "arrow", arrow_cowCrit: "arrow", arrow_enderman: "arrow", arrow_player: "arrow", arrow_playerCreative: "arrow", snowballMob: "snowball", pearlMob: "enderPearl", hookNoCow: "fishHook", hookCow: "fishHook" };
// the client entities the probe lists in its client world: a cow or an enderman at (6.5, 0, 2.5), the client player (0.6 x 1.8 at 0.5, 0, 0.5), a cow beside the hook's path
const box = (x, y, z, w, h) => [x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2];
const mob = (type, x, y, z, w, h) => ({ ref: { type, x, y, z }, box: box(x, y, z, w, h) });
const TARGETS = {
  arrow_cow: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], arrow_cowCrit: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], arrow_enderman: () => [mob("enderman", 6.5, 0, 2.5, 0.6, 2.9)],
  arrow_player: () => [{ ref: "player", box: box(0.5, 0, 0.5, 0.6, 1.8), immune: false }], arrow_playerCreative: () => [{ ref: "player", box: box(0.5, 0, 0.5, 0.6, 1.8), immune: true }],
  snowballMob: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], pearlMob: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], hookCow: () => [mob("cow", 0.375, 0, 4, 0.9, 1.3)],
};
const WET = new Set(["arrowWater", "hookWater"]);
const world = (wet) => {
  const water = (x, y, z) => wet && x >= 0 && x < 24 && z >= 3 && z < 24 && y >= 0 && y <= 1;
  return { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? STONE : water(x, y, z) ? WATER : 0), getMeta: () => 0, surface: () => 0, brightnessLevel: 15 };
};
const fmtValue = (v) => { if (v && typeof v === "object") { const n = nativeStack(v); return `I:${n.id}:${n.count}:${n.damage}${v.fireworks ? ":tag" : ""}`; } return v; };
function expectedPackets(list) {
  const out = [];
  for (const p of list) {
    if (p[0] === "S0E") out.push(["spawn", p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10]]);
    else if (p[0] === "S1C") out.push(["meta", p[1], p[2]]);
    else if (p[0] === "S12") out.push(["velocity", p[1], p[2], p[3]]);
    else if (p[0] === "S15") out.push(["move", p[1], p[2], p[3]]);
    else if (p[0] === "S17") out.push(["moveLook", p[1], p[2], p[3], p[4], p[5]]);
    else if (p[0] === "S16") out.push(["look", p[1], p[2]]);
    else if (p[0] === "S18") out.push(["teleport", p[1], p[2], p[3], p[4], p[5]]);
    else if (p[0] === "S1A") out.push(["status", p[1], p[2]]);
  }
  return out;
}
const flat = (p) => p.type === "spawn" ? ["spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz, p.pitch, p.yaw, OBJECT_KINDS[p.kind].type, p.data]
  : p.type === "meta" ? ["meta", p.id, p.list.map(([t, i, v]) => [t, i, fmtValue(v)])]
  : p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : p.type === "move" ? ["move", p.dx, p.dy, p.dz] : p.type === "moveLook" ? ["moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch]
  : p.type === "look" ? ["look", p.yaw, p.pitch] : p.type === "teleport" ? ["teleport", p.x, p.y, p.z, p.yaw, p.pitch] : p.type === "status" ? ["status", p.id, p.status] : null;

function host(name, kind, r, id, next = null) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = r;
  const h = { kind, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch, id };
  if (kind === "arrow") h.crit = (name === "arrowCritTrail" && Math.abs(vx) > 0.5) || (name === "arrow_cowCrit" && !(!next || (next[0] === x && next[1] === y))); // the tick it sticks (the next input is the same place) clears it // EntityArrow.onUpdate clears the flag when it sticks
  if (kind === "potion") h.damage = 16421;
  if (kind === "fishHook") { delete h.mx; delete h.my; delete h.mz; Object.assign(h, { vx, vy, vz }); }
  if (kind === "firework") { h.stack = makeRocket({ flight: 1, explosions: [] }); h.exploded = r[10] === 1; }
  return h;
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const sameParticles = (got, want, what) => {
  assert.equal(got.length, want.length, `${what}: particle count ${JSON.stringify(got.map((p) => p[0]))} vs ${JSON.stringify(want.map((p) => p[0]))}`);
  got.forEach((g, i) => { assert.equal(g[0], want[i][0], `${what} #${i} type`); for (let k = 1; k < 7; k++) { if (String(g[0]).startsWith("sound:") && k >= 4) assert.equal(f(g[k]), f(want[i][k]), `${what} #${i} ${g[0]} field ${k}`); else near(g[k], want[i][k], `${what} #${i} ${g[0]} field ${k}`); } });
};

// Replays one case: returns the mismatching ticks. `tweak(tracker)` mutates the tracker (the mutation checks).
function replay(name, tweak = null) {
  const rec = ref[name], kind = KIND[name];
  assert.equal(OBJECT_KINDS[kind].range, rec.range, name + " range");
  assert.equal(OBJECT_KINDS[kind].frequency, rec.freq, name + " frequency");
  const tracker = new ObjectTracker(10, () => 12345 / 2 ** 48); // the probe's client Entity.rand is Random(12345)
  tracker.hooks.clientTargets = TARGETS[name];
  tweak?.(tracker);
  const player = { x: rec.player[0], y: 0, z: rec.player[1] };
  tracker.ctx.world = world(WET.has(name)); tracker.ctx.player = null;
  const rows = new Map(rec.rows.map((r) => [r[0], expectedPackets(r[1])]));
  let sentLog = [];
  tracker.view.log = (p) => { const x = flat(p); if (x) sentLog.push(x); };
  const bad = [], h = { id: rec.id };
  let gone = false;
  for (let t = 0; t < rec.inputs.length; t++) {
    const inp = rec.inputs[t];
    if (inp[10] === 1) gone = true;
    Object.assign(h, host(name, kind, inp, h.id, rec.inputs[t + 1]));
    sentLog = []; tracker.log = [];
    tracker.serverTick(gone ? {} : { [kind]: [h] }, player);
    const sent = sentLog;
    tracker.clientTick();
    const events = tracker.drainEvents();
    const en = tracker.entries.get(h) ?? tracker.dying[0];
    const c = en?.client, want = rec.client[t];
    try {
      assert.deepEqual(sent, rows.get(t) ?? [], "packets");
      assert.equal(!!c?.present, want[0] === 1, "present");
      if (want[0] === 1) {
        const got = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.px, c.py, c.pz];
        want.slice(1, 10).forEach((v, i) => near(got[i], v, `field ${i}`));
        assert.equal(c.onGround ? 1 : 0, want[10], "onGround");
        assert.equal(f(c.yaw), f(want[11]), "yaw");
        assert.equal(f(c.pitch), f(want[12]), "pitch");
        if (kind === "arrow") { const v = objectView(tracker, h, kind); assert.equal(v.inGround, want[13], "inGround"); assert.equal(v.shake, want[14], "arrowShake"); }
      }
      // the particles of this client tick (a makeFireworks call comes from the S1A handled before the tick)
      const wantLog = rec.log[t].filter((p) => p[0] !== "makeFireworks"), wantFw = rec.log[t].filter((p) => p[0] === "makeFireworks");
      sameParticles(tracker.log, wantLog, "particles");
      assert.equal(events.length, wantFw.length, "makeFireworks calls");
      events.forEach((e, i) => {
        const w = wantFw[i], q = e.firework;
        [q.x, q.y, q.z, q.vx, q.vy, q.vz].forEach((v, k) => near(v, w[1 + k], "makeFireworks " + k));
        assert.equal(w[7], "{Flight:1b,}", "the probe's tag");
        assert.equal(q.fireworks?.flight, 1, "the rocket's Fireworks tag reaches makeFireworks");
      });
    } catch (e) { if (process.env.DBG) console.log(name, t, e.message.split("\n")[0], JSON.stringify(tracker.log)); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
  }
  return bad;
}

for (const name of Object.keys(KIND)) test(`${name}: packets, the client entity and every spawnParticle call each tick match the executed classes`, () => {
  assert.deepEqual(replay(name), []);
});

test("the impacts the client runs itself: snowball and egg poof 8 times a tick, the pearl portals 32 times, a potion does nothing (bytecode-executed)", () => {
  const n = (name) => ref[name].log.map((l) => l.length);
  for (const name of ["snowballImpact", "eggImpact"]) assert.ok(ref[name].log.some((l) => l.length === 8 && l.every((p) => p[0] === "snowballpoof")), name);
  assert.ok(ref.pearlImpact.log.some((l) => l.length === 32 && l.every((p) => p[0] === "portal")));
  assert.ok(n("potionImpact").every((k) => k === 0));
});

test("mutation check: client rocket sparks that are dropped, or impacts that stay server-only, are caught", () => {
  assert.ok(replay("rocketSparks", (tr) => { tr.particle = () => {}; }).length > 0);
  assert.ok(replay("snowballImpact", (tr) => { tr.sims.balls.clientImpact = () => {}; }).length > 0);
});
test("mutation check: a client arrow that never sticks (inGround/shake) is caught", () => {
  assert.ok(replay("arrowStick", (tr) => { const orig = tr.newSim.bind(tr); tr.newSim = (c) => { const s = orig(c); Object.defineProperty(s, "inGround", { get: () => false, set() {} }); return s; }; }).length > 0);
});

test("client hits (executed): an arrow and a hook search the client world's entities, a thrown entity does not, and attackEntityFrom answers false", () => {
  const calls = (name) => ref[name].log.flat().filter((p) => String(p[0]).startsWith("call:attackEntityFrom"));
  assert.deepEqual(calls("arrow_cow").map((p) => [p[0], p[4], p[5]]), [["call:attackEntityFrom:cow", 4, 0]]);
  assert.deepEqual(calls("arrow_cowCrit").map((p) => [p[0], p[4], p[5]]), [["call:attackEntityFrom:cow", 5, 0]]); // the crit's nextInt draw is part of the damage
  assert.deepEqual(calls("arrow_enderman").map((p) => p[0]), ["call:attackEntityFrom:enderman"]);
  assert.deepEqual(calls("hookCow").map((p) => [p[4], p[5]]), [[0, 0], [0, 0]]);
  for (const name of ["snowballMob", "pearlMob", "hookNoCow"]) assert.equal(calls(name).length, 0, name);
  // the creative client player is not hit at all: the arrow flies on through it
  assert.ok(ref.arrow_playerCreative.client[6][1] < 0.5 && ref.arrow_player.client[6][1] > 1);
});
test("mutation check: a client arrow that skips the entity search, or a hook that does not search, is caught", () => {
  assert.ok(replay("arrow_cow", (tr) => { tr.hooks.clientTargets = () => []; }).length > 0);
  assert.ok(replay("hookCow", (tr) => { tr.hooks.clientTargets = () => []; }).length > 0);
  assert.ok(replay("arrow_playerCreative", (tr) => { tr.hooks.clientTargets = () => [{ ref: "player", box: [0.2, 0, 0.2, 0.8, 1.8, 0.8], immune: false }]; }).length > 0);
  assert.ok(replay("snowballMob", (tr) => { tr.sims.balls.clientImpact = () => {}; }).length > 0);
});
