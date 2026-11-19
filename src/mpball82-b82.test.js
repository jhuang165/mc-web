// Batch 82 mpball82: the angles, burning flag and water factor of the fireball and wither skull copies. The reference is executed on the unchanged
// 1.7.10 classes (tools/probes/BallFlagProbe.java -> public/research/ballflag82-reference.json): a large fireball, a small one and a wither skull
// (exact form, accel 0.1 along +x) fly through still water (x 30..40) into stone (x 50..51), once on a server world and once on a remote one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WATER, World } from "./world.js";
import { waterAcceleration, entityWaterBox } from "./fluids.js";
import { FIREBALL, fireballAcceleration, fireballBurn, fireballStep } from "./blaze-ghast.js";
import { fireballTurn } from "./fireball-turn.js";
import { BallTracks, spawnBallCopy, stepBallCopy, applyBallPacket, ballCopyBurning, flyBallRow } from "./multiplayer/fireball-copy.js";
import { ballCopyLook, angleOfByte } from "./multiplayer/skull-look.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { clientBallFx } from "./multiplayer/client-explosion.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const REF = JSON.parse(readFileSync(new URL("../public/research/ballflag82-reference.json", import.meta.url), "utf8"));
const run = (name) => REF.runs.find((r) => r.name === name).rows;
const WIDTH = [1, Math.fround(0.3125), 0.3125];
// The probe's world: still water x 30..40, y 0..6, z 0..6 (stone at x 50..51 is never read here: neither side's sweep is in these loops)
const pool = { get: (x, y, z) => (x >= 30 && x <= 40 && y >= 0 && y <= 6 && z >= 0 && z <= 6 ? WATER : 0), getMeta: () => 0, solid: () => false };
const waterAt = (x, y, z, w) => waterAcceleration(pool, entityWaterBox([x - w / 2, y, z - w / 2, x + w / 2, y + w, z + w / 2]));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// The server ball's update as fireballs.js / wither-boss-mobs.js run it, without the sweep: prev angles, the water test, fireballBurn, the move with the turn.
function serverBall(kind) {
  const [ax, ay, az] = fireballAcceleration(0.1, 0, 0); // ze.<init>: a / (double) sqrt_double(..) * 0.1, the float root
  const b = { x: 26.5, y: 2.5, z: 3.5, vx: 0, vy: 0, vz: 0, ax, ay, az, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0 };
  return { b, step() {
    b.prevYaw = b.yaw; b.prevPitch = b.pitch;
    const w = waterAt(b.x, b.y, b.z, WIDTH[kind]);
    fireballBurn(b, w.wet, kind === 0);
    fireballStep(b, w.wet, (e) => fireballTurn(e, e.vx, e.vy, e.vz));
    return w.wet;
  } };
}

for (const [kind, name] of ["large", "small", "skull"].entries()) {
  test(`server ${name}: position, motion, angles, fire counter, burning flag and velocityChanged match the executed update`, () => {
    const { b, step } = serverBall(kind), rows = run(`${name}-server`);
    for (const [t, r] of rows.entries()) {
      if (r[13]) break; // the update the ball hit the wall in (onImpact, not in this loop)
      const wet = step();
      near(b.x, r[0], 1e-9, `t${t} x`); near(b.vx, r[3], 1e-9, `t${t} motionX`);
      near(b.yaw, r[6], 1e-3, `t${t} yaw`); near(b.pitch, r[7], 1e-3, `t${t} pitch`);
      assert.equal(b.fire, r[8], `t${t} fire`); assert.equal(b.burnFlag ? 1 : 0, r[9], `t${t} flag 0`);
      assert.equal(b.velocityChanged ? 1 : 0, r[10], `t${t} velocityChanged`); b.velocityChanged = false;
      assert.equal(wet ? 1 : 0, r[11], `t${t} isInWater`);
    }
  });

  test(`remote ${name}: the copy turns, burns and slows to 0.8 in water as the remote-world update does, and flies on through the wall`, () => {
    const rows = run(`${name}-remote`), c = spawnBallCopy(kind === 2 ? "witherSkull" : kind === 1 ? "smallFireball" : "fireball", [26.5 * 32, 2.5 * 32, 3.5 * 32, 800, 0, 0, 0, 0, 0]);
    assert.equal(c.angles, true);
    const bubbles = [];
    for (const [t, r] of rows.entries()) {
      stepBallCopy(c, { water: (cc) => waterAt(cc.x, cc.y, cc.z, WIDTH[kind]), spawn: (n) => bubbles.push(t) });
      near(c.x, r[0], 1e-9, `t${t} x`); near(c.vx, r[3], 1e-9, `t${t} motionX`);
      near(c.yaw, r[6], 1e-3, `t${t} yaw`); near(c.pitch, r[7], 1e-3, `t${t} pitch`);
      assert.equal(c.fire, r[8], `t${t} fire`);
      assert.equal(ballCopyBurning(c) ? 1 : 0, r[12], `t${t} isBurning`);
      assert.equal(r[13], 0, "the remote copy is never set dead");
    }
    assert.ok(c.x > 52, "past the stone wall: the client's ray and entity sweep change nothing (onImpact is server-only)");
    assert.ok(bubbles.length > 0);
  });
}

test("BallTracks: the flag's S1C forces the location block at the change, and a large ball sends S12 every update out of water", () => {
  for (const [kind, name] of [[0, "large"], [1, "small"]]) {
    const rows = run(`${name}-server`), { b, step } = serverBall(kind), tracks = new BallTracks();
    Object.assign(b, { kind: kind ? "smallFireball" : "fireball" });
    const metas = [], s12 = [], blocks = [];
    for (const [t, r] of rows.entries()) {
      if (r[13]) break;
      step();
      tracks.update([b]);
      const p = tracks.row(b).p ?? [];
      for (const q of p) if (q.type === "meta") metas.push([t, q.f]);
      if (p.some((q) => q.type === "velocity")) s12.push(t);
      if (p.some((q) => q.type !== "velocity" && q.type !== "meta") || p.some((q) => q.type === "meta")) blocks.push(t);
      const m = p.findIndex((q) => q.type === "meta"), v = p.findIndex((q) => q.type === "velocity");
      if (m >= 0 && v >= 0) assert.ok(m < v, "the S1C goes out inside the location block, before the tail's S12");
    }
    const live = rows.filter((r) => !r[13]);
    const want = live.map((r, t) => [t, r[9]]).filter(([t, f]) => f !== (t ? live[t - 1][9] : 0));
    assert.deepEqual(metas, want, `${name}: an S1C at each change of the executed flag`);
    assert.deepEqual(s12, kind ? [] : live.map((r, t) => (r[10] ? t : -1)).filter((t) => t >= 0), `${name}: S12 where velocityChanged was set`);
  }
});

test("BallTracks: `s` carries the angle bytes and the flag; S16 / S17 / S18 carry the angle bytes, and the copy takes them % 360", () => {
  const tracks = new BallTracks(), b = { kind: "fireball", x: 0.5, y: 70, z: 0.5, vx: 0, vy: 0, vz: 0, ax: 0.1, ay: 0, az: 0, yaw: 30, pitch: 10, prevYaw: 30, prevPitch: 10 };
  b.track = { spawn: { yb: 21, pb: 7 } };
  const rows = [];
  for (let t = 0; t < 25; t++) {
    b.prevYaw = b.yaw; b.prevPitch = b.pitch;
    fireballBurn(b, false, true);
    fireballStep(b, false, (e) => fireballTurn(e, e.vx, e.vy, e.vz));
    tracks.update([b]);
    rows.push(JSON.parse(JSON.stringify(tracks.row(b))));
  }
  assert.deepEqual(rows[0].s.slice(6), [21, 7, 0], "the first tracked tick: the join's bytes, the join's flag");
  assert.equal(rows[5].s[8], 1, "later watchers get the flag that is on now");
  const look = rows[1].p.find((q) => q.yb !== undefined);
  assert.ok(look, "the forced block at ticks 1 sends the turned angles");
  const c = spawnBallCopy("fireball", rows[0].s);
  assert.deepEqual([c.prevYaw, c.yaw, c.pitch, c.flag], [0, angleOfByte(21), angleOfByte(7), false]);
  applyBallPacket(c, { type: "look", yb: -128, pb: 3 });
  assert.equal(c.yaw, Math.fround(angleOfByte(-128) % 360));
  applyBallPacket(c, { type: "meta", f: 1 });
  assert.equal(c.flag, true);
  c.yaw = 725;
  applyBallPacket(c, { type: "move", dx: 4, dy: 0, dz: 0 });
  assert.equal(c.yaw, 5, "an S15 keeps the angles, through setRotation's % 360");
});

test("old rows: a batch 81 six-field `s` gives a copy without angles or flames, and the row's own turn keeps the batch 81 path", () => {
  const row = { kind: "fireball", track: { s: [331, 2246, -148, 800, 0, 0] } };
  flyBallRow(row, {});
  assert.equal(row.copy.angles, undefined);
  row.track = { p: [] };
  flyBallRow(row, { water: () => ({ wet: false, push: [0.014, 0, 0] }) });
  assert.equal(row.copy.vx, row.copy.ax * FIREBALL.friction, "no flow push on a batch 81 copy");
  assert.equal(row.burning, undefined);
  assert.equal(row.yaw, undefined);
  // a batch 81 fireball row carries no yb / pb: ballCopyLook leaves it alone
  const plain = { kind: "fireball" };
  ballCopyLook(plain, { kind: "fireball" }, true);
  assert.equal(plain.look, undefined);
});

test("ballCopyLook: the row's own turn uses water's 0.8, the kind's factor otherwise", () => {
  const d = { kind: "fireball", yb: 0, pb: 0, a8: [800, 0, 0] };
  const dry = { kind: "fireball" }, wet = { kind: "fireball" }, skull = { kind: "witherSkull", blue: true };
  for (const r of [dry, wet, skull]) ballCopyLook(r, { ...d, kind: r.kind }, true);
  for (let i = 0; i < 3; i++) { ballCopyLook(dry, d, false); ballCopyLook(wet, d, false, { wet: true }); ballCopyLook(skull, { ...d, kind: "witherSkull" }, false); }
  const k = FIREBALL.friction, w = FIREBALL.waterFriction, kb = Math.fround(0.73);
  const a = dry.look.a[0], three = (q) => ((a * q + a) * q + a) * q;
  near(dry.look.m[0], three(k), 1e-12, "dry");
  near(wet.look.m[0], three(w), 1e-12, "wet");
  near(skull.look.m[0], three(kb), 1e-12, "charged skull");
});

// --- the dedicated server to a client with the ballFx hook ---
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(name) {
  const world = new World(name);
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, x, z) => { const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input("a", input()); s.tick(); p.dispOut = null; return p; };

test("server to client: a fireball's copy starts at the shooter's angle bytes, turns itself, takes the look packets and burns from its first update", () => {
  const s = fixture("mpball82-fireball"), p = join(s, 40.5, 40.5);
  const pig = s.mobs.mobs.create("pig", 64.5, 10, 100.5); s.mobs.mobs.entities.push(pig);
  pig.rotationYaw = 30; pig.rotationPitch = 10;
  const b = s.mobs.mobs.fireballs.launch({ large: true, owner: pig, x: 64.5, y: 20, z: 90, dx: -10, dy: -3, dz: -20 });
  const remote = new RemoteDispense({ ballFx: (row) => clientBallFx(row, { spawn: () => {} }) });
  const rows = [], copies = [];
  for (let i = 0; i < 25; i++) {
    s.input("a", input()); s.tick();
    const ents = (p.dispOut ?? []).splice(0).find((m) => m.type === "dispEnts")?.ents ?? [];
    remote.ents(JSON.parse(JSON.stringify(ents)));
    const d = ents.find((e) => e.kind === "fireball");
    if (!d || b.dead) break;
    rows.push(d);
    const row = [...remote.rows.values()].find((r) => r.kind === "fireball");
    copies.push({ yaw: row.yaw, pitch: row.pitch, prevYaw: row.prevYaw, burning: row.burning });
  }
  assert.ok(rows.length >= 21, `the ball flew (${rows.length})`);
  assert.deepEqual(rows[0].t.s.slice(6), [21, 7, 0], "the S0E of trackEntity: the shooter's angles before the first turn, the flag off");
  assert.deepEqual([rows[0].yb, rows[0].pb], [21, 7], "the skull's wire fields on a fireball row too");
  assert.deepEqual([copies[0].prevYaw, copies[0].yaw, copies[0].burning], [0, angleOfByte(21), false], "the spawn: prev 0, no update yet, flag 0");
  assert.ok(copies.slice(1).every((c) => c.burning === true), "the copy's own setFire(1) from its first update");
  assert.notEqual(copies[2].yaw, copies[1].yaw, "the copy turns between packets");
  const looks = rows.map((r, i) => (r.t.p?.some((q) => q.yb !== undefined) ? i : -1)).filter((i) => i >= 0);
  assert.ok(looks.includes(1) && looks.includes(10), `look packets at the flag's forced block and on the beat: ${looks}`);
  for (const i of looks) {
    const q = rows[i].t.p.filter((x) => x.yb !== undefined).at(-1);
    assert.equal(copies[i].yaw, Math.fround(angleOfByte(q.yb) % 360), `tick ${i}: the copy takes the packet's yaw`);
  }
  assert.ok(rows.slice(2).every((r) => r.t.p?.some((q) => q.type === "velocity")), "a large ball's S12 every tick out of water (the onFire hurt's setBeenAttacked)");
});
