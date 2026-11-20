// Batch 88 mobrec88: executed mob fights on the unchanged 1.7.10 classes (tools/probes/EndermanWolfProbe.java set b88mr, scenarios EndermanWolfScenarios.run88,
// `EW_SET=b88mr node tools/verify-endermanwolf.mjs` -> public/research/enderman-wolf-b88mr-reference.json). The b47 serverplayer harness: the probe player is a ticked
// EntityPlayerMP (its potion effects run in onUpdateEntity, the hurt-window counter of EntityPlayerMP.onUpdate counts down after the mobs), the snow golem's snowballs fly
// (every EntityThrowable updates after the mobs), and a spider's row carries entityToAttack. Replayed by enderman-wolf-replay.js with the live snowball walk.
//   cave-*: a cave spider bites the player at night on Normal, Hard and Easy (and creative after the bite); the player kills it at tick 61 and the poison runs out.
//   golem-*: an iron golem against a creeper (never picked, even after the creeper's hit), a spider and a cave spider.
//   snow-*: a snow golem pelts a zombie (0 damage, knockback, revenge) and leaves a creeper alone.
import test from "node:test";
import assert from "node:assert/strict";
import { reference88, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./lighting.js";
import { aimFor, SNOW_GOLEM } from "./snow-golem.js";
import { GaussianRandom } from "./projectiles.js";

const f = Math.fround;
const recs = reference88.records, by = (s) => recs.find((r) => r.name.includes(s)), all = (s) => recs.filter((r) => r.name.includes(s));
// rows: [mobs [x, y, z, health, target, revenge, flags, draws, motion...], sounds, player damage, player revenge, player ticks, [explosions, spawned, cells, player motion],
// gBefore, client y, server copy position, [[snowballs k, x, y, z, motion, dead], [the player's effects [id, duration, amplifier]]]]
const damageOf = (r) => r.rows.map((row, t) => [t, row[2]]).filter((x) => x[1]);
const poisonOf = (r) => r.rows.map((row) => row[9][1].find((e) => e[0] === 19)?.[1] ?? 0);

test("mobrec88: the b88mr reference holds 20 executed records", () => {
  assert.equal(recs.length, 20);
  assert.match(reference88.method, /Batch 88 \(mobrec88\)/);
  for (const r of recs) assert.ok(r.rows.every((row) => row[9] && row[8]), r.name);
});
for (const r of recs) {
  test(`mobrec88: ${r.name} replays with no divergence (mobs, draws, sounds, player damage and effects, snowballs, drops)`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}

// --- cave spiders and poison
test("mobrec88 cave spider: a bite poisons for 7 s on Normal and 15 s on Hard (EntityCaveSpider.attackEntityAsMob), none on Easy", () => {
  for (const [s, want] of [["cave-normal", 139], ["cave-hard", 299], ["cave-creative", 139]]) for (const r of all(s)) {
    const t = r.rows.findIndex((row) => row[9][1].length);
    assert.deepEqual(r.rows[t][9][1], [[19, want, 0]], r.name); // 140 or 300, less the player's own update the same tick
    assert.equal(r.rows[t][2] > 0, true, `${r.name}: the bite lands that tick`);
  }
  for (const r of all("cave-easy")) assert.ok(r.rows.every((row) => !row[9][1].length), r.name);
});
test("mobrec88 cave spider: bites deal 2 on Easy and Normal and 3 on Hard (EntityPlayer damage scaled by difficulty)", () => {
  assert.deepEqual(damageOf(by("cave-easy-8821")), [[11, 2], [31, 2], [51, 2]]);
  for (const r of all("cave-hard")) assert.deepEqual(damageOf(r).filter(([t]) => t <= 61).map((x) => x[1]), [3, 3, 3], r.name);
});
test("mobrec88 cave spider: poison deals 1 whenever the duration is a multiple of 25, through the hurt window", () => {
  // Normal: the bite at 12 (2), poison at 27, the bite at 32 deals only the difference (2 - 1) and refreshes the poison, poison at 47, the bite at 52 (1 more), then
  // the poison of the last bite alone every 25 ticks until it runs out
  assert.deepEqual(damageOf(by("normal-8801")), [[12, 2], [27, 1], [32, 1], [47, 1], [52, 1], [67, 1], [92, 1], [117, 1], [142, 1], [167, 1]]);
  // Hard: each bite 20 ticks after the last is a fresh 3; the poison tick due 25 after a bite falls inside the next bite's window (1 <= 3) and is refused
  assert.deepEqual(damageOf(by("hard-8811")), [[10, 3], [30, 3], [50, 3], ...[75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325].map((t) => [t, 1])]);
  for (const r of [...all("cave-normal"), ...all("cave-hard")]) {
    const p = poisonOf(r), last = p.findLastIndex((d, t) => t > 0 && d > p[t - 1]); // the last refresh (the last bite)
    assert.equal(p.findLastIndex((d) => d > 0) - last, p[last] - 1, `${r.name}: the effect runs out after its duration`);
    for (const [t] of damageOf(r).filter(([t]) => t > 61)) assert.equal((p[t] + 1) % 25, 0, `${r.name} tick ${t}: duration % 25 == 0 when it hurts`);
  }
});
test("mobrec88 cave spider: a creative player takes no poison damage, the effect still counts down", () => {
  const r = by("cave-creative-8822");
  assert.deepEqual(damageOf(r).filter(([t]) => t > 61), [[69, 1], [169, 1]]);
  assert.ok(poisonOf(r)[120] > 0);
});
test("mobrec88 cave spider: the spider's entityToAttack is the player until the player kills it (drops, then orbs at deathTime 20)", () => {
  for (const r of all("b88mr-cave-")) {
    assert.equal(r.rows[20][0][0][4], 1, r.name);
    assert.equal(r.rows[61][0][0][3], 0, r.name);
    const kinds = r.rows.flatMap((row, t) => row[5][1].map((x) => [t, x[0]]));
    assert.ok(kinds.some(([t, k]) => t === 61 && k === "item") && kinds.some(([t, k]) => t === 80 && k === "xp"), r.name);
  }
});

// --- iron and snow golems
test("mobrec88 golem: neither golem ever targets a creeper (EntityLiving.canAttackClass), not even after the creeper's hit", () => {
  for (const r of [...all("golem-creeper"), ...all("snow-creeper")]) {
    assert.ok(r.rows.every((row) => row[0][0][4] === -1 && row[0][1][4] === -1), r.name);
    assert.ok(r.rows.every((row) => !row[5][0].length), `${r.name}: no explosion`);
  }
  for (const r of [...all("golem-creeper-8832"), ...all("golem-creeper-8833"), ...all("snow-creeper-8862")]) {
    assert.deepEqual([r.rows[9][0][0][5], r.rows[10][0][0][5], r.rows[109][0][0][5], r.rows[110][0][0][5]], [-1, 1, 1, -1], `${r.name}: the revenge target lasts 100 ticks`);
  }
});
test("mobrec88 golem: the iron golem's blow deals 7 + nextInt(15) (all of what is left at most) with mob.irongolem.throw; the spider turns on it", () => {
  for (const r of [...all("golem-spider"), ...all("golem-cave")]) {
    const hits = r.rows.map((row, t) => [t, t ? r.rows[t - 1][0][1][3] - row[0][1][3] : 0, t ? r.rows[t - 1][0][1][3] : 0]).filter((x) => x[1] > 0);
    assert.ok(hits.length > 0, r.name);
    for (const [t, d, before] of hits) {
      assert.ok((d >= 7 && d <= 21) || d === before, `${r.name} tick ${t}: ${d}`);
      assert.ok(r.rows[t][1].some((s) => s.startsWith("mob.irongolem.throw|1.0|1.0")), `${r.name} tick ${t}`);
      assert.ok(r.rows[t][0][0][7].includes("i15"), `${r.name} tick ${t}: the roll`);
    }
    assert.equal(r.rows[hits[0][0]][0][1][4], 0, `${r.name}: entityToAttack becomes the golem`);
  }
  assert.deepEqual(by("golem-spider-8841").rows.map((row, t) => [t, row[0][1][3]]).filter(([t, h], i, a) => i && h !== a[i - 1][1]), [[25, 6], [40, 0]]);
});
test("mobrec88 snow golem: a snowball every 20 ticks deals the zombie 0, knocks it back and makes it the zombie's revenge and target", () => {
  for (const r of all("snow-zombie")) {
    const thrown = r.rows.flatMap((row, t) => row[5][1].filter((x) => x[0] === "snowball").map(() => t));
    assert.ok(thrown.length >= 7, r.name);
    assert.ok(r.rows.every((row) => row[0][1][3] === 20), `${r.name}: never hurt`);
    const hit = r.rows.findIndex((row) => row[9][0].some((b) => b[7] === 1));
    assert.equal(r.rows[hit][0][1][5], 0, `${r.name}: revenge`);
    assert.ok(r.rows[hit][0][1][8][0] > 0, `${r.name}: knocked east, away from the golem`);
    assert.equal(r.rows[hit + 2][0][1][4], 0, `${r.name}: the zombie's HurtByTarget picks the golem`);
  }
});
test("mobrec88 snow golem: the snowball's random draws the EntityThrowable constructor's aim (three gaussians) before the golem's own", () => {
  const ew = new EntityWorld({ get: () => 0, getMeta: () => 0, solid: (x, y, z) => y < 0, height: 256 }, [], () => 0.5);
  const golem = ew.create("snow_golem", 10.5, 0, 10.5), zombie = ew.create("zombie", 16.5, 0, 10.5);
  setEntityRandom(golem, new JavaRandom(5n));
  golem.yaw = 0;
  const seed = 7000123;
  ew.golemBalls.projectiles.random = () => seed / 2 ** 48;
  ew.golemBalls.shoot(golem, { x: zombie.x, y: zombie.y, z: zombie.z, eyeHeight: f(1.53) });
  const ball = ew.golemBalls.balls[0], want = new GaussianRandom(BigInt(seed));
  for (let i = 0; i < 6; i++) want.nextGaussian();
  assert.equal(ball.rand.nextGaussian(), want.nextGaussian());
  // wr.a(sv, F): the lift is MathHelper.sqrt_double (a float) times 0.2F in float
  const a = aimFor({ x: 0, z: 0 }, { x: 5.701826996, y: 0, z: -0.11867798, eyeHeight: f(1.53) }, 1.43);
  assert.equal(a.dy - (f(1.53) - SNOW_GOLEM.ballOffsetY - 1.43), f(f(Math.sqrt(5.701826996 ** 2 + 0.11867798 ** 2)) * f(0.2)));
});

// --- the records hold the rules (negative controls)
test("mobrec88: replayed on the wrong difficulty or without the creative toggle, the records diverge", () => {
  for (const r of all("cave-hard")) assert.notEqual(JSON.stringify(firstDivergence(r, replayEndermanWolf({ ...r, script: r.script.filter((s) => !s.includes("difficulty")) }))), "null", r.name);
  const c = by("cave-creative");
  assert.notEqual(JSON.stringify(firstDivergence(c, replayEndermanWolf({ ...c, script: c.script.filter((s) => !s.includes("creative")) }))), "null");
  const z = by("snow-zombie-8851");
  assert.notEqual(JSON.stringify(firstDivergence(z, replayEndermanWolf({ ...z, rows: z.rows.map((row) => [...row.slice(0, 5), [row[5][0], row[5][1].map((x) => (x[0] === "snowball" ? [...x.slice(0, 7), x[7] + 1] : x)), row[5][2], row[5][3]], ...row.slice(6)]) }))), "null", "another ball seed");
});
