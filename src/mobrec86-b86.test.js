// Batch 86 mobrec86: executed mob records on the unchanged 1.7.10 classes.
// 1. Squid push against a boat and against a ticked player (tools/probes/SquidPushProbe.java SQ_B86 records, tools/verify-squid-push.mjs ->
//    public/research/squid-push-b86-reference.json): a pool world (EntityListProbe.EW: still water at x 44..85, z 44..85, y 0..9, stone walls), a squid and an
//    empty EntityBoat walked in one list (both orders, and a boat drifting into the squid), and a squid beside a real EntityPlayerMP ticked after the world's
//    entities (EntityPlayerMP.onUpdateEntity) and put back where it stood (processPlayer), so the squid pushes the player and the player pushes the squid.
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
import { replayFight, firstDivergence, fightReference86 } from "./village-fight-replay.js";
import { splitExperience } from "./experience.js";

const squidRef = JSON.parse(readFileSync(new URL("../public/research/squid-push-b86-reference.json", import.meta.url)));
const f = Math.fround;
const FIELDS = ["pitch", "prevPitch", "yaw", "prevYaw", "rotation", "tentacle", "prevTentacle", "motionSpeed", "rotationVelocity", "rotateSpeed", "vecX", "vecY", "vecZ"];
const counted = (r) => { const next = r.next.bind(r); r.calls = 0; r.next = (bits) => (r.calls++, next(bits)); return r; };
// The probe's pool: original still water 9 and stone 1 (legacy-ai-replay.js plain maps the ids; its door cells are inside the fill and overwritten).
const pool = () => plain([[43, 0, 43, 86, 10, 86, 1, 0], [44, 0, 44, 85, 9, 85, 9, 0], [44, 10, 44, 85, 10, 85, 0, 0]]);

function squidOf(ew, seed, [x, y, z]) {
  const e = ew.create("squid", x, y, z);
  Object.assign(e, { vx: 0, vy: 0, vz: 0, renderYawOffset: 0, rotationYaw: 0, air: 300, onGround: false });
  const s = squidStateOf(e, new JavaRandom(seed)), r = counted(new JavaRandom(seed));
  setEntityRandom(e, r);
  return { e, s, r };
}
function compareSquid(at, q, x, before, vel = true) {
  for (const k of vel ? ["x", "y", "z", "vx", "vy", "vz"] : ["x", "y", "z"]) assert.equal(q.e[k] + 0, x[k], `${at} ${k}`);
  for (const k of FIELDS) assert.equal(q.s[k], f(x[k]), `${at} ${k}`);
  assert.equal(q.r.calls - before, x.draws, `${at} draws`);
  assert.equal(q.r.save().seed, x.random.seed, `${at} random`);
}

export function replaySquidBoat(rec, check, without = null) {
  const ew = new EntityWorld(pool(), [], () => 0.5);
  ew.ai.player.unticked = true;
  // The probe world has no player (EntityLiving.despawnEntity finds none); the port's player stands 10 blocks above the pool, inside the ticking window and the
  // 32-block despawn radius (no draws within the records' 40 ticks), out of every push reach.
  const boats = new Boats(), player = { x: 64.5, y: 20, z: 64.5 };
  Object.assign(ew.ai.player, player);
  const state = { world: ew.world, boats, mobs: ew, position: player, width: 0.6, height: 1.8, alive: false, velocity: { x: 0, z: 0 } };
  ew.walks = entityWalkers(() => ({ state, hooks: {} }));
  for (const k of [...ew.walks.keys()]) if (k !== "boat") ew.walks.delete(k);
  boats.joined = (b) => ew.joined(b, "boat");
  const [bx, by, bz, bvx, byaw] = rec.boat;
  const addBoat = () => { const b = boats.spawnBoat({ x: bx, y: by, z: bz, yaw: byaw, vx: bvx }, { seed: 7 }); return b; };
  let boat, q;
  if (rec.order === "bs") { boat = addBoat(); q = squidOf(ew, rec.seed, rec.at); ew.entities.push(q.e); }
  else { q = squidOf(ew, rec.seed, rec.at); ew.entities.push(q.e); ew.orderStamp(); boat = addBoat(); }
  const view = () => [boat.x, boat.posY, boat.z, boat.vx, boat.vy, boat.vz, boat.yaw, boat.dead ? 1 : 0];
  check("start", view(), rec.boatStart);
  const surv = new Survival({});
  if (without !== "boatBox") setEntityBoxes(boatBoxProvider(boats));
  if (without === "boatBox") ew.walks.get("boat").tick = (b) => boats.tickOne(state.world, b, [], {}); // the boat moves through the squid // World.getCollidingBoundingBoxes: the boat's box blocks the squid (main.js installs the same provider)
  try {
    rec.rows.forEach((row, t) => {
      const before = q.r.calls;
      if (without === "boatPush") ew.walks.get("boat").pushMob = null;
      ew.tickMobs(player, surv);
      finishBoatSimulation(state, {});
      compareSquid(`${rec.name} tick ${t + 1} squid`, q, row[0], before);
      check(`${rec.name} tick ${t + 1} boat`, view(), row[1]);
    });
  } finally { setEntityBoxes(null); }
}

export function replaySquidPlayer(rec, check, without = null) {
  const ew = new EntityWorld(pool(), [], () => 0.5);
  const q = squidOf(ew, rec.seed, rec.at);
  ew.entities.push(q.e);
  const [px, py, pz] = rec.player, p = { x: px, y: py, z: pz, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62, motion: { x: 0, y: 0, z: 0 } };
  Object.assign(ew.ai.player, { x: px, y: py, z: pz });
  const surv = new Survival({});
  rec.rows.forEach((row, t) => {
    const before = q.r.calls, m = ew.ai.player.motion;
    let pushed = null, sq = null;
    ew.afterEntities = () => { pushed = [m.x, m.y, m.z]; sq = [q.e.vx, q.e.vy, q.e.vz]; }; // after the world's entities, before the network tick's onUpdateEntity
    if (without === "playerTick") ew.ai.player.unticked = true;
    ew.tick(p, surv);
    compareSquid(`${rec.name} tick ${t + 1} squid`, q, row[0], before, false);
    check(`${rec.name} tick ${t + 1} squid motion`, sq, [row[0].vx, row[0].vy, row[0].vz]); // as the probe logs it: before the player's own update pushes the squid
    check(`${rec.name} tick ${t + 1} pushed`, pushed, row[1]);
    check(`${rec.name} tick ${t + 1} player`, [m.x, m.y, m.z], row[2]);
    Object.assign(ew.ai.player, { x: px, y: py, z: pz }); // processPlayer puts the copy back
  });
}

// a boat row's yaw (index 6) is a float the probe prints with Float.toString
const exact = (at, got, want) => { for (let i = 0; i < want.length; i++) assert.equal(got[i] + 0, i === 6 && at.includes("boat") || at.endsWith("start") && i === 6 ? f(want[i]) : want[i], `${at} [${i}]`); };
for (const rec of squidRef.records) {
  test(`mobrec86 squid: ${rec.name} replays with 0 mismatches`, () => {
    if (rec.kind === "boat") replaySquidBoat(rec, exact);
    else replaySquidPlayer(rec, exact);
  });
}
test("mobrec86 squid: the records push (the boat and the player move, the squid is pushed by the player)", () => {
  const drift = squidRef.records.find((r) => r.name === "b86-boat-drift");
  assert.ok(drift.rows.some((row) => row[1][3] < 0), "the drifting boat turns back off the squid");
  for (const r of squidRef.records.filter((x) => x.kind === "tplayer")) {
    assert.ok(r.rows.some((row) => row[1][0] !== 0), `${r.name}: the squid's push reaches the player`);
    assert.ok(r.rows.some((row) => row[0].x !== r.at[0]), `${r.name}: the player's push moves the squid`);
  }
});
test("mobrec86 squid: the records need the squid's push on the boat and the player's own tick", () => {
  const fails = (fn) => { try { fn(); return false; } catch { return true; } };
  for (const r of squidRef.records.filter((x) => x.kind === "boat" && !x.name.includes("ram"))) assert.ok(fails(() => replaySquidBoat(r, exact, "boatPush")), `${r.name} without the mob push`);
  // the rams: the boat's move stops at the squid's box (EntityBoat.getCollisionBox(other) is other's box); at 0.25 the stopped boat breaks (isCollidedHorizontally, speed > 0.2)
  for (const r of squidRef.records.filter((x) => x.name.includes("ram"))) assert.ok(fails(() => replaySquidBoat(r, exact, "boatBox")), `${r.name} without the boxes`);
  for (const r of squidRef.records.filter((x) => x.kind === "tplayer")) assert.ok(fails(() => replaySquidPlayer(r, exact, "playerTick")), `${r.name} without the player tick`);
});

// 2. Villager-to-zombie conversion (tools/probes/VillageFightProbe.java names b86-*, `VF_PREFIX=b86- node tools/verify-village-fight.mjs` ->
//    public/research/village-fight-b86-reference.json): a villager killed by a zombie, EntityLivingBase.onDeath -> EntityZombie.onKillEntity (yq.a(sv)). "kill": both in a
//    walled 2x1 cell, a scripted 17.0 blow by the zombie, then the zombie's own EntityAIAttackOnCollide hit kills the villager at tick 10; "blow": a scripted lethal hit in the open.
const fightRef = fightReference86;
for (const r of fightRef.records) {
  test(`mobrec86 ${r.types === "P" ? "pigman" : "conversion"}: ${r.name} replays with no divergence, the same items and orbs`, () => {
    const seen = [], at = { n: 0 };
    const got = replayFight(r, { onTick: (t, ew) => { for (; at.n < ew.events.length; at.n++) { const x = ew.events[at.n]; if (x.drop) seen.push("item"); if (x.xp) for (const _ of splitExperience(x.xp)) seen.push("orb"); } } });
    assert.equal(JSON.stringify(firstDivergence(r, got)), "null", r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(r.loot.map((l) => l[1] === "sq" ? "orb" : "item").sort(), seen.sort(), `${r.name} loot kinds`);
  });
}
test("mobrec86 conversion: Easy never converts, Hard always does, Normal converts for some seeds (the killer's nextBoolean)", () => {
  const by = (d) => fightRef.records.filter((r) => r.types === "VZ" && r.difficulty === d);
  assert.ok(by(1).length && by(1).every((r) => r.conversions.length === 0));
  assert.ok(by(3).length && by(3).every((r) => r.conversions.length === 1 && r.zombies.length === 1));
  const normal = by(2).map((r) => r.conversions.length);
  assert.ok(normal.includes(0) && normal.includes(1), JSON.stringify(normal));
  // the kills are the zombie's own attack: the villager is on 3 health after the scripted blow and dies at tick 10
  for (const r of fightRef.records.filter((x) => x.name.includes("-kill-"))) assert.deepEqual([r.rows[9][0][0][3], r.rows[10][0][0][3]], [3, 0], r.name);
});
test("mobrec86 conversion: a converting record diverges when replayed on Easy (the conversion is in the compared rows)", () => {
  for (const r of fightRef.records.filter((x) => x.types === "VZ" && x.difficulty === 3)) assert.notEqual(JSON.stringify(firstDivergence(r, replayFight({ ...r, difficulty: 1 }))), "null", r.name);
});

// 3. A zombie pigman fight (the same probe, names b86-pigman-*): angered by the player's hit at tick 5 it runs at the held player and strikes (7.5 on Normal, 1000-health probe
//    player), the player's lethal hit at tick 50 kills it, the recentlyHit drops and the deathTime 20 orbs.
test("mobrec86 pigman: the records anger, strike the player and drop loot", () => {
  const pig = fightRef.records.filter((r) => r.types === "P");
  assert.equal(pig.length, 4);
  for (const r of pig) {
    assert.ok(r.rows.some((row) => row[0][1][3] < 1000), `${r.name}: the pigman's hit lands`);
    assert.ok(r.loot.filter((l) => l[1] === "sq").length > 0, `${r.name}: orbs`);
  }
  assert.ok(pig.some((r) => r.loot.some((l) => l[1] !== "sq")), "an item drop");
});
