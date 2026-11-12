// Batch 44: the client copies of arrows, thrown entities, firework rockets and fishing hooks do their own onUpdate (the tracker only moves and ends
// them with S12/S18/S13/S1A), replayed against the executed 1.7.10 classes (tools/probes/TrackerHitsProbe.java,
// public/research/tracker-hits-reference.json): the unchanged EntityTrackerEntry tracking a real server entity, the real class as the client entity
// ticked with its own onUpdate on a client world that records every spawnParticle and makeFireworks call, its Entity.rand seeded with Random(12345).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS, nativeStack, objectView } from "./object-tracker.js";
import { makeRocket } from "./fireworks.js";
import { Arrows } from "./bow.js";
import { MobTracker } from "./entity-tracker.js";
import { WATER } from "./world.js";
import { fromOriginal } from "./block-registry.js";
const STONE = fromOriginal(1, 0).id; // the probe's floor is native stone (aji.e(1))

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-hits-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { snowballImpact: "snowball", eggImpact: "egg", pearlImpact: "enderPearl", potionImpact: "potion", arrowStick: "arrow", arrowCritTrail: "arrow", arrowWater: "arrow", rocketSparks: "firework", hookFloor: "fishHook", hookWater: "fishHook",
  arrow_cow: "arrow", arrow_cowCrit: "arrow", arrow_enderman: "arrow", arrow_player: "arrow", arrow_playerCreative: "arrow", snowballMob: "snowball", pearlMob: "enderPearl", hookNoCow: "fishHook", hookCow: "fishHook",
  // Batch 46: the other client-world collidables and burning arrows
  arrow_boat: "arrow", arrow_minecart: "arrow", arrow_painting: "arrow", arrow_itemFrame: "arrow", arrow_leashKnot: "arrow", arrow_dragonPart: "arrow",
  arrowFire_cow: "arrow", arrowFire_enderman: "arrow", arrowFire_boat: "arrow", hook_boat: "fishHook", hook_dragonPart: "fishHook" };
// the client entities the probe lists in its client world: a cow or an enderman at (6.5, 0, 2.5), the client player (0.6 x 1.8 at 0.5, 0, 0.5), a cow beside the hook's path
const box = (x, y, z, w, h) => [x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2];
const mob = (type, x, y, z, w, h) => ({ ref: { type, x, y, z }, box: box(x, y, z, w, h) });
const TARGETS = {
  arrow_cow: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], arrow_cowCrit: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], arrow_enderman: () => [mob("enderman", 6.5, 0, 2.5, 0.6, 2.9)],
  arrow_player: () => [{ ref: "player", box: box(0.5, 0, 0.5, 0.6, 1.8), immune: false }], arrow_playerCreative: () => [{ ref: "player", box: box(0.5, 0, 0.5, 0.6, 1.8), immune: true }],
  snowballMob: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], pearlMob: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], hookCow: () => [mob("cow", 0.375, 0, 4, 0.9, 1.3)],
};
// Batch 46: the boxes of the real boat, cart, painting, frame, knot and dragon part come from the probe's own `listed:` rows (the executed classes' bounding boxes). The call rows
// carry the entity position: the box centre, except the knot's (tile + 0.5, as main.js lists it) and the dragon part (the dragon's new target, random draws not modelled).
const listedOf = (name) => Object.fromEntries(ref[name].log[0].filter((r) => String(r[0]).startsWith("listed:")).map((r) => [r[0].slice(7), r.slice(1, 7)]));
const centre = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
function other(kind, name, answers = true) {
  const b = listedOf(name)[kind], [x, y, z] = centre(b), pos = kind === "leashKnot" ? [x, b[1], z] : [x, y, z];
  return { ref: { type: kind, x: pos[0], y: pos[1], z: pos[2] }, kind, box: b, answers };
}
const dragonParts = (name) => { const d = { type: "ender_dragon", x: 0, y: 0, z: 0 }; const b = listedOf(name).dragonPart; return [{ ref: d, kind: "dragonPart", box: b, answers: true, reach: () => true }]; };
Object.assign(TARGETS, {
  arrow_boat: () => [other("boat", "arrow_boat")], arrow_minecart: () => [other("minecart", "arrow_minecart")], arrow_painting: () => [other("painting", "arrow_painting")],
  arrow_itemFrame: () => [other("itemFrame", "arrow_itemFrame")], arrow_leashKnot: () => [other("leashKnot", "arrow_leashKnot")], arrow_dragonPart: () => dragonParts("arrow_dragonPart"),
  arrowFire_cow: () => [mob("cow", 6.5, 0, 2.5, 0.9, 1.3)], arrowFire_enderman: () => [mob("enderman", 6.5, 0, 2.5, 0.6, 2.9)], arrowFire_boat: () => [other("boat", "arrowFire_boat")],
  hook_boat: () => [other("boat", "hook_boat")], hook_dragonPart: () => dragonParts("hook_dragonPart"),
});
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

function host(name, kind, r, id, next = null, t = 0) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = r;
  const h = { kind, x, y, z, mx: vx, my: vy, mz: vz, yaw, pitch, id };
  if (kind === "arrow") h.crit = (name === "arrowCritTrail" && Math.abs(vx) > 0.5) || (name === "arrow_cowCrit" && !(!next || (next[0] === x && next[1] === y))); // the tick it sticks (the next input is the same place) clears it // EntityArrow.onUpdate clears the flag when it sticks
  if (kind === "arrow") h.fire = name.startsWith("arrowFire") && t > 0 ? 2000 : 0; // the server arrow's setFire(100); the data watcher flag is written by its first update
  if (kind === "arrow") h.velocityChanged = h.fire > 0 && (t - 1) % 20 === 0; // Entity.onEntityUpdate's `fire % 20 == 0` attackEntityFrom (bow.js) flags it
  if (kind === "potion") h.damage = 16421;
  if (kind === "fishHook") { delete h.mx; delete h.my; delete h.mz; Object.assign(h, { vx, vy, vz }); }
  if (kind === "firework") { h.stack = makeRocket({ flight: 1, explosions: [] }); h.exploded = r[10] === 1; }
  return h;
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const NO_XYZ = new Set(["call:attackEntityFrom:dragonPart"]); // the row carries the dragon's new target (three Entity.rand draws the port does not model)
const sameParticles = (got, want, what) => {
  assert.equal(got.length, want.length, `${what}: particle count ${JSON.stringify(got.map((p) => p[0]))} vs ${JSON.stringify(want.map((p) => p[0]))}`);
  got.forEach((g, i) => { assert.equal(g[0], want[i][0], `${what} #${i} type`); for (let k = 1; k < 7; k++) { if (NO_XYZ.has(g[0]) && k < 4) continue; if (String(g[0]).startsWith("sound:") && k >= 4) assert.equal(f(g[k]), f(want[i][k]), `${what} #${i} ${g[0]} field ${k}`); else near(g[k], want[i][k], `${what} #${i} ${g[0]} field ${k}`); } });
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
    Object.assign(h, host(name, kind, inp, h.id, rec.inputs[t + 1], t));
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
      const wantLog = rec.log[t].filter((p) => p[0] !== "makeFireworks" && !/^(listed|fire):/.test(p[0])), wantFw = rec.log[t].filter((p) => p[0] === "makeFireworks");
      sameParticles(tracker.log, wantLog, "particles");
      assert.equal(events.length, wantFw.length, "makeFireworks calls");
      events.forEach((e, i) => {
        const w = wantFw[i], q = e.firework;
        [q.x, q.y, q.z, q.vx, q.vy, q.vz].forEach((v, k) => near(v, w[1 + k], "makeFireworks " + k));
        assert.equal(w[7], "{Flight:1b,}", "the probe's tag");
        assert.equal(q.fireworks?.flight, 1, "the rocket's Fireworks tag reaches makeFireworks");
      });
    } catch (e) { if (process.env.DBG) console.log(name, t, e.message.split("\n").slice(0, process.env.DBG === "2" ? 40 : 1).join(" "), JSON.stringify(tracker.log)); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
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

// Batch 46: the other collidables of the client world and the burning arrow (executed: real EntityBoat, EntityMinecartEmpty, EntityPainting, EntityItemFrame, EntityLeashKnot,
// an EntityDragonPart of a real EntityDragon).
const rows = (name, prefix) => ref[name].log.flat().filter((p) => String(p[0]).startsWith(prefix));
test("client hits on boats, carts, hanging entities and dragon parts (executed): attackEntityFrom answers true, so the arrow plays its hit and ends instead of ricocheting", () => {
  for (const kind of ["boat", "minecart", "painting", "itemFrame", "leashKnot", "dragonPart"]) {
    const name = "arrow_" + kind, calls = rows(name, "call:attackEntityFrom");
    assert.deepEqual(calls.map((p) => [p[0], p[4], p[5]]), [["call:attackEntityFrom:" + kind, 4, 1]], name);
    assert.ok(rows(name, "sound:random.bowhit").length === 1, name + " hit sound");
    const gone = ref[name].client.findIndex((c, i) => i > 0 && c[0] === 0);
    assert.ok(gone > 0 && ref[name].client.slice(gone).every((c) => c[0] === 0), name + " the client arrow ends for good");
  }
  // the dragon itself is not collidable: only its part is hit (the listed 16 x 8 box takes no call)
  assert.equal(rows("arrow_dragonPart", "call:attackEntityFrom:dragon").length, 1);
  // a hook "attaches" (true) and keeps flying: it searches again the next tick (two logged calls on the recorded path) and is never removed
  assert.deepEqual(rows("hook_boat", "call:attackEntityFrom").map((p) => [p[0], p[4], p[5]]), [["call:attackEntityFrom:boat", 0, 1], ["call:attackEntityFrom:boat", 0, 1]]);
  assert.ok(rows("hook_dragonPart", "call:attackEntityFrom:dragonPart").length >= 1 && ref.hook_boat.client.every((c) => c[0] === 1));
});
test("burning client arrow (executed): setFire(5) comes before attackEntityFrom on every target but an enderman, and the copy's next update zeroes the counter", () => {
  for (const kind of ["cow", "boat"]) {
    const log = ref["arrowFire_" + kind].log.flat().filter((p) => /^call:/.test(p[0]));
    assert.deepEqual(log.map((p) => p[0]), ["call:setFire:" + kind, "call:attackEntityFrom:" + kind], kind);
    assert.deepEqual([log[0][4], log[0][5]], [5, 100]);
  }
  assert.deepEqual(rows("arrowFire_enderman", "call:").map((p) => p[0]), ["call:attackEntityFrom:enderman"]);
  // the mobs' own onEntityUpdate (run before the arrow each tick): fire reads 0 every tick, also right after the hit tick
  const fire = (n) => ref[n].log.flat().filter((p) => p[0].startsWith("fire:")).map((p) => p[4]);
  assert.ok(fire("arrowFire_cow").length > 20 && fire("arrowFire_cow").every((v) => v === 0) && fire("arrowFire_boat").every((v) => v === 0));
});
test("mutation check: targets that answer false, a missing ignite and a hook that never attaches are caught", () => {
  assert.ok(replay("arrow_boat", (tr) => { const t = tr.hooks.clientTargets; tr.hooks.clientTargets = () => t().map((x) => ({ ...x, answers: false })); }).length > 0);
  assert.ok(replay("arrow_painting", (tr) => { tr.hooks.clientTargets = () => []; }).length > 0);
  assert.ok(replay("arrowFire_cow", (tr) => { tr.ignite = () => {}; }).length > 0);
  assert.ok(replay("arrowFire_boat", (tr) => { const orig = tr.attack.bind(tr); tr.attack = (r, d, t) => orig(r, d, { ...t, answers: false }); }).length > 0);
  assert.ok(replay("arrow_dragonPart", (tr) => { tr.hooks.clientTargets = () => [{ ...dragonParts("arrow_dragonPart")[0], reach: () => false }]; }).length > 0);
});
test("the port's hook marks a target hooked only when the client's attackEntityFrom said true", () => {
  const tr = new ObjectTracker(10, () => 0.5);
  const t = { ref: { type: "boat", x: 0, y: 0, z: 0 }, kind: "boat", box: [0, 0, 0, 1, 1, 1], answers: true };
  assert.equal(tr.attack(t.ref, 0, t), true);
  assert.equal(tr.attack(t.ref, 0, { ...t, answers: false }), false);
  assert.equal(tr.attack(t.ref, 0), false);
});

test("a burning server arrow flags velocityChanged every 20th tick (Entity.onEntityUpdate's onFire attackEntityFrom), a wet one does not", () => {
  const arrows = new Arrows(() => 0.5);
  const flags = (fire, wet) => {
    const a = arrows.make({ x: 2.5, y: 40, z: 2.5, mx: 0.1, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), { fire });
    const out = [];
    for (let t = 0; t < 45; t++) { a.velocityChanged = false; arrows.step(world(wet), a, {}); out.push(a.velocityChanged ? 1 : 0); }
    return out.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  };
  assert.deepEqual(flags(2000, false), [0, 20, 40]);
  assert.deepEqual(flags(0, false), []);
});
test("a client mob copy's fire counter is zeroed at each client update (Entity.onEntityUpdate: World.isRemote)", () => {
  const tracker = new MobTracker(10);
  const mob = { type: "zombie", x: 70.5, y: 64, z: 0.5, rotationYaw: 0, health: 20, onGround: true };
  tracker.update([mob], { x: 70.5, y: 64, z: 0.5 }, () => [0.6, 1.8]);
  const c = tracker.entries.get(mob).client;
  assert.equal(c.present, true);
  c.fire = 100; // a client arrow's setFire(5) (object-tracker.js ignite)
  tracker.update([mob], { x: 70.5, y: 64, z: 0.5 }, () => [0.6, 1.8]);
  assert.equal(c.fire, 0);
});
