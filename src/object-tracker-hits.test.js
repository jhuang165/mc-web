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

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-hits-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { snowballImpact: "snowball", eggImpact: "egg", pearlImpact: "enderPearl", potionImpact: "potion", arrowStick: "arrow", arrowCritTrail: "arrow", arrowWater: "arrow", rocketSparks: "firework", hookFloor: "fishHook", hookWater: "fishHook" };
const WET = new Set(["arrowWater", "hookWater"]);
const world = (wet) => {
  const water = (x, y, z) => wet && x >= 0 && x < 24 && z >= 3 && z < 24 && y >= 0 && y <= 1;
  return { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : water(x, y, z) ? WATER : 0), getMeta: () => 0, surface: () => 0, brightnessLevel: 15 };
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

function host(name, kind, r, id) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = r;
  const h = { kind, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch, id };
  if (kind === "arrow") h.crit = name === "arrowCritTrail" && Math.abs(vx) > 0.5; // EntityArrow.onUpdate clears the flag when it sticks
  if (kind === "potion") h.damage = 16421;
  if (kind === "fishHook") { delete h.mx; delete h.my; delete h.mz; Object.assign(h, { vx, vy, vz }); }
  if (kind === "firework") { h.stack = makeRocket({ flight: 1, explosions: [] }); h.exploded = r[10] === 1; }
  return h;
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const sameParticles = (got, want, what) => {
  assert.equal(got.length, want.length, `${what}: particle count ${JSON.stringify(got.map((p) => p[0]))} vs ${JSON.stringify(want.map((p) => p[0]))}`);
  got.forEach((g, i) => { assert.equal(g[0], want[i][0], `${what} #${i} type`); for (let k = 1; k < 7; k++) near(g[k], want[i][k], `${what} #${i} ${g[0]} field ${k}`); });
};

// Replays one case: returns the mismatching ticks. `tweak(tracker)` mutates the tracker (the mutation checks).
function replay(name, tweak = null) {
  const rec = ref[name], kind = KIND[name];
  assert.equal(OBJECT_KINDS[kind].range, rec.range, name + " range");
  assert.equal(OBJECT_KINDS[kind].frequency, rec.freq, name + " frequency");
  const tracker = new ObjectTracker(10, () => 12345 / 2 ** 48); // the probe's client Entity.rand is Random(12345)
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
    Object.assign(h, host(name, kind, inp, h.id));
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
    } catch (e) { if (process.env.DBG) console.log(name, t, e.message.split("\n")[0]); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
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
