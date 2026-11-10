import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WOODEN_DOOR, WATER, LAVA, WEB, FENCE, STONE_SLAB } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { revengeOf } from "./revenge-target.js"; // the raw field: a dead target is cleared on the target's next own update, as natively
import { Arrows, arrowTargets } from "./bow.js";
import { mobTargets } from "./projectiles.js";
import { reinforcementBase } from "./difficulty.js";
import { setPathNodeCap } from "./pathfinding.js";

// Replays one VillageFightProbe record (public/research/village-fight-reference.json) through the port's ticked mobs: the same village, the same
// positions, entity Randoms seeded like the probe's (seed * 10 + index) and logging their draws as the probe's Log does (nextInt(bound) "i<bound>", nextFloat
// "f", nextGaussian "g"). Per tick `states[t]` is, per entity, [x, y, z, health, attack target index, revenge target index, draws] (7 = the player, -1 none).
export const fightReference = JSON.parse(readFileSync(new URL("../public/research/village-fight-reference.json", import.meta.url)));
// Batch 31: village-fight-b31-reference.json (mob list from `types`, bow skeletons, three or more zombies, Hard, equipment swaps): rows carry a 4th element
// (the arrows that changed), the record lists `shots` and `conversions`, and `states` of the replay gain `arrows` / `conversions` / `playerDamage`.
export const fightReference31 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b31-reference.json", import.meta.url)));
// Batch 32: village-fight-b32-reference.json (arena variants: terrain steps, a water pool, walls, doors, glass and fences the arrows hit, dark Hard
// reinforcements); rows carry a 5th element (the zombies built during the fight, ticked like any mob) and `zombies` lists their Entity.rand seeds.
export const fightReference32 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b32-reference.json", import.meta.url)));
// Batch 33: village-fight-b33-reference.json (stairs, ladders, trapdoors, fence gates, lava, ice, packed ice, soul sand, cobweb); a `pos` row may carry a start height.
export const fightReference33 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b33-reference.json", import.meta.url)));
// Batch 34: village-fight-b34-reference.json (the native ChunkCache does not bound the search, sealed and far targets, chunk borders, reinforcement sites in chunks that are not loaded,
// cobblestone walls, nether fences, cobweb with arrows and falls); a record may carry `unloaded` chunks (the double's ChunkProviderServer has not loaded them).
export const fightReference34 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b34-reference.json", import.meta.url)));
// Batch 35: village-fight-b35-reference.json (stacked storeys, a tower, zombie follow range 80-130): records carry `searches`, the native PathFinder's point count of every search.
export const fightReference35 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b35-reference.json", import.meta.url)));
// Batch 36: village-fight-b36-reference.json (baby-zombie chicken jockeys from scripted spawns, held-item swaps with attribute modifiers, gates and doors on slopes, villagers fleeing across storeys):
// a `spawn` script op, chickens (`C`) among the mobs, `spawns`/`chickens` lists and two more row elements (the chickens built during the fight, the jockey flags of the starting chickens).
export const fightReference36 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b36-reference.json", import.meta.url)));
export const fightReference37 = JSON.parse(readFileSync(new URL("../public/research/village-fight-b37-reference.json", import.meta.url)));
class LogRandom extends JavaRandom {
  log = [];
  logBooleans = false;
  nextBoolean() { const r = super.nextBoolean(); if (this.logBooleans) this.log.push("b"); return r; }
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); return super.nextGaussian(); }
}
const key = (x, y, z) => `${x},${y},${z}`;
const TYPE_OF = { V: "villager", Z: "zombie", z: "zombie", G: "iron_golem", K: "skeleton", B: "skeleton", C: "chicken" };
const BOW_STACK = () => ({ id: 261, count: 1, damage: 0, enchantments: [] });

// The record's fills use the original block ids; the port's internal ids differ (world.js).
const PORT_ID = { 1: 3, 2: 1, 4: 12, 5: 7, 8: WATER, 9: WATER, 10: LAVA, 11: LAVA, 20: 9, 44: STONE_SLAB, 64: WOODEN_DOOR, 85: FENCE };
// original id and metadata to the port's cell: the few fixed ids above, else the block registry (stairs, ladder, trapdoor, gate, ice, soul sand, cobweb ...)
function portCell(id, meta) {
  if (id in PORT_ID) return [PORT_ID[id], meta];
  const c = fromOriginal(id, meta);
  if (!c) throw new Error(`no port block for original ${id}`);
  return [c.id, c.meta];
}
function plain(blocks = []) {
  const cells = new Map([[key(50, 0, 50), [WOODEN_DOOR, 0]], [key(50, 1, 50), [WOODEN_DOOR, 8]]]);
  // Batch 32: `blocks` are the record's [x0, y0, z0, x1, y1, z1, id, meta] fills (terrain steps, walls, glass, fences, a water pool replacing floor cells at y < 0).
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of blocks) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells.set(key(x, y, z), portCell(id, meta));
  return { numericSeed: 1, height: 256, floorBelow: true, minX: -3e7, maxX: 3e7, minZ: -3e7, maxZ: 3e7, // the native world has no edge a mob stops at (batch 34: the golem of a hunt walks past x 0)
    get: (x, y, z) => cells.get(key(x, y, z))?.[0] ?? (y < 0 ? PORT_ID[1] : 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, WATER, LAVA, WEB].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}

export function replayFight(r, hooks = {}) {
  const was = setPathNodeCap(Infinity); // natively a path search has no node cap (the live port stops at 30000 expanded points)
  try { return replayFightUncapped(r, hooks); } finally { setPathNodeCap(was); }
}
function replayFightUncapped(r, hooks) {
  const types = r.types ?? "VVZZGKK", n = types.length, extras = !!r.types, difficulty = r.difficulty ?? 2;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = difficulty;
  if (r.local) ew.localDifficulty = () => r.local; // the probe's World.func_147462_b answers a constant (record field `local`, 0 when absent)
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.brightnessLevel = () => 15; // natively the probe's World.getLightBrightness is 1.0 whatever k() answers
  ew.lightAt = () => r.light ?? 15; // the probe world's getLightBrightness is 1.0 everywhere; World.getBlockLightValue is the record's `light` (15 unless a dark arena)
  if (r.unloaded) { const gone = new Set(r.unloaded.map(([x, z]) => x + "," + z)); ew.chunkLoaded = (x, z) => !gone.has((x >> 4) + "," + (z >> 4)); } // World.spawnEntityInWorld's chunkExists
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  // EntityLiving.despawnEntity is setDead: the native row keeps the health it had, the port marks a despawn as health 0 / death 20 (a corpse's removal)
  const gone = new Map(), despawn = ew.ai.deps.despawn;
  ew.ai.deps.despawn = (e) => { gone.set(e, e.health); despawn(e); };
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0], ents = [], logs = [], states = [];
  [...types].forEach((ch, i) => {
    const type = TYPE_OF[ch], [x, z, y0 = 0] = r.pos[i], e = type === "iron_golem" ? ew.spawnIronGolem(x, y0, z, false) : ew.create(type, x, y0, z);
    if (type !== "iron_golem") ew.entities.push(e);
    e.growingAge = 0; e.onGround = true;
    // the probe's `new EntityZombie` never ran onSpawnWithEgg: no random knockback-resistance bonus
    if (type === "zombie") e.knockbackResistance = 0;
    // the probe's `new EntitySkeleton` was never onSpawnWithEgg'd: an empty hand, so setCombatTask picks AttackOnCollide (a bow skeleton got its bow through setCurrentItemOrArmor)
    if (type === "skeleton") e.equipment = [ch === "B" ? BOW_STACK() : null, null, null, null, null];
    if (ch === "z") e.canBreakDoors = true;
    if (type === "zombie" && r.follow) e.followRange = r.follow; // the probe sets generic.followRange (the live value the onSpawnWithEgg bonuses give); the navigator reads it when the mob's brain is built
    if (type === "zombie" && r.bases) e.reinforcement = r.bases[i]; // the spawnReinforcements base the zombie's constructor drew from its (then seeded) Entity.rand
    if (type === "villager") e.profession = i % 5;
    if (type === "chicken" && r.egg) e.eggTimer = r.egg; // the probe sets timeUntilNextEgg (the constructor's 6000 + nextInt(6000) is out of reach)
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); lr.logBooleans = extras; logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  // no village link here: each villager and the golem finds it in its own first updateAITick refresh (nextInt(50) draw), as natively
  const survival = new Survival({}, "survival");
  survival.difficulty = difficulty; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, isPlayer: true };
  ew.ai.player.unticked = true;
  ew.ai.budget.perTick = Infinity; // natively a path search is never refused; the live port spreads them over ticks (ai.js budget), the replay does not
  // arrows: a skeleton's shot is the port's own end to end (Batch 32): the heading comes from the arrow's Entity.rand, which the record seeds (its
  // EntityArrow constructor's gaussians), then flight, hits and damage. The shot must happen on the recorded tick from the recorded shooter, and its start
  // state (position, motion, yaw, pitch, damage, punch, flame) must equal the native one: `headingDiff` lists any differing field.
  const arrows = new Arrows(() => 0.5), shotLog = [], shotsLeft = (r.shots ?? []).slice(), mine = [];
  let tick = 0, nextShot = 0;
  ew.shoot = (e, target, scale) => {
    arrows.mobRands.set(e, ents.includes(e) ? logs[ents.indexOf(e)] : arrows.rng());
    const want = shotsLeft[0];
    arrows.rng = () => new JavaRandom(BigInt(want?.[13] ?? 1)); // the seed of the arrow's Entity.rand
    const a = arrows.skeletonShoot(e, target?.height ? target : { x: target.x, y: target.y, z: target.z, height: 1.8 }, scale, ew.difficulty);
    shotsLeft.shift();
    shotLog.push([tick, ents.indexOf(e), a ? a.damage : null]);
    if (!a || !want) return a;
    const [, , x, y, z, mx, my, mz, yaw, pitch, damage, punch, fire] = want;
    const got = { x: a.x, y: a.y, z: a.z, mx: a.mx, my: a.my, mz: a.mz, yaw: a.yaw, pitch: a.pitch, damage: a.damage, punch: a.knockback ?? 0, fire: a.fire ?? 0 };
    a.headingDiff = Object.entries({ x, y, z, mx, my, mz, yaw: Math.fround(yaw), pitch: Math.fround(pitch), damage, punch, fire }).filter(([k, v]) => got[k] !== v).map(([k, v]) => [k, v, got[k]]);
    a.id = nextShot++;
    mine.push(a);
    return a;
  };
  // Zombies built during the fight (EntityZombie.onKillEntity's conversion, a Hard reinforcement): each takes the next recorded Entity.rand seed (natively the
  // constructor's `new Random()` is the one thing the record cannot give, so the probe's Entity is seeded), and ticks and is compared like any mob.
  const extra = [], extraLogs = [], zombiesLeft = (r.zombies ?? []).slice(), made = [];
  const extraChickens = [], chickenLogs = [], chickensLeft = (r.chickens ?? []).slice();
  const extraMobs = [], mobLogs = [], mobsLeft = (r.mobs ?? []).slice(); // batch 37: spiders and skeletons built during the fight
  ew.entitySeed = (z, kind) => {
    if (kind === "jockey-chicken") { // a baby zombie's new chicken (yq.a(sy)): Entity.rand seeded, the constructor's egg timer, the yaw setLocationAndAngles gave it
      const rec = chickensLeft.shift(), lr = new LogRandom(BigInt(rec ? rec[4] : 1));
      setEntityRandom(z, lr);
      lr.nextInt(6000); // the constructor's timeUntilNextEgg draw (the probe's Entity is seeded from the start), overwritten below with the recorded value
      z.growingAge = 0; z.onGround = false;
      if (rec) { z.eggTimer = rec[8]; for (const k of ["rotationYawHead", "prevRotationYawHead"]) z[k] = Math.fround(rec[6]); }
      made.push([tick, kind, z.x, z.y, z.z]);
      extraChickens.push(z); chickenLogs.push(lr);
      return;
    }
    if (z.type === "spider" || z.type === "skeleton") { // batch 37: a spider built by a spawn op and the skeleton jockey its onSpawnWithEgg seats on it: Entity.rand seeded from the record, the constructor's yaw fields, then ticked like any mob
      const rec = mobsLeft.shift(), lr = new LogRandom(BigInt(rec ? rec[5] : 1));
      lr.logBooleans = true; setEntityRandom(z, lr);
      z.growingAge = 0; z.onGround = false;
      if (rec) for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) z[k] = Math.fround(rec[6]);
      if (rec) z.yaw = (-Math.fround(rec[6]) * Math.PI) / 180;
      made.push([tick, kind, z.x, z.y, z.z]);
      extraMobs.push(z); mobLogs.push(lr);
      return;
    }
    const rec = zombiesLeft.shift();
    made.push([tick, kind, z.x, z.y, z.z]);
    const lr = new LogRandom(BigInt(rec ? rec[5] : 1)); lr.logBooleans = true; setEntityRandom(z, lr);
    z.growingAge = 0; z.onGround = false; // a new Entity starts in the air (the probe sets onGround only on the mobs it builds): canNavigate() is false until its first move lands
    z.reinforcement = reinforcementBase(() => lr.nextDouble()); // EntityZombie.applyEntityAttributes: the first draw of the new zombie's constructor
    if (rec?.[7] !== undefined) for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) z[k] = Math.fround(rec[7]); // the constructor's Math.random yaw (the one start heading no seed reaches)
    if (rec?.[7] !== undefined) z.yaw = (-Math.fround(rec[7]) * Math.PI) / 180;
    extra.push(z); extraLogs.push(lr);
  };
  const vel = [0, 0], script = r.script.map((s) => s.split(" ")), hits = [], rows = [], playerDamage = [];
  const arrowLast = new Map();
  // "t equipmid k idx item": the swap happens right after mob k's update that tick (natively the pickup loop sits at the end of its onLivingUpdate, which lootPickupOne mirrors)
  const pickup = ew.lootPickupOne.bind(ew);
  ew.lootPickupOne = (e) => { pickup(e); const k = ents.indexOf(e); if (k >= 0) for (const p of script) if (Number(p[0]) === tick && p[1] === "equipmid" && Number(p[2]) === k) equip(Number(p[3]), p[4] === "0" ? 0 : p[4]); };
  let name = "probe", playerHealth = 1000;
  // "t spawn x z y yaw": SpawnerAnimals' order, a zombie placed with its yaw, World.spawnEntityInWorld (refused in a chunk that is not loaded), then onSpawnWithEgg with its chicken-jockey rolls.
  const spawnLog = [], spawnsLeft = (r.spawns ?? []).slice();
  const spawnZombie = (x, z, y, yaw) => {
    const rec = spawnsLeft.shift(), loaded = ew.chunkLoaded ? ew.chunkLoaded(x, z) : true, before = ew.entities.length;
    let zb, kind;
    if (loaded) zb = ew.spawnNatural("zombie", x, y, z, "spawn");
    else { // a zombie the world refused still runs onSpawnWithEgg: its draws on World.rand happen, nothing joins the world
      zb = ew.create("zombie", x, y, z);
      zb.rotationYaw = Math.fround(yaw);
      setEntityRandom(zb, new LogRandom(BigInt(rec ? rec[6] : 1)));
      zb.growingAge = 0;
      ew.onSpawnWithEgg(zb, { ghost: true });
    }
    const mount = zb.ridingEntity, near = mount ? ents.indexOf(mount) : -1;
    kind = !mount ? 0 : near >= 0 ? 1 : 2;
    spawnLog.push([tick, loaded ? 1 : 0, zb.growingAge < 0 ? 1 : 0, kind, near, ew.entities.length - before - (loaded ? 1 : 0) > 0 ? 1 : 0, rec ? rec[6] : null]);
  };
  const equip = (i, id) => { const e = ents[i]; e.equipment = [id ? { id: Number(id), count: 1, damage: 0, enchantments: [] } : null, null, null, null, null]; ew.ai.brain(e).syncCombatTask(true); }; // setCurrentItemOrArmor(0) runs setCombatTask at once
  for (let t = 0; t < r.ticks; t++) {
    tick = t;
    const knownExtras = extraLogs.length, knownChickens = chickenLogs.length, knownMobs = mobLogs.length;
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      if (p[1] === "hitmob") { // batch 37: "t hitmob k dmg player|mob" on the k-th spider or skeleton of the fight
        const v = extraMobs[Number(p[2])], a = p[4] === "player" ? player : ents[0];
        const src = p[4] === "player" ? { from: { x: player.x, z: player.z }, player: true, name: "player" } : { from: { x: a.x, z: a.z }, attacker: a, name: "mob", player: false };
        hits.push([t, ew.attackEntityFrom(v, Number(p[3]), src), v.health]);
        continue;
      }
      if (p[1] === "hit") {
        const v = ents[Number(p[2])], a = Number(p[3]) === n ? player : ents[Number(p[3])];
        const src = p[5] === "player" ? { from: { x: player.x, z: player.z }, player: true, name: "player" } : { from: { x: a.x, z: a.z }, attacker: a, shooter: p[5] === "arrow" ? a : undefined, name: p[5] === "arrow" ? "arrow" : "mob", player: false };
        // A hit on a mob the world already removed (Peaceful setDead, despawn) still lands natively: sv.attackEntityFrom never asks whether the entity is in the world list, and
        // the corpse keeps its health. The port refuses such a hit on purpose (nothing in the game can reach a removed mob), so the replay puts the mob back for the hit alone.
        const away = !ew.entities.includes(v) && (v.removedHealth !== undefined || gone.has(v));
        let kept = null;
        if (away) { kept = { h: v.removedHealth ?? gone.get(v), d: v.death }; v.health = kept.h; v.death = 0; ew.entities.push(v); }
        const hit = ew.attackEntityFrom(v, Number(p[4]), src);
        hits.push([t, hit, v.health]);
        if (away) { ew.entities.splice(ew.entities.indexOf(v), 1); v.removedHealth = v.health; v.health = 0; v.death = kept.d; gone.delete(v); }
      } else if (p[1] === "walk" && Number(p[2]) === n) { vel[0] = Number(p[3]); vel[1] = Number(p[4]); }
      else if (p[1] === "move" && Number(p[2]) !== n) { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); if (p.length > 5) e.y = Number(p[5]); }
      else if (p[1] === "move") { player.x = Number(p[3]); player.z = Number(p[4]); }
      else if (p[1] === "rename") name = p[2];
      else if (p[1] === "equip") equip(Number(p[2]), p[3] === "0" ? 0 : p[3]);
      else if (p[1] === "spawn") spawnZombie(Number(p[2]), Number(p[3]), Number(p[4]), Number(p[5]));
      else if (p[1] === "spawnspider") ew.spawnNatural("spider", Number(p[2]), Number(p[4]), Number(p[3]), "spawn"); // SpawnerAnimals' order: spawnEntityInWorld, then onSpawnWithEgg (the jockey roll and the Hard potion on World.rand)
    }
    player.x += vel[0]; player.z += vel[1];
    ew.ai.beginTick(player, survival, 0);
    // a zombie built by a scripted hit (before this point) keeps its constructor-time draws: the probe notices it only in the entity pass that follows its log reset
    for (const l of [...logs, ...extraLogs.slice(0, knownExtras), ...chickenLogs.slice(0, knownChickens), ...mobLogs.slice(0, knownMobs)]) l.log.length = 0;
    survival.health = 1000;
    // the arrows (zc.h) tick after every mob, in spawn order; one spawned this tick ticks in this pass. A zombie an arrow's hit makes (a reinforcement) is appended after the arrows and ticks in the same pass.
    const changed = [];
    ew.lateEntity = extras ? { lateHook: () => arrows.tick(ew.world, { targets: arrowTargets(mobTargets(ew.entities.filter((m) => !m.removedHealth), { x: player.x, y: 0, z: player.z }, 0.6, 1.8), false), mobs: ew, survival, player }) } : null;
    ew.tick(player, survival, 0);
    if (extras) {
      for (const a of mine) {
        const s = JSON.stringify([a.id, a.x, a.y, a.z, a.mx, a.my, a.mz, a.dead ? 1 : 0]);
        if (arrowLast.get(a) !== s) { arrowLast.set(a, s); changed.push([a.id, a.x, a.y, a.z, a.mx, a.my, a.mz, a.dead ? 1 : 0]); }
      }
    }
    playerDamage.push(1000 - survival.health);
    survival.health = 1000;
    const index = (e) => (ents.includes(e) ? ents.indexOf(e) : extra.includes(e) ? n + 1 + extra.indexOf(e) : extraMobs.includes(e) ? n + 1 + extra.length + extraMobs.indexOf(e) : -1);
    const agg = village.aggressors.map((a) => [a.entity.isPlayer ? n : index(a.entity.e), a.tick]);
    const idx = (b) => (!b ? -1 : b.isPlayer ? n : index(b.e));
    states.push(ents.map((e, i) => [e.x, e.y, e.z, gone.has(e) ? gone.get(e) : e.removedHealth ?? e.health, idx(ew.ai.brain(e).attackTarget), (e.revenge ? (revengeOf(e) === "player" ? n : index(revengeOf(e))) : -1), logs[i].log.slice()]));
    states[states.length - 1].arrows = changed;
    states[states.length - 1].chickens = extraChickens.map((c, k) => [c.x, c.y, c.z, c.removedHealth ?? c.health, c.chickenJockey ? 1 : 0, chickenLogs[k].log.slice()]);
    states[states.length - 1].mobs = extraMobs.map((m, k) => [m.x, m.y, m.z, gone.has(m) ? gone.get(m) : m.removedHealth ?? m.health, idx(ew.ai.brain(m).attackTarget), (m.revenge ? (revengeOf(m) === "player" ? n : index(revengeOf(m))) : -1), mobLogs[k].log.slice()]);
    states[states.length - 1].jockeys = ents.flatMap((e) => (e.type === "chicken" ? [e.chickenJockey ? 1 : 0] : []));
    states[states.length - 1].extras = extra.map((z, k) => [z.x, z.y, z.z, gone.has(z) ? gone.get(z) : z.removedHealth ?? z.health, idx(ew.ai.brain(z).attackTarget), (z.revenge ? (revengeOf(z) === "player" ? n : index(revengeOf(z))) : -1), extraLogs[k].log.slice()]);
    hooks.onTick?.(t, ew, ents);
    rows.push([agg, village.playerReputation(name === "alt" ? "Player" : "Player")]);
  }
  return { ew, extraMobs, spawnLog, extraChickens, hits, rows, states, conversions: made.filter((m) => m[1] === "convert").map(([t, , x, y, z]) => [t, x, y, z]), made, extra, playerDamage, shotLog, shots: mine };
}

// The first tick, mob and field where a replay differs from a record (null when none): fields 0-5 are x, y, z, health, attack target, revenge target, then the draws.
const near = (a, b) => Math.abs(a - b) < 1e-9;
export function firstDivergence(r, got) {
  const n = r.types.length;
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t][0];
    for (let i = 0; i < n; i++) {
      const w = want[i], g = got.states[t][i];
      for (let k = 0; k < 6; k++) if (w[k] !== g[k]) return [t, i, k, w[k], g[k]];
      if (JSON.stringify(w[6]) !== JSON.stringify(g[6])) return [t, i, "draws", w[6], g[6]];
    }
    if (JSON.stringify(r.rows[t][3]) !== JSON.stringify(got.states[t].arrows)) return [t, "arrows"];
    if (JSON.stringify(r.rows[t][4]) !== JSON.stringify(got.states[t].extras)) return [t, "extra zombies", r.rows[t][4], got.states[t].extras];
    if (r.rows[t][5] !== undefined) { // batch 36 rows: the chickens built during the fight, then the jockey flags of the starting chickens
      if (JSON.stringify(r.rows[t][5]) !== JSON.stringify(got.states[t].chickens)) return [t, "extra chickens", r.rows[t][5], got.states[t].chickens];
      if (JSON.stringify(r.rows[t][6]) !== JSON.stringify(got.states[t].jockeys)) return [t, "jockey flags", r.rows[t][6], got.states[t].jockeys];
    }
    if (r.rows[t][7] !== undefined) {
      // A spider's own update draws on Entity.rand through EntityCreature.updateEntityActionState (i180, i120, f, f while idle), which the port's adapted spider AI does not (public/research/spiders.md): its draws
      // are compared only up to the first ambient-sound draw (i1000) of its first update, i.e. its spawn rolls; its place, health and target are compared at every tick. The skeleton jockey is compared whole.
      const view = (list, kinds) => list.map((m, i) => (kinds[i] === 0 ? [...m.slice(0, 6), m[6].slice(0, Math.max(0, m[6].indexOf("i1000")))] : m));
      const kinds = (r.mobs ?? []).map((m) => m[1]);
      if (JSON.stringify(view(r.rows[t][7], kinds)) !== JSON.stringify(view(got.states[t].mobs, kinds))) return [t, "extra mobs", r.rows[t][7], got.states[t].mobs];
    }
    const before = t ? r.rows[t - 1][0][n][3] : 1000;
    if (!near(before - want[n][3], got.playerDamage[t])) return [t, "player damage", before - want[n][3], got.playerDamage[t]];
  }
  return null;
}
