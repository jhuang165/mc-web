// Batch 83 corpse83: the rest of a corpse's living update (corpse-living.js).
// Executed: tools/probes/CorpseLivingProbe.java (tools/verify-corpse-living.mjs) -> public/research/corpse-living-reference.json: a squid corpse in water and in air (with a
// Speed effect and a revenge target), 21 ws.h() ticks each; one ya.e() of an enderman corpse over 6 environments x 300 seeds; an enderman corpse chasing a far player.
// Bytecode-read: sa.C / sv.C (sprint draws, handleWaterMovement, setAir(300), the revenge lapse, sv.aO), wv.e / wv.h, wr.e, xc.e, wt.e (the golem's counters).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityRandom, entityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { squidStateOf } from "./squid-bat.js";
import { addMobEffect } from "./mob-effects.js";
import { noteRevenge } from "./revenge-target.js";
import { WATER } from "./world.js";
import * as E from "./enderman.js";

const reference = JSON.parse(await readFile(new URL("../public/research/corpse-living-reference.json", import.meta.url)));
const f = Math.fround;
const key = (x, y, z) => `${x},${y},${z}`;
// A block-map world: stone below y 0, `fill` above (air, or still water).
const mapWorld = (fill = 0) => {
  const blocks = new Map();
  return {
    blocks, numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => blocks.get(key(x, y, z)) ?? (y < 0 ? 1 : fill), getMeta: () => 0,
    set: (x, y, z, id) => blocks.set(key(x, y, z), id), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), temperatureAt: () => 0.5,
  };
};
const player = { x: 64, y: 0, z: 64, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const world = (mobs, w = mapWorld()) => { const m = new EntityWorld(w, mobs.map((x, i) => ({ id: `mob-${i + 1}`, x: 64, y: 0, z: 66, health: 8, ...x })), () => 0.5); Object.assign(m.ai.player, { x: 64, y: 0, z: 64 }); return m; };
const tick = (w, n = 1) => { for (let i = 0; i < n; i++) w.tick(player, new Survival({})); };
const counted = (r) => { const next = r.next.bind(r); r.calls = 0; r.next = (bits) => (r.calls++, next(bits)); return r; };
const restored = (data) => { const r = new JavaRandom(0); assert.ok(r.restore({ version: 1, ...data })); return counted(r); };

const SQUID_FIELDS = ["pitch", "prevPitch", "yaw", "prevYaw", "rotation", "tentacle", "prevTentacle", "motionSpeed", "rotationVelocity", "rotateSpeed", "vecX", "vecY", "vecZ"];
for (const kind of ["water", "air"]) {
  test(`a squid corpse ${kind === "water" ? "coasts on its frozen swim vector in water" : "falls out of water, counts its Speed down and loses its revenge target"} (ws.e(FF), ws.e, sv.C)`, () => {
    const rows = reference.squidCorpse.filter((r) => r.kind === kind), start = rows[0];
    assert.equal(rows.length, 22);
    assert.equal(start.tick, 40);
    const w = world([{ type: "squid", health: 10 }, ...(kind === "air" ? [{ type: "squid", health: 10, x: 70.5, y: 6, z: 64.5 }] : [])], mapWorld(kind === "water" ? WATER : 0));
    const e = w.entities[0];
    Object.assign(e, { x: start.x, y: start.y, z: start.z, vx: start.vx, vy: start.vy, vz: start.vz, renderYawOffset: f(start.renderYawOffset), rotationYaw: f(start.rotationYaw),
      health: 0, death: 0, air: 300, inWater: true, fallDistance: 0, age: 40, onGround: false });
    const s = squidStateOf(e, new JavaRandom(1));
    for (const k of SQUID_FIELDS) s[k] = f(start[k]);
    s.prevRotation = s.rotation;
    if (kind === "air") {
      addMobEffect(e, 1, 15, 0);
      noteRevenge(e, w.entities[1]);
      e.revenge = e.age - 91; // the probe's revengeTimer is ticksExisted - 92; this port keeps age + 1 at the hit
    }
    const r = restored(start.random);
    setEntityRandom(e, r);
    let seen = 0;
    for (const row of rows.slice(1)) {
      if (row.tick > 60) break; // tick 61: the probe calls h() on the removed entity
      const before = r.calls;
      tick(w);
      const at = `${kind} tick ${row.tick}`;
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) assert.equal(e[k] + 0, row[k], `${at} ${k}`);
      for (const k of SQUID_FIELDS) assert.equal(s[k], f(row[k]), `${at} ${k}`);
      assert.equal(e.renderYawOffset, f(row.renderYawOffset), `${at} renderYawOffset`);
      assert.equal(e.rotationYaw, f(row.rotationYaw), `${at} rotationYaw`);
      assert.equal(e.air, row.air, `${at} air`);
      assert.equal(e.death, row.deathTime, `${at} deathTime`);
      assert.deepEqual((e.effects ?? []).map((x) => [x.id, x.duration]), row.effects, `${at} effects`);
      if (row.revenge !== null) assert.equal(!!e.revenge, row.revenge, `${at} revenge`);
      assert.equal(r.calls, before + row.draws, `${at} draws`);
      assert.equal(r.save().seed, row.random.seed, `${at} random`);
      seen++;
    }
    assert.equal(seen, 20);
    if (kind === "air") {
      assert.ok(rows.some((x) => x.draws === 7), "the swirl's three nextDouble were drawn on some ticks");
      assert.equal(rows.find((x) => x.tick === 55).effects.length, 0, "the effect ended on the corpse");
      assert.equal(rows.find((x) => x.tick === 49).revenge, false, "aa - bm > 100 lapsed it");
    }
  });
}

// The probe world double of EndermanProbe (as in enderman.test.js): stone below y 0, a settable block map, switches for daylight, sky, rain, light.
const LIQUID = new Set([8, 9, 10, 11]);
function enderWorld(opts = {}) {
  const w = {
    blocks: new Map(), metas: new Map(), day: false, sky: false, light: 0, raining: false, blocked: false, exists: true, sounds: [], particles: 0, attempts: 0,
    block: (x, y, z) => w.blocks.get(key(x, y, z)) ?? (y < 0 ? 1 : 0),
    blockId: (x, y, z) => w.block(x, y, z),
    blockMeta: (x, y, z) => w.metas.get(key(x, y, z)) ?? 0,
    blockExists: () => { w.attempts++; return w.exists; },
    blocksMovement: (x, y, z) => { const b = w.block(x, y, z); return b !== 0 && !LIQUID.has(b); },
    isNormalCube: (x, y, z) => w.block(x, y, z) !== 0 && !LIQUID.has(w.block(x, y, z)),
    collides: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY) - 1; y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++)
            if (w.blocksMovement(x, y, z) && x + 1 > b.minX && x < b.maxX && y + 1 > b.minY && y < b.maxY && z + 1 > b.minZ && z < b.maxZ) return true;
      return false;
    },
    liquidIn: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY); y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++) if (LIQUID.has(w.block(x, y, z))) return true;
      return false;
    },
    setBlock: (x, y, z, id, meta) => { w.blocks.set(key(x, y, z), id); w.metas.set(key(x, y, z), meta); },
    canSeeSky: () => w.sky, brightness: () => w.light, isDaytime: () => w.day, rainingAt: () => w.raining,
    lineBlocked: () => w.blocked, mobGriefing: () => true,
    sound: (name, x, y, z, volume, pitch) => w.sounds.push({ name, x, y, z, volume, pitch }),
    particle: (name) => { if (name === "portal") w.particles++; },
    ...opts,
  };
  for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) w.blocks.set(key(x, 0, z), 1);
  return w;
}
const enderRng = (seed) => counted(new JavaRandom(BigInt.asIntN(64, BigInt(seed) * 0x9e3779b97f4a7c15n)));
const ender = (x, y, z, extra = {}) => ({ ...E.endermanFields(), x, y, z, health: 0, ...extra });
const ctx = (r, extra = {}) => ({ rng: r, target: null, dropTarget() {}, wet: false, burning: false, hurt() {}, distanceSq: () => 0, dead: true, ...extra });
const ENVS = {
  night: {}, sun: { day: true, sky: true, light: f(0.9) }, shade: { day: true, light: f(0.9) }, water: { wet: true },
  rain: { raining: true, wet: true }, dimSun: { day: true, sky: true, light: f(0.45) },
};

test("an enderman corpse runs ya.e but its alive-gated block: wet and sunlit corpses still teleport, screaming stays (EndermanProbe environments, 300 seeds)", () => {
  assert.equal(reference.enderCorpse.length, 1800);
  const moved = {}, screaming = {};
  for (const row of reference.enderCorpse) {
    const { wet, ...opts } = ENVS[row.env];
    const w = enderWorld(opts), e = ender(0.5, 1, 0.5, { screaming: true, aggressive: true }), r = enderRng(row.seed);
    E.tick(e, w, ctx(r, { wet: !!wet })); // the drown hit is refused at 0 health (sv.a: entityAge = 0, then false): no draws
    const at = `${row.env} ${row.seed}`;
    assert.deepEqual([Math.hypot(e.x - 0.5, e.y - 1, e.z - 0.5) > 3, e.screaming, e.aggressive, e.carried, e.carriedData, w.particles],
      [row.moved, row.screaming, row.aggressive, row.carried, row.carriedData, row.particles], at);
    assert.equal(r.calls, row.draws, `${at} draws`);
    assert.equal(r.save().seed, row.random.seed, `${at} random`);
    moved[row.env] = (moved[row.env] ?? 0) + row.moved;
    screaming[row.env] = (screaming[row.env] ?? 0) + row.screaming;
  }
  assert.deepEqual(moved, { night: 0, sun: 7, shade: 0, water: 154, rain: 154, dimSun: 0 });
  assert.equal(screaming.night, 300, "the else branch (screaming = false) is inside the alive test");
  // The live control: the same block clears the scream of a mob with no target.
  const live = ender(0.5, 1, 0.5, { screaming: true, aggressive: true, health: 40 });
  E.tick(live, enderWorld(), ctx(enderRng(0), { dead: false }));
  assert.equal(live.screaming, false);
});

test("an enderman corpse never teleports after its target (the chase counter is alive-gated)", () => {
  assert.deepEqual(reference.enderChase.map((c) => [c.firstTeleportTick, c.chaseTimer]), [[-1, 0], [-1, 0], [-1, 0], [-1, 0]]);
  const away = { x: 0.5, y: 0.12, z: 0.5, yaw: 90, pitch: 0, helmet: 0 }, target = { id: "player", x: 0.5, y: 0.12, z: 0.5, eye: E.PLAYER_EYE_OFFSET, player: away };
  const run = (dead) => {
    const w = enderWorld({ exists: false }), e = ender(0.5, 1, 30.5, { health: dead ? 0 : 40 });
    for (let i = 1; i <= 40; i++) E.tick(e, w, ctx(enderRng(i), { target, distanceSq: () => 900, dead }));
    return [w.attempts, e.chaseTimer];
  };
  assert.deepEqual(run(true), [0, 0]);
  assert.ok(run(false)[0] > 0, "a live one tries from the 31st tick");
});

test("the engine runs ya.e on an enderman corpse with the dead flag: the portal particles are drawn, the scream stays", () => {
  const w = world([{ type: "enderman", health: 40 }], mapWorld()), e = w.entities[0];
  tick(w);
  Object.assign(e, { health: 0, death: 0, screaming: true, aggressive: false });
  const r = counted(new JavaRandom(3));
  setEntityRandom(e, r);
  tick(w);
  assert.ok(r.calls >= 26, `two portal particles' six nextDouble each, the carry roll and the scream roll (${r.calls} next calls)`);
  assert.equal(e.screaming, true, "the no-target else branch did not run");
});

test("a mob that dies inside its tick still counts its effects down that tick (sv.aO follows onDeathUpdate in sv.C)", () => {
  const w = world([{ type: "cow", health: 1, growingAge: 0 }]), e = w.entities[0];
  tick(w);
  addMobEffect(e, 1, 30, 0);
  e.fire = 20; // fire % 20 == 0: 1 onFire damage in Entity.onEntityUpdate, before the death check
  const d = e.effects[0].duration;
  tick(w);
  assert.ok(e.health <= 0);
  assert.equal(e.effects[0].duration, d - 1);
  tick(w);
  assert.equal(e.effects[0].duration, d - 2, "and on every corpse tick after");
});

test("a corpse in water: handleWaterMovement still runs (inWater, the splash, the fire put out) and the air goes back to 300", () => {
  const w = world([{ type: "cow", health: 10, growingAge: 0 }], mapWorld()), e = w.entities[0];
  tick(w);
  Object.assign(e, { health: 0, death: 0, fire: 100, air: 120, inWater: false });
  for (let x = 62; x <= 66; x++) for (let z = 64; z <= 68; z++) for (let y = 0; y <= 2; y++) w.world.set(x, y, z, WATER);
  const events = w.events.length;
  tick(w);
  assert.equal(e.inWater, true);
  assert.ok(e.fire <= 0, "extinguished (the move tail rests the counter at -1)");
  assert.equal(e.air, 300);
  assert.ok(w.events.slice(events).some((x) => x.sound === "game.neutral.swim.splash"), "the splash sound");
});

test("a sprinting corpse still draws the sprint particle's two nextFloat (sa.C)", () => {
  const draws = (sprinting) => {
    const w = world([{ type: "ocelot", health: 10, growingAge: 0 }]), e = w.entities[0];
    tick(w);
    Object.assign(e, { health: 0, death: 0, sprinting, vx: 0, vz: 0 });
    const r = counted(new JavaRandom(9));
    setEntityRandom(e, r);
    tick(w);
    return r.calls;
  };
  assert.equal(draws(true) - draws(false), 2);
});

test("a wet wolf corpse on the ground shakes (wv.e / wv.h) and keeps the watcher health of its last live tick", () => {
  const w = world([{ type: "wolf", health: 8, growingAge: 0 }]), e = w.entities[0];
  tick(w, 2);
  Object.assign(e, { health: 0, death: 0, wet: true, shaking: false, begging: true, headTilt: 0, dwHealth: 8 });
  tick(w);
  assert.equal(e.shaking, true);
  assert.ok(e.headTilt > 0, "the head tilt eases toward begging");
  assert.equal(e.dwHealth, 8, "watcher 18 is written by updateAITasks only");
  tick(w, 3);
  assert.ok(e.shakeTime > 0);
});

test("a snowman corpse still lays its snow trail (wr.e)", () => {
  const w = world([{ type: "snow_golem", health: 4 }]), e = w.entities[0];
  tick(w);
  Object.assign(e, { health: 0, death: 0, x: 64.5, z: 66.5, y: 0 });
  w.world.blocks.clear();
  tick(w);
  assert.ok([...w.world.blocks.values()].length > 0, "snow layers were placed");
});

test("an iron golem corpse counts its attack and rose timers down (wt.e: already run through the push before batch 83)", () => {
  const w = world([{ type: "iron_golem", health: 100 }]), e = w.entities[0];
  tick(w);
  Object.assign(e, { health: 0, death: 0, attackTimer: 5, holdRose: 7 });
  tick(w, 2);
  assert.deepEqual([e.attackTimer, e.holdRose], [3, 5]);
});

test("a wither corpse runs xc.e's head part and side heads without its AI", () => {
  const w = world([{ type: "wither", health: 300 }]), e = w.entities[0];
  tick(w);
  Object.assign(e, { health: 0, death: 0, rotationYaw: 30 });
  tick(w);
  assert.equal(e.yaw, (-e.rotationYaw * Math.PI) / 180);
});
