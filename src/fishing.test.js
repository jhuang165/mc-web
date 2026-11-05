import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { nextLong } from "./weather.js";
import { GaussianRandom } from "./projectiles.js";
import { FishHook, FISH_TYPES, JUNK, TREASURE, FISH, PUFFERFISH_EFFECTS, ROD_DURABILITY, rollFishable, STAT } from "./fishing.js";
import { itemInfo } from "./enchantments.js";

// public/research/fishing-reference.json: tools/probes/FishingProbe.java against the unchanged 1.7.10
// EntityFishHook (xe), ItemFishingRod (acv), ItemFishFood (act) and WeightedRandomFishable (xf).
const reference = JSON.parse(await readFile(new URL("../public/research/fishing-reference.json", import.meta.url)));
const f = Math.fround;
const near = (a, b, e = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= e, `${what} ${a} != ${b}`);

// The probe's lake: stone below y 58 (or 63 on dry land), source water from 58 to 62.
const STONE = 3, WATER = 10;
function lake(water) {
  const top = water ? 58 : 63;
  return {
    get: (x, y, z) => (y < top ? STONE : water && y < 63 ? WATER : 0),
    getMeta: () => 0,
    solid: (x, y, z) => y < top,
    height: 256,
  };
}
const encode = (s) => [s.id, s.count, s.damage ?? 0, (s.enchantments ?? []).map((e) => [e.id, e.lvl]), (s.storedEnchantments ?? []).map((e) => [e.id, e.lvl])];
// Native stack ids of the probe: the book becomes the enchanted book (403) in both.
const rodPlayer = (x, y, z, luck, lure) => ({ x, y, z, valid: true, luck, lure });

test("loot tables are the three native WeightedRandomFishable lists", () => {
  const rows = (t) => t.map(([weight, id, count, damage, damaged, enchanted]) => ({ weight, stack: [id, count, damage, [], []], damaged, enchanted }));
  const byName = Object.fromEntries(reference.tables.map((t) => [t.name, t.entries]));
  assert.deepEqual(rows(JUNK), byName.junk);
  assert.deepEqual(rows(TREASURE), byName.treasure);
  assert.deepEqual(rows(FISH), byName.fish);
});

test("ItemFishFood values, pufferfish effects and the rod's 64 uses", () => {
  assert.equal(reference.food.rodMaxDamage, ROD_DURABILITY);
  assert.equal(itemInfo(346).maxDamage, ROD_DURABILITY);
  assert.equal(reference.food.rodEnchantability, itemInfo(346).enchantability);
  for (const t of reference.food.types) {
    const mine = FISH_TYPES[t.meta];
    assert.equal(mine.name, t.name);
    assert.deepEqual(mine.raw, [t.itemRawHeal, t.itemRawSaturation].map(f));
    assert.equal(!!mine.cooked, t.hasCooked);
    if (mine.cooked) assert.deepEqual(mine.cooked, [t.itemCookedHeal, t.itemCookedSaturation].map(f));
  }
  const pufferfish = reference.effects.cases.find((c) => c.type === "pufferfish").effects;
  assert.deepEqual(PUFFERFISH_EFFECTS.map((e) => e.join("|")), pufferfish);
  for (const c of reference.effects.cases) if (c.type !== "pufferfish") assert.deepEqual(c.effects, []);
});

test("casting: position, motion, heading and rotation match EntityFishHook(World, EntityPlayer)", () => {
  for (const l of reference.launches) {
    // The probe's player has Entity.yOffset 1.62F (client side); the integrated server's is 0.
    const h = FishHook.cast(new GaussianRandom(l.seed), { x: 12.5, y: 63, z: -7.25, yaw: l.yaw, pitch: l.pitch }, f(1.62));
    for (const [k, v] of [["x", l.hook.x], ["y", l.hook.y], ["z", l.hook.z], ["vx", l.hook.vx], ["vy", l.hook.vy], ["vz", l.hook.vz]]) near(h[k], v, 1e-9, `${l.yaw}/${l.pitch} ${k}`);
    near(h.yaw, l.hook.yaw, 1e-4);
    near(h.pitch, l.hook.pitch, 1e-4);
    assert.equal(h.prevYaw, h.yaw);
    assert.equal(h.prevPitch, h.pitch);
    // Entity.rand is unseeded in the probe's `real` hook: only speed and the offsets are comparable.
    near(Math.hypot(h.vx, h.vy, h.vz), Math.hypot(l.real.vx, l.real.vy, l.real.vz), 0.1);
    near(h.x, l.real.x, 1e-9);
    near(h.z, l.real.z, 1e-9);
  }
});

function envFor(c, events) {
  const world = lake(c.water);
  return {
    world, player: rodPlayer(0.5, c.water ? 63 : 64, 0.5, c.luck, c.lure), worldRand: null,
    canLightningStrike: () => c.lightning, canSeeSky: () => c.sky,
    sound: (name, volume, pitch) => events.push(`sound|${name}|${volume}|${pitch}`),
    particle: (name, x, y, z, n, dx, dy, dz, speed) => events.push(`particle|${name}|${x}|${y}|${z}|${n}|${dx}|${dy}|${dz}|${speed}`),
    entities: () => [],
  };
}
function launchCast(c, y) {
  const h = FishHook.cast(new GaussianRandom(c.seed), { x: 0.5, y, z: 0.5, yaw: c.yaw, pitch: c.pitch }, f(1.62));
  return h;
}

for (const c of reference.casts) {
  test(`flight, bobbing and the catch timer of cast ${c.name}`, () => {
    const events = [], env = envFor(c, events), h = launchCast(c, c.water ? 63 : 64), seen = new Map(), traces = new Map(c.trace.map((t) => [t[0], t])), timers = new Map(c.timers.map((t) => [t[0], t]));
    let bite = -1, tick = 0;
    for (; tick < c.maxTicks; tick++) {
      h.tick(env);
      const t = traces.get(tick);
      if (t) {
        for (const [i, k] of ["x", "y", "z", "vx", "vy", "vz"].entries()) near(h[k], t[i + 1], 1e-7, `${c.name} t${tick} ${k}`);
      }
      const m = timers.get(tick);
      if (m) {
        // [tick, ticksCatchable, ticksCaughtDelay, ticksCatchableDelay, fishApproachAngle, ticksInGround, ticksInAir, shake, inGround]
        assert.equal(h.ticksCatchable, m[1], `${c.name} t${tick} ticksCatchable`);
        assert.equal(h.ticksCaughtDelay, m[2], `${c.name} t${tick} ticksCaughtDelay`);
        assert.equal(h.ticksCatchableDelay, m[3], `${c.name} t${tick} ticksCatchableDelay`);
        near(h.fishApproachAngle, m[4], 1e-4, `${c.name} t${tick} approach`);
        assert.equal(h.ticksInAir, m[6], `${c.name} t${tick} ticksInAir`);
        assert.equal(+h.inGround, m[8]);
      }
      seen.set(tick, true);
      if (h.dead) break;
      if (bite < 0 && h.ticksCatchable > 0) bite = tick;
      if (bite >= 0 && tick >= bite + c.extraTicks) break;
    }
    assert.equal(bite, c.bite);
    assert.equal(tick, c.endTick);
    assert.equal(h.inGround, c.inGround);
    if (!c.reel) assert.equal(h.dead, c.dead);
    else {
      // The hook then dies reeling in: the same Entity.rand continues into the loot roll.
      const out = h.retrieve({ ...env, worldRand: new JavaRandom(c.seed + 1) }), r = c.reel;
      assert.equal(out.cost, r.ret);
      assert.ok(h.dead);
      const item = r.spawned.find((s) => s.kind === "item"), orb = r.spawned.find((s) => s.kind === "orb");
      assert.deepEqual(encode(out.drop.stack), item.stack);
      for (const [k, v] of [["x", item.x], ["y", item.y], ["z", item.z], ["vx", item.vx], ["vy", item.vy], ["vz", item.vz]]) near(out.drop[k], v, 1e-7, `${c.name} drop ${k}`);
      assert.equal(out.orb, orb.value);
      assert.deepEqual([`${out.stat}|1`], r.stats);
    }
    // Every particle and sound, in order, to the last digit the probe printed.
    assert.equal(events.length, c.events.length);
    for (const [i, e] of c.events.entries()) {
      const a = events[i].split("|"), b = e.split("|");
      assert.equal(a[0], b[0]);
      assert.equal(a[1], b[1]);
      for (let k = 2; k < a.length; k++) near(+a[k], +b[k], 1e-6, `${c.name} event ${i} ${e}`);
    }
  });
}

test("a hook landing on dry ground is released and re-lands every tick and never despawns", () => {
  const g = reference.ground, c = { water: false, luck: 0, lure: 0, lightning: false, sky: true }, env = envFor(c, []);
  const h = FishHook.cast(new GaussianRandom(9), { x: 0.5, y: 64, z: 0.5, yaw: 20, pitch: -10 }, f(1.62));
  env.world = lake(false);
  let landed = -1, dead = -1;
  for (let tick = 1; tick <= 1300; tick++) {
    h.tick(env);
    if (landed < 0 && h.inGround) landed = tick;
    if (h.dead) { dead = tick; break; }
  }
  assert.equal(landed, g.landed);
  assert.equal(dead, g.dead);
  assert.equal(h.inGround, g.inGround);
});

const stackOf = (r) => encode(r.stack);
test("reel-in: return value, durability cost, drop, orb and stats", () => {
  for (const r of reference.reels) {
    const w = lake(r.case !== "ground");
    if (r.case === "water-no-bite") {
      const h = FishHook.cast(new GaussianRandom(11), { x: 0.5, y: 63, z: 0.5, yaw: 0, pitch: 0 }, f(1.62));
      const env = envFor({ water: true, luck: 0, lure: 0, lightning: false, sky: true }, []);
      for (let i = 0; i < 40; i++) h.tick(env);
      const out = h.retrieve({ ...env, worldRand: new JavaRandom(1) });
      assert.equal(out.cost, r.result.ret);
      assert.equal(out.drop, null);
      assert.ok(h.dead);
    } else if (r.case === "ground") {
      const h = FishHook.cast(new GaussianRandom(12), { x: 0.5, y: 64, z: 0.5, yaw: 0, pitch: 20 }, f(1.62));
      const env = envFor({ water: false, luck: 0, lure: 0, lightning: false, sky: true }, []);
      for (let i = 0; i < 20; i++) h.tick(env);
      assert.equal(h.inGround, r.inGround);
      assert.equal(h.retrieve({ ...env, worldRand: new JavaRandom(1) }).cost, r.result.ret);
    } else {
      const h = new FishHook(new GaussianRandom(13));
      Object.assign(h, { x: r.hook.x, y: r.hook.y, z: r.hook.z, hooked: "mob" });
      const out = h.retrieve({ player: rodPlayer(r.player.x, r.player.y, r.player.z, 0, 0), worldRand: new JavaRandom(1) });
      assert.equal(out.cost, r.result.ret);
      near(0.25 + out.pull.add[0], r.target.vx, 1e-12);
      near(-0.5 + out.pull.add[1], r.target.vy, 1e-9);
      near(0.125 + out.pull.add[2], r.target.vz, 1e-12);
    }
  }
});

test("loot rolls replay the native seeds: item, wear, enchantments, orb, statistic and item motion", () => {
  const master = new JavaRandom(17101710n);
  let total = 0;
  const kinds = {};
  for (const set of reference.loot) {
    for (const row of set.rows) {
      const worldRand = new JavaRandom(nextLong(master)), rand = new GaussianRandom(nextLong(master));
      const h = new FishHook(rand);
      Object.assign(h, { x: 1.5, y: 63.25, z: -2, ticksCatchable: 20 });
      const out = h.retrieve({ player: rodPlayer(5, 63, 5, set.luck, set.lure), worldRand });
      const [ret, stack, orb, stats, vy] = row;
      assert.equal(out.cost, ret);
      assert.deepEqual(encode(out.drop.stack), stack, `luck ${set.luck} lure ${set.lure} #${total}`);
      assert.equal(out.orb, orb);
      assert.deepEqual([`${out.stat}|1`], stats);
      near(out.drop.vy, vy, 1e-12);
      kinds[`${set.luck}/${set.lure}/${out.kind}`] = (kinds[`${set.luck}/${set.lure}/${out.kind}`] ?? 0) + 1;
      total++;
    }
  }
  assert.equal(total, 2400);
  // Luck of the Sea and Lure move junk into fish, and treasure follows 0.05 + 0.01 luck - 0.01 lure.
  assert.ok((kinds["0/0/junk"] ?? 0) > (kinds["3/0/junk"] ?? 0));
  assert.equal(kinds["3/3/junk"] ?? 0, 0);
  assert.deepEqual(Object.values(STAT).sort(), ["stat.fishCaught", "stat.junkFished", "stat.treasureFished"]);
  assert.equal(rollFishable.length, 4);
});
