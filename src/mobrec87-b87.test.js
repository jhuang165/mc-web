// Batch 87 mobrec87: executed mob records on the unchanged 1.7.10 classes.
// 1. A witch fight against the player (tools/probes/EndermanWolfProbe.java set b87wf, scenarios EndermanWolfScenarios.run87, `EW_SET=b87wf node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b87wf-reference.json): the b45cw creeperwitch harness where the EntityPotion entities the witch throws also update, after the mobs in spawn
//    order, so they fly, hit the (unticked) probe player and splash it: the witch's choice follows the effects that landed, harming hurts the player, the hurt witch drinks
//    healing, and the player's blows kill it (drops and orbs). Replayed by enderman-wolf-replay.js with the live potion walk (entity-simulation.js entityWalkers, kind potion).
// 2. Zombie pigmen and 4. villagers killed by a baby zombie and a zombie villager (tools/probes/VillageFightProbe.java names b87-*, `VF_PREFIX=b87- node tools/verify-village-fight.mjs`
//    -> public/research/village-fight-b87-reference.json), replayed by village-fight-replay.js.
// 3. A squid pushing a boat with a rider (tools/probes/SquidPushProbe.java SQ_B87 records, tools/verify-squid-push.mjs -> public/research/squid-push-b87-reference.json): the
//    b86 pool world, a squid, an EntityBoat and an AI-less EntityCow mounted on it (World.updateEntities: the rider updates right after its mount).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityRandom, setEntityBoxes } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { squidStateOf } from "./squid-bat.js";
import { plain } from "./legacy-ai-replay.js";
import { Boats } from "./boats.js";
import { entityWalkers } from "./entity-simulation.js";
import { finishBoatSimulation } from "./structure-simulation.js";
import { boatBoxProvider } from "./entity-collision.js";
import { mountMobOnVehicle } from "./vehicle-riders.js";
import { replayFight, firstDivergence, fightReference87 } from "./village-fight-replay.js";
import { replayEndermanWolf, firstDivergence as witchDivergence } from "./enderman-wolf-replay.js";
import { splitExperience } from "./experience.js";

const ref = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url)));
const witchRef = ref("enderman-wolf-b87wf-reference.json"), squidRef = ref("squid-push-b87-reference.json"), fightRef = fightReference87;
const f = Math.fround;

// --- 1. the witch fight
for (const r of witchRef.records) {
  test(`mobrec87 witch: ${r.name} replays with no divergence (potions in flight, the player's effects and damage, drinks, drops)`, () => {
    assert.equal(JSON.stringify(witchDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
// Witch rows: [mobs (the witch: [x, y, z, health, ..., [drinking, use timer, potion damage, speed], draws, motion]), sounds, damage to the player, hurtBy, tick,
// [explosions, spawned [kind, ...], cells, player motion], [potions that updated [k, x, y, z, motion, dead], the player's effects [id, duration, amplifier]]].
const spawnedKinds = (r) => r.rows.flatMap((row, t) => row[5][1].map((x) => [t, x[0], x[1]]));
const throwsOf = (r) => spawnedKinds(r).filter((x) => x[1] === "potion").map((x) => [x[0], x[2]]);
const effectsOf = (r) => [...new Set(r.rows.flatMap((row) => row[6][1].map((e) => e[0])))].sort((a, b) => a - b);
const witchBy = (s) => witchRef.records.find((r) => r.name.includes(s));
test("mobrec87 witch: it throws every 60 ticks and its pick follows the distance and the effects that landed", () => {
  assert.equal(witchRef.records.length, 4);
  // poison 32660, harming 32732, slowness 32698 (EntityWitch.attackEntityWithRangedAttack); the unticked player's effects never run out
  assert.deepEqual(throwsOf(witchBy("fight-8801")), [[60, 32660], [120, 32732], [180, 32698]]);
  assert.deepEqual(effectsOf(witchBy("fight-8801")), [2, 19]);
  assert.deepEqual(throwsOf(witchBy("near-8803")), [[60, 32660], [120, 32660], [180, 32732]]);
  assert.deepEqual(effectsOf(witchBy("near-8803")), [19]);
  for (const r of witchRef.records) assert.ok(r.rows.some((row) => row[6][0].some((p) => p[7] === 1)), `${r.name}: a potion breaks`);
});
test("mobrec87 witch: harming hurts the player 6 (the unticked player's hurt timer then blocks later splashes)", () => {
  assert.deepEqual(witchBy("fight-8801").rows.map((row, t) => [t, row[2]]).filter((x) => x[1]), [[130, 6]]);
  assert.deepEqual(witchBy("near-8803").rows.filter((row) => row[2]).length, 0);
});
test("mobrec87 witch: the hurt witch drinks healing (16341) and the player's blows kill it: items, then orbs 20 ticks later", () => {
  const drinks = (r) => r.rows.map((row, t) => [t, row[0][0]?.[6]]).filter(([t, d], i, all) => d && d[0] === 1 && !(all[i - 1]?.[1]?.[0] === 1)).map(([t, d]) => [t, d[2]]);
  assert.deepEqual(drinks(witchBy("melee-8811")), [[63, 16341], [141, 16341]]);
  assert.deepEqual(drinks(witchBy("melee-8812")), [[102, 16341]]);
  assert.deepEqual(spawnedKinds(witchBy("melee-8811")).filter((x) => x[1] !== "potion"), [[141, "item", 280], [141, "item", 280], [141, "item", 375], [160, "xp", 3], [160, "xp", 3]]);
  assert.deepEqual(spawnedKinds(witchBy("melee-8812")).filter((x) => x[1] !== "potion"), [[160, "xp", 3], [160, "xp", 1], [160, "xp", 1]]);
  for (const s of ["melee-8811", "melee-8812"]) assert.equal(witchBy(s).rows.at(-1)[0][0][3], 0);
});
test("mobrec87 witch: the records need the potions to fly (frozen potions diverge)", () => {
  for (const r of witchRef.records) assert.notEqual(JSON.stringify(witchDivergence(r, replayEndermanWolf(r, { frozenPotions: true }))), "null", r.name);
});

// --- 2 and 4. pigmen, baby zombie and zombie villager kills
const replayWithLoot = (r) => {
  const seen = [], at = { n: 0 };
  const got = replayFight(r, { onTick: (t, ew) => { for (; at.n < ew.events.length; at.n++) { const x = ew.events[at.n]; if (x.drop) seen.push("item"); if (x.xp) for (const _ of splitExperience(x.xp)) seen.push("orb"); } } });
  return { got, seen };
};
for (const r of fightRef.records) {
  test(`mobrec87 fight: ${r.name} replays with no divergence, the same hits, items and orbs`, () => {
    const { got, seen } = replayWithLoot(r);
    assert.equal(JSON.stringify(firstDivergence(r, got)), "null", r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(r.loot.map((l) => (l[1] === "sq" ? "orb" : "item")).sort(), seen.sort(), `${r.name} loot kinds`);
  });
}
const byName = (s) => fightRef.records.filter((r) => r.name.includes(s));
const lost = (r, n) => [...new Set(r.rows.map((row, t) => (t ? r.rows[t - 1][0][n][3] : 1000) - row[0][n][3]).filter((x) => x > 0))];
test("mobrec87 pigman: Easy strikes for 3.5 and Normal for 5 (EntityMob damage scaled by the difficulty)", () => {
  for (const r of byName("pigman-easy")) assert.deepEqual(lost(r, 1), [3.5], r.name);
  for (const r of byName("pigman-normal")) assert.deepEqual(lost(r, 1), [5], r.name);
  for (const r of [...byName("pigman-easy"), ...byName("pigman-normal")]) assert.ok(r.loot.some((l) => l[1] === "sq"), `${r.name}: orbs`);
});
test("mobrec87 pigman: the player's hit angers every pigman within 32 blocks, not the far one", () => {
  for (const r of byName("pigman-group")) {
    // tick 30: pigmen 0 and 1 (the hit one and its neighbour) chase the player (index 3); pigman 2 at x 98.5 is outside the box and stays calm until its own hit at tick 70
    assert.deepEqual(r.rows[30][0].slice(0, 3).map((m) => m[4]), [3, 3, -1], r.name);
  }
  const [easy] = byName("pigman-group-easy");
  assert.equal(easy.rows.at(-1)[0][2][3], 20, "the far pigman is never hit nor angered on Easy");
  // the anger reaches a dying pigman too (it is still in the chunk lists until deathTime 20): hit after pigman 0 died, pigman 1's attackEntityFrom angers it again and its
  // angry sound (two nextFloat draws) plays 2 ticks later (the death puffs follow at deathTime 20)
  for (const [name, hit] of [["group-8711", 60], ["group-easy-8712", 70]]) {
    const [r] = byName(name);
    assert.equal(r.rows[hit - 1][0][0][3], 0, name);
    assert.deepEqual(r.rows.map((row, t) => [t, row[0][0][6]]).filter(([t, d]) => t > hit && t < hit + 5 && d.length).map(([t, d]) => [t, d]), [[hit + 2, ["f", "f"]]], name);
  }
});
test("mobrec87 pigman: the iron golem kills it without anger or orbs (not a player kill)", () => {
  for (const r of byName("pigman-golem")) {
    assert.ok(r.rows.some((row) => row[0][0][3] === 0), `${r.name}: the golem kills the pigman`);
    assert.ok(r.rows.some((row) => row[0][1][4] === 0), `${r.name}: the golem targets the pigman`);
    assert.ok(r.loot.length > 0 && r.loot.every((l) => l[1] !== "sq"), `${r.name}: drops without orbs`);
    assert.equal(lost(r, 2).length, 0, `${r.name}: the player is never hit`);
  }
});
test("mobrec87 conversion: a baby zombie and a zombie villager kill; Easy never converts, Hard always, Normal for some seeds", () => {
  for (const kind of ["babykill", "zvkill"]) {
    const by = (d) => byName(`${kind}-d${d}`);
    assert.ok(by(1).every((r) => r.conversions.length === 0), kind);
    assert.ok(by(3).length && by(3).every((r) => r.conversions.length === 1), kind);
    const normal = by(2).map((r) => r.conversions.length);
    assert.ok(normal.includes(0) && normal.includes(1), `${kind} ${normal}`);
    for (const r of byName(kind)) assert.deepEqual([r.rows[9][0][0][3], r.rows[10][0][0][3]], [3, 0], `${r.name}: the killer's own hit at tick 10`);
  }
});
test("mobrec87 conversion: the baby op matters (replayed as an adult the baby records diverge) and a converting record diverges on Easy", () => {
  for (const r of byName("babykill")) assert.notEqual(JSON.stringify(firstDivergence(r, replayFight({ ...r, script: r.script.filter((s) => !s.includes(" baby ")) }))), "null", r.name);
  for (const r of fightRef.records.filter((x) => x.difficulty === 3 && x.types === "VZ")) assert.notEqual(JSON.stringify(firstDivergence(r, replayFight({ ...r, difficulty: 1 }))), "null", r.name);
});

// --- 3. a squid pushing a boat with a rider
const FIELDS = ["pitch", "prevPitch", "yaw", "prevYaw", "rotation", "tentacle", "prevTentacle", "motionSpeed", "rotationVelocity", "rotateSpeed", "vecX", "vecY", "vecZ"];
const counted = (r) => { const next = r.next.bind(r); r.calls = 0; r.next = (bits) => (r.calls++, next(bits)); return r; };
const pool = () => plain([[43, 0, 43, 86, 10, 86, 1, 0], [44, 0, 44, 85, 9, 85, 9, 0], [44, 10, 44, 85, 10, 85, 0, 0]]);
function squidOf(ew, seed, [x, y, z]) {
  const e = ew.create("squid", x, y, z);
  Object.assign(e, { vx: 0, vy: 0, vz: 0, renderYawOffset: 0, rotationYaw: 0, air: 300, onGround: false });
  const s = squidStateOf(e, new JavaRandom(seed)), r = counted(new JavaRandom(seed));
  setEntityRandom(e, r);
  return { e, s, r };
}
const exact = (at, got, want) => { for (let i = 0; i < want.length; i++) assert.equal(got[i] + 0, i === 6 && /boat|start/.test(at) ? f(want[i]) : want[i], `${at} [${i}]`); };
export function replaySquidRider(rec, without = null) {
  const ew = new EntityWorld(pool(), [], () => 0.5);
  ew.ai.player.unticked = true;
  ew.ai.think = () => {}; // EntityListProbe.Cow: updateAITasks switched off
  const boats = new Boats(), player = { x: 64.5, y: 20, z: 64.5 };
  Object.assign(ew.ai.player, player);
  const state = { world: ew.world, boats, mobs: ew, position: player, width: 0.6, height: 1.8, alive: false, velocity: { x: 0, z: 0 } };
  ew.walks = entityWalkers(() => ({ state, hooks: {} }));
  for (const k of [...ew.walks.keys()]) if (k !== "boat") ew.walks.delete(k);
  boats.joined = (b) => ew.joined(b, "boat");
  const [bx, by, bz, bvx, byaw] = rec.boat, addBoat = () => boats.spawnBoat({ x: bx, y: by, z: bz, yaw: byaw, vx: bvx }, { seed: 7 });
  let boat, q;
  if (rec.order === "bs") { boat = addBoat(); q = squidOf(ew, rec.seed, rec.at); ew.entities.push(q.e); }
  else { q = squidOf(ew, rec.seed, rec.at); ew.entities.push(q.e); ew.orderStamp(); boat = addBoat(); }
  const cow = ew.create("cow", bx, by + 1, bz);
  Object.assign(cow, { growingAge: 0, onGround: false, vx: 0, vy: 0, vz: 0 });
  for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead"]) cow[k] = 0;
  cow.yaw = 0;
  setEntityRandom(cow, new JavaRandom(7));
  ew.entities.push(cow); ew.orderStamp();
  if (without !== "rider") assert.ok(mountMobOnVehicle(boat, cow, (m) => ew.size(m)[1]));
  const view = () => [boat.x, boat.posY, boat.z, boat.vx, boat.vy, boat.vz, boat.yaw, boat.dead ? 1 : 0];
  exact("start", view(), rec.boatStart);
  const surv = new Survival({});
  setEntityBoxes(boatBoxProvider(boats));
  try {
    rec.rows.forEach((row, t) => {
      const before = q.r.calls;
      ew.tickMobs(player, surv);
      finishBoatSimulation(state, {});
      const at = `${rec.name} tick ${t + 1}`, x = row[0];
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) assert.equal(q.e[k] + 0, x[k], `${at} squid ${k}`);
      for (const k of FIELDS) assert.equal(q.s[k], f(x[k]), `${at} squid ${k}`);
      assert.equal(q.r.calls - before, x.draws, `${at} squid draws`);
      exact(`${at} boat`, view(), row[1]);
      exact(`${at} cow`, [cow.x, cow.y, cow.z, cow.vx, cow.vy, cow.vz], row[2]);
    });
  } finally { setEntityBoxes(null); }
}
for (const rec of squidRef.records) test(`mobrec87 squid: ${rec.name} replays with 0 mismatches (squid, boat, rider)`, () => replaySquidRider(rec));
test("mobrec87 squid: the squid pushes the ridden boat and its rider; the rider matters", () => {
  for (const r of squidRef.records) {
    assert.ok(r.rows.some((row) => row[1][3] !== r.boat[3]), `${r.name}: the boat is pushed`);
    assert.ok(r.rows.some((row) => row[0].x !== r.at[0]), `${r.name}: the squid moves`);
    assert.ok(Math.abs(r.rows.at(-1)[2][0] - r.rows[0][2][0]) > 1, `${r.name}: the rider rides along (updateRidden places it on the boat each tick)`);
    assert.throws(() => replaySquidRider(r, "rider"), assert.AssertionError, `${r.name}: an unseated cow diverges`);
  }
});
