// Where the game awards statistics (the StatList call sites of 1.7.10 read from the unchanged client; see public/research/stats.md).
// Small observers that main.js wires in: the per-tick movement stats, mob kills and hits, hurt/death/jump on Survival, drops, crafting,
// block harvests and fishing. The stat table, formats and file shape live in stats.js; every award is `stats.increment`.
import { STAT } from "./stats.js";
import { ITEMS } from "./survival.js";
import { WEB } from "./world.js";
import { toOriginal } from "./block-registry.js";
import { originalOfLive } from "./item-names.js";

const f32 = Math.fround;
// 1.7.10 ids of this build's item and block ids (null when the port has no original: no stat).
export const originalItem = (id) => originalOfLive(id)?.id ?? null;
export const originalBlock = (id, meta = 0) => toOriginal(id, meta)?.[0] ?? null;
// ItemSword / ItemTool.hitEntity and onBlockDestroyed return true, so ItemStack awards the use stat; ItemShears only on plants and webs.
const TOOL_KINDS = new Set(["sword", "axe", "pickaxe", "shovel"]);
const SHEAR_BLOCKS = new Set([5, 71, 39, WEB]);
export const toolUses = (tool) => TOOL_KINDS.has(ITEMS[tool]?.kind);
// ItemStack.tryPlaceItemIntoWorld returned true: the branches of player-edit-simulation.js that place or apply the held item.
export const USE_BRANCHES = new Set(["place-block", "plant-crop", "plant-nether-wart", "use-flint-and-steel", "use-fire-charge", "use-spawn-egg", "use-bone-meal"]);
// EntityPlayer.addMovementStat/addMountedMovementStat use qh.a(double) (a float sqrt) and Math.round(float).
const length = (x, y, z) => f32(Math.sqrt(x * x + y * y + z * z));
const round = (v) => Math.floor(v + 0.5);
// A move longer than this in one tick is a teleport (portal, respawn, /tp, ender pearl): vanilla never reports one as movement.
export const TELEPORT_SQUARED = 100;

// EntityPlayer.addMovementStat (yz.k): called after each player move with the delta and the state the move left.
//   dive: head in water, swim: in water, ladder: on a ladder, ground: onGround, else the airborne fly stat.
export function addMovementStat(stats, { dx, dy, dz, dive = false, swim = false, ladder = false, ground = false }) {
  if (dive) {
    const i = round(length(dx, dy, dz) * 100);
    if (i > 0) stats.increment(STAT.dive, i);
  } else if (swim) {
    const i = round(length(dx, 0, dz) * 100);
    if (i > 0) stats.increment(STAT.swim, i);
  } else if (ladder) {
    if (dy > 0) stats.increment(STAT.climb, round(dy * 100));
  } else if (ground) {
    const i = round(length(dx, 0, dz) * 100);
    if (i > 0) stats.increment(STAT.walk, i);
  } else {
    const i = round(length(dx, 0, dz) * 100);
    if (i > 25) stats.increment(STAT.fly, i);
  }
}
// EntityPlayer.addMountedMovementStat (yz.l): the whole 3D distance by the class of the vehicle.
export function addMountedMovementStat(stats, { dx, dy, dz, kind }) {
  const i = round(length(dx, dy, dz) * 100);
  if (i > 0 && STAT[kind]) stats.increment(STAT[kind], i);
}
// The vehicle a rider.vehicle record is: a boat, a pig or horse steed, else a minecart.
export function vehicleKind(vehicle) {
  if (!vehicle) return null;
  if (vehicle.boat) return "boat";
  const type = vehicle.entity?.type;
  if (type === "pig") return "pig";
  if (vehicle.horse || type === "horse") return "horse";
  return "minecart";
}
// EntityPlayer.fall (yz.b): a landing of 2 or more blocks outside Creative flight adds round(distance * 100).
export function addFallStat(stats, distance, creative) {
  if (!creative && distance >= 2) stats.increment(STAT.fall, round(f32(distance) * 100));
}
// EntityPlayer.attackEntityFrom adds round(amount * 10) damage taken before the invulnerability frames reject it.
export const damageTenths = (amount) => round(f32(amount) * 10);

// The live observer for one world: owns the previous-position state and the last mob that hurt the player.
export class StatsLive {
  constructor(stats) {
    this.stats = stats;
    this.ticks = 0;
    this.attacker = null; // { type, tick } of the last mob hit on the player (CombatTracker.func_94550_c)
  }
  // Once per game tick after the player moved (EntityPlayer.onUpdate: minutesPlayed; nh.processPlayer: the movement stat).
  tick({ oldPosition, position, vehicle = null, eyeInWater = false, inWater = false, onLadder = false, grounded = false }) {
    this.ticks++;
    const { stats } = this;
    stats.increment(STAT.playOneMinute);
    const dx = position.x - oldPosition.x, dy = position.y - oldPosition.y, dz = position.z - oldPosition.z;
    if (dx * dx + dy * dy + dz * dz > TELEPORT_SQUARED) return;
    const kind = vehicleKind(vehicle);
    if (kind) addMountedMovementStat(stats, { dx, dy, dz, kind });
    else addMovementStat(stats, { dx, dy, dz, dive: eyeInWater, swim: inWater, ladder: onLadder, ground: grounded });
  }
  // EntityPlayerMP.onDeath: deaths, and the killedBy stat of the most recent mob attacker (within the combat window of 300 ticks).
  death() {
    this.stats.increment(STAT.deaths);
    if (this.attacker && this.ticks - this.attacker.tick <= 300) this.stats.killedBy(this.attacker.type);
    this.attacker = null;
  }
  hurtBy(type) { this.attacker = { type, tick: this.ticks }; }
  // Survival hooks: jump (EntityPlayer.jump) and damage taken.
  bind(survival) {
    survival.onJump = () => this.stats.increment(STAT.jump);
    survival.onDamageTaken = (amount) => this.stats.increment(STAT.damageTaken, damageTenths(amount));
  }
  drop() { this.stats.increment(STAT.drop); }
  leaveGame() { this.stats.increment(STAT.leaveGame); }
  // EntityFishHook: `events` of fishing-simulation.js carry the stat id of each catch.
  fishing(fishing) { for (const e of fishing.events.splice(0)) this.stats.increment(e.stat); }
  // ItemStack.onBlockDestroyed (use) and Block.harvestBlock (mineBlock) after a Survival break; the tool's wear comes after both.
  harvested({ block, meta = 0, tool = 0, harvest = false }) {
    const kind = ITEMS[tool]?.kind;
    if (toolUses(tool) || (kind === "shears" && SHEAR_BLOCKS.has(block))) this.stats.use(originalItem(tool));
    if (harvest) this.stats.mineBlock(originalBlock(block, meta));
  }
  // EntityLivingBase.renderBrokenItemStack: the stack's item ran out (ItemStack.damageItem: breakItem).
  broken(id) { if (id) this.stats.breakItem(originalItem(id)); }
  crafted(stack, amount) { if (stack?.id) this.stats.craft(originalItem(stack.id), amount ?? stack.count ?? 1); }
  // ItemStack.tryPlaceItemIntoWorld through the player edit dispatcher.
  placed(acted, heldTool) { if (acted && USE_BRANCHES.has(acted.branch) && heldTool) this.stats.use(originalItem(heldTool)); }
}

// Wraps mob events on an EntityWorld instance (the same seam achievements-live.js watchMobs uses): kills credited to the player
// (EntityPlayer.addToPlayerScore + onKillEntity), damage dealt by the player's melee hits, breeding by the player's feeding and
// the mob hits on the player (for killedBy). `ctx.live` is the StatsLive.
export function watchMobStats(mobs, { live }) {
  const { stats } = live, death = mobs.onDeath, attack = mobs.attack, baby = mobs.spawnBaby, hit = mobs.hitPlayer;
  mobs.onDeath = function (e, source = {}) {
    const result = death.call(this, e, source);
    if (source.player) {
      stats.increment(STAT.mobKills);
      stats.kill(e.type);
    }
    return result;
  };
  mobs.attack = function (e, tool, ...rest) {
    const before = e.health, landed = attack.call(this, e, tool, ...rest);
    if (landed && before > e.health) stats.increment(STAT.damageDealt, round(f32(before - e.health) * 10));
    if (landed && toolUses(tool)) stats.use(originalItem(tool)); // ItemStack.hitEntity
    return landed;
  };
  mobs.spawnBaby = function (a, b) {
    const born = baby.call(this, a, b);
    if (born) stats.increment(STAT.animalsBred);
    return born;
  };
  if (typeof hit === "function") {
    mobs.hitPlayer = function (e, survival) {
      const result = hit.call(this, e, survival);
      if (result) live.hurtBy(e.type);
      return result;
    };
  }
}

// EntityPlayer.dropPlayerItem: one drop per thrown stack (also the death scatter).
export function watchDrops(items, live) {
  const drop = items.dropPlayer;
  items.dropPlayer = function (...args) {
    live.drop();
    return drop.apply(this, args);
  };
}
