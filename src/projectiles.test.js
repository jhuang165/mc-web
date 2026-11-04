import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { GaussianRandom, Projectiles, heading, inWater, intercept, launch, mobTargets, rayBounds, rayTraceBlocks, thrownHit } from "./projectiles.js";

// Stone below y = 10; extra cells (x,y,z -> id) override it.
const stage = (cells = {}) => ({
  get: (x, y, z) => cells[[x, y, z]] ?? (y < 10 && y >= 0 ? 3 : 0),
  solid(x, y, z) {
    const b = this.get(x, y, z);
    return b !== 0 && b !== 10 && b !== 20 && !(b >= 31 && b <= 39);
  },
});
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const still = { nextGaussian: () => 0 };
const air = stage();

test("GaussianRandom reproduces java.util.Random.nextGaussian", () => {
  const r = new GaussianRandom(0);
  near(r.nextGaussian(), 0.8025330637390305, 1e-15);
  near(r.nextGaussian(), -0.9015460884175122, 1e-15);
  near(r.nextGaussian(), 2.080920790428163, 1e-15);
});

// tools/probes/SnowballProbe.java: zj.c(dx, dy, dz, 1.5f, inaccuracy) with
// Entity.rand = new Random(seed), run against the unchanged 1.7.10 classes.
const PROBE = [
  [1, [0.3, -0.2, 0.9], 1, 0.48170735892034416, -0.3162684359164881, 1.3801424044239363, 19.240381, -12.208158],
  [42, [0, 0, 1], 1, 0.012846434511931673, 0.010343339194864711, 1.4893140005738281, 0.4942062, 0.39790004],
  [12345, [-0.5, 0.1, 0.2], 1, -1.3714191934905042, 0.28048117676539613, 0.5583965905029937, -67.84547, 10.725852],
  [987654321, [0, -1, 0], 1, -0.006327548490421281, -1.4896059193032616, -0.0010198361268200413, -99.155846, -89.75348],
  [7, [0.1, 0.5, -0.8], 0, 0.15811387910417427, 0.7905693955208712, -1.2649110328333941, 172.87498, 31.806099],
  [-5, [0.4, 0.1, -0.3], 1, 1.1629654508817253, 0.284299260861069, -0.8918409328122152, 127.48344, 10.978265],
];
test("heading matches EntityThrowable.setThrowableHeading from the original classes", () => {
  for (const [seed, d, inaccuracy, mx, my, mz, yaw, pitch] of PROBE) {
    const h = heading(new GaussianRandom(seed), ...d, 1.5, inaccuracy);
    near(h.mx, mx, 1e-12);
    near(h.my, my, 1e-12);
    near(h.mz, mz, 1e-12);
    assert.equal(h.yaw, Math.fround(yaw));
    assert.equal(h.pitch, Math.fround(pitch));
  }
});

test("a throw leaves 0.16 to the player's right and 0.1 below the eye at 1.5 blocks/tick", () => {
  // Looking along -z: the right hand is +x.
  let b = launch(still, { x: 10, y: 20, z: 10 }, 0, 0);
  near(b.x, 10.16, 1e-6);
  near(b.y, 20 + Math.fround(1.62) - 0.10000000149011612, 1e-12);
  near(b.z, 10, 2e-5);
  near(b.mz, -1.5, 1e-6);
  near(b.my, 0, 1e-6);
  // Looking along -x: the right hand is -z.
  b = launch(still, { x: 10, y: 20, z: 10 }, Math.PI / 2, 0);
  near(b.x, 10, 2e-5);
  near(b.z, 9.84, 1e-6);
  near(b.mx, -1.5, 1e-6);
  // Looking straight up.
  b = launch(still, { x: 0, y: 0, z: 0 }, 0, Math.PI / 2);
  near(b.my, 1.5, 1e-3);
  near(Math.hypot(b.mx, b.mz), 0, 1e-3);
});

test("a ball in open air moves, then loses 1% speed and 0.03 per tick", () => {
  const p = new Projectiles(seeded());
  p.load([{ x: 5, y: 40, z: 5, mx: 0, my: 0, mz: -1.5, yaw: 0, pitch: 0 }]);
  const b = p.balls[0];
  p.tick(air);
  near(b.z, 3.5, 1e-12);
  near(b.y, 40, 1e-12);
  near(b.mz, -1.5 * Math.fround(0.99), 1e-12);
  near(b.my, -Math.fround(0.03), 1e-12);
  assert.equal(b.px, 5);
  assert.equal(b.pz, 5);
  p.tick(air);
  near(b.y, 40 - Math.fround(0.03), 1e-12);
  assert.equal(b.ticks, 2);
});

test("water slows a ball by 0.8 only while its box reaches a water cell it overlaps", () => {
  const w = stage({ [[5, 20, 5]]: 10 });
  assert.equal(inWater(w, 5.5, 20.3, 5.5), true);
  assert.equal(inWater(w, 5.5, 20.15, 5.5), false);
  assert.equal(inWater(w, 5.5, 20.151, 5.5), true);
  assert.equal(inWater(w, 5.5, 20.6, 5.5), false);
  assert.equal(inWater(w, 5.5, 19.3, 5.5), false);
  // A box straddling x = 6 also sees the water next door.
  assert.equal(inWater(stage({ [[6, 20, 5]]: 10 }), 5.9, 20.3, 5.5), true);
  const p = new Projectiles(seeded());
  p.load([{ x: 5.5, y: 20.3, z: 5.5, mx: 0.1, my: 0, mz: 0, yaw: 0, pitch: 0 }]);
  p.tick(w);
  near(p.balls[0].mx, 0.1 * Math.fround(0.8), 1e-12);
  near(p.balls[0].my, -Math.fround(0.03), 1e-12);
});

test("rayTraceBlocks stops at the first solid face, passing air and water", () => {
  const w = stage({ [[3, 12, 3]]: 10, [[4, 12, 3]]: 3 });
  const hit = rayTraceBlocks(w, [0.5, 12.5, 3.5], [6.5, 12.5, 3.5]);
  assert.deepEqual(hit.block, [4, 12, 3]);
  assert.equal(hit.side, 4);
  near(hit.vec[0], 4, 1e-12);
  // Down onto the floor (top face = side 1).
  const floor = rayTraceBlocks(air, [2.5, 14, 2.5], [2.5, 8, 2.5]);
  assert.deepEqual(floor.block, [2, 9, 2]);
  assert.equal(floor.side, 1);
  near(floor.vec[1], 10, 1e-12);
  assert.equal(rayTraceBlocks(air, [2.5, 14, 2.5], [2.5, 12, 2.5]), null);
  assert.equal(rayTraceBlocks(air, [NaN, 1, 1], [1, 1, 1]), null);
  // Below the world is air, so a ball does not stop at y < 0.
  assert.equal(rayTraceBlocks({ get: () => 0 }, [0.5, 1, 0.5], [0.5, -10, 0.5]), null);
});

test("tall grass, crops, torches and chests are hit only inside their own bounds", () => {
  const grass = stage({ [[4, 10, 4]]: 39 });
  assert.ok(rayTraceBlocks(grass, [0, 10.5, 4.5], [8, 10.5, 4.5]));
  assert.equal(rayTraceBlocks(grass, [0, 10.9, 4.5], [8, 10.9, 4.5]), null);
  assert.equal(rayTraceBlocks(grass, [4.05, 10.5, 0], [4.05, 10.5, 8]), null);
  const wheat = stage({ [[4, 10, 4]]: 35 });
  assert.equal(rayTraceBlocks(wheat, [0, 10.5, 4.5], [8, 10.5, 4.5]), null);
  assert.ok(rayTraceBlocks(wheat, [0, 10.2, 4.5], [8, 10.2, 4.5]));
  const torch = stage({ [[4, 10, 4]]: 20 });
  assert.equal(rayTraceBlocks(torch, [0, 10.3, 4.2], [8, 10.3, 4.2]), null);
  assert.ok(rayTraceBlocks(torch, [0, 10.3, 4.5], [8, 10.3, 4.5]));
  assert.equal(rayTraceBlocks(torch, [0, 10.7, 4.5], [8, 10.7, 4.5]), null);
  const chest = stage({ [[4, 10, 4]]: 41 });
  assert.equal(rayTraceBlocks(chest, [0, 10.95, 4.5], [8, 10.95, 4.5]), null);
  near(rayTraceBlocks(chest, [0, 10.5, 4.5], [8, 10.5, 4.5]).vec[0], 4.0625, 1e-12);
});

test("block ray bounds agree with the original defaults where the ray box is the default box", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/shadow-reference.json", import.meta.url))).blocks;
  for (const [id, b] of Object.entries(ref)) {
    const w = { ...stage({ [[1, 1, 1]]: Number(id) }), getMeta: () => 0 };
    // The torch's ray box is set in BlockTorch.collisionRayTrace, not by default.
    if (Number(id) === 20) continue;
    // A fence's ray box is its connection bounds (BlockFence.setBlockBoundsBasedOnState), tested below.
    if ([60,69,72,73,85,97,98,99,100,104,107,108,109,110,111,112,113,114,118,119,120,124,125,126,127,128,129,135,136,137].includes(Number(id))) continue; // 135-137: powered/detector/activator rails shape their box per metadata like rail 61 // 119-129: torches, button, plates, comparators and sensor shape their boxes per metadata (redstone-blocks-2.test.js ray cases). 85: the anvil's box follows its metadata (BlockAnvil.setBlockBoundsBasedOnState; tested below), the regenerated probe records the constructor default. State-dependent bounds (doors and panes: doors-panes.test.js); constructor defaults are not ray boxes. 107-114: redstone components, per-metadata boxes (redstone-blocks.test.js). 104: the raw field stays 1.0, but BlockEndPortalFrame.addCollisionBoxesToList ends with setBlockBoundsForItemRender (0.8125), which is the ray box in play (stone-utility.test.js). 118: the piston head's box follows its facing metadata (dispenser-piston.test.js).
    assert.deepEqual(rayBounds(w, 1, 1, 1, Number(id)).map((v) => Math.fround(v)), b.bounds.map((v) => Math.fround(v)), "block " + id);
  }
  assert.deepEqual(rayBounds(stage(), 1, 1, 1, 20), [0.4000000059604645, 0, 0.4000000059604645, 0.6000000238418579, 0.6000000238418579, 0.6000000238418579]);
  // Fence: the post alone, or the post widened towards connected sides; rails rise to 0.625 ascending.
  assert.deepEqual(rayBounds(stage({ [[1, 11, 1]]: 60 }), 1, 11, 1, 60), [0.375, 0, 0.375, 0.625, 1, 0.625]);
  assert.deepEqual(rayBounds(stage({ [[1, 11, 1]]: 60, [[2, 11, 1]]: 3 }), 1, 11, 1, 60), [0.375, 0, 0.375, 1, 1, 0.625]);
  assert.deepEqual(rayBounds({ ...stage(), getMeta: () => 2 }, 1, 11, 1, 61), [0, 0, 0, 1, 0.625, 1]);
  assert.deepEqual(rayBounds({ ...stage(), getMeta: () => 1 }, 1, 11, 1, 20), [0, 0.20000000298023224, 0.3499999940395355, 0.30000001192092896, 0.800000011920929, 0.6499999761581421]);
});

test("anvil projectile rays use the metadata-oriented BlockAnvil selection box", () => {
  for (const [meta, expected] of [
    [0, [0.125, 0, 0, 0.875, 1, 1]], [1, [0, 0, 0.125, 1, 1, 0.875]],
    [2, [0.125, 0, 0, 0.875, 1, 1]], [3, [0, 0, 0.125, 1, 1, 0.875]],
  ]) {
    const w = { ...stage({ [[1, 1, 1]]: 85 }), getMeta: () => meta };
    assert.deepEqual(rayBounds(w, 1, 1, 1, 85), expected);
  }
});

test("intercept picks the nearest face and ignores near-parallel planes", () => {
  const r = intercept([0, 0, 0, 1, 1, 1], [-1, 0.5, 0.5], [2, 0.5, 0.5]);
  assert.equal(r.side, 4);
  assert.deepEqual(r.vec, [0, 0.5, 0.5]);
  assert.equal(intercept([0, 0, 0, 1, 1, 1], [-1, 0.5, 5], [2, 0.5, 5]), null);
  // From inside, only the exit face is found.
  assert.equal(intercept([0, 0, 0, 1, 1, 1], [0.5, 0.5, 0.5], [2, 0.5, 0.5]).side, 5);
  assert.equal(intercept([0, 0, 0, 1, 1, 1], [0.5, 0.5, 0.5], [0.8, 0.5, 0.5]), null);
});

test("hitting a block removes the ball and bursts eight particles at its current position", () => {
  const p = new Projectiles(seeded(3));
  p.load([{ x: 2.5, y: 11, z: 2.5, mx: 0, my: -2, mz: 0, yaw: 0, pitch: 0 }]);
  p.tick(air);
  assert.equal(p.balls.length, 0);
  assert.equal(p.particles.length, 8);
  // The burst is spawned before the particles' own first update, at (2.5, 11, 2.5).
  for (const q of p.particles) {
    near(q.px, 2.5, 1e-12);
    near(q.py, 11, 1e-12);
    assert.equal(q.age, 1);
  }
});

test("a ball hits the nearest mob in its path once, and a mob behind a block is not reached", () => {
  const hits = [];
  const box = (z) => ({ ref: "z" + z, box: [4.7, 20, z, 5.3, 21.8, z + 0.6] });
  const p = new Projectiles(seeded());
  p.load([{ x: 5, y: 20.5, z: 0, mx: 0, my: 0, mz: 1.5, yaw: 0, pitch: 0 }]);
  p.tick(air, [box(2.2), box(1.4)], (ref) => hits.push(ref));
  assert.deepEqual(hits, ["z1.4"]);
  assert.equal(p.balls.length, 0);
  assert.equal(p.particles.length, 8);
  // Ball at y 11 above the floor at y 10 heading down: a mob below the floor is shielded.
  const q = new Projectiles(seeded());
  q.load([{ x: 5, y: 11, z: 5, mx: 0, my: -3, mz: 0, yaw: 0, pitch: 0 }]);
  const seen = [];
  q.tick(air, [{ ref: "under", box: [4.7, 5, 4.7, 5.3, 6.8, 5.3] }], (r) => seen.push(r));
  assert.deepEqual(seen, []);
  assert.equal(q.balls.length, 0);
});

test("the thrower is passed over until the ball has been in the air five ticks", () => {
  const target = { ref: "player", thrower: true, box: [4.7, 20, 4.7, 5.3, 21.8, 5.3] };
  for (const [ticks, expected] of [[3, 0], [4, 1]]) {
    const hits = [], p = new Projectiles(seeded());
    p.load([{ x: 5, y: 22.4, z: 5, mx: 0, my: -1, mz: 0, yaw: 0, pitch: 0 }]);
    p.balls[0].ticks = ticks;
    p.tick(air, [target], (r) => hits.push(r));
    assert.equal(hits.length, expected);
    assert.equal(p.balls.length, expected ? 0 : 1);
  }
});

test("a box that the ball begins inside is missed unless the ball leaves through a face this tick", () => {
  const target = { ref: "m", box: [4, 20, 4, 6, 22, 6] };
  const p = new Projectiles(seeded()), hits = [];
  p.load([{ x: 5, y: 21, z: 5, mx: 0.1, my: 0, mz: 0, yaw: 0, pitch: 0 }]);
  p.tick(air, [target], (r) => hits.push(r));
  assert.deepEqual(hits, []);
  assert.equal(p.balls.length, 1);
});

test("thrown damage is zero but still flashes, hurts out loud and knocks a mob away from the thrower", () => {
  const e = { type: "pig", health: 10, hurt: 0, flee: 0, love: 600, mateTicks: 3, x: 5, y: 10, z: 5, yaw: 0, vx: 0, vy: 0, vz: 0 }, mobs = Object.assign(Object.create(EntityWorld.prototype), { entities: [e], events: [] });
  assert.equal(thrownHit(mobs, e, { x: 5, y: 10, z: 8 }), true);
  assert.equal(e.health, 10);
  assert.equal(e.hurt, 10);
  assert.equal(e.flee, 60);
  assert.equal(e.love, 0);
  assert.equal(e.mateTicks, 0);
  // EntityLivingBase.knockBack (sv.a(Entity,F,DD)): 0.4 away from the thrower, 0.4 up.
  near(e.vz, -0.4, 1e-7);
  near(e.vx, 0, 1e-12);
  near(e.vy, 0.4, 1e-7);
  // getSoundVolume 1 and getSoundPitch's (rand - rand) * 0.2 + 1 on Entity.rand.
  assert.deepEqual(mobs.events.map((x) => [x.sound, x.volume, x.position]), [["mob.pig.say", 1, e]]);
  assert.ok(Math.abs(mobs.events[0].pitch - 1) <= 0.2);
  // Inside the hurt window the hit is refused (but the animal still panics).
  e.flee = 0;
  e.vy = 0;
  assert.equal(thrownHit(mobs, e, { x: 5, y: 10, z: 8 }), false);
  assert.equal(e.vy, 0);
  assert.equal(e.flee, 60);
  assert.equal(mobs.events.length, 1);
  const z = { type: "zombie", health: 20, hurt: 0, flee: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  mobs.entities.push(z);
  thrownHit(mobs, z, { x: 3, y: 0, z: 0 });
  assert.equal(z.flee, 0);
  assert.equal(mobs.events.at(-1).sound, "mob.zombie.hurt");
  const dead = { type: "cow", health: 0, hurt: 0, flee: 0, x: 0, y: 0, z: 0 };
  mobs.entities.push(dead);
  assert.equal(thrownHit(mobs, dead, { x: 1, y: 0, z: 0 }), false);
  assert.equal(thrownHit(mobs, { type: "cow" }, { x: 1, y: 0, z: 0 }), false);
});

test("mob and thrower boxes use each setSize, halved for calves", () => {
  const list = mobTargets(
    [
      { type: "cow", x: 10, y: 5, z: 10 },
      { type: "cow", x: 20, y: 5, z: 20, growingAge: -100 },
    ],
    { x: 1, y: 2, z: 3 },
  );
  assert.equal(list.length, 3);
  const [cow, calf, you] = list;
  near(cow.box[3] - cow.box[0], 0.9, 1e-6);
  near(cow.box[4] - cow.box[1], 1.3, 1e-6);
  near(calf.box[3] - calf.box[0], 0.45, 1e-6);
  near(calf.box[4] - calf.box[1], 0.65, 1e-6);
  assert.equal(you.thrower, true);
  near(you.box[3] - you.box[0], 0.6, 1e-6);
  near(you.box[4] - you.box[1], 1.8, 1e-6);
});

test("snowballpoof particles follow EntityBreakingFX's ranges and EntityFX's physics", () => {
  const p = new Projectiles(seeded(5));
  for (let i = 0; i < 200; i++) p.poof(5, 30, 5);
  for (const q of p.particles) {
    assert.ok(q.jx >= 0 && q.jx < 3 && q.jy >= 0 && q.jy < 3);
    assert.ok(q.scale >= 0.5 - 1e-6 && q.scale <= 1 + 1e-6, "scale " + q.scale);
    assert.ok(q.max >= 4 && q.max <= 40, "age " + q.max);
    // Speed is f * 0.4 (f in 0.15..0.45) plus 0.1 up.
    assert.ok(Math.hypot(q.mx, q.my - 0.1, q.mz) <= 0.45 * 0.4 + 1e-6);
  }
  const q = p.particles[0];
  Object.assign(q, { mx: 0.1, my: 0.2, mz: -0.1, age: 0, max: 5 });
  p.moveParticle(air, q);
  near(q.x, 5.1, 1e-12);
  near(q.y, 30 + 0.2 - 0.04, 1e-12);
  near(q.my, (0.2 - 0.04) * 0.9800000190734863, 1e-12);
  near(q.mx, 0.1 * 0.9800000190734863, 1e-12);
  assert.equal(q.age, 1);
  // Ages out when age reaches max, after one more update.
  q.age = 5;
  p.moveParticle(air, q);
  assert.equal(q.dead, true);
});

test("a particle lands on the floor, stops falling and loses 30% of its sideways speed", () => {
  const p = new Projectiles(seeded(5)), q = p.poof(5, 10.5, 5);
  Object.assign(q, { mx: 0.2, my: -0.5, mz: 0, age: 0, max: 40 });
  p.moveParticle(stage(), q);
  // Box bottom (y - 0.1) comes to rest on the top of the stone at y = 10.
  near(q.y - 0.10000000149011612, 10, 1e-9);
  assert.equal(q.onGround, true);
  near(q.mx, 0.2 * 0.9800000190734863 * 0.699999988079071, 1e-12);
  assert.equal(q.my, 0);
});

test("snowballs save position, motion and rotation, and restart their air time", () => {
  const p = new Projectiles(seeded(9));
  p.throwSnowball({ x: 8, y: 30, z: 8 }, 1, 0.2);
  p.tick(air);
  const saved = JSON.parse(JSON.stringify(p.serialize()));
  assert.equal(saved.length, 1);
  const q = new Projectiles(seeded(2));
  q.load([...saved, { x: NaN }, null]);
  assert.equal(q.balls.length, 1);
  assert.equal(q.balls[0].x, p.balls[0].x);
  assert.equal(q.balls[0].my, p.balls[0].my);
  assert.equal(q.balls[0].ticks, 0);
  q.clear();
  assert.equal(q.balls.length + q.particles.length, 0);
});

test("throwSnowball spawns from the eye and a flight lands about where the arc says", () => {
  const p = new Projectiles(seeded(11));
  const b = p.throwSnowball({ x: 64, y: 10, z: 64 }, 0, 0);
  let ticks = 0;
  while (p.balls.length && ticks < 100) (p.tick(stage()), ticks++);
  assert.equal(p.balls.length, 0);
  assert.ok(ticks > 8 && ticks < 30, "flew " + ticks);
  // It lands in front of the player, along -z, near the eye's x.
  assert.ok(b.z < 64 - 10 && Math.abs(b.x - 64.16) < 3);
  assert.equal(p.particles.length, 8);
});
