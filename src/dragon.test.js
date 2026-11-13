import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { exitPortalBlocks } from "./exit-portal.js";
import {
  DRAGON_MAX_HEALTH, DRAGON_SOUNDS, DRAGON_XP_TOTAL, PART_SIZES, createDragonState, dragonTick, deathTick, movementOffsets,
  attackFromPart, crystalUpdate, destroyBlocks, dragonBossStatus, livingHurt, wingFlapPitch,
} from "./dragon.js";
import { explosionImpact } from "./explosion.js";

const ref = JSON.parse(await readFile(new URL("../public/research/dragon-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const one = (c) => by(c)[0];


// java.util.Random.nextGaussian calls StrictMath.log (fdlibm e_log.c); V8's Math.log differs in the last bit
// for about 1.6% of inputs, which would break the multi-thousand tick digests. Ported here for the test only.

const buf = new DataView(new ArrayBuffer(8));
function strictLog(x) {
  const ln2_hi = 6.93147180369123816490e-01, ln2_lo = 1.90821492927058770002e-10;
  const Lg1 = 6.666666666666735130e-01, Lg2 = 3.999999999940941908e-01, Lg3 = 2.857142874366239149e-01, Lg4 = 2.222219843214978396e-01,
    Lg5 = 1.818357216161805012e-01, Lg6 = 1.531383769920937332e-01, Lg7 = 1.479819860511658591e-01;
  buf.setFloat64(0, x);
  let hx = buf.getInt32(0);
  let k = 0;
  if (hx < 0x00100000) { k -= 54; x *= 1.80143985094819840000e+16; buf.setFloat64(0, x); hx = buf.getInt32(0); }
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  buf.setInt32(0, hx | (i ^ 0x3ff00000));
  x = buf.getFloat64(0);
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) { if (k === 0) return 0; const dk = k; return dk * ln2_hi + dk * ln2_lo; }
    const R = f * f * (0.5 - 0.33333333333333333 * f);
    if (k === 0) return f - R;
    const dk = k; return dk * ln2_hi - ((R - dk * ln2_lo) - f);
  }
  const s = f / (2.0 + f), dk = k, z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * ln2_hi - ((hfsq - (s * (hfsq + R) + dk * ln2_lo)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * ln2_hi - ((s * (f - R) - dk * ln2_lo) - f);
}

class StrictRandom extends JavaRandom {
  nextGaussian() {
    if (this.haveNextGaussian) { this.haveNextGaussian = false; return this.nextGaussianValue; }
    let v1, v2, s;
    do { v1 = 2 * this.nextDouble() - 1; v2 = 2 * this.nextDouble() - 1; s = v1 * v1 + v2 * v2; } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * strictLog(s)) / s);
    this.nextGaussianValue = v2 * m;
    this.haveNextGaussian = true;
    return v1 * m;
  }
}

const noWorld = () => 0;
function host(seed, extra = {}) {
  return { rand: new StrictRandom(seed), players: [], crystals: () => [], living: () => [], blockKind: noWorld, removeBlock: () => false, griefing: true, particle() {}, ...extra };
}
function dragon(x, y, z, yaw, seed, extra = {}) {
  const e = { x, y, z, vx: 0, vy: 0, vz: 0, rotationYaw: yaw, health: DRAGON_MAX_HEALTH, hurtTime: 0, ticksExisted: 0 };
  createDragonState(e);
  return { e, h: host(seed, extra) };
}
const nextLong = (r) => String(BigInt.asIntN(64, (BigInt(r.next(32)) << 32n) + BigInt(r.next(32))));
const hit = (a, b) => a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5];

test("facts: health, size, parts and sounds", () => {
  const r = one("facts");
  assert.equal(r.maxHealth, DRAGON_MAX_HEALTH);
  assert.equal(r.partCount, 7);
  assert.equal(r.targetY, 100);
  assert.equal(r.growl, DRAGON_SOUNDS.growl);
  assert.equal(r.hit, DRAGON_SOUNDS.hit);
  assert.equal(r.volume, DRAGON_SOUNDS.volume);
  assert.equal(r.bo, -1);
  assert.equal(PART_SIZES.length, 7);
  const { e } = dragon(0, 128, 0, 90, 5);
  assert.equal(e.dragon.ti ?? e.dragon.ty, 100);
  assert.equal(e.dragon.ri, -1);
});

test("flight replays the original tick: position, yaw, targets, motion, animation, ring and part boxes", () => {
  for (const r of by("flight")) {
    const { e, h } = dragon(0, 128, 0, r.yaw, r.seed, { players: r.players.map((p) => ({ x: p[0], z: p[2], minY: p[1] })) });
    const md = createHash("sha1");
    const d = (v) => { const b = Buffer.alloc(8); b.writeDoubleBE(v); md.update(b); };
    for (let t = 0; t < r.full + r.digestTicks; t++) {
      e.ticksExisted++;
      dragonTick(e, h);
      const s = e.dragon;
      if (t < r.full) {
        const got = [e.x, e.y, e.z, e.rotationYaw, s.tx, s.ty, s.tz, e.vx, e.vy, e.vz, s.anim, s.slowed ? 1 : 0, s.ri];
        const want = r.trace[t];
        got.forEach((v, i) => assert.ok(Object.is(v, want[i]) || v === want[i], `${r.name} tick ${t} field ${i}: ${v} vs ${want[i]}`));
        if (t < 60) s.parts.forEach((p, i) => assert.deepEqual(p.box, r.parts[t][i], `${r.name} tick ${t} part ${i}`));
      } else {
        for (const v of [e.x, e.y, e.z, e.rotationYaw, s.tx, s.ty, s.tz, e.vx, e.vy, e.vz, s.anim, s.ryv]) d(v);
        md.update(Buffer.from([s.slowed ? 1 : 0, s.ri]));
        for (const p of s.parts) for (const v of p.box) d(v);
      }
    }
    assert.equal(md.digest("hex"), r.digest, `${r.name} digest`);
  }
});

test("getMovementOffsets samples the ring buffer like the original", () => {
  const r = one("ring");
  const { e, h } = dragon(3, 100, -4, 20, 11);
  for (let t = 0; t < 150; t++) dragonTick(e, h);
  assert.equal(e.dragon.ri, r.index);
  for (const [n, p, a, b, c] of r.samples) assert.deepEqual(movementOffsets(e, n, p), [a, b, c], `n=${n} p=${p}`);
  e.health = 0;
  for (const [n, a, b, c] of r.dead) assert.deepEqual(movementOffsets(e, n, 0.5), [a, b, c]);
});

test("attackEntityFromPart: damage scaling, hurt window, retarget and random draws", () => {
  for (const r of by("damage")) {
    const { e, h } = dragon(10, 100, -6, 135, 77 + r.part);
    for (let t = 0; t < 3; t++) dragonTick(e, h);
    const source = r.source === "player" ? { player: true } : r.source === "explosion" ? { explosion: true } : {};
    const before = [e.dragon.tx, e.dragon.ty, e.dragon.tz];
    assert.equal(attackFromPart(e, r.part, source, r.amount, h), r.result);
    const s = e.dragon;
    assert.equal(e.health, r.healthAfter, JSON.stringify([r.part, r.source, r.amount]));
    assert.equal(e.hurtTime, r.hurtTime);
    assert.equal(e.rotationYaw, r.yaw);
    assert.equal(e.y, r.posY);
    assert.deepEqual([s.tx, s.ty, s.tz], r.target);
    assert.equal(before.some((v, i) => v !== [s.tx, s.ty, s.tz][i]), r.targetChanged);
    assert.equal(nextLong(h.rand), r.rand);
  }
  const m = one("damageMain");
  assert.equal(m.result, false); // the dragon entity itself is not hittable; only the parts are
  const w = one("hurtWindow");
  const { e, h } = dragon(0, 100, 0, 0, 3);
  w.seq.forEach(([amount, result, health, hurt]) => {
    assert.equal(attackFromPart(e, 0, { player: true }, amount, h), result);
    assert.equal(e.health, health);
    assert.equal(e.hurtTime, hurt);
  });
});

test("crystal healing: nearest crystal in 32 blocks, +1 per 10 ticks, a dead crystal strikes the head for 10", () => {
  for (const r of by("crystal")) {
    const { e, h } = dragon(0, 100, 0, 0, 101 + r.variant);
    e.health = r.variant === 3 ? 195 : 100;
    const cs = r.crystals.map(([x, y, z]) => ({ x, y, z, dead: false, box: [x - 1, y - 1, z - 1, x + 1, y + 1, z + 1] }));
    h.crystals = (box) => cs.filter((c) => hit(c.box, box));
    for (let t = 0; t < 300; t++) {
      e.ticksExisted++;
      if (r.variant >= 2 && t === 120) {
        const healer = e.dragon.healer;
        if (healer) { healer.dead = true; assert.equal(cs.indexOf(healer), r.destroyed[1]); }
      }
      crystalUpdate(e, h);
      const [health, idx, hurt] = r.trace[t];
      assert.equal(e.health, health, `variant ${r.variant} tick ${t} health`);
      assert.equal(cs.indexOf(e.dragon.healer), idx, `variant ${r.variant} tick ${t} crystal`);
      assert.equal(e.hurtTime, hurt);
    }
  }
});

test("wings push living entities away from the body, the head hurts for 10, a hurt dragon does neither", () => {
  const make = (x, y, z) => {
    const b = [x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3];
    const z0 = { living: true, x, z, vel: [0, 0, 0], hurts: [], push(a, b2, c) { this.vel[0] += a; this.vel[1] += b2; this.vel[2] += c; }, hurt(d) { this.hurts.push(d); } };
    return { v: z0, box: b };
  };
  for (const r of by("collide")) {
    const { e, h } = dragon(0.25, 100, 0.5, 0, 21);
    for (let t = 0; t < 2; t++) dragonTick(e, h);
    const { v, box } = make(...r.spot);
    h.living = (b) => (hit(box, b) ? [v] : []);
    dragonTick(e, h);
    assert.deepEqual(e.dragon.parts[0].box, r.head);
    assert.deepEqual(e.dragon.parts[5].box, r.wing1);
    assert.deepEqual(e.dragon.parts[6].box, r.wing2);
    assert.deepEqual(e.dragon.parts[1].box, r.body);
    assert.equal(v.hurts.length > 0, r.healthAfter < r.healthBefore, `hurt at ${r.spot}`);
    assert.ok(v.hurts.every((d) => d === 10));
    if (!v.hurts.length) assert.deepEqual(v.vel, r.velocity, `push at ${r.spot}`);
  }
  const r = one("collideHurt");
  const { e, h } = dragon(0.25, 100, 0.5, 0, 21);
  for (let t = 0; t < 2; t++) dragonTick(e, h);
  const { v, box } = make(4.5, 100, 0);
  h.living = (b) => (hit(box, b) ? [v] : []);
  e.hurtTime = 5;
  dragonTick(e, h);
  assert.deepEqual(v.vel, r.velocity);
});

test("destroyBlocksInAABB removes everything but obsidian, end stone and bedrock; mobGriefing off removes nothing", () => {
  const kind = (id) => (id === 0 ? 0 : id === 49 || id === 121 || id === 7 ? 1 : 2);
  for (const r of by("destroy")) {
    const grid = new Map(r.grid.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
    const { e, h } = dragon(0, 100, 0, 0, 5 + r.pattern, {
      griefing: r.grief,
      blockKind: (x, y, z) => kind(grid.get(`${x},${y},${z}`) ?? 0),
      removeBlock: (x, y, z) => { const k = `${x},${y},${z}`; const had = (grid.get(k) ?? 0) !== 0; grid.set(k, 0); return had; },
    });
    const parts = [];
    h.particle = (n, x, y, z) => parts.push([n, x, y, z]);
    const b = r.box;
    assert.equal(destroyBlocks(e, b, h), r.result);
    const after = [];
    for (let x = Math.floor(b[0]) - 1; x <= Math.floor(b[3]) + 1; x++) for (let y = Math.floor(b[1]) - 1; y <= Math.floor(b[4]) + 1; y++) for (let z = Math.floor(b[2]) - 1; z <= Math.floor(b[5]) + 1; z++) after.push(grid.get(`${x},${y},${z}`) ?? 0);
    assert.deepEqual(after, r.after);
    assert.deepEqual(parts, r.particles);
    assert.equal(nextLong(h.rand), r.nextLong);
  }
  // flying into a wall: the head and body break stone, obsidian slows the dragon
  const r = one("destroyTicks");
  const cells = new Map();
  for (let x = -8; x <= 8; x++) for (let y = 96; y <= 106; y++) for (let z = -3; z <= 3; z++) cells.set(`${x},${y},${z}`, (x + y + z) % 5 === 0 ? 49 : 1);
  let writes = 0;
  const { e, h } = dragon(0.25, 100, 0.5, 0, 33, {
    blockKind: (x, y, z) => kind(cells.get(`${x},${y},${z}`) ?? 0),
    removeBlock: (x, y, z) => { const k = `${x},${y},${z}`; const had = (cells.get(k) ?? 0) !== 0; cells.set(k, 0); writes++; return had; },
  });
  r.trace.forEach(([st, count], t) => {
    dragonTick(e, h);
    const s = e.dragon;
    const got = [e.x, e.y, e.z, e.rotationYaw, s.tx, s.ty, s.tz, e.vx, e.vy, e.vz, s.anim, s.slowed ? 1 : 0, s.ri];
    got.forEach((v, i) => assert.ok(v === st[i], `tick ${t} field ${i}: ${v} vs ${st[i]}`));
    assert.equal(writes, count, `tick ${t} block writes`);
  });
});

test("death: 200 ticks rising and spinning, 12000 xp, world event 1018, then the exit portal", () => {
  assert.equal(DRAGON_XP_TOTAL, 12000);
  for (const r of by("death")) {
    const orbs = [], events = [], parts = [], orbAt = [];
    let portal = null, tickNow = 0;
    const { e, h } = dragon(r.start[0] + 0.5, 100, r.start[1] + 0.5, 30, 9, {
      particle: (n, x, y, z) => parts.push([n, x, y, z]),
    });
    for (let t = 0; t < 5; t++) dragonTick(e, h);
    Object.assign(h, { orb: (n) => { orbs.push(n); orbAt.push([tickNow, n, e.x, e.y, e.z]); }, worldEvent: (...a) => events.push([...a, 0]), portal: (x, z) => { portal = [x, z]; } });
    parts.length = 0;
    e.health = 0;
    let dead = false;
    for (let t = 1; t <= 205; t++) {
      tickNow = t;
      if (!dead) { dead = deathTick(e, h) || dead; dragonTick(e, h); }
      const [, bb, x, y, z, yaw, , k, n, ev, np] = r.trace[t - 1];
      assert.equal(e.dragon.deathTicks, bb, `t=${t}`);
      assert.deepEqual([e.x, e.y, e.z, e.rotationYaw], [x, y, z, yaw], `t=${t}`);
      assert.equal(dead ? 1 : 0, k);
      assert.equal(orbs.length, n);
      assert.equal(events.length, ev);
      assert.equal(parts.length, np);
    }
    assert.deepEqual(orbs, r.orbs);
    // b56 (executed): each orb is spawned at the dragon's position before that tick's 0.1 rise; [tick, value, x, y, z] (the orb's own motion is its unseeded Random)
    assert.deepEqual(orbAt, r.orbAt.map(([t, n, x, y, z]) => [t, n, x, y, z]));
    assert.equal(orbs.reduce((a, b) => a + b, 0), 12000);
    assert.deepEqual(events, r.events);
    assert.deepEqual(parts, r.particles);
    assert.deepEqual(portal, r.start);
    assert.equal(exitPortalBlocks(portal[0], portal[1]).length, r.portalWrites);
  }
});

test("boss bar status and the hurt window helper", () => {
  assert.deepEqual(dragonBossStatus({ health: 100 }), { name: "Ender Dragon", fraction: 0.5 });
  assert.equal(dragonBossStatus({ health: -3 }).fraction, 0);
  const e = { health: 200, hurtResist: 0, hurtTime: 0, lastDamage: 0 };
  assert.equal(livingHurt(e, 6, null, null), true);
  assert.equal(livingHurt(e, 4), false);
  assert.equal(livingHurt(e, 9), true);
  assert.equal(e.health, 191);
});

// Batch 15: World.newExplosion lists every EntityDragonPart (Chunk.getEntitiesWithinAABBForEntity adds getParts), so each part inside the blast
// takes its own distance/exposure damage (Entity.getEyeHeight is 0 for a part) and attackEntityFromPart divides it for the non-head parts.
test("explosionParts: each part in the blast takes its own damage through attackEntityFromPart (probe: Explosion.doExplosionA)", () => {
  const air = { get: () => 0, getMeta: () => 0, set: () => false };
  for (const r of by("explosionParts")) {
    const { e, h } = dragon(10, 100, -6, 135, 177 + r.part);
    for (let t = 0; t < 3; t++) dragonTick(e, h);
    assert.deepEqual(e.dragon.parts.map((p) => p.box), r.boxes, "part boxes before the blast");
    const [cx, cy, cz] = r.center;
    e.dragon.parts.forEach((p, i) => {
      const impact = explosionImpact(air, cx, cy, cz, r.size, p.x, p.y, p.z, p.y, p.box);
      if (impact) attackFromPart(e, i, { explosion: true }, impact.damage, h);
    });
    assert.equal(e.health, r.healthAfter, JSON.stringify([r.part, r.size, r.lift]));
    assert.equal(e.hurtTime, r.hurtTime);
    assert.equal(nextLong(h.rand), r.rand, "random draws after the blast");
  }
});

test("the wing flap sound: cos(anim * 2 pi) crossing -0.3 upward draws the client Random float for the pitch", () => {
  const r = new StrictRandom(5), twin = new StrictRandom(5);
  const e = { prev: 0, anim: 0 };
  let flaps = 0;
  for (let t = 0; t < 400; t++) {
    e.prev = e.anim; e.anim = Math.fround(e.anim + 0.05);
    const p = wingFlapPitch(e.prev, e.anim, r);
    if (p !== null) { flaps++; assert.equal(p, Math.fround(Math.fround(0.8) + Math.fround(twin.nextFloat() * Math.fround(0.3)))); }
  }
  assert.equal(flaps, 20, "one flap per anim cycle (20 ticks at 0.05)");
  assert.equal(nextLong(r), nextLong(twin), "no draw when there is no flap");
});
