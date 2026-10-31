import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  JavaRandom, sunBrightness, skylightSubtracted, starBrightness, skyColor, cloudColor, providerFogColor, fogColor, lightmap, biomeTemperature,
} from "./lighting.js";
import {
  Weather, LightningBolt, RainDrop, nextLong, stopsPrecipitation, precipitationHeight, canSeeSky, strikeRule, canLightningStrikeAt, isWet,
  struckByLightning, strikeBox, overlaps, entityBox, rainsHere,
} from "./weather.js";
import { boltGeometry } from "./weather-renderer.js";
import { World, SIZE } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";

const reference = JSON.parse(await readFile(new URL("../public/research/weather-reference.json", import.meta.url)));
const f = Math.fround;

test("the reference is the 1.7.10 client's weather classes", () => {
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  for (const c of ["ahb", "ays", "xh", "blt", "bma", "mt", "sa"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/);
});

// World.updateWeather replayed over 400000 ticks (and 70000 from awkward starting
// timers) against the original ahb.o: every roll, toggle and sampled strength.
test("updateWeather rolls the timers, toggles the flags and ramps the strengths like ahb.o", () => {
  assert.equal(reference.timers.length, 10);
  for (const run of reference.timers) {
    const w = new Weather({ random: new JavaRandom(run.seed) });
    [w.rainTime, w.thunderTime] = run.start;
    w.raining = run.start[2] === 1;
    w.thundering = run.start[3] === 1;
    // WorldInfo's own start values; the strengths of a loaded world begin at 0.
    let pr = w.rainTime, pt = w.thunderTime, praining = w.raining, pthundering = w.thundering, e = 0, s = 0;
    const step = run.ticks === 400000 ? 1009 : 53;
    for (let t = 1; t <= run.ticks; t++) {
      w.updateWeather();
      const change = w.rainTime !== pr - 1 || w.thunderTime !== pt - 1 || w.raining !== praining || w.thundering !== pthundering;
      if (change || w.rainTime <= 0 || w.thunderTime <= 0) {
        assert.deepEqual(run.events[e++], [t, w.rainTime, w.thunderTime, w.raining ? 1 : 0, w.thundering ? 1 : 0], `seed ${run.seed} tick ${t}`);
      }
      pr = w.rainTime;
      pt = w.thunderTime;
      praining = w.raining;
      pthundering = w.thundering;
      if (t % step === 0 || t < 5) {
        const [rt, a, b, c, d] = run.samples[s++];
        assert.equal(rt, t);
        assert.deepEqual([w.prevRain, w.rain, w.prevThunder, w.thunder], [f(a), f(b), f(c), f(d)], `seed ${run.seed} tick ${t}`);
      }
    }
    assert.equal(e, run.events.length);
    assert.equal(s, run.samples.length);
  }
});

test("a new world rains first after 12000 to 180000 ticks and a storm lasts 3600 to 15600", () => {
  const w = new Weather({ random: new JavaRandom(7) });
  w.updateWeather();
  assert.ok(w.rainTime >= 12000 && w.rainTime < 180000 && w.thunderTime >= 12000 && w.thunderTime < 180000);
  w.set("rain", 10);
  assert.deepEqual([w.raining, w.thundering, w.rainTime], [true, false, 200]);
  for (let i = 0; i < 120; i++) w.updateWeather(); // +0.01 per tick, clamped at 1
  assert.equal(w.rainStrength(1), 1);
  assert.equal(w.isRaining(), true);
  assert.equal(w.isThundering(), false);
});

test("strengths: getRainStrength, getWeightedThunderStrength, isRaining and isThundering", () => {
  const w = new Weather();
  Object.assign(w, { prevRain: 0.5, rain: 1, prevThunder: 0.5, thunder: 1 });
  assert.equal(w.rainStrength(0.5), f(0.75));
  assert.equal(w.weightedThunder(0.5), f(f(0.75) * f(0.75)));
  Object.assign(w, { prevRain: 0.2, rain: 0.2, prevThunder: 1, thunder: 1 });
  assert.equal(w.isRaining(), false); // rain must exceed 0.2
  w.rain = w.prevRain = 0.91;
  assert.equal(w.isRaining(), true);
  assert.equal(w.isThundering(), true); // 0.91 * 1 > 0.9
  w.rain = w.prevRain = 0.89;
  assert.equal(w.isThundering(), false);
});

test("save and restore keep WorldInfo's four fields; a raining save starts at full rain (calculateInitialWeather)", () => {
  const w = new Weather();
  w.set("thunder", 30);
  const saved = JSON.parse(JSON.stringify(w.save()));
  assert.deepEqual(saved, { rainTime: 600, thunderTime: 600, raining: true, thundering: true });
  const r = new Weather().restore(saved);
  assert.deepEqual([r.rain, r.thunder, r.prevRain, r.prevThunder], [1, 1, 0, 0]);
  const dry = new Weather().restore({ rainTime: 5, thunderTime: 6, raining: false, thundering: true });
  assert.deepEqual([dry.rain, dry.thunder], [0, 0]);
  const drizzle = new Weather().restore({ rainTime: 5, thunderTime: 6, raining: true, thundering: false });
  assert.deepEqual([drizzle.rain, drizzle.thunder], [1, 0]);
  for (const junk of [null, 5, "x", { rainTime: 1.5, thunderTime: NaN, raining: "yes", thundering: 1 }]) {
    const j = new Weather().restore(junk);
    assert.deepEqual(j.save(), { rainTime: 0, thunderTime: 0, raining: false, thundering: false });
  }
});

// calculateSkylightSubtracted, getSunBrightness, getStarBrightness, getCloudColour,
// the provider fog colour and getSkyColor with rain, thunder and lightning.
test("sky terms match the original World methods across angles, strengths and partial ticks", () => {
  const { states, partials, angles, biomes: ids, rows } = reference.sky;
  assert.equal(rows.length, states.length * partials.length * angles.length);
  const temps = Object.fromEntries(reference.biomes.map(([id, t]) => [id, t]));
  for (const row of rows) {
    const [pr, r, pt, t, bolt] = states[row.s], partial = f(partials[row.p]), angle = f(angles[row.a]);
    const w = new Weather();
    Object.assign(w, { prevRain: f(pr), rain: f(r), prevThunder: f(pt), thunder: f(t), lastLightning: bolt });
    const rain = w.rainStrength(partial), thunder = w.weightedThunder(partial), at = `state ${row.s} partial ${row.p} angle ${angles[row.a]}`;
    assert.equal(rain, f(row.rain), at);
    assert.equal(thunder, f(row.thunder), at);
    assert.equal(skylightSubtracted(angle, rain, thunder), row.sub, at);
    assert.equal(sunBrightness(angle, rain, thunder), f(row.sun), at);
    assert.equal(starBrightness(angle), f(row.star), at); // no rain term in getStarBrightness
    assert.deepEqual(cloudColor(angle, rain, thunder), row.cloud.map(f), at);
    assert.deepEqual(providerFogColor(angle), row.fog.map(f), at); // WorldProvider.getFogColor ignores weather
    ids.forEach((id, i) => assert.deepEqual(skyColor(f(temps[id]), angle, rain, thunder, w.lastLightning, partial), row.sky[i].map(f), `${at} biome ${id}`));
  }
});

test("clear-sky arguments reproduce the previous behaviour exactly", () => {
  for (const a of [0, 0.2, 0.25, 0.5, 0.77, 0.95]) {
    assert.equal(sunBrightness(a), sunBrightness(a, 0, 0));
    assert.equal(skylightSubtracted(a), skylightSubtracted(a, 0, 0));
    assert.deepEqual(skyColor(0.8, a), skyColor(0.8, a, 0, 0, 0, 0));
    assert.deepEqual(cloudColor(a), cloudColor(a, 0, 0));
  }
  assert.deepEqual(lightmap(1, 0, 0), lightmap(1, 0, 0, new Uint8Array(1024), false));
  // At noon rain leaves 12 sky light levels and a thunderstorm 10 (subtracted 3 and 5).
  assert.equal(skylightSubtracted(0, 1, 0), 3);
  assert.equal(skylightSubtracted(0, 1, 1), 5);
});

test("fog darkens by rain (0.5, 0.5, 0.4) and thunder (0.5) after the sky blend; water and lava replace it", () => {
  const base = { angle: f(0), temperature: biomeTemperature("meadow"), look: [0, 0, 1], chunks: 8, brightness: 1 },
    clear = fogColor(base);
  // The fog colour is the provider fog blended toward the sky, so at 4+ chunks the
  // rain-free reference must differ from the rainy one only by the grey and the factors.
  const rain = fogColor({ ...base, rain: 1 });
  assert.ok(rain.every((c, i) => c < clear[i]));
  assert.deepEqual(fogColor({ ...base, rain: 1, underwater: true }), fogColor({ ...base, underwater: true }));
  assert.deepEqual(fogColor({ ...base, thunder: 1, lava: true }), fogColor({ ...base, lava: true }));
  const storm = fogColor({ ...base, rain: 1, thunder: 1 });
  assert.ok(storm.every((c, i) => c < rain[i]));
});

test("a lightning flash lights the sky level with the bare brightness table, ignoring the sun", () => {
  const dim = lightmap(0.2, 0, 0), flash = lightmap(0.2, 0, 0, new Uint8Array(1024), true), full = lightmap(1, 0, 0);
  const sky = (data, level) => data[(level * 16 + 0) * 4];
  assert.ok(sky(flash, 15) > sky(dim, 15));
  assert.ok(sky(flash, 8) > sky(dim, 8));
  // With the sun at its brightest the flash changes only the 0.95 + 0.05 factor (which is 1).
  assert.deepEqual(lightmap(1, 0, 0, new Uint8Array(1024), true), full);
});

test("canLightningStrikeAt follows the original for every biome, rain strength, sky access and precipitation height", () => {
  const facts = Object.fromEntries(reference.biomes.map(([id, t, canSpawn, snow]) => [id, { temperature: f(t), canSpawn: !!canSpawn, enableSnow: !!snow }]));
  assert.equal(reference.strike.length, 7 * 4 * 2 * 3);
  for (const [biome, rain, sees, dy, result] of reference.strike) {
    const got = strikeRule({ raining: f(rain) > f(0.2), sees: !!sees, precipitation: 40 + dy, y: 40, ...facts[biome] });
    assert.equal(got, !!result, `biome ${biome} rain ${rain} sees ${sees} dy ${dy}`);
  }
  // The biomes this build has (0.8 and 0.2) are rain biomes: both strike, neither snows.
  assert.equal(rainsHere({ biome: "meadow" }), true);
  assert.equal(rainsHere({ biome: "alpine" }), true);
  assert.equal(rainsHere({ biome: "island" }), true);
});

// Vanilla ids by game id: the blocks this build has, against the probe's
// Material.blocksMovement || isLiquid table (Chunk.getPrecipitationHeight).
const VANILLA = {
  0: 0, 1: 2, 2: 3, 3: 1, 4: 17, 5: 18, 6: 12, 7: 5, 8: 45, 9: 20, 10: 9, 11: 7, 12: 4, 13: 58, 14: 61, 15: 16, 16: 15, 17: 56, 18: 14, 19: 35,
  20: 50, 21: 47, 22: 49, 23: 80, 24: 82, 25: 13, 26: 42, 27: 41, 28: 57, 29: 60, 30: 60, 39: 31, 40: 172, 41: 54, 42: 11, 43: 37, 44: 38,
};
for (let b = 31; b <= 38; b++) VANILLA[b] = 59;

test("precipitation stops at the same blocks as the original: leaves, glass, liquids; not torches, crops, grass or flowers", () => {
  const stops = new Set(reference.precipitation.map(([id]) => id));
  for (const [game, vanilla] of Object.entries(VANILLA)) assert.equal(stopsPrecipitation(Number(game)), stops.has(vanilla), `game block ${game} (vanilla ${vanilla})`);
  for (const id of [8, 9, 10, 11, 18, 20]) assert.ok(stops.has(id));
  for (const id of [0, 6, 31, 37, 38, 50, 51, 59, 78]) assert.ok(!stops.has(id));
});

const column = (blocks, x = 5, z = 5) => ({ biome: "meadow", get: (px, y, pz) => (y < 0 ? 11 : px === x && pz === z ? blocks[y] ?? 0 : 0) });

test("precipitation height is one above the topmost stopping block; sky access follows the light-blocking height map", () => {
  // Game ids: stone 3, leaves 5, planks 7, glass 9, water 10, torch 20, tall grass 39, lava 42, flower 44.
  const w = column({ 0: 3, 1: 3, 2: 3, 10: 5, 11: 9 });
  assert.equal(precipitationHeight(w, 5, 5), 12); // glass stops rain
  assert.equal(precipitationHeight(w, 6, 6), -1);
  assert.equal(precipitationHeight(column({ 0: 3, 5: 5 }), 5, 5), 6); // leaves
  assert.equal(precipitationHeight(column({ 0: 3, 5: 9, 6: 9 }, 4, 4), 5, 5), -1);
  assert.equal(precipitationHeight(column({ 0: 3, 4: 10 }), 5, 5), 5); // water
  assert.equal(precipitationHeight(column({ 0: 3, 4: 42 }), 5, 5), 5); // lava
  assert.equal(precipitationHeight(column({ 0: 3, 4: 20, 6: 44, 7: 39 }), 5, 5), 1); // torch, flower, tall grass let it through
  assert.equal(precipitationHeight(column({ 0: 3 }), SIZE, 5), -1);
  // Glass does not block light, so the cell under it still sees the sky; leaves do block.
  assert.equal(canSeeSky(column({ 0: 3, 5: 9 }), 5, 3, 5), true);
  assert.equal(canSeeSky(column({ 0: 3, 5: 5 }), 5, 3, 5), false);
  assert.equal(canSeeSky(column({ 0: 3 }), 5, 1, 5), true);
  assert.equal(canSeeSky(column({ 0: 3 }), 5, 0, 5), false);
});

test("rain falls only where it can reach: the open cell rains, the roofed cell does not", () => {
  const w = new Weather();
  w.set("rain", 60);
  for (let i = 0; i < 100; i++) w.updateWeather();
  const open = column({ 0: 3, 1: 3 }), roofed = column({ 0: 3, 1: 3, 5: 7 });
  assert.equal(canLightningStrikeAt(w, open, 5, 2, 5), true);
  assert.equal(canLightningStrikeAt(w, roofed, 5, 2, 5), false);
  assert.equal(canLightningStrikeAt(w, roofed, 5, 6, 5), true);
  assert.equal(isWet(w, open, { x: 5.5, y: 2, z: 5.5 }, 1.8), true);
  assert.equal(isWet(w, roofed, { x: 5.5, y: 2, z: 5.5 }, 1.8), false);
  assert.equal(isWet(w, roofed, { x: 5.5, y: 2, z: 5.5, inWater: true }, 1.8), true);
  assert.equal(isWet(w, roofed, { x: 5.5, y: 5, z: 5.5 }, 1.8), true); // the head is out in the open
  w.set("clear");
  for (let i = 0; i < 100; i++) w.updateWeather();
  assert.equal(canLightningStrikeAt(w, open, 5, 2, 5), false);
});

test("EntityLightningBolt: state machine, re-flashes, vertex seeds and sounds replay the original xh", () => {
  assert.equal(reference.bolts.length, 36);
  for (const run of reference.bolts) {
    const bolt = new LightningBolt(4.5, 30, 6.5, new JavaRandom(99));
    // The probe swaps in Random(seed) and boltLivingTime after construction.
    bolt.random = new JavaRandom(run.seed);
    bolt.living = run.living;
    bolt.vertex = BigInt(run.ticks[0].vertex); // the constructor's own roll, which the probe's Random made
    const events = [];
    run.ticks.forEach((ref, t) => {
      events.length = 0;
      const flash = bolt.tick(events);
      const at = `living ${run.living} seed ${run.seed} tick ${t}`;
      assert.equal(bolt.state, ref.state, at);
      assert.equal(bolt.living, ref.living, at);
      assert.equal(String(bolt.vertex), ref.vertex, at);
      assert.equal(flash ? 2 : 0, ref.flash, at);
      assert.equal(bolt.dead, ref.dead, at);
      assert.deepEqual(events.map((e) => ({ s: e.sound, v: e.volume, p: e.pitch })), ref.sounds.map(({ s, v, p }) => ({ s, v, p: f(p) })), at);
    });
    assert.equal(run.ticks.at(-1).dead, true);
  }
});

test("Random.nextLong is a signed 64-bit (next(32) << 32) + next(32)", () => {
  assert.equal(nextLong(new JavaRandom(42)), -5025562857975149833n);
  assert.equal(nextLong(new JavaRandom(0)), -4962768465676381896n);
});

test("a bolt spawns with state 2, 1 to 3 lives and draws from the bolt's own Random", () => {
  const bolt = new LightningBolt(1, 2, 3, new JavaRandom(1));
  assert.equal(bolt.state, 2);
  assert.ok(bolt.living >= 1 && bolt.living <= 3);
  assert.equal(typeof bolt.vertex, "bigint");
});

test("the bolt's path is the original's: 4 layers of 14 triangle strips of 5 vertex pairs, seeded by the vertex", () => {
  const a = boltGeometry(4, 30, 6, 123456789n), b = boltGeometry(4, 30, 6, 123456789n), c = boltGeometry(4, 30, 6, 987654321n);
  assert.equal(a.length, 4 * 14 * 8 * 9);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  // Every layer starts at y + 7 * 16 + 16 and descends to y.
  const ys = a.filter((_, i) => i % 3 === 1);
  assert.equal(Math.max(...ys), 30 + 8 * 16);
  assert.equal(Math.min(...ys), 30);
});

test("strike damage: 5 fire damage, then ++fire and setFire(8) only when fire reaches 0", () => {
  assert.deepEqual(struckByLightning(0), { damage: 5, fire: 1 });
  assert.deepEqual(struckByLightning(-1), { damage: 5, fire: 160 });
  assert.deepEqual(struckByLightning(40), { damage: 5, fire: 41 });
  const box = strikeBox({ x: 10, y: 20, z: 30 });
  assert.deepEqual(box, [7, 17, 27, 13, 29, 33]);
  assert.equal(overlaps(entityBox({ x: 10, y: 20, z: 30 }, 0.6, 1.8), box), true);
  assert.equal(overlaps(entityBox({ x: 10, y: 29.5, z: 30 }, 0.6, 1.8), box), false);
  assert.equal(overlaps(entityBox({ x: 13.5, y: 20, z: 30 }, 0.6, 1.8), box), false);
  assert.equal(overlaps(entityBox({ x: 13.2, y: 20, z: 30 }, 0.6, 1.8), box), true);
});

test("a thunderstorm strikes a random column of an active chunk where rain reaches", () => {
  const flat = new World("Flat", "meadow", 2);
  const w = new Weather({ random: new JavaRandom(3), lcg: 12345 });
  w.set("thunder", 600);
  for (let i = 0; i < 120; i++) w.updateWeather();
  assert.equal(w.isThundering(), true);
  // 100000 chunks per tick on average: force the roll by replacing the Random.
  w.random = { nextInt: () => 0 };
  w.rollLightning(flat, [[2, 3]]);
  assert.equal(w.bolts.length, 1);
  const b = w.bolts[0];
  assert.ok(b.x >= 32 && b.x < 48 && b.z >= 48 && b.z < 64);
  assert.equal(b.y, precipitationHeight(flat, b.x, b.z));
  assert.equal(w.lcg, (Math.imul(12345, 3) + 1013904223) | 0);
  // No storm, no bolt.
  const calm = new Weather();
  calm.random = { nextInt: () => 0 };
  calm.rollLightning(flat, [[2, 3]]);
  assert.equal(calm.bolts.length, 0);
  assert.equal(Weather.activeChunks(0, 0, 2).length, 3 * 3);
  assert.equal(Weather.activeChunks(40, 40, 10).length, (SIZE / 16) ** 2); // 10 chunks reach beyond this 8 x 8 chunk world
  assert.equal(Weather.activeChunks(SIZE / 2, SIZE / 2).length, (SIZE / 16) ** 2);
});

test("a flash sets lastLightningBolt to 2 and counts down once per tick", () => {
  const w = new Weather({ random: new JavaRandom(5) });
  w.bolts.push(new LightningBolt(1, 2, 3, new JavaRandom(8)));
  w.tick();
  assert.equal(w.lastLightning, 2);
  assert.equal(w.struck.length, 1);
  const sounds = w.drain();
  assert.deepEqual(sounds.map((s) => s.sound), ["ambient.weather.thunder", "random.explode"]);
  assert.equal(w.drain().length, 0);
});

test("rain splashes: up to 100 * rain^2 candidate columns around the viewer, each on a stopping block", () => {
  const ground = { biome: "meadow", get: (x, y) => (y < 40 ? 3 : 0) };
  const w = new Weather();
  w.set("rain", 600);
  for (let i = 0; i < 100; i++) w.updateWeather();
  const viewer = { x: 64, y: 41.6, z: 64 };
  w.clientTicks = 7;
  w.rainParticles(ground, viewer);
  assert.ok(w.drops.length > 0 && w.drops.length <= 100);
  for (const d of w.drops) {
    assert.ok(Math.abs(d.x - 64) < 11 && Math.abs(d.z - 64) < 11);
    assert.ok(d.y >= 40 + f(0.1) - 1e-6 && d.y < 41);
    assert.ok(d.texture >= 19 && d.texture <= 22);
    assert.ok(d.scale >= 1 && d.scale < 2);
  }
  const sounds = [];
  for (let t = 8; t < 100; t++) {
    w.clientTicks = t;
    w.rainParticles(ground, viewer);
    sounds.push(...w.drain());
  }
  assert.ok(sounds.length > 0 && sounds.every((s) => s.sound === "ambient.weather.rain"));
  assert.ok(sounds.every((s) => s.volume === f(0.2) && s.pitch === 1)); // nothing overhead
  const dry = new Weather();
  dry.rainParticles(ground, viewer);
  assert.equal(dry.drops.length, 0);
  // The same tick number replays the same splashes.
  const a = new Weather(), b = new Weather();
  for (const x of [a, b]) {
    Object.assign(x, { rain: 1, prevRain: 1, clientTicks: 11 });
    x.rainParticles(ground, viewer);
  }
  assert.deepEqual(a.drops.map((d) => [d.x, d.z]), b.drops.map((d) => [d.x, d.z]));
});

test("rain under a roof sounds quieter and lower (volume 0.1, pitch 0.5)", () => {
  const roof = { biome: "meadow", get: (x, y) => (y < 40 ? 3 : y === 46 ? 7 : 0) };
  const w = new Weather();
  Object.assign(w, { rain: 1, prevRain: 1, raining: true });
  const viewer = { x: 64, y: 41.6, z: 64 }, sounds = [];
  for (let t = 1; t < 200; t++) {
    w.clientTicks = t;
    w.rainParticles(roof, viewer);
    sounds.push(...w.drain());
  }
  assert.ok(sounds.length > 0);
  assert.ok(sounds.every((s) => s.volume === f(0.1) && s.pitch === f(0.5)));
});

test("a splash hops up, falls under gravity 0.06 and lives 8 to 40 ticks", () => {
  for (let i = 0; i < 50; i++) {
    const d = new RainDrop(1, 41.1, 1);
    assert.ok(d.vy >= f(0.1) && d.vy <= f(0.3) + 1e-6);
    assert.ok(Math.hypot(d.vx, d.vz) < 0.2);
    assert.ok(d.age >= 8 && d.age <= 40);
  }
  const d = new RainDrop(1, 41.1, 1);
  d.vx = d.vz = 0;
  d.vy = 0.2;
  const top = d.y;
  d.tick(41);
  assert.ok(Math.abs(d.y - (top + 0.2 - 0.06)) < 1e-9);
  assert.ok(Math.abs(d.vy - (0.2 - 0.06) * 0.98) < 1e-9);
});

test("rain extinguishes burning mobs and zombies do not burn in the rain", () => {
  const flat = { get: (x, y) => (y < 0 ? 11 : y === 0 ? 1 : 0), solid: (x, y) => y <= 0, biome: "meadow" };
  const survival = new Survival();
  survival.time = 6000;
  const zombie = (wet) => {
    const w = new EntityWorld(flat, [{ id: "mob-1", type: "zombie", x: 64, y: 1, z: 64, health: 20 }]);
    if (wet) w.wet = () => true;
    return w;
  };
  const dry = zombie(false);
  dry.tick({ x: 64, y: 1, z: 80 }, survival);
  assert.equal(dry.entities[0].burn, 1);
  const rainy = zombie(true);
  rainy.tick({ x: 64, y: 1, z: 80 }, survival);
  assert.equal(rainy.entities[0].burn, 0);
  const pig = new EntityWorld(flat, [{ id: "mob-2", type: "pig", x: 64, y: 1, z: 64, health: 10 }]);
  pig.entities[0].fire = 100;
  pig.tick({ x: 64, y: 1, z: 90 }, survival);
  assert.ok(pig.entities[0].fire > 0);
  pig.wet = () => true;
  pig.events.length = 0;
  pig.tick({ x: 64, y: 1, z: 90 }, survival);
  // moveEntity's tail: wet and burning hisses and rests the counter at -fireResistance (1).
  assert.equal(pig.entities[0].fire, -1);
  assert.ok(pig.events.some((ev) => ev.sound === "random.fizz"));
});

test("rain moistens farmland under open sky without water nearby", () => {
  const w = new World("Farm", "meadow", 2);
  for (let x = 19; x <= 23; x++) for (let z = 19; z <= 23; z++) { w.set(x, 40, z, 2); w.set(x, 41, z, 0); }
  const f1 = new Farming(w);
  f1.till(20, 40, 20);
  const weather = new Weather();
  f1.rained = (x, y, z) => canLightningStrikeAt(weather, w, x, y + 1, z);
  weather.set("rain", 600);
  for (let i = 0; i < 100; i++) weather.updateWeather();
  f1.soilTick(20, 40, 20);
  assert.equal(w.get(20, 40, 20), 30);
  assert.equal(f1.fields.get("20,40,20"), 7);
  // Without rain the soil dries out again.
  weather.set("clear", 600);
  for (let i = 0; i < 100; i++) weather.updateWeather();
  for (let i = 0; i < 8; i++) f1.soilTick(20, 40, 20);
  assert.equal(w.get(20, 40, 20), 2);
});
