// Batch 59 (tag b59df), deathfx: replays public/research/deathfx-reference.json (tools/probes/DeathFxProbe.java, unchanged 1.7.10 sv.C on a client world double) against the
// port's client copy (ClientEntity.step + death-fx.js): deathTime, the 20 "explode" particles on the copy's own Random at deathTime 20, the corpse tilt and the draw order.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ClientEntity } from "./entity-tracker.js";
import { JavaRandom } from "./java-random.js";
import { copyDeathUpdate, copyDeathAngle } from "./death-fx.js";
import { deathTipAngle } from "./damage-fx.js";
import { clientAngles } from "./mob-renderer.js";
import { mobPose } from "./entities.js";
import { EntityWorld } from "./entities.js";
import { stepHorseCopy, horseCopyStatus } from "./horse-copy.js";

const ref = JSON.parse(await readFile(new URL("../public/research/deathfx-reference.json", import.meta.url), "utf8"));
const status = JSON.parse(await readFile(new URL("../public/research/horse-status-reference.json", import.meta.url), "utf8"));
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const make = (c) => {
  const e = new ClientEntity("mob");
  e.present = true; e.width = c.width; e.height = c.height; e.rand = new Log(c.seed);
  return e;
};

test("deathfx-reference is the executed record", () => {
  assert.equal(ref.tag, "b59df");
  assert.deepEqual(ref.death.map((d) => d.kind), ["zombie", "pig", "piglet", "horse"]);
});

for (const c of ref.death) test(`${c.kind} copy: deathTime and the 20 poof particles match the executed sv.C each tick (position read before the interpolation)`, () => {
  const e = make(c);
  let seen = 0;
  c.ticks.forEach(([st, x, y, z, deathTime, draws, particles], i) => {
    if (st === 3) { e.dead = true; e.rand.nextFloat(); e.rand.nextFloat(); } // sv.a(byte) 3: the death sound's pitch (two floats) in the packet phase, before the tick
    e.x = x; e.y = y; e.z = z; e.px = x; e.py = y; e.pz = z;
    e.tx = x + 1; e.ty = y + 1; e.tz = z + 1; e.increments = 3; // the interpolation that follows onEntityUpdate
    e.rand.log.length = 0; e.fx.length = 0;
    // an alive copy draws EntityLiving's living sound roll (and the horse its tail roll) from the same Random: only the horse copy models them (horse-copy.js), so replay the
    // recorded bounded draws here to keep the stream aligned (their values are checked against the record)
    if (!e.dead) for (const d of draws.split(" ").filter(Boolean)) { const [b, v] = d.split(":").map(Number); assert.equal(e.rand.nextInt(b), v, `${c.kind} tick ${i} ${d}`); }
    e.rand.log.length = 0;
    e.step();
    assert.equal(e.deathTime, Math.min(20, deathTime), `${c.kind} tick ${i} deathTime`); // the probe keeps ticking a dead entity; the port stops at setDead
    if (e.dead) assert.equal(e.rand.log.join(" "), draws, `${c.kind} tick ${i} draws`);
    assert.equal(e.fx.length, particles.length, `${c.kind} tick ${i} particle count`);
    particles.forEach((p, k) => {
      const [name, ...v] = p.split("|"), q = e.fx[k];
      assert.equal(q.particle, name);
      [q.x, q.y, q.z, q.vx, q.vy, q.vz].forEach((a, n) => assert.ok(near(a, Number(v[n])), `${c.kind} tick ${i} particle ${k} field ${n}: ${a} vs ${v[n]}`));
      seen++;
    });
  });
  assert.equal(seen, 20);
});

test("the copy stops at setDead: no second burst, and it needs health 0 to count", () => {
  const e = make(ref.death[0]);
  for (let i = 0; i < 30; i++) e.step();
  assert.equal(e.deathTime, 0);
  e.dead = true;
  for (let i = 0; i < 40; i++) e.step();
  assert.equal(e.deathTime, 20);
  assert.equal(e.fx.length, 20);
});

test("dragon and crystal copies keep their own death code (no explode burst here)", () => {
  for (const t of ["ender_dragon", "ender_crystal"]) { const e = new ClientEntity(t); e.dead = true; e.rand = new Log(1); for (let i = 0; i < 25; i++) assert.equal(copyDeathUpdate(e), false); assert.equal(e.deathTime, 0); }
});

test("corpse tilt of the copy: rotateCorpse's (deathTime + p - 1) / 20 * 1.6, sqrt, max 1, times 90; the renderer's pose reads the copy's deathTime", () => {
  const c = { deathTime: 7 };
  assert.equal(copyDeathAngle(c, 0.5), deathTipAngle(7, 0.5));
  assert.equal(copyDeathAngle({ deathTime: 0 }, 0.5), 0);
  assert.equal(copyDeathAngle({ deathTime: 19 }, 1), 90);
  const live = { death: 3, growingAge: 0, type: "zombie", prevRenderYawOffset: 0, renderYawOffset: 0, prevRotationYawHead: 0, rotationYawHead: 0, prevRotationPitch: 0, rotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, px: 0, x: 0, py: 0, y: 0, pz: 0, z: 0, age: 0 };
  const copy = { ...c, prevRenderYawOffset: 0, renderYawOffset: 0, prevRotationYawHead: 0, rotationYawHead: 0, prevRotationPitch: 0, rotationPitch: 0 };
  assert.equal(mobPose(clientAngles(live, copy), 0.5).death, deathTipAngle(7, 0.5));
  copy.deathTime = 0;
  assert.equal(mobPose(clientAngles(live, copy), 0.5).death, deathTipAngle(3, 0.5), "a copy that has not counted falls back to the live counter (dragon)");
});

test("mutation check: reading the position after the interpolation shifts the particles", () => {
  const c = ref.death[1], e = make(c);
  c.ticks.forEach(([st, x, y, z, , , particles]) => {
    if (st === 3) e.dead = true;
    e.x = x + 1; e.y = y; e.z = z; e.fx.length = 0; // wrong: the post-interpolation position
    e.step();
    if (particles.length) assert.ok(!near(e.fx[0].x, Number(particles[0].split("|")[1])));
  });
});

for (const s of status.status) test(`horse copy ${s.name}: the whole 90-tick status record incl. the deathTime 20 poofs (tick 79) with the death update before the tail roll`, () => {
  const e = new ClientEntity("horse");
  e.present = true; e.width = 1.4; e.height = 1.6; e.rand = new Log(s.seed);
  let dead = false;
  s.ticks.forEach(([st, draws], i) => {
    e.rand.log.length = 0;
    if (st) { horseCopyStatus(e, st); if (st === 3) dead = e.dead = true; }
    e.step(); // onEntityUpdate: the death update
    stepHorseCopy(e, 0, { alive: !dead, child: s.age < 0, type: s.type }); // wi.e(): living sound (alive only), tail roll
    assert.equal(e.rand.log.join(" "), draws, `${s.name} tick ${i}`);
  });
  assert.equal(e.deathTime, 20);
  assert.equal(e.fx.length, 20);
});

test("EntityWorld: the live mob's death update still draws its 20 puffs (server side) but only spawns visible particles when no client copy is tracked", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const run = (tracked) => {
    const w = new EntityWorld(terrain, [{ id: "mob-1", type: "zombie", x: 64, y: 0, z: 64, health: 20 }], () => 0.5);
    const spawned = []; w.fx = { spawn: (...a) => spawned.push(a) };
    w.tracker = { clientIfTracked: () => (tracked ? {} : null) };
    const e = w.entities[0]; e.health = 0; e.death = 19;
    w.deathUpdate(e, { width: 0.6, height: 1.8 });
    return spawned.length;
  };
  assert.equal(run(false), 20);
  assert.equal(run(true), 0);
});
