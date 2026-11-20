// b86 blastcover86: Explosion.doExplosionA's exposure (World.getBlockDensity, ahb.a(azw, azt): the share of an entity box's sample points with a clear World.rayTraceBlocks
// line to the centre) with blocks between the blast and the entities. Executed: tools/probes/BlastOrderProbe.java case "cover" (600 scenes in
// public/research/blast-order-reference.json, made by tools/verify-blast-order.mjs): the unchanged agw.a() over real chunks, World.getBlock / getBlockMetadata answered from
// the scene's blocks (110 native kinds: cubes, glass, fluids, fire, slabs, fences, walls, panes, doors, stairs, plants, redstone parts and other shaped blocks), real items, orbs,
// arrows, TNT, eyes, hooks, an ender crystal, zombies, pigs (adult and baby), spiders, cows and a player with EntityPlayerMP geometry. Each scene is replayed through
// applyExplosion with the port's entity systems over a world holding the same blocks (block-registry.js fromOriginal); the hit order and depth, the damage passed to every living
// entity and crystal, the push (to the last bit) and who is dead after must all match.
// Also: the dedicated server: flint and steel primes a TNT block with the player as placer (BlockTNT.onBlockActivated), a burning arrow with its shooter, and the blast passes that
// player's Creative flag to the hanging entities (server-mobs.js explode); dispensed TNT has no placer (kr, bytecode-read); the single-player look a large fireball takes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Arrows } from "./bow.js";
import { primeTnt, blockDensity } from "./explosion.js";
import { createEye } from "./eye-of-ender.js";
import { stampEntity, forgetEntity, walkedY } from "./candidate-order.js";
import { fromOriginal } from "./block-registry.js";
import { ENTITY_TYPES } from "./entities.js";
import { World, TNT } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { PAINTING_ITEM } from "./hanging.js";
import { ITEMS } from "./survival.js";
import { langReady } from "./chat-component.js";
import { Fireballs } from "./fireballs.js";
import { lookVector } from "./blaze-ghast.js";
import { mhSin, mhCos } from "./lighting.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/blast-order-reference.json", import.meta.url), "utf8"));
const recs = reference.records.filter((x) => x.case === "cover");
const MOTION = { eye: ["vx", "vy", "vz"], hook: ["vx", "vy", "vz"], item: ["mx", "my", "mz"], arrow: ["mx", "my", "mz"], orb: ["vx", "vy", "vz"], tnt: ["vx", "vy", "vz"], crystal: ["vx", "vy", "vz"] };
const LIVING = new Set(["zombie", "pig", "babypig", "spider", "cow"]);

// The port's world for a scene: each native block through fromOriginal (the same cell the port would hold after an Anvil import or /setblock).
function worldOf(r) {
  const cells = new Map(), key = (x, y, z) => x + "," + y + "," + z;
  for (const [mc, meta, x, y, z] of r.blocks) {
    const p = fromOriginal(mc, meta);
    if (!p) throw new Error(`no port block for ${mc}:${meta}`);
    cells.set(key(x, y, z), p);
  }
  const at = (x, y, z) => cells.get(key(x, y, z));
  return {
    get: (x, y, z) => (y < 0 ? 1 : at(x, y, z)?.id ?? 0), getMeta: (x, y, z) => at(x, y, z)?.meta ?? 0, getState: (x, y, z) => at(x, y, z)?.state,
    solid: (x, y, z) => y < 0 || !!at(x, y, z), set: () => true, isLoaded: () => true, isTicking: () => true, height: 256,
  };
}

function scene(r) {
  const events = [], world = worldOf(r), items = new ItemEntities(() => 0.5), xpOrbs = new ExperienceOrbs([], () => 0.5), arrows = new Arrows(() => 0.5), primed = [];
  const eyes = { eyes: [] }, hookList = [], mobs = { entities: [] };
  const position = { x: 0, y: -100, z: 0 }, serverPlayer = { motion: { x: 0, y: 0, z: 0 } };
  const survival = { health: 0, creative: false, furnaces: {}, chests: {}, inventory: { armor: [] }, serverPlayer };
  let depth = 0;
  const watch = (e, field, i) => { let v = e[field]; Object.defineProperty(e, field, { get: () => v, set: (n) => { v = n; events.push(["h", depth, i]); }, configurable: true, enumerable: true }); };
  const state = { world, random: undefined, mobs, items, xpOrbs, arrows, projectiles: null, falling: null, primed, survival, position, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} }, eyes, hooks: hookList };
  // smoking false: the probe runs doExplosionA only (no block is broken by a nested blast, no drop is spawned)
  const boom = (x, y, z, size) => applyExplosion({ ...state, random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } }, { x, y, z, size, smoking: false });
  // a crystal: wz.a setDead, then createExplosion(null, .., 6) inline; a living mob takes the damage (the probe's have 1000 health)
  const hurt = (e, damage) => {
    if (!(e.health > 0)) return;
    events.push(["h", depth, e.index], ["dmg", depth, e.index, damage]);
    if (e.type !== "ender_crystal") return;
    e.health = 0; depth++;
    try { boom(e.x, e.y, e.z, 6); } finally { depth--; }
  };
  mobs.hazard = hurt; mobs.damage = hurt;
  let playerIndex = -1;
  const ents = r.ents.map(([kind, x, y, z], i) => {
    let e;
    if (kind === "player") {
      playerIndex = i;
      Object.assign(position, { x, y, z }); // EntityPlayerMP: posY is the feet
      Object.assign(survival, { health: 1000, scaledDamage: (damage) => { events.push(["h", depth, i], ["dmg", depth, i, damage]); return false; } });
      return "player";
    }
    if (kind === "item") { e = items.spawn({ id: 1, count: 1, damage: 0 }, x, y, z, { motion: [0, 0, 0] }); watch(e, "mx", i); }
    else if (kind === "orb") { e = newOrb(3, x, y, z, () => 0.5); xpOrbs.orbs.push(e); watch(e, "vx", i); }
    else if (kind === "arrow") { e = { x, y, z, mx: 0, my: 0, mz: 0 }; arrows.list.push(e); watch(e, "mx", i); }
    else if (kind === "tnt") { e = primeTnt(x, y, z, { random: () => 0.5 }); primed.push(e); watch(e, "vx", i); }
    else if (kind === "crystal") { e = { type: "ender_crystal", index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 5, growingAge: 0 }; mobs.entities.push(e); }
    else if (kind === "eye") { e = createEye(x, y, z); eyes.eyes.push(e); watch(e, "vx", i); }
    else if (kind === "hook") { const h = 0.125; e = { x, y, z, vx: 0, vy: 0, vz: 0, bb: [x - h, y, z - h, x + h, y + 0.25, z + h], dead: false }; hookList.push(e); watch(e, "vx", i); }
    else if (LIVING.has(kind)) { e = { type: kind === "babypig" ? "pig" : kind, index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 1000, growingAge: kind === "babypig" ? -24000 : 0 }; mobs.entities.push(e); }
    for (const k of MOTION[kind] ?? []) e[k] = 0;
    return e;
  });
  // the port files its player by the eye (stampPlayerCell); the probe keeps the feet and the eye in one slice
  const stamp = (i) => (ents[i] === "player" ? stampEntity("player", position.x, position.y + Math.fround(1.62), position.z, true) : stampEntity(ents[i], ents[i].x, walkedY(ents[i]), ents[i].z));
  events.length = 0;
  return { events, ents, stamp, boom, serverPlayer, playerIndex };
}
function replay(r) {
  forgetEntity("player");
  const s = scene(r);
  for (const op of r.ops) s.stamp(op[1]);
  s.boom(...r.centre, r.size);
  return s;
}
const motionOf = (s, r) => s.ents.map((e, i) => {
  const kind = r.ents[i][0];
  if (r.dead[i]) return null; // a dead entity's later pushes are on something gone (blastprobe85)
  if (kind === "player") return [s.serverPlayer.motion.x, s.serverPlayer.motion.y, s.serverPlayer.motion.z];
  return (MOTION[kind] ?? ["vx", "vy", "vz"]).map((k) => e[k]);
});
const deadOf = (s, r) => s.ents.map((e, i) => { const k = r.ents[i][0]; return k === "player" || LIVING.has(k) ? false : k === "crystal" ? e.health <= 0 : e.dead === true; });

test("blastcover86 (executed): exposure through blocks: hits, damage, pushes and deaths match native in every cover scene", () => {
  assert.equal(recs.length, 600);
  const bad = [];
  for (const r of recs) {
    const s = replay(r);
    const got = { events: s.events, motion: motionOf(s, r), dead: deadOf(s, r) };
    const want = { events: r.events, motion: r.motion.map((m, i) => (r.dead[i] ? null : m)), dead: r.dead };
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push({ centre: r.centre, size: r.size, blocks: r.blocks, ents: r.ents, want, got });
  }
  assert.equal(bad.length, 0, `${bad.length} mismatches; first: ${JSON.stringify(bad.slice(0, 1))}`);
});

// The scenes exercise what the empty probe worlds could not: partial cover, full cover (density 0: damage 1 and no push) and every box size.
test("blastcover86: the cover scenes cover partial and full exposure for each entity kind", () => {
  const seen = new Map(), note = (kind, d) => { const s = seen.get(kind) ?? { partial: 0, none: 0, full: 0 }; s[d === 1 ? "full" : d === 0 ? "none" : "partial"]++; seen.set(kind, s); };
  const BOX = { item: [0.125, 0, 0.25], orb: [0.25, 0, 0.5], arrow: [0.25, 0, 0.5], tnt: [0.49, 0, 0.98], eye: [0.125, 0, 0.25], hook: [0.125, 0, 0.25], crystal: [1, -1, 2], player: [0.3, 0, 1.8] };
  for (const r of recs) {
    const world = worldOf(r);
    r.ents.forEach(([kind, x, y, z]) => {
      let hw, dy, h;
      if (BOX[kind]) [hw, dy, h] = BOX[kind];
      else { const t = ENTITY_TYPES[kind === "babypig" ? "pig" : kind], sc = kind === "babypig" ? 0.5 : 1; hw = Math.fround(t.width * sc) / 2; dy = 0; h = Math.fround(t.height * sc); }
      if (kind === "item") dy = -0.125; // posY is the box centre
      if (kind === "tnt") dy = -0.49;
      const by = y + dy;
      note(kind, blockDensity(world, r.centre, [x - hw, by, z - hw, x + hw, by + h, z + hw]));
    });
  }
  // item, eye and hook boxes are 0.25 wide (2 x 2 x 2 sample points), so most land fully exposed or fully covered; every kind still sees both partial and zero exposure
  const thin = Object.entries(Object.fromEntries(seen)).filter(([, s]) => !(s.partial > 5 && s.none > 3));
  assert.equal(seen.size, 13, [...seen.keys()].join());
  assert.deepEqual(thin, []);
  const kinds = new Set(recs.flatMap((r) => r.blocks.map((b) => b[0])));
  assert.ok(kinds.size >= 100, `${kinds.size} block kinds`);
  for (const id of [20, 8, 9, 10, 11, 44, 126, 85, 113, 107, 64, 71, 102, 101, 53, 139, 51]) assert.ok(kinds.has(id), `block ${id} in some scene`);
});

// ---- the dedicated server: a player's TNT carries the player, and a Creative player's blast breaks paintings with no drop ----
await langReady;
const FLINT = Number(Object.keys(ITEMS).find((k) => ITEMS[k]?.kind === "flint_and_steel"));
function server(gameMode) {
  const world = new World("b86-cover");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  for (let x = 60; x <= 66; x++) for (let y = 10; y <= 14; y++) world.put(x, y, 60, 1, 0, false); // a wall facing +z
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode });
  sim.mobs.mobs.entities.length = 0;
  const p = sim.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001"); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  p.survival.inventory.main.fill(null); p.survival.add(PAINTING_ITEM, 1);
  assert.equal(sim.vehicles.hanging.useHeld(p, { block: [63, 11, 60], adjacent: [63, 11, 61] }), true);
  world.put(64, 11, 63, TNT, 0, false);
  p.survival.inventory.main.fill(null); p.survival.add(FLINT, 1);
  Object.assign(p, { yaw: 0, pitch: 0, moved: true }); // looking north at the TNT block
  return { sim, p, world };
}
const paintingDrops = (sim) => sim.items.items.filter((e) => (e.stack?.id ?? e.id) === PAINTING_ITEM).length;

test("blastcover86 (bytecode-read aob.a(ahb,III,yz,IFFF)): flint and steel on a server TNT block primes it with the player as placer", () => {
  const { sim, p, world } = server("survival");
  assert.equal(sim.edit(p, true), true);
  assert.equal(world.get(64, 11, 63), 0);
  assert.equal(sim.dispense.primed.length, 1);
  assert.equal(sim.dispense.primed[0].placer, p);
  assert.deepEqual(sim.dispense.fx.map((f) => f.name), ["game.tnt.primed"]);
  assert.equal(p.survival.inventory.main.find(Boolean)?.damage, 1); // damageItem(1, player)
});

for (const [mode, drops] of [["survival", 1], ["creative", 0]]) {
  test(`blastcover86: the server's blast from a ${mode} player's TNT ${drops ? "drops" : "breaks with no drop"} the painting (EntityHanging.onBroken(placer))`, () => {
    const { sim, p } = server(mode);
    sim.edit(p, true);
    const t = sim.dispense.primed[0];
    sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
    assert.equal(sim.vehicles.hanging.entities.length, 0);
    assert.equal(paintingDrops(sim), drops);
    if (mode === "creative") assert.equal(p.survival.inventory.main.find(Boolean)?.damage ?? 0, 0); // ItemStack.damageItem: not in Creative
  });
}

test("blastcover86 (bytecode-read kr, registered by kl for Blocks.tnt): dispensed TNT has no placer, so a Creative player near it still gets the drop", () => {
  const { sim } = server("creative");
  sim.dispense.host(() => {}).spawnTnt(64, 11, 63);
  const t = sim.dispense.primed[0];
  assert.equal(t.placer, null);
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  assert.equal(paintingDrops(sim), 1);
});

test("blastcover86: a burning arrow's TNT on the server takes the shooter (aob.a(ahb,III,sa): zc.c instanceof sv)", () => {
  const { sim, p } = server("creative");
  sim.dispense.igniteBlockTnt(64, 11, 63, p);
  assert.equal(sim.dispense.primed[0].placer, p);
  const src = readFileSync(new URL("./multiplayer/server-dispense.js", import.meta.url), "utf8");
  assert.match(src, /ctx\.tntPlacer = this\.ownerOf\(a\)/);
  assert.match(src, /igniteTnt: lane === this \? \(x, y, z\) => this\.igniteBlockTnt\(x, y, z, ctx\.tntPlacer\)/);
});

test("blastcover86: a large fireball in the single-player player's blast turns to the player's look vector, not NaN (main.js playerLook gives degrees)", () => {
  const balls = new Fireballs({ entities: [], playerLook: () => ({ yaw: 90, pitch: -30 }) });
  assert.deepEqual(balls.lookOf("player"), lookVector(90, -30, mhSin, mhCos));
  assert.ok(balls.lookOf("player").every(Number.isFinite));
  const replay = new Fireballs({ entities: [], playerLook: () => [0, 0, 1] });
  assert.deepEqual(replay.lookOf("player"), [0, 0, 1]);
});
