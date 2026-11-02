import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, ICE, WATER, TNT, SAND, WOOL, RED_FLOWER, SNOW_LAYER, PHYSICS, opaqueCube } from "./world.js";
import { Survival, ITEMS, MATERIALS } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, oreExperience } from "./experience.js";
import { Weather } from "./weather.js";
import { JavaRandom } from "./java-random.js";
import { Farming, cropDrops } from "./farming.js";
import { snowballsFor, iceLeavesWater } from "./snow.js";
import { leafDrops } from "./trees.js";
import { makeStack, copyStack } from "./inventory.js";
import { newChest, CHEST } from "./chest.js";
import { EntityWorld, ENTITY_TYPES, setEntityRandom } from "./entities.js";
import { Arrows } from "./bow.js";
import { Projectiles } from "./projectiles.js";
import { FallingBlocks } from "./falling.js";
import { primeTnt, explodeTnt, explodeBlocks, explosionImpact } from "./explosion.js";
import { entityBox } from "./weather.js";
import { breakPlayerBlock } from "./block-break-simulation.js";
import { applyExplosion } from "./explosion-simulation.js";

const BASELINE = "c1d239b";
const clone = value => JSON.parse(JSON.stringify(value));
const reference = JSON.parse(readFileSync(new URL("./block-actions-port-reference.json", import.meta.url), "utf8"));
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const compile = (fn, bindings) => {
  const names = Object.keys(bindings);
  return new Function(...names, `let saved = false; return (${fn});`)(...Object.values(bindings));
};

function withRandom(seed, fn) {
  const prior = Math.random;
  let state = seed >>> 0;
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  try { return fn(); } finally { Math.random = prior; }
}

function create() {
  const world = new World("block-actions-replay", "meadow", 1);
  // Clear only the authored work area. The generated landscape and unrelated
  // world systems remain outside this compound regression.
  for (let x = 6; x <= 26; x++) for (let z = 6; z <= 26; z++) {
    world.set(x, 0, z, 3);
    for (let y = 1; y <= 8; y++) world.set(x, y, z, 0);
  }
  const stone = [8, 1, 8], chestPos = [10, 1, 8], ice = [12, 2, 8];
  world.set(...stone, 3);
  world.set(...chestPos, CHEST, true, 2);
  world.set(12, 1, 8, WATER);
  world.set(...ice, ICE);
  world.set(21, 3, 20, TNT);
  world.set(22, 3, 20, TNT);
  world.set(20, 4, 20, SAND);

  const survival = new Survival({}, "survival");
  survival.inventory.add(makeStack(100, 1, 3)); // Wooden pickaxe, damage 3 / 59.
  survival.inventory.current = survival.inventory.find(100);
  const chest = newChest(2);
  chest.items[0] = makeStack(320, 5);
  survival.chests[chestPos.join(",")] = chest;
  const items = new ItemEntities(seeded(11));
  const blastItem = items.spawn({ id: 320, count: 2 }, 21, 3.5, 20.5, { motion: [0, 0, 0] });
  const xpOrbs = new ExperienceOrbs([
    { x: 21, y: 3.25, z: 20.5, vx: 0, vy: 0, vz: 0, value: 5, age: 0, health: 5 },
  ], seeded(13));
  // ExperienceOrbs' process-global IDs are transient; align this one so the
  // comparison holds its same distance-retarget branch in both instances.
  xpOrbs.orbs[0].id = 73;
  const blastOrb = xpOrbs.orbs[0];
  const weather = new Weather({ random: new JavaRandom(1717) });
  const mobs = new EntityWorld(world, [
    { id: "mob-1", type: "pig", x: 20.8, y: 2, z: 20.5, health: 10, recentlyHit: 100 },
  ], seeded(17));
  const mob = mobs.entities[0];
  setEntityRandom(mob, new JavaRandom(12345));
  mobs.worldRandom = weather.random;
  const arrows = new Arrows(seeded(19));
  arrows.load([{ x: 20.5, y: 3.5, z: 21.2, mx: 0.1, my: 0, mz: 0, yaw: 90, pitch: 0,
    xTile: -1, yTile: -1, zTile: -1, inTile: 0, inData: 0, life: 0, shake: 0,
    inGround: false, pickup: 1, damage: 2 }]);
  const projectiles = new Projectiles(seeded(23));
  projectiles.load([{ x: 20.5, y: 3.5, z: 22, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }]);
  const farming = new Farming(world);
  const falling = new FallingBlocks(world);
  const fallingEntity = falling.fall(20, 4, 20);
  world.set(20, 4, 20, 0); // The first EntityFallingBlock update removes its source block.
  const primed = [primeTnt(20.5, 3.49, 22.5, { fuse: 29, random: seeded(29) })];
  const position = { x: 4.5, y: 1, z: 4.5 }, velocity = { x: 0, y: 0, z: 0 };
  let watchBlastWrites = false, blastWriteGate = null;
  const set = world.set.bind(world);
  world.set = (...args) => {
    if (watchBlastWrites && !blastWriteGate && args[3] === 0) {
      blastWriteGate = {
        mobHealth: mob.health, mobVelocity: [mob.vx, mob.vy, mob.vz],
        item: [blastItem.health, blastItem.mx, blastItem.my, blastItem.mz],
        orb: [blastOrb.health, blastOrb.vx, blastOrb.vy, blastOrb.vz],
        arrow: [arrows.list[0].mx, arrows.list[0].my, arrows.list[0].mz],
        projectile: [projectiles.balls[0].mx, projectiles.balls[0].my, projectiles.balls[0].mz],
        falling: fallingEntity && [fallingEntity.vx, fallingEntity.vy, fallingEntity.vz],
        primed: [primed[0].vx, primed[0].vy, primed[0].vz],
      };
    }
    return set(...args);
  };
  const baseEdits = new Map(world.edits);
  return { world, baseEdits, stone, chestPos, ice, survival, items, blastItem, xpOrbs, blastOrb, weather, mobs, mob,
    arrows, projectiles, farming, falling, fallingEntity, primed, position, velocity,
    get blastWriteGate() { return blastWriteGate; }, set watchBlastWrites(value) { watchBlastWrites = value; } };
}

function breakBindings(s, trace) {
  const math = Object.create(Math); math.random = seeded(101);
  const scene = {
    updateBlock: (...args) => trace.push(["updateBlock", ...args]),
    particles: { destroyBlock: (_world, x, y, z, block, meta) => trace.push(["destroy", x, y, z, block, meta]) },
  };
  return {
    world: s.world, MATERIALS, heldId: () => 100, survival: s.survival, SNOW_LAYER: 46,
    snowballsFor, ITEMS, Math: math, cropDrops, trees: { random: seeded(101) }, leafDrops,
    ICE, iceLeavesWater, WATER, farming: s.farming, items: s.items, copyStack, makeStack,
    WOOL, RED_FLOWER, oreExperience, xpOrbs: s.xpOrbs, scene,
    renderHotbar: () => trace.push(["renderHotbar"]), sound: (...args) => trace.push(["blockSound", ...args]),
  };
}

function explodeBindings(s, trace) {
  const sounds = { play: (...args) => trace.push(["sound", ...args]) };
  const scene = { explosionParticles: { burst: (...args) => trace.push(["burst", args[0], args[1], args[2], args[3]]) },
    updateBlocks: changes => trace.push(["updateBlocks", clone(changes)]) };
  return {
    world: s.world, explodeBlocks, weather: s.weather, opaqueCube, mobs: s.mobs, ENTITY_TYPES,
    explosionImpact, entityBox, Math, items: s.items, xpOrbs: s.xpOrbs, arrows: s.arrows,
    projectiles: s.projectiles, falling: s.falling, primed: s.primed, explodeTnt,
    survival: s.survival, position: s.position, PHYSICS, reportBrokenTool: () => trace.push(["brokenTool"]),
    velocity: s.velocity, scene, sounds, farming: s.farming, copyStack, makeStack, primeTnt,
    chestRenderer: { sync: (...args) => trace.push(["syncChests", args[1]]) },
    renderVitals: () => trace.push(["renderVitals"]),
  };
}

function snapshot(s) {
  return clone({
    edits: [...s.world.edits].filter(([key, value]) => s.baseEdits.get(key) !== value).sort(([a], [b]) => a.localeCompare(b)),
    stone: s.world.get(...s.stone), chestBlock: s.world.get(...s.chestPos),
    chestMeta: s.world.getMeta(...s.chestPos), ice: s.world.get(...s.ice), iceMeta: s.world.getMeta(...s.ice),
    survival: s.survival.serialize(), items: s.items.serialize(), orbs: s.xpOrbs.serialize(),
    mobs: s.mobs.entities.map(e => ({ type: e.type, health: e.health, x: e.x, y: e.y, z: e.z,
      vx: e.vx, vy: e.vy, vz: e.vz, death: e.death || 0 })),
    arrows: s.arrows.serialize(), projectiles: s.projectiles.serialize(), falling: s.falling.serialize(),
    primed: s.primed.map(e => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse })),
    random: s.weather.random.save(), farming: s.farming.serialize(), velocity: s.velocity,
  });
}

test("compound break and explosion actions match pinned main.js ordering with real world systems", () => {
  assert.equal(reference.commit, BASELINE);
  assert.match(reference.blobSha256, /^[a-f0-9]{64}$/);
  const sourceState = create(), helperState = create(), oldTrace = [], helperTrace = [];
  const oldBreak = compile(reference.functions.breakBlock, breakBindings(sourceState, oldTrace));
  const oldExplode = compile(reference.functions.explodeAt, explodeBindings(sourceState, oldTrace));

  const oldBlocks = [sourceState.stone, sourceState.chestPos, sourceState.ice];
  const newBlocks = [helperState.stone, helperState.chestPos, helperState.ice];
  withRandom(101, () => oldBlocks.forEach(p => assert.equal(oldBreak(p, false), true)));
  const helperBreakRandom = seeded(101);
  for (const p of newBlocks) {
    assert.equal(breakPlayerBlock({ world: helperState.world, survival: helperState.survival,
      items: helperState.items, xpOrbs: helperState.xpOrbs, farming: helperState.farming,
      trees: { random: seeded(101) }, heldTool: 100 }, p, {
      random: helperBreakRandom, leafRandom: seeded(101),
      updateBlock: (...args) => helperTrace.push(["updateBlock", ...args]),
      renderHotbar: () => helperTrace.push(["renderHotbar"]),
      playBlockSound: (...args) => helperTrace.push(["blockSound", ...args]),
      destroyParticles: (_world, x, y, z, block, meta) => helperTrace.push(["destroy", x, y, z, block, meta]),
      markUnsaved: () => {},
    }), true);
  }
  assert.deepEqual(helperTrace, oldTrace.slice(0, helperTrace.length), "block observers preserve the pinned callback sequence");
  assert.deepEqual(snapshot(helperState), snapshot(sourceState), "stone wear, chest spill/metadata and ice water match");
  assert.equal(helperState.survival.exhaustion, 0.07500000298023224);
  assert.equal(helperState.survival.inventory.main[helperState.survival.inventory.current].damage, 6);
  assert.ok(helperState.items.items.some(e => e.stack.id === 12), "stone produced its real cobblestone item drop");
  assert.ok(helperState.items.items.some(e => e.stack.id === 320 && e.stack.count === 5), "chest contents spilled");
  assert.ok(helperTrace.some(e => e[0] === "destroy" && e[1] === 10 && e[4] === CHEST && e[5] === 2),
    "chest destroy feedback retained the original block metadata");
  assert.equal(helperState.world.get(12, 2, 8), WATER, "harvesting ice over water replaces the ice with flowing water");

  const beforeBlast = s => ({
    mobHealth: s.mob.health, mobVelocity: [s.mob.vx, s.mob.vy, s.mob.vz],
    item: [s.blastItem.health, s.blastItem.mx, s.blastItem.my, s.blastItem.mz],
    orb: [s.blastOrb.health, s.blastOrb.vx, s.blastOrb.vy, s.blastOrb.vz],
    arrow: [s.arrows.list[0].mx, s.arrows.list[0].my, s.arrows.list[0].mz],
    projectile: [s.projectiles.balls[0].mx, s.projectiles.balls[0].my, s.projectiles.balls[0].mz],
    falling: [s.fallingEntity.vx, s.fallingEntity.vy, s.fallingEntity.vz],
    primed: [s.primed[0].vx, s.primed[0].vy, s.primed[0].vz],
  });
  const oldBeforeBlast = beforeBlast(sourceState), helperBeforeBlast = beforeBlast(helperState);
  sourceState.watchBlastWrites = helperState.watchBlastWrites = true;
  withRandom(202, () => oldExplode(20.5, 3.5, 20.5, 4, { attacker: "player" }));
  const blast = withRandom(202, () => applyExplosion({ ...helperState, weather: helperState.weather },
    { x: 20.5, y: 3.5, z: 20.5, size: 4, attacker: "player" }, {
      burst: (...args) => helperTrace.push(["burst", args[0], args[1], args[2], args[3]]),
      sound: (...args) => helperTrace.push(["sound", ...args]),
      updateBlocks: changes => helperTrace.push(["updateBlocks", clone(changes)]),
      syncChests: (...args) => helperTrace.push(["syncChests", args[1]]),
      renderVitals: () => helperTrace.push(["renderVitals"]),
      markDirty: () => {},
    }));

  assert.deepEqual(snapshot(helperState), snapshot(sourceState), "blast block edits, drops, entity impacts and chain TNT match");
  assert.ok(sourceState.blastWriteGate && helperState.blastWriteGate, "both explosions reached a block mutation");
  assert.ok(sourceState.blastWriteGate.mobHealth < 10 && helperState.blastWriteGate.mobHealth < 10,
    "the real pig took blast damage before the first block edit");
  assert.notDeepEqual(sourceState.blastWriteGate.item, oldBeforeBlast.item, "the named dropped item was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.item, helperBeforeBlast.item, "the named dropped item was affected before block edits");
  assert.notDeepEqual(sourceState.blastWriteGate.orb, oldBeforeBlast.orb, "the named XP orb was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.orb, helperBeforeBlast.orb, "the named XP orb was affected before block edits");
  assert.notDeepEqual(sourceState.blastWriteGate.arrow, oldBeforeBlast.arrow, "the arrow was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.arrow, helperBeforeBlast.arrow, "the arrow was affected before block edits");
  assert.notDeepEqual(sourceState.blastWriteGate.projectile, oldBeforeBlast.projectile, "the projectile was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.projectile, helperBeforeBlast.projectile, "the projectile was affected before block edits");
  assert.notDeepEqual(sourceState.blastWriteGate.falling, oldBeforeBlast.falling, "the falling block was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.falling, helperBeforeBlast.falling, "the falling block was affected before block edits");
  assert.notDeepEqual(sourceState.blastWriteGate.primed, oldBeforeBlast.primed, "primed TNT was affected before block edits");
  assert.notDeepEqual(helperState.blastWriteGate.primed, helperBeforeBlast.primed, "primed TNT was affected before block edits");
  assert.ok(blast.chainedTnt.length > 0, "the blast primed TNT blocks into chain fuses");
  assert.ok(helperState.primed.length > 1, "chain TNT was appended to the live primed list");
  assert.deepEqual(helperTrace, oldTrace, "block and explosion presentation hooks match the pinned sequence");
});
