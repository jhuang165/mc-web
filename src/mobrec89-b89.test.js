// Batch 89 mobrec89: executed mob records on the unchanged 1.7.10 classes (tools/probes/EndermanWolfProbe.java set b89mr, scenarios EndermanWolfScenarios.run89,
// `EW_SET=b89mr node tools/verify-endermanwolf.mjs` -> public/research/enderman-wolf-b89mr-reference.json). The b88mr harness (a ticked EntityPlayerMP, the snow golem's
// snowballs fly) plus: the blaze's small fireballs update in the same spawn-order pass as the snowballs, every mob's active effects, and the player's FoodStats
// (the `realhp` op gives the probe player generic.maxHealth 20 and stops the health reset; `food` sets foodLevel, saturation, exhaustion). Row element 10:
// [[each mob's effects [id, duration, amplifier] by id], [player health, food, saturation, exhaustion, food timer], [[k, x, y, z, motion, dead] of each fireball]].
//   snow-blaze-*: a snow golem pelts a blaze (3 a snowball), the blaze answers with fireballs that light the floor and kill the golem in one record.
//   poison-*: Poison on a pig (I and II), a zombie and a pigman (undead refuse it), a spider (refuses poison, takes regeneration), a witch (15 % of magic damage),
//             a snow golem, an iron golem (Poison II).
//   player-poison*: Poison II and IV on the player, a cave spider biting a player with Poison II.
//   food-*: natural regeneration at food 18+, its interplay with poison, the floor at 1, starvation with poison, Hunger III, a cave spider fight with real health.
import test from "node:test";
import assert from "node:assert/strict";
import { reference89, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { SNOW_GOLEM_TARGETS } from "./snow-golem.js";
import { IMOB_TYPES } from "./iron-golem.js";
import { Survival } from "./survival.js";
import { tickMobEffects } from "./mob-effects.js";
import { readFileSync } from "node:fs";

const f = Math.fround;
const recs = reference89.records, by = (s) => recs.find((r) => r.name.includes(s)), all = (s) => recs.filter((r) => r.name.includes(s));
const mobHp = (r, k = 0) => r.rows.map((row) => row[0][k][3]);
const drops = (r, k = 0) => { const h = mobHp(r, k); return h.map((v, t) => [t, v]).filter(([t, v]) => t > 0 && v < h[t - 1]).map(([t]) => t); };
const food = (r) => r.rows.map((row) => row[10][1]); // [health, food, saturation, exhaustion, timer]
const healTicks = (r) => { const p = food(r); return p.map((x, t) => [t, x[0]]).filter(([t, h]) => t > 0 && h > p[t - 1][0]).map(([t]) => t); };
const playerDamage = (r) => r.rows.map((row, t) => [t, row[2]]).filter((x) => x[1] && x[1] < 100).map(([t]) => t); // the 1000-health probe player: health lost per tick

test("mobrec89: the b89mr reference holds 20 executed records with the effects, food and fireball element", () => {
  assert.equal(recs.length, 20);
  assert.match(reference89.method, /Batch 89/);
  for (const r of recs) assert.ok(r.rows.every((row) => Array.isArray(row[10]) && row[10].length === 3 && row[10][1].length === 5), r.name);
});
for (const r of recs) {
  test(`mobrec89: ${r.name} replays with no divergence (mobs, draws, sounds, effects, food stats, fireballs, cells)`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec89: firstDivergence still catches a changed record (food stats, mob effects)", () => {
  const r = by("food-regen-8931"), got = replayEndermanWolf(r);
  const bad = structuredClone(r); bad.rows[79][10][1][0] = 10;
  assert.deepEqual(firstDivergence(bad, got).slice(0, 2), [79, "player food"]);
  const p = by("poison-pig-8911"), gp = replayEndermanWolf(p), badp = structuredClone(p); badp.rows[30][10][0][0] = [];
  assert.deepEqual(firstDivergence(badp, gp).slice(0, 2), [30, "mob effects"]);
});

// --- snow golem against a blaze
test("mobrec89 snow golem: IMob.mobSelector picks the blaze on the golem's first tick; the target set is every IMob type", () => {
  for (const r of all("snow-blaze")) assert.equal(r.rows[0][0][0][4], 1, `${r.name}: the golem's attack target is the blaze at tick 0`);
  assert.deepEqual([...SNOW_GOLEM_TARGETS].sort(), [...IMOB_TYPES].sort());
  for (const k of ["blaze", "ghast", "magma_cube", "pigman"]) assert.ok(SNOW_GOLEM_TARGETS.has(k), k);
  assert.ok(!SNOW_GOLEM_TARGETS.has("pig") && !SNOW_GOLEM_TARGETS.has("iron_golem"));
  // EntityLiving.canAttackClass (sw.a(Class), bytecode-read) still refuses EntityCreeper (xz) and EntityGhast (yd) in the golem's target task
  assert.match(readFileSync(new URL("./mooshroom-golem-live.js", import.meta.url), "utf8"), /o\.e\?\.type === "creeper" \|\| o\.e\?\.type === "ghast"\) continue/);
});
test("mobrec89 snow golem: each snowball hurts the blaze by 3 (EntitySnowball.onImpact), fireballs answer and light the floor", () => {
  for (const r of all("snow-blaze")) {
    const h = mobHp(r, 1);
    assert.equal(h[0], 20, r.name);
    for (const t of drops(r, 1)) assert.equal(h[t - 1] - h[t], 3, `${r.name} tick ${t}`);
    const shots = r.rows.map((row, t) => [t, row[5][1].filter((x) => x[0] === "fireball").length]).filter((x) => x[1]).map((x) => x[0]);
    assert.equal(shots.length, 3, `${r.name}: one volley of three`);
    assert.deepEqual(shots.slice(1).map((t, i) => t - shots[i]), [6, 6], `${r.name}: six ticks apart`);
  }
  assert.deepEqual(by("snow-blaze-8901").rows.flatMap((row) => row[5][2]), [[123, 0, 67, 51, 0], [120, 0, 62, 51, 0], [102, 0, 58, 51, 0]]); // fire (51) beside the block hit
});
test("mobrec89 snow golem: a fireball kills the golem (8902) and the blaze still rises toward the dying golem that tick (xx.e reads entityToAttack before td.bq clears it)", () => {
  const r = by("snow-blaze-8902");
  assert.equal(mobHp(r)[131], 0);
  assert.ok(r.rows[131][1].some((s) => s.startsWith("none|")), "EntityGolem's death sound is \"none\"");
  const m = r.rows[132][0][1];
  assert.ok(m[1] > r.rows[131][0][1][1], "the blaze moves up at tick 132");
});

// --- poison on mobs
test("mobrec89 mob poison: Poison I every 25 ticks and Poison II every 12, never below 1 health (Potion.performEffect, health > 1)", () => {
  assert.deepEqual(drops(by("poison-pig-8911")), [25, 50, 75, 100, 125, 150, 175, 200]);
  assert.equal(Math.min(...mobHp(by("poison-pig-8911"))), 1);
  const p2 = by("poison2-pig-8912");
  assert.deepEqual(drops(p2), [8, 20, 32, 44, 56, 68, 80, 92, 104]);
  assert.equal(mobHp(p2).at(-1), 1);
  assert.deepEqual(p2.rows.at(-1)[10][0][0], [[19, 40, 1]], "the effect keeps counting at 1 health");
  assert.deepEqual(drops(by("poison2-golem-8917")).slice(0, 4), [6, 18, 30, 42]);
  assert.deepEqual(drops(by("poison-snowgolem-8916")), [20, 45, 70]);
});
test("mobrec89 mob poison: undead refuse poison and regeneration, a spider refuses poison and takes regeneration (EntityLivingBase.isPotionApplicable overrides)", () => {
  const z = by("poison-zombie-8913");
  assert.deepEqual(z.rows[1][10][0][0], [[1, 98, 0]], "only Speed stays on the zombie");
  assert.deepEqual(drops(z), []);
  const pm = by("poison-pigman-8918");
  assert.ok(pm.rows.every((row) => !row[10][0][0].length));
  assert.deepEqual(drops(pm), []);
  const s = by("poison-spider-8914");
  assert.deepEqual(s.rows[1][10][0][0], [[10, 148, 0]]);
  const h = mobHp(s);
  assert.deepEqual(h.map((v, t) => [t, v]).filter(([t, v]) => t > 0 && v !== h[t - 1]), [[50, 12], [100, 13]], "Regeneration I heals every 50 ticks");
});
test("mobrec89 mob poison: the witch takes 15 % of the magic damage (EntityWitch.applyPotionDamageCalculations), and poison goes through attackEntityFrom", () => {
  const w = by("poison-witch-8915"), h = mobHp(w);
  for (const t of drops(w)) assert.equal(f(h[t - 1] - h[t]) <= 0.16, true, `tick ${t}: ${h[t - 1]} -> ${h[t]}`);
  assert.ok(w.rows.some((row) => row[1].some((s) => s.startsWith("mob.witch.hurt"))), "the hurt sound plays");
  // tickMobEffects with the world's hurt path: the amount and the magic source reach it
  const calls = [], e = { type: "pig", health: 10, effects: [{ id: 19, duration: 25, amplifier: 0 }] };
  tickMobEffects(e, { width: 0.9, height: 0.9 }, 10, { nextBoolean: () => false, nextDouble: () => 0, nextInt: () => 1, nextFloat: () => 0 }, null, (m, n, src) => calls.push([m === e, n, src]));
  assert.deepEqual(calls, [[true, 1, "magic"]]);
  assert.equal(e.health, 10, "the hurt hook owns the health change");
});

// --- poison on the player
test("mobrec89 player poison: Poison II hurts every 12 ticks, Poison IV (every 3) is filtered to every 12 by the hurt window", () => {
  const p2 = playerDamage(by("player-poison2-8921"));
  assert.deepEqual(p2.slice(0, 5), [8, 20, 32, 44, 56]);
  const p4 = playerDamage(by("player-poison4-8922"));
  assert.deepEqual(p4.slice(0, 5), [1, 13, 25, 37, 49]);
  for (const ts of [p2, p4]) assert.ok(ts.slice(1).every((t, i) => t - ts[i] === 12));
});
test("mobrec89 player poison: magic damage costs no exhaustion, a cave spider's bite costs 0.3F (FoodStats.addExhaustion(float))", () => {
  const r = by("player-poison2-cave-8923"), p = food(r);
  assert.equal(p[13][3], 0, "the poison hits at 0 and 12 add nothing");
  assert.equal(p[14][3], f(0.3));
  // the hit at 34 lands on 0.31470004 before the copy's knockback walk adds 0.0018F: f32 sums of 0.3F, not of the double 0.3
  assert.equal(p[34][3], 0.6165000796318054);
  const s = new Survival(); s.exhaustion = f(0.31470003724098206); s.exhaust(0.3); s.exhaust(f(f(f(0.01) * 18) * f(0.01)));
  assert.equal(s.exhaustion, 0.6165000796318054);
});

// --- food stats
test("mobrec89 food: natural regeneration heals 1 every 80 ticks at food 18+ and charges 3 exhaustion (FoodStats.onUpdate)", () => {
  const r = by("food-regen-8931");
  assert.deepEqual(healTicks(r), [79, 159, 239, 319, 399]);
  const p = food(r);
  assert.equal(p[79][3], 3);
  assert.deepEqual(p[160].slice(1, 4), [20, 4, 2], "exhaustion over 4 takes a saturation point first");
});
test("mobrec89 food: poison does not reset the regeneration timer; both run (poison every 25, regen every 80)", () => {
  const r = by("food-poison-8932");
  assert.deepEqual(healTicks(r), [79, 159, 239, 319, 399]);
  const p = food(r), lost = p.map((x, t) => [t, x[0]]).filter(([t, h]) => t > 0 && h < p[t - 1][0]).map(([t]) => t);
  assert.deepEqual(lost, [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275]);
  assert.equal(Math.min(...p.map((x) => x[0])), 1);
});
test("mobrec89 food: below food 18 no regeneration; Poison II stops at 1 health", () => {
  const p = food(by("food-poison2-floor-8933"));
  assert.deepEqual(p.map((x) => x[0]).filter((h, t, a) => t === 0 || h !== a[t - 1]), [4, 3, 2, 1]);
  assert.ok(p.every((x) => x[4] === 0), "the food timer never counts at food 10");
});
test("mobrec89 food: at food 0 the timer counts to 80 and starvation is refused inside the poison's hurt window; health stays at least 1", () => {
  const p = food(by("food-starve-8934"));
  assert.equal(p[78][4], 79);
  assert.equal(p[79][4], 0);
  assert.equal(p[79][0], p[78][0], "no starvation damage on Normal at tick 79 (the poison hit at 75 holds the window)");
  assert.equal(Math.min(...p.map((x) => x[0])), 1);
});
test("mobrec89 food: Hunger III drains 0.075 exhaustion a tick and costs food once saturation is gone", () => {
  const p = food(by("food-hunger-8935"));
  assert.equal(p[0][3], f(0.075));
  const foods = p.map((x) => x[1]).filter((v, t, a) => t === 0 || v !== a[t - 1]);
  assert.deepEqual(foods.slice(0, 4), [20, 19, 18, 17]);
  assert.deepEqual(healTicks(by("food-hunger-8935")), [79], "the regeneration while food was still 18+");
});

test("mobrec89: the replay sets no Date.now seeding and the probe set is registered in the verifier", () => {
  const src = readFileSync(new URL("./enderman-wolf-replay.js", import.meta.url), "utf8");
  assert.ok(!/Date\.now/.test(src));
  assert.match(readFileSync(new URL("../tools/verify-endermanwolf.mjs", import.meta.url), "utf8"), /b89mr/);
});
