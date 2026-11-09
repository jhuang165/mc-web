import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WOODEN_DOOR } from "./world.js";
import { revengeOf } from "./revenge-target.js"; // the raw field: a dead target is cleared on the target's next own update, as natively
import { Arrows, arrowTargets } from "./bow.js";
import { mobTargets } from "./projectiles.js";
import { reinforcementBase } from "./difficulty.js";

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
class LogRandom extends JavaRandom {
  log = [];
  logBooleans = false;
  nextBoolean() { const r = super.nextBoolean(); if (this.logBooleans) this.log.push("b"); return r; }
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); return super.nextGaussian(); }
}
const key = (x, y, z) => `${x},${y},${z}`;
const TYPE_OF = { V: "villager", Z: "zombie", z: "zombie", G: "iron_golem", K: "skeleton", B: "skeleton" };
const BOW_STACK = () => ({ id: 261, count: 1, damage: 0, enchantments: [] });

function plain(blocks = []) {
  const cells = new Map([[key(50, 0, 50), [WOODEN_DOOR, 0]], [key(50, 1, 50), [WOODEN_DOOR, 8]]]);
  // Batch 32: `blocks` are the record's [x0, y0, z0, x1, y1, z1, id, meta] fills (terrain steps, walls, glass, fences, a water pool replacing floor cells at y < 0).
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of blocks) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells.set(key(x, y, z), [id, meta]);
  return { numericSeed: 1, height: 256, floorBelow: true, get: (x, y, z) => cells.get(key(x, y, z))?.[0] ?? (y < 0 ? 1 : 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, 8, 9, 10, 11].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}

export function replayFight(r) {
  const types = r.types ?? "VVZZGKK", n = types.length, extras = !!r.types, difficulty = r.difficulty ?? 2;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = difficulty;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.lightAt = () => r.light ?? 15; // the probe world's getLightBrightness is 1.0 everywhere; World.getBlockLightValue is the record's `light` (15 unless a dark arena)
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  // EntityLiving.despawnEntity is setDead: the native row keeps the health it had, the port marks a despawn as health 0 / death 20 (a corpse's removal)
  const gone = new Map(), despawn = ew.ai.deps.despawn;
  ew.ai.deps.despawn = (e) => { gone.set(e, e.health); despawn(e); };
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0], ents = [], logs = [], states = [];
  [...types].forEach((ch, i) => {
    const type = TYPE_OF[ch], [x, z] = r.pos[i], e = type === "iron_golem" ? ew.spawnIronGolem(x, 0, z, false) : ew.create(type, x, 0, z);
    if (type !== "iron_golem") ew.entities.push(e);
    e.growingAge = 0; e.onGround = true;
    // the probe's `new EntityZombie` never ran onSpawnWithEgg: no random knockback-resistance bonus
    if (type === "zombie") e.knockbackResistance = 0;
    // the probe's `new EntitySkeleton` was never onSpawnWithEgg'd: an empty hand, so setCombatTask picks AttackOnCollide (a bow skeleton got its bow through setCurrentItemOrArmor)
    if (type === "skeleton") e.equipment = [ch === "B" ? BOW_STACK() : null, null, null, null, null];
    if (ch === "z") e.canBreakDoors = true;
    if (type === "zombie" && r.bases) e.reinforcement = r.bases[i]; // the spawnReinforcements base the zombie's constructor drew from its (then seeded) Entity.rand
    if (type === "villager") e.profession = i % 5;
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); lr.logBooleans = extras; logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  // no village link here: each villager and the golem finds it in its own first updateAITick refresh (nextInt(50) draw), as natively
  const survival = new Survival({}, "survival");
  survival.difficulty = difficulty; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: 0, z: r.pos[n][1], health: 1000, alive: true, isPlayer: true };
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
  ew.entitySeed = (z, kind) => {
    const rec = zombiesLeft.shift();
    made.push([tick, kind, z.x, z.y, z.z]);
    const lr = new LogRandom(BigInt(rec ? rec[5] : 1)); lr.logBooleans = true; setEntityRandom(z, lr);
    z.growingAge = 0; z.onGround = false; // a new Entity starts in the air (the probe sets onGround only on the mobs it builds): canNavigate() is false until its first move lands
    z.reinforcement = reinforcementBase(() => lr.nextDouble()); // EntityZombie.applyEntityAttributes: the first draw of the new zombie's constructor
    extra.push(z); extraLogs.push(lr);
  };
  const vel = [0, 0], script = r.script.map((s) => s.split(" ")), hits = [], rows = [], playerDamage = [];
  const arrowLast = new Map();
  // "t equipmid k idx item": the swap happens right after mob k's update that tick (natively the pickup loop sits at the end of its onLivingUpdate, which lootPickupOne mirrors)
  const pickup = ew.lootPickupOne.bind(ew);
  ew.lootPickupOne = (e) => { pickup(e); const k = ents.indexOf(e); if (k >= 0) for (const p of script) if (Number(p[0]) === tick && p[1] === "equipmid" && Number(p[2]) === k) equip(Number(p[3]), p[4] === "0" ? 0 : p[4]); };
  let name = "probe", playerHealth = 1000;
  const equip = (i, id) => { const e = ents[i]; e.equipment = [id ? { id: Number(id), count: 1, damage: 0, enchantments: [] } : null, null, null, null, null]; ew.ai.brain(e).syncCombatTask(); }; // setCurrentItemOrArmor(0) runs setCombatTask at once
  for (let t = 0; t < r.ticks; t++) {
    tick = t;
    const knownExtras = extraLogs.length;
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
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
      else if (p[1] === "move" && Number(p[2]) !== n) { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); }
      else if (p[1] === "move") { player.x = Number(p[3]); player.z = Number(p[4]); }
      else if (p[1] === "rename") name = p[2];
      else if (p[1] === "equip") equip(Number(p[2]), p[3] === "0" ? 0 : p[3]);
    }
    player.x += vel[0]; player.z += vel[1];
    ew.ai.beginTick(player, survival, 0);
    // a zombie built by a scripted hit (before this point) keeps its constructor-time draws: the probe notices it only in the entity pass that follows its log reset
    for (const l of [...logs, ...extraLogs.slice(0, knownExtras)]) l.log.length = 0;
    survival.health = 1000;
    ew.tick(player, survival, 0);
    // the arrows (zc.h) tick after every mob, in spawn order; one spawned this tick ticks in this pass
    const changed = [];
    if (extras) {
      arrows.tick(ew.world, { targets: arrowTargets(mobTargets(ew.entities.filter((m) => !m.removedHealth), { x: player.x, y: 0, z: player.z }, 0.6, 1.8), false), mobs: ew, survival, player });
      for (const a of mine) {
        const s = JSON.stringify([a.id, a.x, a.y, a.z, a.mx, a.my, a.mz, a.dead ? 1 : 0]);
        if (arrowLast.get(a) !== s) { arrowLast.set(a, s); changed.push([a.id, a.x, a.y, a.z, a.mx, a.my, a.mz, a.dead ? 1 : 0]); }
      }
    }
    playerDamage.push(1000 - survival.health);
    survival.health = 1000;
    const index = (e) => (ents.includes(e) ? ents.indexOf(e) : extra.includes(e) ? n + 1 + extra.indexOf(e) : -1);
    const agg = village.aggressors.map((a) => [a.entity.isPlayer ? n : index(a.entity.e), a.tick]);
    const idx = (b) => (!b ? -1 : b.isPlayer ? n : index(b.e));
    states.push(ents.map((e, i) => [e.x, e.y, e.z, gone.has(e) ? gone.get(e) : e.removedHealth ?? e.health, idx(ew.ai.brain(e).attackTarget), (e.revenge ? (revengeOf(e) === "player" ? n : index(revengeOf(e))) : -1), logs[i].log.slice()]));
    states[states.length - 1].arrows = changed;
    states[states.length - 1].extras = extra.map((z, k) => [z.x, z.y, z.z, gone.has(z) ? gone.get(z) : z.removedHealth ?? z.health, idx(ew.ai.brain(z).attackTarget), (z.revenge ? (revengeOf(z) === "player" ? n : index(revengeOf(z))) : -1), extraLogs[k].log.slice()]);
    rows.push([agg, village.playerReputation(name === "alt" ? "Player" : "Player")]);
  }
  return { ew, hits, rows, states, conversions: made.filter((m) => m[1] === "convert").map(([t, , x, y, z]) => [t, x, y, z]), made, extra, playerDamage, shotLog, shots: mine };
}
