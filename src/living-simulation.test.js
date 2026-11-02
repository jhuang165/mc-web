import { test } from "node:test";
import assert from "node:assert/strict";
import { drainMobEvents, tickLivingSimulation } from "./living-simulation.js";
import { Experience, ExperienceOrbs } from "./experience.js";
import { ItemEntities } from "./item-entities.js";

const random = () => 0.5;
const world = {
  get: () => 0,
  solid: () => false,
};

test("living tick advances mob and XP systems before event drain; new death XP waits a tick", () => {
  const calls = [], position = { x: 0, y: 10, z: 0 };
  class TracedExperience extends Experience {
    add(n) { calls.push("experience.add"); return super.add(n); }
    levelUp(old, ticks) { calls.push("experience.levelUp"); return super.levelUp(old, ticks); }
  }
  class TracedOrbs extends ExperienceOrbs {
    tick(...args) { calls.push("orbs.tick"); return super.tick(...args); }
    collect(...args) { calls.push("orbs.collect"); return super.collect(...args); }
    spawn(...args) { calls.push("orbs.spawn"); return super.spawn(...args); }
  }
  class TracedItems extends ItemEntities {
    dropMob(...args) { calls.push("items.dropMob"); return super.dropMob(...args); }
  }
  const experience = new TracedExperience({ total: 84 }),
    xpOrbs = new TracedOrbs([], random),
    items = new TracedItems(random),
    event = {
      sound: "mob.test", position: { x: 4, y: 10, z: 4 }, xp: 5,
      explode: { x: 4, y: 10, z: 4, size: 2, source: { type: "creeper" } },
      drop: 3, count: 2, damage: 0,
      eatGrass: { x: 1, y: 2, z: 3, block: 31 },
    };
  // This orb reaches level five when collected (84 -> 85 points).
  xpOrbs.spawn(1, position);
  calls.length = 0;
  const state = {
    world, position, survival: { health: 20, time: 7 },
    inhabited: { tick: (time) => { assert.equal(time, 7); calls.push("inhabited"); } },
    mobs: {
      tick: (p, s, held) => { assert.equal(p, position); assert.equal(held, 8); calls.push("mobs.tick"); },
      drain: () => { calls.push("mobs.drain"); return [event]; },
    },
    xpOrbs, experience, items, playerTicks: 100, width: 0.6, height: 1.8,
  };
  const ticks = tickLivingSimulation(state, {
    heldItem: () => 8,
    levelUpSound: (volume) => { assert.equal(volume, 0.125); calls.push("levelup.sound"); },
    experienceCollected: (n) => { assert.equal(n, 1); calls.push("experience.collected"); },
    orbSound: (e) => { assert.equal(e.name, "random.orb"); calls.push("orb.sound"); },
    sound: (e, source) => { assert.equal(e.volume, 0.6); assert.equal(source, event); calls.push("mob.sound"); },
    explode: (x, y, z, size, context, source) => {
      assert.deepEqual([x, y, z, size], [4, 10, 4, 2]);
      assert.equal(context.exploder, event.explode.source);
      assert.equal(context.attacker, event.explode.source);
      assert.equal(source, event); calls.push("mob.explode");
    },
    eatGrass: (eat, source) => { assert.equal(eat, event.eatGrass); assert.equal(source, event); calls.push("eatGrass"); },
  });
  assert.equal(ticks, 101);
  assert.equal(state.playerTicks, 101);
  assert.equal(experience.total, 85);
  assert.equal(experience.level, 5);
  assert.ok(calls.indexOf("orbs.tick") < calls.indexOf("mobs.drain"));
  assert.deepEqual(calls, [
    "inhabited", "mobs.tick", "orbs.tick", "orbs.collect", "experience.add", "experience.levelUp",
    "levelup.sound", "experience.collected", "orb.sound", "mobs.drain", "mob.sound", "orbs.spawn",
    "mob.explode", "items.dropMob", "eatGrass",
  ]);
  const deathOrbs = xpOrbs.orbs.filter((orb) => orb.x === 4 && orb.z === 4);
  assert.equal(deathOrbs.length, 3);
  assert.ok(deathOrbs.every((orb) => orb.age === 0 && orb.color === 0), "mob death orbs are created after this tick's orb update");
  assert.equal(items.items.length, 2);
});

test("dead player still ticks XP and drains mob events but does not collect", () => {
  const calls = [], systems = {
    mobs: { drain: () => { calls.push("drain"); return []; } },
    xpOrbs: { spawn() {}, tick: () => calls.push("tick"), collect: () => { calls.push("collect"); return 2; }, sounds: [] },
    items: { dropMob() {} },
  };
  const state = {
    world, position: { x: 0, y: 0, z: 0 }, survival: { health: 0, time: 2 },
    inhabited: { tick: () => {} }, mobs: { tick: () => {}, ...systems.mobs },
    xpOrbs: systems.xpOrbs, experience: new Experience(), items: systems.items,
    playerTicks: 1, width: 0.6, height: 1.8,
  };
  tickLivingSimulation(state);
  assert.deepEqual(calls, ["tick", "drain"]);
  assert.equal(state.playerTicks, 2);
});

test("standalone mob event draining preserves per-event effect order", () => {
  const calls = [], first = { sound: "a", xp: 1, position: { x: 0, y: 0, z: 0 }, drop: 1, count: 1 },
    second = { sound: "b", position: { x: 1, y: 0, z: 0 }, explode: { x: 1, y: 2, z: 3, size: 4 } };
  drainMobEvents({
    mobs: { drain: () => [first, second] },
    xpOrbs: { spawn: (xp) => calls.push(`xp:${xp}`) },
    items: { dropMob: () => calls.push("drop") },
  }, {
    sound: (event) => calls.push(`sound:${event.sound}`),
    explode: () => calls.push("explode"),
  });
  assert.deepEqual(calls, ["sound:a", "xp:1", "drop", "sound:b", "explode"]);
});
