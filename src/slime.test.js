import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import {
  SLIME, SLIMEBALL, slimeWidth, slimeHeight, slimeHealth, slimeDamage, slimeCanDamage, slimeEyeHeight, slimeVolume, slimeSoundName, slimeMakesJumpSound,
  slimeMakesLandSound, slimeExperience, jumpDelay, slimeDrops, slimeChildren, slimeTouches, chunkRandom, isSlimeChunk, slimeCanSpawnHere, slimeSquishStart,
  slimeActionState, slimeSquishEnd, slimeSizeToNbt, slimeSizeFromNbt, randomSize, SLIME_MODEL, slimeScale,
} from "./slime.js";

const ref = JSON.parse(await readFile(new URL("../public/research/slime-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;

test("facts: dimensions, health, damage, sounds and flags per size", () => {
  const [r] = by("facts");
  for (const row of r.rows) {
    const s = row.size;
    assert.equal(slimeWidth(s), f(row.width), "width " + s);
    assert.equal(slimeHeight(s), f(row.height));
    assert.equal(slimeHealth(s), row.maxHealth);
    assert.equal(slimeExperience(s), row.experienceValue);
    assert.equal(slimeDamage(s), row.damage);
    assert.equal(slimeCanDamage(s), row.canDamage);
    assert.equal(slimeEyeHeight(s), f(row.eyeHeight));
    assert.equal(slimeVolume(s), f(row.volume));
    assert.equal(slimeSoundName(s), row.hurt);
    assert.equal(slimeSoundName(s), row.death);
    assert.equal(slimeSoundName(s), row.jumpSound);
    assert.equal(slimeMakesJumpSound(s), row.makesJumpSound);
    assert.equal(slimeMakesLandSound(s), row.landSound);
    assert.equal(row.stored, s);
    assert.equal(slimeSizeToNbt(s), s - 1);
    assert.equal(row.drop, s === 1 ? SLIMEBALL : null);
    assert.equal(row.particle, "slime");
    assert.equal(row.talkInterval, SLIME.talkInterval);
    assert.equal(row.maxSpawnedInChunk, SLIME.maxSpawnedInChunk);
    assert.equal(row.followRange, SLIME.followRange);
    assert.equal(f(row.speedAttr), SLIME.speed);
  }
  assert.deepEqual(r.constructorSizes, SLIME.sizes);
  assert.deepEqual(r.constructorJumpDelay, [10, 29]);
  assert.equal(slimeSizeFromNbt(-3), 1);
  assert.equal(slimeSizeFromNbt(3), 4);
  assert.equal(slimeSizeFromNbt(undefined), 1);
  const rand = new JavaRandom(7);
  for (let i = 0; i < 50; i++) assert.ok(SLIME.sizes.includes(randomSize(rand)));
});

test("jumpDelay: nextInt(20) + 10 over 200 seeds", () => {
  by("jumpDelay")[0].rows.forEach((v, seed) => assert.equal(jumpDelay(new JavaRandom(seed)), v));
});

test("split: children count, size, offsets, yaw and health", () => {
  for (const r of by("split")) {
    r.rows.forEach((kids, seed) => {
      const out = slimeChildren(new JavaRandom(seed), { size: r.size, x: 64.5, y: 3, z: 70.5, health: 0 });
      assert.equal(out.length, kids.length, `size ${r.size} seed ${seed}`);
      out.forEach((c, i) => {
        const [size, x, y, z, yaw, health] = kids[i];
        assert.deepEqual([c.size, c.x, c.y, c.z, c.yaw, slimeHealth(c.size)], [size, x, y, z, f(yaw), health]);
      });
    });
  }
  assert.equal(by("splitAlive")[0].children, 0);
  assert.deepEqual(slimeChildren(new JavaRandom(1), { size: 4, x: 0, y: 0, z: 0, health: 1 }), []);
});

test("drops: slimeball count with and without Looting", () => {
  for (const r of by("drops"))
    r.rows.forEach((items, seed) => assert.deepEqual(slimeDrops(new JavaRandom(seed), r.size, r.looting).map((id) => [id, 1]), items, `size ${r.size} looting ${r.looting} seed ${seed}`));
});

test("xp: the size", () => {
  for (const [size, xp] of by("xp")[0].rows) assert.equal(slimeExperience(size), xp);
});

test("attack: only size 2 and 4 hit, within 0.6 * size", () => {
  for (const r of by("attack")[0].rows) {
    assert.equal(slimeTouches(r.size, r.dist * r.dist, true), r.hits.length > 0, `${r.size} ${r.dist}`);
    if (r.hits.length) assert.equal(r.hits[0][0], slimeDamage(r.size));
  }
  assert.equal(slimeTouches(2, 0.1, false), false);
});

test("chunkRandom: the slime chunk grids and int-overflow samples over six world seeds", () => {
  const [r] = by("chunkRandom");
  for (const row of r.rows) {
    let i = 0, count = 0;
    for (let cz = r.min; cz <= r.max; cz++)
      for (let cx = r.min; cx <= r.max; cx++, i++) {
        const hit = isSlimeChunk(BigInt(row.seed), cx, cz);
        count += hit ? 1 : 0;
        assert.equal(hit ? "1" : "0", row.grid[i], `seed ${row.seed} chunk ${cx},${cz}`);
      }
    assert.equal(count, row.count);
    for (const [cx, cz, v] of row.samples) assert.equal(chunkRandom(BigInt(row.seed), cx, cz).nextInt(10), v, `${row.seed} ${cx},${cz}`);
  }
});

const entityRand = (s) => new JavaRandom(BigInt.asIntN(64, BigInt(s) * 2654435761n));
test("spawn: the swamp rule over difficulty, size, moon phase, light and height", () => {
  const [r] = by("spawn"), facts = by("spawnFacts")[0];
  assert.deepEqual(facts.moonFactors, [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75]);
  let ones = 0;
  for (const [difficulty, size, swamp, phase, light, y, bits] of r.rows)
    for (let s = 0; s < r.seeds; s++) {
      const env = { flat: false, difficulty, biome: swamp ? 6 : 1, blockLight: () => light, chunkX: 4, chunkZ: 4, worldSeed: BigInt(r.worldSeed), worldTime: phase * 24000, base: () => true };
      const got = slimeCanSpawnHere(entityRand(s), size, y, env);
      ones += got ? 1 : 0;
      assert.equal(got ? "1" : "0", bits[s], `diff ${difficulty} size ${size} swamp ${swamp} phase ${phase} light ${light} y ${y} seed ${s}`);
    }
  assert.ok(ones > 100, "the recorded rows include real spawns");
});

test("spawnChunk: the slime chunk rule below y 40 for chunks of two world seeds", () => {
  let ones = 0;
  for (const r of by("spawnChunk"))
    r.rows.forEach((bits, k) => {
      const cx = k % r.chunks, cz = Math.floor(k / r.chunks);
      for (let s = 0; s < r.entitySeeds; s++) {
        const env = { flat: false, difficulty: 2, biome: 1, blockLight: () => 15, chunkX: cx, chunkZ: cz, worldSeed: BigInt(r.worldSeed), worldTime: 0, base: () => true };
        const got = slimeCanSpawnHere(entityRand(s), 1, r.y, env);
        ones += got ? 1 : 0;
        assert.equal(got ? "1" : "0", bits[s], `seed ${r.worldSeed} y ${r.y} chunk ${cx},${cz} entity ${s}`);
      }
    });
  assert.ok(ones > 20);
});

test("think: jump delay, squish, strafe, yaw, sounds and landing particles replay the recorded runs", () => {
  const runs = by("think").filter((r) => r.kind !== "peaceful");
  assert.equal(runs.length, 21);
  for (const r of runs) {
    const rand = new JavaRandom(r.seed);
    const s = { size: r.size, x: 64.5, y: 0, z: 64.5, rotationYaw: 0, rotationPitch: 0, onGround: false, jumpDelay: 15, jumping: false, moveForward: 0, moveStrafing: 0, squishAmount: 0, squishFactor: 0, prevSquishFactor: 0 };
    // creative and far (26 blocks) players are no target; near is 8 blocks away at eye height 1.62.
    const target = r.kind === "near" ? { x: r.player[0], eyeY: r.player[1] + 1.62, z: r.player[2] } : null;
    const sounds = [], particleTicks = [];
    let livingSound = 0, particles = 0;
    r.ticks.forEach((t, i) => {
      slimeSquishStart(s);
      // EntityLiving.onEntityUpdate: the idle sound roll draws nextInt(1000) every tick.
      if (rand.nextInt(1000) < livingSound++) livingSound = -SLIME.talkInterval;
      slimeActionState(s, rand, target, (name, volume, pitch) => sounds.push(`${name}|${volume}|${pitch}`));
      s.moveForward = f(s.moveForward * f(0.98));
      s.moveStrafing = f(s.moveStrafing * f(0.98));
      const before = particles;
      [s.x, s.y, s.z] = t;
      s.onGround = t[8] === 1;
      slimeSquishEnd(s, rand, () => particles++, (name, volume, pitch) => sounds.push(`${name}|${volume}|${pitch}`));
      if (particles > before) particleTicks.push(i);
      const where = `${r.kind} size ${r.size} seed ${r.seed} tick ${i}`;
      assert.equal(s.squishAmount, f(t[9]), "squishAmount " + where);
      assert.equal(s.squishFactor, f(t[10]), "squishFactor " + where);
      assert.equal(s.prevSquishFactor, f(t[11]), "prev " + where);
      assert.equal(s.jumpDelay, t[12], "jumpDelay " + where);
      assert.equal(s.jumping ? 1 : 0, t[13], "jumping " + where);
      assert.equal(s.moveForward, f(t[14]), "forward " + where);
      assert.equal(s.moveStrafing, f(t[15]), "strafe " + where);
      assert.ok(Math.abs(s.rotationYaw - t[6]) < 1e-4, `yaw ${s.rotationYaw} ${t[6]} ${where}`);
    });
    assert.deepEqual(particleTicks, r.particleTicks, `${r.kind} particle ticks`);
    assert.equal(particles, r.particleCount);
    assert.deepEqual(sounds, r.sounds.filter((x) => x.startsWith("mob.slime")).map((x) => { const [n, v, p] = x.split("|"); return `${n}|${f(+v)}|${f(+p)}`; }), `${r.kind} sounds`);
  }
});

test("model: ModelSlime boxes and RenderSlime's squish scale", () => {
  const m = ref.records.find((r) => r.model === "slime");
  const boxes = Object.values(m.parts).flatMap((p) => p.boxes);
  assert.equal(boxes.length, SLIME_MODEL.inner.length);
  for (const b of SLIME_MODEL.inner) {
    const hit = boxes.find((x) => x.uv[0] === b.uv[0] && x.uv[1] === b.uv[1]);
    assert.ok(hit, b.name);
    assert.deepEqual(hit.from, b.from);
    assert.deepEqual(hit.to.map((v, i) => v - hit.from[i]), b.size);
  }
  assert.deepEqual(m.texture, SLIME_MODEL.texture);
  assert.equal(ref.render.shadowSize, SLIME.shadowSize);
  assert.deepEqual(slimeScale(2, 0, 0, 0.5), [2, 2, 2]);
  const [sx, sy] = slimeScale(1, 0.6, 0.6, 0.3);
  assert.ok(sx < 1 && sy > 1);
});
