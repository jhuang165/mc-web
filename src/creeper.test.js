// Replays the creeper records of public/research/creeper-reference.json
// (tools/verify-creepers.mjs): EntityCreeper's fuse, fall and drops, the swell task,
// ModelCreeper's pose and the probed constants, against creeper.js and entities.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { creeperFields, creeperTick, creeperFlash, creeperFall, swellShould, swellState, creeperSafeTries, creeperDrops, creeperPose, creeperScale, creeperWhite, CREEPER_FUSE, CREEPER_RADIUS, GUNPOWDER } from "./creeper.js";
import { ENTITY_TYPES, EntityWorld, setEntityRandom } from "./entities.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/creeper-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;

test("probed EntityCreeper constants", () => {
  const c = records("facts")[0].creeper, t = ENTITY_TYPES.creeper;
  assert.equal(f(t.width), f(c.width));
  assert.equal(f(t.height), f(c.height));
  assert.equal(f(f(t.height) * f(0.85)), f(c.eye));
  assert.equal(t.health, c.health);
  assert.equal(t.movement, c.speed);
  assert.equal(CREEPER_FUSE, c.fuse);
  assert.equal(CREEPER_RADIUS, c.radius);
  assert.equal(creeperSafeTries(false, 20), c.safeTries);
  assert.equal(c.ambient, true); // getLivingSound is null
  assert.equal(c.hurt, "mob.creeper.say");
  assert.equal(c.death, "mob.creeper.death");
});

test("EntityCreeper.onUpdate fuse, flash and explosion for every scenario", () => {
  for (const r of records("fuse")) {
    const e = { ...creeperFields(), x: 0.5, y: 0, z: 0.5, alive: true };
    if (r.scenario === "ignite" || r.scenario === "dead") e.ignited = true;
    if (r.scenario === "powered") e.powered = e.ignited = true;
    let explodedAt = -1, explosion = null;
    r.ticks.forEach((t, i) => {
      if (explodedAt >= 0) return;
      if (r.scenario.startsWith("swell")) e.creeperState = r.scenario === "swell-release" && i >= 12 ? -1 : 1;
      if (r.scenario === "dead" && i === 10) e.alive = false;
      const out = e.alive ? creeperTick(e) : {};
      const sounds = out.sound ? [`${out.sound.name}|${out.sound.volume.toFixed(1)}|${out.sound.pitch}`] : [];
      assert.deepEqual([e.creeperState, e.fuseTime, e.lastActive, creeperFlash(e, 0), creeperFlash(e, 0.5), sounds], [t.state, t.t, t.last, f(t.flash0), f(t.flash5), t.sounds], r.scenario + " tick " + i);
      if (out.explode) { explodedAt = i; explosion = out.explode; }
    });
    assert.equal(explodedAt, r.explodedAt, r.scenario);
    if (r.explosion) assert.deepEqual([explosion.x, explosion.y, explosion.z, explosion.size], r.explosion.slice(0, 4));
  }
});

test("EntityCreeper.fall advances the fuse by distance * 1.5 up to fuse - 5", () => {
  for (const r of records("fall")) {
    const e = { ...creeperFields(), fuseTime: r.start };
    creeperFall(e, f(r.distance));
    assert.equal(e.fuseTime, r.t, JSON.stringify(r));
  }
});

test("EntityAICreeperSwell shouldExecute and updateTask", () => {
  for (const r of records("swell")) {
    // Feet-to-feet distance along z; the wall block row at z = 0 hides a target past z = 0
    // (at distance 1 the target stands on the block's face and is still seen).
    const d = r.distance === null ? null : r.distance * r.distance;
    const should = swellShould(r.state, d);
    assert.equal(should, r.should, JSON.stringify(r));
    assert.equal(should ? swellState(d, !(r.wall && r.distance > 1)) : r.state, r.after, JSON.stringify(r));
  }
});

test("dropFewItems gives rand.nextInt(3) gunpowder", () => {
  for (const r of records("cdrops")) {
    const rand = new JavaRandom(r.seed);
    assert.equal(creeperDrops((n) => rand.nextInt(n)), r.gunpowder, "seed " + r.seed);
    assert.equal(r.other, 0);
  }
});

test("ModelCreeper.setRotationAngles", () => {
  for (const r of records("pose")) assert.deepEqual(creeperPose(r.swing, r.amount, r.yaw, r.pitch).map((p) => p.map((v) => v + 0)), r.parts.map((p) => p.map(f)), JSON.stringify(r));
});

test("RenderCreeper swell scale and white flash", () => {
  assert.deepEqual(creeperScale(0), [1, 1, 1]);
  const [x, y] = creeperScale(1), wobble = f(1 + f(f(Math.sin(100)) * 0.01));
  assert.ok(Math.abs(x - 1.4 * wobble) < 1e-4 && Math.abs(y - 1.1 / wobble) < 1e-4);
  assert.equal(creeperWhite(0.05), 0);
  assert.equal(creeperWhite(0.15), Math.trunc(f(f(f(0.15) * f(0.2)) * 255)) / 255);
});

// A creeper spawned by EntityWorld: datawatcher defaults, saved fields, death drops,
// the fuse explosion event and the fall pushing the fuse.
test("EntityWorld creepers explode, drop gunpowder and keep powered/ignited across a save", () => {
  const ground = { get: (x, y) => (y < 32 ? 3 : 0), getMeta: () => 0, solid: (x, y) => y < 32, surface: () => 32, spawn: () => ({ x: 64, z: 64 }), numericSeed: 1 };
  const w = new EntityWorld(ground, [{ id: "mob-1", type: "creeper", x: 64.5, y: 32, z: 64.5, health: 20, powered: true, ignited: true, fuseTime: 12, creeperState: 1 }]);
  const e = w.entities[0];
  assert.equal(e.powered, true);
  assert.equal(e.ignited, true);
  assert.equal(e.fuseTime, 0); // timeSinceIgnited is not in the NBT
  const survival = { time: 1000, creative: false, health: 20, damage() {}, count: () => 0 };
  let boom = null;
  for (let i = 0; i < 40 && !boom; i++) {
    w.tick({ x: 80, y: 32, z: 80 }, survival);
    boom = w.events.find((ev) => ev.explode);
  }
  assert.ok(boom);
  assert.equal(boom.explode.size, 6);
  assert.equal(boom.explode.source, e);
  assert.ok(w.events.some((ev) => ev.sound === "creeper.primed" && ev.pitch === 0.5));
  assert.equal(w.entities.includes(e), false);
  // Killed: nextInt(3) gunpowder on Entity.rand, then 5 XP at deathTime 20; no ambient say.
  const w2 = new EntityWorld(ground, [{ id: "mob-1", type: "creeper", x: 64.5, y: 32, z: 64.5, health: 20 }]);
  setEntityRandom(w2.entities[0], { nextInt: (n) => n - 1, nextFloat: () => 0.99, nextDouble: () => 0.99, nextGaussian: () => 0 });
  w2.damage(w2.entities[0], 30, 64, 64);
  assert.equal(w2.events.filter((ev) => ev.drop === GUNPOWDER && ev.count === 1).length, 2);
  for (let i = 0; i < 20; i++) w2.deathUpdate(w2.entities[0], ENTITY_TYPES.creeper);
  assert.ok(w2.events.some((ev) => ev.xp === 5));
  assert.ok(w2.events.some((ev) => ev.sound === "mob.creeper.death"));
  const w3 = new EntityWorld(ground, [{ id: "mob-1", type: "creeper", x: 64.5, y: 32, z: 64.5, health: 20 }]);
  w3.damage(w3.entities[0], 1, 64, 64);
  assert.ok(w3.events.some((ev) => ev.sound === "mob.creeper.say"));
  w3.fall(w3.entities[0], 7);
  assert.equal(w3.entities[0].fuseTime, 10);
});
