import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Experience, ExperienceOrbs } from "./experience.js";
import { InhabitedTime } from "./difficulty.js";
import { ItemEntities } from "./item-entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { tickLivingSimulation } from "./living-simulation.js";

const copy = value => JSON.parse(JSON.stringify(value));
const seeded = (seed = 17) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const flat = {
  numericSeed: 123,
  height: 64,
  solid: (x, y, z) => y < 0,
  get: (x, y, z) => y < 0 ? 3 : 0,
  surface: () => 0,
  spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
};

// ExperienceOrbs.spawn currently consumes Math.random directly. Scope a fixed
// provider around each paired tick so both old-order and extracted runs receive
// the same deterministic synthetic entity RNG inputs.
function withMathRandom(seed, fn) {
  const prior = Math.random;
  let value = seed >>> 0;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
  try { return fn(); } finally { Math.random = prior; }
}

function create() {
  const survival = new Survival({ time: 14000 }, "creative");
  const position = { x: 64.5, y: 0, z: 64.5, alive: true, width: 0.6, height: 1.8, yaw: 0 };
  const mobs = new EntityWorld(flat, [
    { id: "mob-1", type: "cow", x: 65.2, y: 0, z: 64.5, health: 10, age: 10 },
  ], seeded(31));
  const cow = mobs.entities[0];
  // Entity.rand is not serialized by the browser save. Give this port replay a
  // matching deterministic stream so mob drops/death XP are comparable.
  setEntityRandom(cow, new JavaRandom(76031));
  mobs.worldRandom = new JavaRandom(211);
  const xpRandom = seeded(51), itemRandom = seeded(61);
  const xpOrbs = new ExperienceOrbs([
    { x: 64.5, y: 0, z: 64.5, vx: 0, vy: 0, vz: 0, value: 1, age: 0, health: 5 },
    { x: 64.5, y: 0, z: 64.5, vx: 0, vy: 0, vz: 0, value: 85, age: 0, health: 5 },
  ], xpRandom);
  const experience = new Experience({ total: 84, score: 84 });
  const items = new ItemEntities(itemRandom);
  const state = {
    world: flat, position, survival, inhabited: new InhabitedTime(0, survival.time), mobs,
    xpOrbs, experience, items, playerTicks: 150, width: 0.6, height: 1.8, cow, trace: [],
    syntheticOrbId: 100,
  };
  // The Java-side XP entity ID is transient. Normalize it in this fixture to
  // make the two independent runs take identical retarget branches.
  xpOrbs.orbs.forEach((orb, i) => { orb.id = 100 + i; });
  const traced = (obj, name, type, fn = args => args) => {
    const original = obj[name].bind(obj);
    obj[name] = (...args) => {
      state.trace.push({ type, args: copy(fn(args)) });
      return original(...args);
    };
  };
  traced(mobs, "tick", "mob.tick", args => [args[1]?.time, args[2]]);
  traced(mobs, "drain", "mob.drain", () => []);
  traced(xpOrbs, "tick", "xp.tick", () => []);
  traced(xpOrbs, "collect", "xp.collect", args => [args[0], args[1], args[2]]);
  const spawnOrb = xpOrbs.spawn.bind(xpOrbs);
  xpOrbs.spawn = (amount, at) => {
    state.trace.push({ type: "xp.spawn", args: [amount, { x: at.x, y: at.y, z: at.z }] });
    const before = xpOrbs.orbs.length;
    const result = spawnOrb(amount, at);
    for (const orb of xpOrbs.orbs.slice(before)) orb.id = state.syntheticOrbId++;
    return result;
  };
  const dropMob = items.dropMob.bind(items);
  items.dropMob = (...args) => {
    const [id, count, at, damage] = args;
    state.trace.push({ type: "items.dropMob", args: [id, count, { x: at.x, y: at.y, z: at.z }, damage || 0] });
    return dropMob(...args);
  };
  traced(items, "tick", "items.tick", () => []);
  traced(items, "collect", "items.collect", args => [{ ...args[0] }, args[1], args[2]]);

  // Exercise an actual player-hit death before the first tick. Sound and item
  // drops queue now; death XP is queued later, on deathTime 20.
  withMathRandom(3, () => mobs.kill(cow));
  return state;
}

function livingHooks(s) {
  return {
    heldItem: () => 0,
    levelUpSound: volume => s.trace.push({ type: "levelup.sound", volume }),
    experienceCollected: (amount, volume) => s.trace.push({ type: "xp.collected", amount, volume }),
    orbSound: event => s.trace.push({ type: "orb.sound", event: { name: event.name, volume: event.volume, pitch: event.pitch } }),
    sound: event => s.trace.push({ type: "mob.sound", event: {
      sound: event.sound, volume: event.volume, pitch: event.pitch,
      position: { x: event.position.x, y: event.position.y, z: event.position.z },
    } }),
    explode: (x, y, z, size, context) => s.trace.push({ type: "mob.explode", x, y, z, size, attacker: context.attacker?.type || context.attacker }),
    eatGrass: event => s.trace.push({ type: "mob.eatGrass", event }),
  };
}

// This is the pre-extraction main.js sequence around the extracted segment at
// commit 90f8807, written independently so the test compares behavior rather
// than calling the new helper twice.
function oldLivingOrder(s) {
  s.inhabited.tick(s.survival.time);
  s.mobs.tick(s.position, s.survival, 0);
  s.playerTicks++;
  s.xpOrbs.tick(s.world, s.position);
  if (s.survival.health > 0) {
    const oldLevel = s.experience.level;
    const amount = s.xpOrbs.collect(s.position, s.width, s.height);
    if (amount) {
      s.experience.add(amount);
      const volume = s.experience.levelUp(oldLevel, s.playerTicks);
      if (volume) s.trace.push({ type: "levelup.sound", volume });
      s.trace.push({ type: "xp.collected", amount, volume });
    }
  }
  for (const event of s.xpOrbs.sounds.splice(0))
    s.trace.push({ type: "orb.sound", event: { name: event.name, volume: event.volume, pitch: event.pitch } });
  for (const event of s.mobs.drain()) {
    if (event.sound) {
      const normalized = { sound: event.sound, position: event.position, volume: event.volume ?? 0.6, pitch: event.pitch };
      const p = normalized.position;
      s.trace.push({ type: "mob.sound", event: { sound: normalized.sound, volume: normalized.volume,
        pitch: normalized.pitch, position: { x: p.x, y: p.y, z: p.z } } });
    }
    if (event.xp) s.xpOrbs.spawn(event.xp, event.position);
    if (event.explode) s.trace.push({ type: "mob.explode", x: event.explode.x, y: event.explode.y,
      z: event.explode.z, size: event.explode.size, attacker: event.explode.source?.type || event.explode.source });
    if (event.drop) s.items.dropMob(event.drop, event.count, event.position, event.damage, event);
    if (event.eatGrass) s.trace.push({ type: "mob.eatGrass", event: event.eatGrass });
  }
}

function itemSegment(s) {
  s.items.tick(s.world);
  const picked = s.items.collect(s.position, s.width, s.height, stack => s.survival.inventory.add(stack));
  if (picked.length) s.trace.push({ type: "item.picked", counts: picked.map(p => p.count), stacks: picked.map(p => p.item.stack.id) });
}

function snapshot(s) {
  return copy({
    playerTicks: s.playerTicks, inhabited: s.inhabited.save(s.survival.time),
    health: s.survival.health, creative: s.survival.creative, inventory: s.survival.serialize().slots,
    experience: { ...s.experience.serialize(), level: s.experience.level, points: s.experience.points,
      progress: s.experience.progress, lastLevelUp: s.experience.lastLevelUp || 0 },
    orbs: s.xpOrbs.orbs.map(o => ({ id: o.id, value: o.value, x: o.x, y: o.y, z: o.z, posY: o.posY,
      vx: o.vx, vy: o.vy, vz: o.vz, age: o.age, color: o.color, target: o.target, retarget: o.retarget })),
    items: s.items.items.map(e => ({ stack: e.stack, x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz,
      age: e.age, delay: e.delay, hover: e.hover })),
    mobs: s.mobs.entities.map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, z: e.z,
      health: e.health, death: e.death || 0, recentlyHit: e.recentlyHit || 0 })),
    deadCow: { death: s.cow.death || 0, health: s.cow.health, recentlyHit: s.cow.recentlyHit },
  });
}

test("real mob death, XP and item rewards match the old order over 35 ticks", () => {
  const old = create(), extracted = create();
  let deathXpSpawnTick = -1, deathOrbMovedTick = -1, deathXpTotalAtSpawn = null,
    deathXpValue = 0, deathXpCollected = 0;
  const fullTrace = [];
  for (let tick = 0; tick < 35; tick++) {
    for (const s of [old, extracted]) {
      s.trace = [];
      withMathRandom(9000 + tick, () => {
        itemSegment(s);
        if (s === old) oldLivingOrder(s);
        else tickLivingSimulation(s, livingHooks(s));
      });
    }

    assert.deepEqual(extracted.trace, old.trace, `ordered callbacks at tick ${tick}`);
    assert.deepEqual(snapshot(extracted), snapshot(old), `real system state at tick ${tick}`);
    fullTrace.push(...copy(extracted.trace));
    const trace = extracted.trace.map(event => event.type);
    if (trace.includes("xp.spawn")) {
      const xpSpawn = trace.lastIndexOf("xp.spawn");
      if (extracted.cow.death === 20 && extracted.xpOrbs.orbs.some(o => o.age === 0 && o.x === extracted.cow.x)) {
        deathXpSpawnTick = tick;
        deathXpTotalAtSpawn = extracted.experience.total;
        deathXpValue = extracted.trace[xpSpawn].args[0];
        assert.ok(trace.indexOf("xp.tick") < xpSpawn, "death XP is spawned after this tick's XP motion");
        assert.ok(trace.indexOf("xp.collect") < xpSpawn, "death XP cannot be picked up in its spawn tick");
      }
    }
    if (deathXpSpawnTick >= 0 && tick > deathXpSpawnTick &&
        (extracted.experience.total > deathXpTotalAtSpawn || extracted.xpOrbs.orbs.some(o => o.x === extracted.cow.x && o.age > 0)))
      deathOrbMovedTick = tick;
    if (deathXpSpawnTick >= 0 && tick > deathXpSpawnTick)
      deathXpCollected += extracted.trace.filter(event => event.type === "xp.collected").reduce((n, event) => n + event.amount, 0);
  }

  assert.ok(old.survival.creative, "the player is Creative while collecting XP");
  assert.ok(old.experience.total >= 170, "Creative player collects XP through the real orb system");
  assert.ok(deathXpValue > 0 && old.experience.total > 170, "the mob's real death reward increases XP beyond the initial orbs");
  assert.equal(deathXpCollected, deathXpValue, "the Creative player later collects the mob's actual death XP");
  assert.equal(old.experience.total, 170 + deathXpValue, "both initial XP and mob reward were counted exactly once");
  assert.ok(old.experience.level >= 10);
  const levelSounds = fullTrace.filter(event => event.type === "levelup.sound");
  assert.equal(levelSounds.length, 1, "level five sounds once; another level threshold inside the cooldown is muted");
  assert.equal(levelSounds[0].volume, 0.125);
  const firstTick = fullTrace.filter(event => event.type === "mob.sound" || event.type === "items.dropMob");
  assert.equal(firstTick[0]?.type, "mob.sound", "death sound is routed before its real item drops");
  assert.ok(firstTick.slice(1).length > 0 && firstTick.slice(1).every(event => event.type === "items.dropMob"),
    "the queued cow drops follow the death sound in event order");
  assert.ok(deathXpSpawnTick >= 0, "player-hit mob death emitted XP at deathTime 20");
  assert.ok(deathOrbMovedTick > deathXpSpawnTick, "new death XP begins moving on a later tick");
  assert.ok(fullTrace.some(event => event.type === "items.dropMob" && (event.args[0] === 204 || event.args[0] === 315)), "real cow drops entered ItemEntities");
  assert.ok(fullTrace.some(event => event.type === "item.picked" && event.stacks.some(id => id === 204 || id === 315)), "real mob drops later moved and were picked up");
});
