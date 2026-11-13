// Batch 58 (tag b58v4), vehicles: replays public/research/vehicles4-reference.json (tools/probes/Vehicles4Probe.java, unchanged 1.7.10 classes) against the port.
//  walk     the ridden boat copy among other copies that MOVE in the same client tick: the entity walk order decides whether an other copy moved before the boat's update or after.
//  cart     a rider on a minecart copy that drops: the copy only interpolates (no updateFallState), so the client player gets no fall call; a server cart (control) does call it.
//  dismount the client player leaves a falling boat copy and falls on foot: the fall distance counts from the dismount (sv.ab zeroes it every riding tick).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, ObjectClient, boatSeat, clientRiderFall } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";
import { WATER, solidBlock } from "./world.js";
import { stepHorseCopy, horseCopyStatus } from "./horse-copy.js";
import { EntityWorld } from "./entities.js";
import { movePlayer } from "./player-physics.js";
import { playerFixture } from "./player-physics-fixture.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/vehicles4-reference.json", import.meta.url), "utf8"));
const num = (v) => (v === "-0" ? -0 : v);
const near = (a, b) => Math.abs(a - num(b)) <= 1e-9 * Math.max(1, Math.abs(num(b)));
const kind = (k) => ref.cases.filter((c) => c.kind === k);
const rec = (n) => ref.cases.find((c) => c.name === n);

function openWorld() {
  const map = new Map();
  for (let x = -4; x <= 24; x++) for (let z = -8; z <= 8; z++) { map.set(`${x},-1,${z}`, [WATER, 0]); map.set(`${x},0,${z}`, [WATER, 0]); }
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], meta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)),
    set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}

// `order(en list)` decides the client list; the default is the executed one: others with order 0 first, the ridden boat, the others with order 1.
function replayWalk(c, { reverse = false, independent = false } = {}) {
  const world = openWorld(), t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  const live = { id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };
  const rider = { player: true, yaw: 0, moveForward: 0, moveStrafing: 0, vehicle: live, fallDistance: 0 };
  live.rider = rider;
  t.view.player = player; t.ctx.world = world; t.hooks.rides = (l) => l === live;
  t.serverTick({ boat: [{ ...live, rider: undefined }] }, player); t.clientTick();
  const [[, en]] = [...t.entries.entries()];
  const e = en.client; en.client.live = live;
  const s = c.spawn;
  Object.assign(e, { world, x: s[0], y: s[1] + f(0.3), z: s[2], vx: s[3], vy: s[4], vz: s[5], yaw: f(c.boatYaw), pitch: 0, firstUpdate: true, inWater: false, vt: null, cv: [0, 0, 0], onGround: false });
  e.sim.rand = new JavaRandom(7);
  t.hooks.particle = () => {};
  const others = c.others.map((o) => {
    const k = new ObjectClient(o[0] === 0 ? "boat" : "minecart", t); k.present = true; k.world = world; k.sim = t.newSim(k); k.sim.rand = new JavaRandom(7);
    Object.assign(k, { x: o[1], y: o[2] + (o[0] === 0 ? f(0.3) : 0), z: o[3], vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, firstUpdate: true, inWater: false, vt: null, cv: [0, 0, 0], onGround: false });
    return { k, o };
  });
  t.clientList.clear();
  const entry = { client: e };
  const list = (reverse ? [...others].reverse() : others).filter((x) => x.o[7] === (reverse ? 1 : 0)).concat([{ ridden: true }], (reverse ? [...others].reverse() : others).filter((x) => x.o[7] === (reverse ? 0 : 1)));
  for (const x of list) t.clientList.add(x.ridden ? entry : { client: x.k });
  const bad = [];
  c.ticks.forEach(([st, , ov], tick) => {
    for (const row of c.inputs) if (row[0] <= tick) { rider.moveForward = row[1]; rider.moveStrafing = row[2]; rider.yaw = f(row[3]); }
    for (const { k, o } of others) k.place(o[1] + o[4] * (tick + 1), o[2] + o[5] * (tick + 1), o[3] + o[6] * (tick + 1), 0, 0);
    if (independent) for (const x of list) { if (x.ridden) e.step(t.ctx); else x.k.step(t.ctx); }
    else for (const cl of t.clientList) cl.client.step(t.ctx);
    const got = [e.x, e.y, e.z, e.vx, e.vy, e.vz];
    got.forEach((v, i) => { if (!near(v, st[i])) bad.push([c.name, tick, "boat", i, v, st[i]]); });
    others.forEach(({ k }, i) => { [k.x, k.y, k.z].forEach((v, j) => { if (!near(v, ov[i][j])) bad.push([c.name, tick, "other", i, j, v, ov[i][j]]); }); });
  });
  return bad;
}

test("the reference is the executed one", () => {
  assert.equal(ref.tag, "b58v4");
  for (const k of ["xi", "xm", "sv", "sa"]) assert.match(ref.classes[k].sha256, /^[0-9a-f]{64}$/);
  assert.equal(kind("walk").length, 10);
  assert.equal(kind("cart").length, 4);
  assert.equal(kind("dismount").length, 5);
});

for (const c of kind("walk")) test(`entity walk ${c.name}: the ridden boat copy and the moving others match the executed list order each tick`, () => {
  assert.deepEqual(replayWalk(c).slice(0, 3), []);
});

test("executed: the walk order changes the ridden copy's run whenever an other copy moves into its path; the port reproduces both orders and notices a swap", () => {
  const last = (n) => rec(n).ticks.at(-1)[0];
  for (const [a, b] of [["wk-boat-cross-first", "wk-boat-cross-last"], ["wk-cart-cross-first", "wk-cart-cross-last"], ["wk-boat-ahead-slow-first", "wk-boat-ahead-slow-last"]]) {
    assert.notEqual(last(a)[0], last(b)[0], `${a} vs ${b}`);
    assert.ok(replayWalk(rec(a), { reverse: true }).length > 0, `${a} replayed in the other order differs`);
    assert.ok(replayWalk(rec(b), { reverse: true }).length > 0, `${b} replayed in the other order differs`);
  }
  assert.ok(Math.abs(last("wk-solo")[0] - last("wk-boat-cross-first")[0]) > 1, "a crossing boat does slow the copy");
});

test("the tracker's client walk steps the copies in the order their spawn packets arrived, the ridden boat in its own place", () => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = openWorld();
  const boat = (id, x) => ({ id, x, posY: 0.3, z: 0.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [x - 0.75, 0, -0.25, x + 0.75, 0.6, 1.25] });
  const a = boat(1, 2.5), b = boat(2, 6.5), d = boat(3, 10.5);
  t.serverTick({ boat: [a, b, d] }, player); t.clientTick();
  const order = [];
  for (const en of t.clientList) { const s = en.client.step.bind(en.client); en.client.step = (ctx) => { order.push(en.live.id); return s(ctx); }; }
  t.serverTick({ boat: [a, b, d] }, player); t.clientTick();
  assert.deepEqual(order, [1, 2, 3]);
});

function replayCart(c) {
  const world = openWorld(), t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = world;
  let falls = 0;
  t.hooks.riderFall = () => { falls++; };
  const k = new ObjectClient("minecart", t); k.present = true; k.world = world; k.sim = t.newSim(k);
  Object.assign(k, { x: c.spawn[0], y: c.spawn[1], z: c.spawn[2], vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, vt: null, cv: [0, 0, 0], onGround: false });
  const bad = [];
  c.ticks.forEach(([cs], tick) => {
    for (const p of c.packets) if (p[0] === tick) k.place(p[1], p[2], p[3], 0, 0);
    k.step(t.ctx);
    if (!near(k.y, cs[1])) bad.push([c.name, tick, "y", k.y, cs[1]]);
  });
  return { bad, falls };
}

for (const c of kind("cart").filter((x) => !x.server)) test(`cart rider ${c.name}: the minecart copy interpolates down and the rider is never dropped or hurt (executed: no fall call)`, () => {
  const r = replayCart(c);
  assert.deepEqual(r.bad.slice(0, 3), []);
  assert.equal(r.falls, 0);
  assert.ok(c.ticks.every(([, p, played, attacks]) => played.length === 0 && attacks === 0 && num(p[3]) === 0));
});

test("executed control: the server's cart landing does call the rider's fall (sounds and one attackEntityFrom), the copy never does", () => {
  const s = rec("cart-server-fall-9");
  const played = s.ticks.flatMap((t) => t[2]);
  assert.deepEqual(played.map((p) => p[0]), ["game.player.hurt.fall.big", "step.stone"]);
  assert.equal(s.ticks.reduce((n, t) => n + t[3], 0), 1);
  for (const c of kind("cart").filter((x) => !x.server)) assert.equal(c.ticks.flatMap((t) => t[2]).length, 0, c.name);
});

function replayDismount(c) {
  const st = playerFixture("land");
  for (const key of ["position", "previous", "velocity"]) { const { x, y, z } = st[key]; st[key] = { x, y, z }; }
  const d = c.dismountTick, seat = c.ticks[d > 0 ? d - 1 : 0][0];
  const base = 10; // the fixture's floor top
  st.survival.creative = false; st.grounded = false; st.fallDistance = 0;
  Object.assign(st.position, { x: 64.5, y: base + (d === 0 ? c.ticks[0][0][1] : seat[1]), z: 65.5 }); Object.assign(st.previous, st.position); Object.assign(st.velocity, { x: 0, y: 0, z: 0 });
  const bad = [], sounds = [];
  c.ticks.forEach(([p, riding, played], tick) => {
    if (riding) return;
    st.landedFall = 0;
    movePlayer(st, { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false }, () => {});
    if (!near(st.position.y - base, p[1])) bad.push([c.name, tick, "y", st.position.y - base, p[1]]);
    const out = st.landedFall > 0 ? clientRiderFall(st.landedFall, { x: st.position.x, y: st.position.y - base, z: st.position.z }, { get: () => 3 }).map((s) => s.name) : [];
    if (out.join() !== played.map((q) => q[0]).join()) bad.push([c.name, tick, "sounds", out, played.map((q) => q[0])]);
    sounds.push(...out);
  });
  return { bad, sounds };
}

for (const c of kind("dismount").filter((x) => x.dismountTick < x.ticks.length)) test(`dismount ${c.name}: the player falls on foot from the dismount point and lands with the executed sounds`, () => {
  const r = replayDismount(c);
  assert.deepEqual(r.bad.slice(0, 3), []);
});

test("executed: the fall distance restarts at the dismount (a boat that fell for 3 ticks first changes nothing); under 3 blocks plays nothing", () => {
  const names = (n) => rec(n).ticks.flatMap((t) => t[2]).map((p) => p[0]);
  assert.deepEqual(names("dm-from-9-at-0"), ["game.player.hurt.fall.big", "step.stone"]);
  assert.deepEqual(names("dm-from-9-at-3"), ["game.player.hurt.fall.big", "step.stone"]);
  assert.deepEqual(names("dm-from-2-at-0"), []);
  assert.deepEqual(names("dm-never"), []);
  assert.ok(rec("dm-never").ticks.every((t) => t[1] === true) && num(rec("dm-never").ticks.at(-1)[0][3]) === 0, "riding keeps the fall distance at 0 (sv.ab)");
});

// ---- the horse copy's hurt and death status draws (horse-status-reference.json, executed wi on a client world) ----
const hs = JSON.parse(await readFile(new URL("../public/research/horse-status-reference.json", import.meta.url), "utf8"));
class Log extends JavaRandom {
  log = [];
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
}

test("horse-status-reference is the executed record", () => {
  assert.equal(hs.tag, "b58hs");
  assert.equal(hs.status.length, 5);
  assert.ok(hs.status.every((s) => s.ticks.length === 90));
});

for (const s of hs.status) test(`horse copy status ${s.name}: status 2 / 3 draws (nextInt(3), two floats), the pitch and the tick's other draws match the executed wi each tick`, () => {
  const c = { rand: new Log(s.seed) };
  let dead = false, pitches = 0;
  s.ticks.forEach(([status, draws, played], i) => {
    if (i >= 79) return; // deathTime 20 (tick 60 + 19): EntityLivingBase.onDeathUpdate's 20 poof particles draw gaussians and floats (executed, not ported)
    c.rand.log.length = 0;
    let pitch = null;
    if (status) { pitch = horseCopyStatus(c, status); if (status === 3) dead = true; }
    stepHorseCopy(c, 0, { alive: !dead, child: s.age < 0, type: s.type });
    assert.equal(c.rand.log.join(" "), draws, `${s.name} tick ${i}`);
    if (status) {
      pitches++;
      assert.equal(pitch, f(Number(played[0].split("|")[2])), `${s.name} tick ${i} pitch`);
    }
  });
  assert.equal(pitches, 6);
});

test("executed: a dead copy's deathTime 20 tick draws the poof particles (20 groups of gaussians and floats), which the port's copy does not make", () => {
  for (const s of hs.status) assert.ok(s.ticks[79][1].split(" ").filter((x) => x === "d").length >= 40, s.name);
});

test("EntityWorld: a hit on a horse with a client copy draws its status sounds on the copy's Random, not the generic one; without a copy the generic draw stays", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const make = () => { const w = new EntityWorld(terrain, [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 30, horse: { type: 0 } }], () => 0.5); w.entities[0].onGround = true; return w; };
  const w = make(), e = w.entities[0], c = { rand: new Log(5) };
  w.tracker = { clientIfTracked: (x) => (x === e ? c : null) };
  w.attackEntityFrom(e, 1, { name: "generic" });
  assert.deepEqual(c.rand.log.slice(0, 3), [c.rand.log[0], "f", "f"]);
  assert.match(c.rand.log[0], /^3:/);
  assert.equal(w.clientSounds.length, 1);
  const none = make();
  none.tracker = { clientIfTracked: () => null };
  none.attackEntityFrom(none.entities[0], 1, { name: "generic" });
  assert.equal(none.clientSounds.length, 1);
  assert.ok(none.clientSounds[0].pitch >= 0.8 && none.clientSounds[0].pitch <= 1.2);
});

test("mutation check: a status draw without the nextInt(3) shifts the stream and fails the replay", () => {
  const s = hs.status[0], c = { rand: new Log(s.seed) };
  const [status, draws] = s.ticks[3];
  for (let i = 0; i < 3; i++) stepHorseCopy(c, 0, { alive: true });
  c.rand.log.length = 0;
  c.rand.nextFloat(); c.rand.nextFloat(); // wrong: the hurt status without the nextInt(3)
  stepHorseCopy(c, 0, { alive: true });
  assert.equal(status, 2);
  assert.notEqual(c.rand.log.join(" "), draws);
});

// ---- the flag metadata: when does the copy hold a flag the live horse set? ----
test("horse flag metadata: a flag set on the live horse reaches the copy in the same tracker update (S1C in the entry's own update, executed horseMeta) and its animation starts that client tick; nothing is sent while the flags stand still", async () => {
  const { MobTracker } = await import("./entity-tracker.js");
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [], () => 0.5);
  const horse = { type: "horse", id: "mob-1", uuid: "u1", x: 3.5, y: 0, z: 3.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 30, onGround: true, growingAge: 0, horse: { type: 0 }, mouthTicks: 0 };
  const m = new MobTracker(10);
  m.joinPlayer?.(1);
  const player = { x: 0.5, y: 0, z: 0.5 }, size = () => [1.4, 1.6];
  const physics = Object.assign((c, e) => {}, { turn: (c, e) => w.clientAfterMove(c, e) });
  const tick = () => m.update([horse], player, size, physics);
  for (let i = 0; i < 6; i++) tick();
  const c = m.clientIfTracked(horse);
  assert.ok(c, "the copy exists");
  assert.equal(c.horseFlags & 128, 0);
  assert.equal(c.horse.mouth, 0);
  horse.mouthTicks = 1;
  tick();
  assert.equal(c.horseFlags & 128, 128, "S1C applied in the update the flag changed");
  assert.ok(c.horse.mouth > 0, "the copy's mouth starts opening in that client tick");
  const seen = c.horse.mouth;
  horse.mouthTicks = 0;
  tick();
  assert.equal(c.horseFlags & 128, 0);
  assert.ok(c.horse.mouth < seen);
});
