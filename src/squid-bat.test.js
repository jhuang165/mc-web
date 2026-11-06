import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import * as S from "./squid-bat.js";

// tools/probes/SquidBatProbe.java (tools/verify-squid-bat.mjs): the unchanged EntitySquid (ws), EntityBat (we) and their bases of
// 1.7.10 on the MobMoveProbe world double.
export const reference = JSON.parse(await readFile(new URL("../public/research/squid-bat-reference.json", import.meta.url)));
const f = Math.fround;
const mix = (i) => i * 1000003 + 17; // the probe's seed for rows that sweep seeds
const rows = (name) => reference[name];

test("the squid and bat constants are the original's", () => {
  const { squid, bat } = reference.facts;
  assert.equal(S.SQUID.width, f(squid.width));
  assert.equal(S.SQUID.height, f(squid.height));
  assert.equal(S.SQUID.health, squid.maxHealth);
  assert.equal(S.SQUID.volume, f(squid.volume));
  assert.equal(S.SQUID.talkInterval, squid.talkInterval);
  assert.equal(squid.living, null);
  assert.equal(squid.hurt, null);
  assert.equal(squid.death, null);
  assert.equal(squid.canTriggerWalking, false);
  assert.equal(squid.dropItem, 0); // Items.dye is the original id 351 in the probe's adb.b; see the drop rows for the id
  assert.equal(S.BAT.width, f(bat.width));
  assert.equal(S.BAT.height, f(bat.height));
  assert.equal(S.BAT.health, bat.maxHealth);
  assert.equal(S.BAT.volume, f(bat.volume));
  assert.equal(bat.hanging, true);
  assert.equal(bat.canBePushed, false);
  assert.equal(bat.doesNotTriggerPressurePlate, true);
  assert.equal(bat.canTriggerWalking, false);
  assert.equal(bat.aiEnabled, true);
  assert.equal(S.BAT_SOUNDS.hurt, bat.hurt);
  assert.equal(S.BAT_SOUNDS.death, bat.death);
});

// --- squid ---
const squidRun = (seed) => {
  const start = rows("squidStart").find((r) => r.seed === seed), rand = new JavaRandom(seed);
  const s = S.squidState(new JavaRandom(seed)); // the probe replaces rotationVelocity with the seeded roll
  assert.equal(s.rotationVelocity, f(start.rotationVelocity));
  const e = { x: start.x, y: start.y, z: start.z, vx: 0, vy: 0, vz: 0, renderYawOffset: 0, rotationYaw: 0, air: 300, livingSoundTime: 0 };
  return { s, e, rand, expected: rows("squidTick").filter((r) => r.seed === seed) };
};
// One ws.h() tick of the probe world (no blocks above y 0): Entity.onEntityUpdate's talk roll and air, ws.bq, the move, ws.e's update.
function squidTick({ s, e, rand }, wet) {
  const time = e.livingSoundTime++;
  if (rand.nextInt(1000) < time) e.livingSoundTime = -S.SQUID.talkInterval;
  const drowned = S.squidAir(e, { wet });
  if (drowned) { s.age = 0; e.health = (e.health ?? 10) - 2; } // attackEntityFrom resets entityAge
  if (Math.abs(e.vx) < 0.005) e.vx = 0;
  if (Math.abs(e.vy) < 0.005) e.vy = 0;
  if (Math.abs(e.vz) < 0.005) e.vz = 0;
  if (!(e.health <= 0)) S.squidActionState(s, { rand, inWater: wet }); // a dead mob skips updateEntityActionState
  const px = e.x, pz = e.z;
  e.x += e.vx;
  e.z += e.vz;
  if (e.y + e.vy < 0) { e.y = 0; e.vy = 0; } else e.y += e.vy;
  S.squidLivingUpdate(s, e, { rand, wet });
  S.legacyBodyTurn(e, e.x - px, e.z - pz);
  return drowned;
}
const squidCompare = (run, r) => {
  const { s, e } = run, at = `seed ${r.seed} tick ${r.tick}`;
  assert.equal(e.x + 0, r.x, at + " x");
  assert.equal(e.y + 0, r.y, at + " y");
  assert.equal(e.z + 0, r.z, at + " z");
  assert.equal(e.vx + 0, r.vx, at + " vx"); // the reference went through JSON, which drops the sign of -0
  assert.equal(e.vy + 0, r.vy, at + " vy"); // the reference went through JSON, which drops the sign of -0
  assert.equal(e.vz + 0, r.vz, at + " vz"); // the reference went through JSON, which drops the sign of -0
  for (const [k, key] of [["pitch", "pitch"], ["prevPitch", "prevPitch"], ["yaw", "yaw"], ["prevYaw", "prevYaw"], ["rotation", "rotation"], ["tentacle", "tentacle"], ["prevTentacle", "prevTentacle"],
    ["motionSpeed", "motionSpeed"], ["rotationVelocity", "rotationVelocity"], ["rotateSpeed", "rotateSpeed"], ["vecX", "vecX"], ["vecY", "vecY"], ["vecZ", "vecZ"]]) assert.equal(s[k], f(r[key]), `${at} ${k}`);
  assert.equal(e.renderYawOffset, f(r.renderYawOffset), at + " renderYawOffset");
  assert.equal(e.rotationYaw, f(r.rotationYaw), at + " rotationYaw");
  assert.equal(e.air, r.air, at + " air");
};
for (const seed of [7, 12345]) {
  test(`the squid swims, tilts and flaps like ws.e and ws.bq (seed ${seed})`, () => {
    const run = squidRun(seed);
    const byTick = new Map(run.expected.map((r) => [r.tick, r]));
    let drowned = 0, checked = 0;
    for (let tick = 1; tick <= 1000 && byTick.size; tick++) {
      const wet = tick <= 240;
      if (tick === 241) { run.e.x = 64.5; run.e.y = 0; run.e.z = 64.5; run.e.vy = 0; } // the probe puts the squid on the ground
      if (squidTick(run, wet)) drowned++;
      const r = byTick.get(tick);
      if (r) { squidCompare(run, r); byTick.delete(tick); checked++; }
    }
    assert.equal(byTick.size, 0);
    assert.ok(checked > 200);
    assert.ok(drowned >= 1);
  });
}

test("a squid out of water drowns at -20 air and takes 2 every 20 ticks", () => {
  const rows7 = rows("squidTick").filter((r) => r.seed === 7 && r.tick >= 540), healths = rows7.filter((r, i) => i && r.health < rows7[i - 1].health);
  assert.deepEqual(healths.map((r) => r.tick), [560, 580, 600, 620, 640]);
  assert.deepEqual(healths.map((r) => r.health), [8, 6, 4, 2, 0]);
  const e = { air: 300 };
  let ticks = 0, hits = [];
  while (hits.length < 3) { ticks++; if (S.squidAir(e, { wet: false })) hits.push(ticks); }
  assert.deepEqual(hits, [320, 340, 360]);
  S.squidAir(e, { wet: true });
  assert.equal(e.air, 300);
});

test("the squid's spawn height is 45 < y < 63", () => {
  for (const r of rows("squidSpawn")) assert.equal(S.squidCanSpawn(r.y), r.ok, `y ${r.y}`);
});

test("a squid drops 1 + nextInt(3 + looting) ink sacs, one per stack", () => {
  for (const r of rows("squidDrops")) {
    const got = S.squidDrops(new JavaRandom(mix(r.seed)), r.looting);
    assert.deepEqual(got.map((s) => ({ id: s.id === S.INK_SAC ? 351 : -1, damage: s.damage, count: s.count })), r.items, `looting ${r.looting} seed ${r.seed}`);
  }
});

test("a squid is worth 1 + nextInt(3) experience on the world's random", () => {
  rows("squidXp").forEach((want, i) => assert.equal(S.squidExperience(new JavaRandom(i)), want));
});

// --- bat ---
const batCtx = (rand, over = {}) => ({
  rand, playerNear: false, takeoff: () => {}, normalCube: (x, y) => y < 0 || (y >= 16 && y % 2 === 0), isAir: (x, y) => !(y < 0 || (y >= 16 && y % 2 === 0)), ...over,
});
test("the bat's flight and roost decisions match we.bn", () => {
  let hung = 0, flew = 0;
  for (const seed of [1, 99, 2024, 31337]) {
    const rand = new JavaRandom(seed), s = S.batState(), e = { x: 64.5, y: 25.3, z: 64.5, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationYawHead: 0, moveForward: 0, batHanging: false };
    for (const r of rows("batTick").filter((r) => r.seed === seed)) {
      let aux = 0;
      S.batAIStep(s, e, batCtx(rand, { takeoff: () => aux++ }));
      const at = `seed ${seed} tick ${r.tick}`;
      assert.equal(e.batHanging, r.hanging, at + " hanging");
      assert.equal(e.x + 0, r.x, at + " x");
      assert.equal(e.y + 0, r.y, at + " y");
      assert.equal(e.z + 0, r.z, at + " z");
      assert.equal(e.vx + 0, r.vx, at + " vx"); // the reference went through JSON, which drops the sign of -0
      assert.equal(e.vy + 0, r.vy, at + " vy"); // the reference went through JSON, which drops the sign of -0
      assert.equal(e.vz + 0, r.vz, at + " vz"); // the reference went through JSON, which drops the sign of -0
      assert.equal(e.rotationYaw, f(r.yaw), at + " yaw");
      assert.equal(e.moveForward, f(r.moveForward), at + " moveForward");
      assert.deepEqual(s.spawnPosition, r.spawnPosition, at + " spawnPosition");
      assert.equal(aux, r.aux, at + " takeoff");
      if (e.batHanging) hung++; else flew++;
      // we.h's tail, then the probe's plain Euler step
      S.batUpdate(e);
      if (!e.batHanging) { e.x += e.vx * 0.5; e.y += e.vy * 0.5; e.z += e.vz * 0.5; }
    }
  }
  assert.ok(hung > 100 && flew > 100);
});

test("a hanging bat wakes when a player is within 4 blocks or the block above is not solid (aux 1015)", () => {
  for (const r of rows("batWake")) {
    const aux = [], s = S.batState(), e = { x: 64.5, y: 20, z: 64.5, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationYawHead: 0, batHanging: true };
    const rand = new JavaRandom(5);
    S.batAIStep(s, e, batCtx(rand, { playerNear: r.playerDist <= 4, normalCube: (x, y) => r.ceiling && y === 21, takeoff: (x, y, z) => aux.push({ id: S.AUX_BAT_TAKEOFF, x, y, z }) }));
    assert.equal(e.batHanging, r.hangingAfter, `${r.playerDist} ${r.ceiling}`);
    assert.deepEqual(aux, r.aux);
  }
});

test("a hanging bat re-rolls its head with 1 in 200", () => {
  const rand = new JavaRandom(8), s = S.batState(), e = { x: 64.5, y: 20, z: 64.5, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationYawHead: 0, batHanging: true };
  rows("batHeadYaw").forEach((want, i) => {
    e.rotationYawHead = 0;
    S.batAIStep(s, e, batCtx(rand, { normalCube: (x, y) => y === 21 }));
    assert.equal(e.rotationYawHead, f(Number(want)), `tick ${i}`);
  });
});

test("the bat's living sound and pitch follow we.t and we.bg", () => {
  for (const r of rows("batSound")) {
    const rand = new JavaRandom(mix(r.seed));
    assert.equal(S.batLivingSound(r.hanging, rand), r.sound, `${r.hanging} ${r.seed}`);
    assert.equal(S.batSoundPitch(rand), f(r.pitch));
  }
  assert.ok(rows("batSound").some((r) => r.hanging && r.sound) && rows("batSound").some((r) => r.hanging && !r.sound));
});

test("the bat's spawn rule honours the light limit, y 63 and the injectable Halloween date", () => {
  let trues = 0;
  for (const r of rows("batSpawn")) {
    const got = Array.from({ length: 24 }, (_, i) => S.batCanSpawn({ boxMinY: r.y, light: r.light, date: { month: r.month, day: r.day }, rand: new JavaRandom(mix(i)) }));
    assert.deepEqual(got, r.results, `${r.month}/${r.day} y ${r.y} light ${r.light}`);
    trues += got.filter(Boolean).length;
  }
  assert.ok(trues > 500);
  assert.equal(S.batSpawnLimit({ month: 10, day: 19 }), 4);
  assert.equal(S.batSpawnLimit({ month: 10, day: 20 }), 7);
  assert.equal(S.batSpawnLimit({ month: 11, day: 3 }), 7);
  assert.equal(S.batSpawnLimit({ month: 11, day: 4 }), 4);
  assert.equal(S.batCanSpawn({ boxMinY: 20, light: 0, date: { month: 7, day: 1 }, rand: new JavaRandom(1), superOk: false }), false);
});

test("a hit wakes a hanging bat, and BatFlags is bit 1", () => {
  const hurt = reference.batHurt, e = { batHanging: true };
  assert.equal(e.batHanging, hurt.hangingBefore);
  S.batHurt(e);
  assert.equal(e.batHanging, hurt.hangingAfter);
  const [yes, no] = reference.batNbt;
  assert.equal(S.batFlags({ batHanging: true }), yes.writtenFlags);
  assert.equal(S.batHangingFromFlags(yes.writtenFlags), yes.readHanging);
  assert.equal(S.batHangingFromFlags(no.writtenFlags), no.readHanging);
});

