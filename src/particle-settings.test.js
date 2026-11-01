import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./lighting.js";
import { acceptsParticle, particleSetting, rainParticleAttempts } from "./particle-settings.js";
import { ParticleSystem } from "./particles.js";
import { ExplosionParticles } from "./explosion-particles.js";
import { Projectiles } from "./projectiles.js";
import { Weather } from "./weather.js";
const reference = JSON.parse(await readFile(new URL("../public/research/particle-reference.json", import.meta.url)));

test("original RenderGlobal settings, distance boundaries and random consumption replay for seven particle kinds", () => {
  const records = reference.records.filter(r => r.case === "setting");
  assert.equal(records.length, 504);
  for (const r of records) {
    const random = new JavaRandom(r.seed);
    assert.equal(acceptsParticle(r.kind, r.setting, random, r.distance, 70, 0, [0, 70, 0]), r.accepted, JSON.stringify(r));
    assert.equal(random.save().seed, r.worldSeed, "exact nextInt consumption, including refused and exempt particles");
  }
});

test("minimal suppresses ordinary effects before construction but keeps direct block hits and breaking", () => {
  const blocks = new ParticleSystem();
  blocks.setting = 2;
  blocks.random = () => { throw new Error("refused particle drew constructor randomness"); };
  assert.equal(blocks.spawn("blockcrack", 3, 0, 0, 70, 0, 0, 0, 0, [0, 70, 0]), null);
  blocks.random = () => 0.6;
  const world = { get: () => 3, getMeta: () => 0 };
  assert.equal(blocks.destroyBlock(world, 0, 70, 0, 3), 64);
  assert.ok(blocks.hitBlock(world, 0, 70, 0, 1));
  const explosion = new ExplosionParticles({ random: () => { throw new Error("refused smoke constructed"); } });
  explosion.setting = 2;
  assert.equal(explosion.spawn("smoke", 0, 70, 0), null);
  assert.equal(explosion.spawn("explode", 0, 70, 0), null);
  const projectiles = new Projectiles(() => { throw new Error("refused snowball poof constructed"); });
  projectiles.particleSetting = 2;
  assert.equal(projectiles.poof(0, 70, 0), null);
});

test("minimal retains huge explosion's full 48 puffs even outside the normal view range", () => {
  const explosion = new ExplosionParticles();
  explosion.setting = 2; explosion.viewer = [1000, 70, 1000];
  explosion.spawn("hugeexplosion", 0, 70, 0);
  const spawn = explosion.spawn.bind(explosion);
  let count = 0;
  explosion.spawn = (...args) => { const p = spawn(...args); if (p?.kind === "largeexplode") count++; return p; };
  const world = { get: () => 0 };
  for (let t = 0; t < 8; t++) explosion.tick(world);
  assert.equal(count, 48);
  assert.equal(explosion.emitters.length, 0);
});

test("decreased explosion filtering advances the client stream separately for every spawn attempt", () => {
  const random = new JavaRandom(3), expected = new JavaRandom(3);
  const explosion = new ExplosionParticles({ worldRandom: random });
  explosion.setting = 1; explosion.viewer = [0, 70, 0];
  let accepted = 0;
  for (let i = 0; i < 30; i++) {
    const allow = expected.nextInt(3) !== 0;
    const p = explosion.spawn("smoke", 0, 70, 0);
    assert.equal(!!p, allow); accepted += !!p;
  }
  assert.ok(accepted > 0 && accepted < 30);
  expected.nextInt(3);
  assert.equal(explosion.spawn("smoke", 100, 70, 0), null);
  expected.nextInt(3);
  assert.ok(explosion.spawn("largeexplode", 100, 70, 0));
  assert.deepEqual(random.save(), expected.save());
});

test("rain options halve attempts or suppress splashes and rain sound without clearing existing drops", () => {
  for (const strength of [0, Math.fround(0.3), 0.5, 1]) {
    const all = Math.trunc(Math.fround(Math.fround(100 * strength) * strength));
    assert.equal(rainParticleAttempts(strength, 0), all);
    assert.equal(rainParticleAttempts(strength, 1), all >> 1);
    assert.equal(rainParticleAttempts(strength, 2), 0);
  }
  const weather = new Weather({ random: new JavaRandom(7), lcg: 0 });
  weather.rain = 1; weather.particleSetting = 2;
  weather.rainSoundCounter = 100;
  let updated = 0;
  weather.drops.push({ dead: false, tick: () => updated++ });
  const world = { biome: "meadow", get: () => 3 };
  weather.rainParticles(world, { x: 5, y: 64, z: 5 });
  assert.equal(updated, 1);
  assert.equal(weather.drops.length, 1);
  assert.deepEqual(weather.drain(), []);
  for (const bad of [undefined, null, "1", -1, 3, 1.5, NaN]) assert.equal(particleSetting(bad), 0);
});
