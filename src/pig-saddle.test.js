import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as P from "./pig-saddle.js";
import { moveEntityWithHeading, jump, EntityWorld, ENTITY_TYPES } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { mobDrops } from "./combat.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(await readFile(new URL("../public/research/pig-saddle-reference.json", import.meta.url)));
const f = Math.fround;
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b}`);
const stepWorld = (step) => ({ get: (x, y, z) => (y < 0 || (step > 0 && z >= 2 && y < step) ? 1 : 0), solid: (x, y, z) => y < 0 || (step > 0 && z >= 2 && y < step) });

test("pig facts, task priorities and item limits match EntityPig, ub, ItemSaddle and ItemCarrotOnAStick", () => {
  const facts = ref.facts;
  assert.equal(facts.mountedOffset, P.PIG_MOUNTED_OFFSET);
  assert.equal(f(facts.ubMaxSpeed), P.MAX_SPEED);
  assert.equal(facts.ubMutex, 7);
  assert.deepEqual(facts.tasks.map((t) => t.priority), [0, 1, 2, 3, 4, 4, 5, 6, 7, 8]);
  assert.deepEqual(Object.values(P.PIG_TASK_PRIORITIES), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(facts.tasks[2].class, "ub");
  assert.deepEqual(facts.stick, { id: P.CARROT_ON_A_STICK_ORIGINAL, maxDamage: P.STICK_DURABILITY, maxStack: 1, full3D: true });
  assert.equal(ORIGINAL_ITEMS[P.CARROT_ON_A_STICK_ORIGINAL], P.CARROT_ON_A_STICK);
  assert.equal(ITEMS[P.CARROT_ON_A_STICK].durability, P.STICK_DURABILITY);
  assert.equal(ITEMS[P.CARROT_ON_A_STICK].stack, 1);
  assert.equal(ITEMS[P.SADDLE].stack, facts.saddle.maxStack);
});

test("saddle use and hit agree with ItemSaddle over pigs, foals, saddled pigs and a cow", () => {
  for (const row of ref.saddle) {
    const target = { pig: row.target === "pig", saddled: row.saddled, child: row.age < 0 };
    const out = row.hit ? P.saddleHit(target) : P.saddleUse(target);
    assert.equal(out.result, row.result, JSON.stringify(row));
    assert.equal(row.target === "pig" && (row.saddled || out.saddle), row.after, JSON.stringify(row));
    assert.equal(row.count - (out.saddle ? 1 : 0), row.stack, JSON.stringify(row));
    assert.deepEqual(out.sound ? [`${out.sound.name}|${out.sound.volume}|${out.sound.pitch.toFixed(1)}`] : [], row.sounds);
  }
});

test("a saddled pig mounts the player only when EntityAnimal.interact declines and the seat is free", () => {
  for (const row of ref.interact) {
    // EntityAnimal.interact takes the carrot (breeding item) at age 0 before the seat is tried.
    const fed = row.item === 391 && row.age === 0;
    const mounts = !fed && P.pigMounts({ saddled: row.saddled, riderFree: row.seat === 0, riderIsPlayer: row.seat === 1 });
    assert.equal(fed || mounts, row.result, JSON.stringify(row));
    if (row.seat === 0) assert.equal(mounts ? "player" : "none", row.rider, JSON.stringify(row));
  }
});

test("steering needs a carrot on a stick, a living pig and a player rider, or a running boost", () => {
  for (const row of ref.steer) {
    const held = row.item === 398 ? P.CARROT_ON_A_STICK : row.item;
    if (row.ridden) assert.equal(P.canBeSteered(held), row.canSteer);
    assert.equal(P.controlShouldExecute({ alive: row.health > 0, playerRider: row.ridden, boosted: row.boosted, heldId: held }), row.shouldExecute, JSON.stringify(row));
  }
});

test("carrot on a stick boosts a controlled pig for 7 durability and draws the boost length from the pig's Random", () => {
  for (const row of ref.use) {
    const t = { ...P.controlState(), speed: f(row.speed), boosted: row.boosted };
    const out = P.stickUse({ ridingPig: row.riding === 1, controlled: P.controlledByPlayer(t), damage: row.damage });
    if (out.boost) P.controlBoost(t, new JavaRandom(row.seed));
    assert.equal(row.damage + out.cost, row.stick.damage, JSON.stringify(row));
    assert.deepEqual({ speed: t.speed, boosted: t.boosted, boostTime: t.boostTime, maxBoostTime: t.maxBoostTime }, { ...row.ub, speed: f(row.ub.speed) }, JSON.stringify(row));
  }
});

test("ridden pig ticks follow EntityAIControlledByPlayer.updateTask: ramp, turn, step jump, boost, wear and the broken stick", () => {
  assert.equal(ref.ride.length, 10);
  for (const row of ref.ride) {
    const world = stepWorld(row.step), rand = new JavaRandom(row.seed), t = P.controlState(), type = ENTITY_TYPES.pig;
    const e = { type: "pig", x: 0.5, y: 0, z: row.z, vx: 0, vy: 0, vz: 0, onGround: true, collidedH: false, fallDistance: 0, rotationYaw: f(row.pigYaw), aiMoveSpeed: f(row.aiMoveSpeed), moveForward: 0, jumpTicks: 0, width: f(0.9), height: f(0.9) };
    let held = { id: P.CARROT_ON_A_STICK, damage: row.damage, count: 1 };
    P.controlStart(t);
    row.ticks.forEach((want, i) => {
      if (i === row.boostAt) P.controlBoost(t, rand);
      if (e.jumpTicks > 0) e.jumpTicks--;
      for (const k of ["vx", "vy", "vz"]) if (Math.abs(e[k]) < 0.005) e[k] = 0;
      let jumping = false;
      P.controlTick(t, e, {
        riderYaw: f(row.playerYaw), riderHeight: f(1.8), creative: row.creative, world, rand,
        jump: () => { jumping = true; },
        wear: () => { if (held.id !== P.CARROT_ON_A_STICK) return; if (++held.damage > P.STICK_DURABILITY) held = { id: P.FISHING_ROD, damage: 0, count: 1 }; },
        move: (forward) => moveEntityWithHeading(world, e, type.width, type.height, forward),
      });
      e.moveForward = 0;
      if (jumping) { if (e.onGround && e.jumpTicks === 0) { jump(e); e.jumpTicks = 10; } } else e.jumpTicks = 0;
      moveEntityWithHeading(world, e, type.width, type.height, 0);
      const label = `${row.name} tick ${i}`, p = want.pig;
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) near(e[k], p[k], 1e-9, `${label} ${k}`);
      assert.equal(e.onGround, p.onGround, `${label} onGround`);
      assert.equal(e.collidedH, p.collidedH, `${label} collidedH`);
      assert.equal(e.rotationYaw, f(want.yaw), `${label} yaw`);
      assert.deepEqual({ ...t, speed: t.speed }, { ...want.ub, speed: f(want.ub.speed) }, label);
      assert.equal(jumping, want.jumping, `${label} jumping`);
      assert.deepEqual({ id: held.id, damage: held.damage }, { id: want.held.id === 346 ? P.FISHING_ROD : P.CARROT_ON_A_STICK, damage: want.held.damage }, `${label} held`);
    });
    assert.equal(rand.nextInt(1 << 30), row.nextInt, `${row.name} Random`);
  }
});

test("a saddled pig drops its saddle after the porkchops; the Saddle tag round-trips", () => {
  for (const row of ref.drops) {
    const rand = new JavaRandom(row.seed);
    const drops = mobDrops({ type: "pig", saddled: row.saddled }, { playerHit: false, burning: row.fire, looting: row.looting }, rand);
    const mc = { 202: 319, 203: 320, 363: 329 };
    assert.deepEqual(drops.map(([id]) => `${mc[id]}x1`), row.items, JSON.stringify(row));
    assert.equal(rand.nextInt(1 << 30), row.nextInt);
  }
  assert.deepEqual(ref.nbt.map((r) => [r.saddled, r.tag, r.back]), [[false, "0b", false], [true, "1b", true]]);
  assert.equal(ref.nbtMissing[0].back, false);
});

test("a saddled pig saves and reloads its saddle", () => {
  const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(flat, [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 64, health: 10, saddled: true }]);
  assert.equal(w.entities[0].saddled, true);
  const back = new EntityWorld(flat, w.serialize().entities ?? w.serialize());
  assert.equal(back.entities.find((e) => e.type === "pig").saddled, true);
});

// --- The live wiring: EntityWorld, the seat, ai.js and the edit dispatcher (pig-saddle-live.js) ---
import { Survival } from "./survival.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const pigWorld = (extra = {}) => new EntityWorld(grass, [{ id: "mob-1", type: "pig", x: 64.5, y: 0, z: 64.5, health: 10, ...extra }], () => 0.5);
const holding = (id, n = 1, damage = 0) => {
  const s = new Survival({ inventory: { [id]: n } });
  s.inventory.current = s.inventory.find(id);
  if (damage) s.inventory.held.damage = damage;
  return s;
};
const rider = () => ({ player: true, x: 0, y: 0, z: 0, yaw: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null, height: f(1.8), width: f(0.6) });
const edit = (w, s, r, e, place = true) => applyPlayerEdit({ screen: "playing", heldTool: s.held?.id ?? 0, world: grass, survival: s, mobs: w, motion: {}, position: { x: 64.5, y: 0, z: 62 }, velocity: { x: 0, y: 0, z: 0 }, yaw: 0, rider: r },
  { place, aimedEntity: e ? { entity: e } : null });

test("live: a saddle saddles an adult pig (Creative keeps it), any other pig takes the click, the pig then seats the player", () => {
  const w = pigWorld(), pig = w.entities[0], s = holding(P.SADDLE), r = rider();
  assert.equal(edit(w, s, r, pig).branch, "saddle-pig");
  assert.equal(pig.saddled, true);
  assert.equal(s.count(P.SADDLE), 0);
  assert.ok(w.events.some((x) => x.sound === "mob.horse.leather" && x.volume === 0.5));
  const c = holding(P.SADDLE);
  c.mode = "creative"; c.inventory.creative = true;
  const other = w.create("pig", 66, 0, 66);
  w.entities.push(other);
  assert.equal(edit(w, c, r, other).branch, "saddle-pig");
  assert.equal(c.count(P.SADDLE), 1);
  const empty = new Survival({});
  assert.equal(edit(w, empty, r, pig).branch, "mount-pig");
  assert.equal(r.vehicle.entity, pig);
  assert.equal(pig.rider, r);
  w.horseSeats.updateRiderPosition(r.vehicle);
  assert.equal(r.y, pig.y + P.PIG_MOUNTED_OFFSET - 0.5);
  // Holding a saddle on a saddled pig: ItemSaddle still answers true, so the click never reaches the mount.
  const r2 = rider();
  assert.equal(edit(w, holding(P.SADDLE), r2, other).branch, "saddle-pig");
  assert.equal(r2.vehicle, null);
});

test("live: a hit with a saddle saddles the pig and uses the saddle up in Creative too", () => {
  const w = pigWorld(), pig = w.entities[0], s = holding(P.SADDLE);
  s.mode = "creative"; s.inventory.creative = true;
  w.tick({ x: 64.5, y: 0, z: 62 }, s, P.SADDLE);
  edit(w, s, rider(), pig, false);
  assert.equal(pig.saddled, true);
  assert.equal(s.inventory.held, null);
});

test("live: the ridden pig follows the rider's yaw with a carrot on a stick, a boost costs 7 and a broken stick is a fishing rod", () => {
  const w = pigWorld({ saddled: true }), pig = w.entities[0], s = holding(P.CARROT_ON_A_STICK), r = rider();
  for (let i = 0; i < 3; i++) w.tick({ x: 64.5, y: 0, z: 60 }, s, P.CARROT_ON_A_STICK); // settle; aiMoveSpeed comes from wandering
  pig.aiMoveSpeed = f(0.25);
  w.horseSeats.mount(pig, r);
  r.yaw = f(0); // facing +z
  pig.rotationYaw = f(0);
  const z0 = pig.z;
  for (let i = 0; i < 200; i++) {
    w.tick({ x: r.x, y: r.y, z: r.z }, s, P.CARROT_ON_A_STICK);
    w.horseSeats.updateRiderPosition(r.vehicle);
  }
  const control = w.ai.brain(pig).control;
  assert.ok(pig.z > z0 + 2, `pig moved ${pig.z - z0}`);
  assert.ok(control.t.speed > f(P.MAX_SPEED * f(0.3)));
  assert.equal(edit(w, s, r, null).branch, "use-carrot-on-a-stick");
  assert.equal(control.t.boosted, true);
  assert.ok(control.t.maxBoostTime >= 140 && control.t.maxBoostTime <= 980);
  const worn = s.inventory.held.damage;
  assert.ok(worn >= 7);
  // A stick with less than 7 durability left does not boost (the reference: damage 18 boosts to 25, 19 does not).
  s.inventory.held.damage = 19;
  control.t.boosted = false;
  assert.notEqual(edit(w, s, r, null).branch, "use-carrot-on-a-stick");
  s.inventory.held.damage = 25;
  w.wearStick(s, 1);
  assert.equal(s.inventory.held.id, P.FISHING_ROD);
  assert.equal(s.inventory.held.damage, 0);
  assert.equal(s.broken, P.CARROT_ON_A_STICK);
});

test("live: a pig ridden off a ledge passes its fall to the rider", () => {
  const w = pigWorld({ saddled: true }), pig = w.entities[0], r = rider();
  let fell = 0;
  r.fall = (d) => { fell = d; };
  w.horseSeats.mount(pig, r);
  w.fall(pig, 6);
  assert.equal(fell, 6);
});

test("Java NBT: Saddle reads into the record (summon and region import)", async () => {
  const { summonedMobRecord } = await import("./java-mobs.js");
  const { NBT } = await import("./nbt.js");
  const t = (type, value) => ({ type, value });
  assert.equal(summonedMobRecord("pig", new Map([["Saddle", t(NBT.BYTE, 1)]])).record.saddled, true);
  assert.equal(summonedMobRecord("pig", new Map()).record.saddled, false);
});

test("GuiIngame mount hearts: (int)(max + 0.5) / 2 hearts in rows of 10, full under ceil(health), half at it", async () => {
  const { mountHeartLayout } = await import("./damage-hud.js");
  const pig = mountHeartLayout({ health: 6.5, maxHealth: 10 });
  assert.equal(pig.length, 5);
  assert.deepEqual(pig.map((h) => h.layers.length > 1 ? (h.layers[1][0] === 88 ? "full" : "half") : "empty"), ["full", "full", "full", "half", "empty"]);
  assert.deepEqual(pig.map((h) => h.x), [0, 8, 16, 24, 32]);
  const horse = mountHeartLayout({ health: 30, maxHealth: 30 });
  assert.equal(horse.length, 15);
  assert.deepEqual([horse[9].up, horse[10].up, horse[10].x], [0, 10, 0]);
  assert.ok(horse.every((h) => h.layers[1]?.[0] === 88));
  assert.equal(mountHeartLayout({ health: 100, maxHealth: 100 }).length, 30); // capped at 30
  assert.equal(mountHeartLayout({ health: 5, maxHealth: 15.4 }).length, 7); // (int)(15.9) / 2
});

test("live: the rider's fall takes Jump Boost off, plays the fall and step sounds, and damages (EntityLivingBase.fall)", async () => {
  const { syncRider } = await import("./vehicle-simulation.js");
  const { JUMP_BOOST } = await import("./damage-fx.js");
  const hurt = [], mk = (effects = new Map()) => ({ health: 20, creative: false, effects, damage: (n, why) => hurt.push([n, why]) });
  const run = (survival, distance) => {
    const w = pigWorld({ saddled: true }), pig = w.entities[0], r = rider();
    syncRider({ rider: r, position: { x: 0.5, y: 1, z: 0.5 }, yaw: 0, survival, world: { get: () => 1 } });
    w.horseSeats.mount(pig, r);
    w.events.length = 0;
    w.fall(pig, distance);
    return w.events.map((e) => e.sound);
  };
  const sounds = run(mk(), 8);
  assert.deepEqual(hurt.shift(), [5, "a fall"]);
  assert.equal(sounds[0], "game.player.hurt.fall.big");
  assert.ok(sounds.length >= 2, "the landing block's step sound follows");
  run(mk(new Map([[JUMP_BOOST, { amplifier: 1 }]])), 8); // ceil(8 - 3 - 2)
  assert.deepEqual(hurt.shift(), [3, "a fall"]);
  assert.deepEqual(run(mk(), 3), []);
  assert.equal(hurt.length, 0, "3 blocks hurt nobody");
});
