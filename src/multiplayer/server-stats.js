// Statistics and achievements on the gun server (not 1.7.10 networking): as in a 1.7.10 dedicated server, each player's
// StatisticsFile lives on the server, saved with its account. The single-player observers count here: StatsLive (stats-live.js)
// for movement, jumps, damage, deaths, drops, harvests, crafting, item use and fishing, and the EntityPlayer.triggerAchievement call
// sites (achievements-live.js) for crafting, smelting, pickups, mob kills, breeding, biomes and minecart rides. A tab asks for
// its numbers when it opens the Statistics screen (C16PacketClientStatus REQUEST_STATS -> S37PacketStatistics); an unlock reaches
// every tab as one event (the chat.type.achievement line) and its own player's tab draws the toast; a potion taken from a brewing
// stand counts (server-stations.js), as do a full beacon (server-stations.js), the portals (server-dimensions.js), the Wither
// (spawnWither below) and a diamond thrown to another player (pickedUp).
import { Stats, STAT } from '../stats.js';
import { StatsLive, addFallStat, damageTenths, toolUses, originalItem } from '../stats-live.js';
import { Achievements, BY_ID, OVERKILL_DAMAGE, SNIPE_DISTANCE_SQUARED } from '../achievements.js';
import { IMOB, ITEM, craftedAchievement, smeltedAchievement, pickedAchievement, overkillDamage, pigFall } from '../achievements-live.js';
import { WITHER } from '../wither-rules.js';
import { PHYSICS } from '../world.js';
import { smeltExperience } from '../experience.js';
import { countsVertical } from '../ladders.js';
import { eyeInWater } from '../fluids.js';
import { playerEye } from './server-play.js';

const COWS = new Set(['cow', 'mooshroom']);

// Player p's StatisticsFile: its stats, its achievements and the StatsLive observer, from the saved account record.
export function playerStats(sim, p, saved = null) {
  p.stats = new Stats(saved?.stats ?? null);
  p.statsLive = new StatsLive(p.stats);
  p.achievements = new Achievements({ onUnlock: a => announce(sim, p, a.id) }).load(saved?.achievements ?? null);
  bindSurvival(p);
}
// The jump and damage-taken hooks on player p's current Survival (it is replaced by a mode change).
export function bindSurvival(p) { if (p.statsLive && p.survival) p.statsLive.bind(p.survival); }
export const saveStats = p => (p.stats ? { stats: p.stats.save(), achievements: p.achievements.save() } : {});
export const trigger = (p, id) => !!p?.achievements && BY_ID[id] && p.achievements.trigger(id);

// StatisticsFile.func_150873_a on an unlock: the chat line every player sees (ServerConfigurationManager.sendChatMsg), and the toast
// on the unlocking player's tab.
// To every player on the server, in every world (ServerConfigurationManager.sendChatMsg); a player mid-trip hears it on arrival.
function announce(sim, p, id) {
  const root = sim.root ?? sim, trip = root.dims?.transit.get(p.id);
  if (trip) trip.events.push({ type: 'achievement', id, by: p.name, self: true });
  for (const [q, s] of root.everyone?.() ?? [...sim.players.values()].map(q => [q, sim])) s.send(q, { type: 'achievement', id, by: p.name, self: q === p });
}

// The world-wide observers, installed once: dropped stacks, the mobs' deaths, hits and births, and the server's crafting slots.
export function watchServerStats(sim) {
  const items = sim.play.items, drop = items.dropPlayer;
  // EntityPlayer.func_146097_a: one drop per thrown stack (the Q key, a closed window's cursor, the death scatter).
  items.dropPlayer = function (stack, position, ...rest) {
    for (const p of sim.players.values()) if (p.position === position) { p.statsLive?.drop(); break; }
    return drop.call(this, stack, position, ...rest);
  };
  const mobs = sim.mobs, ew = mobs?.ew;
  if (!ew) return;
  const bySurvival = s => [...sim.players.values()].find(p => p.survival === s) ?? null;
  const death = ew.onDeath, attack = ew.attack, baby = ew.spawnBaby, hit = ew.hitPlayer, land = ew.onLand;
  // EntityLivingBase.onDeath -> EntityPlayer.addToPlayerScore and onKillEntity, for the player whose hit it was (the one the mob
  // AI sees: ServerMobs.see runs before every player's melee, shot, arrow and throw).
  ew.onDeath = function (e, source = {}) {
    const result = death.call(this, e, source), p = source.player ? mobs.current : null;
    if (p?.stats) {
      p.stats.increment(STAT.mobKills); p.stats.kill(e.type);
      if (IMOB.has(e.type)) trigger(p, 'killEnemy');
      if (e.type === 'wither') trigger(p, 'killWither');
      if (e.type === 'ghast' && source.name === 'fireball') trigger(p, 'ghast');
      if ((e.type === 'skeleton' || e.type === 'wither_skeleton') && source.projectile && (p.position.x - e.x) ** 2 + (p.position.z - e.z) ** 2 >= SNIPE_DISTANCE_SQUARED) trigger(p, 'snipeSkeleton');
    }
    return result;
  };
  // EntityPlayer.attackTargetEntityWithCurrentItem: damageDealt, the weapon's use stat and overkill.
  ew.attack = function (e, tool, survival, player, extraKnockback, critical, info) {
    const p = bySurvival(survival), before = e.health, damage = p ? overkillDamage(e, tool, survival, critical) : 0;
    const landed = attack.call(this, e, tool, survival, player, extraKnockback, critical, info);
    if (p?.stats && landed) {
      if (before > e.health) p.stats.increment(STAT.damageDealt, damageTenths(before - e.health));
      if (toolUses(tool)) p.stats.use(originalItem(tool)); // ItemStack.hitEntity: a sword's or tool's use stat
      if (damage >= OVERKILL_DAMAGE) trigger(p, 'overkill');
    }
    return landed;
  };
  // EntityAnimal.procreate credits the player who fed the animal; this port does not keep that player, so the nearest one is credited.
  ew.spawnBaby = function (a, b) {
    const born = baby.call(this, a, b), p = born ? mobs.current : null;
    if (p?.stats) { p.stats.increment(STAT.animalsBred); if (COWS.has(a.type)) trigger(p, 'breedCow'); }
    return born;
  };
  // EntityPig.fall: more than five blocks with a player riding.
  ew.onLand = function (e, distance) {
    land?.call(this, e, distance);
    if (e.type !== 'pig') return;
    for (const p of sim.players.values()) if (p.rider?.vehicle?.entity === e && pigFall(distance, true)) trigger(p, 'flyPig');
  };
  // A mob's hit on a player: the killedBy stat of a death within the combat window.
  ew.hitPlayer = function (e, survival) {
    const result = hit.call(this, e, survival);
    if (result) bySurvival(survival)?.statsLive?.hurtBy(e.type);
    return result;
  };
}

// SlotCrafting.onCrafting for player p's crafting grids (the inventory's 2 x 2 and a workbench).
export function watchCrafting(p, container) {
  container.onCraft = (stack, n) => { const id = craftedAchievement(stack?.id); if (id) trigger(p, id); p.statsLive?.crafted(stack, n); };
  return container;
}
// SlotFurnace.onCrafting for player p: the smelting achievements, the crafted stat and the experience, rounded up by chance,
// as orbs at the player.
export function furnaceTaken(sim, p) {
  return (stack, amount) => {
    const id = smeltedAchievement(stack?.id);
    if (id) trigger(p, id);
    p.statsLive?.crafted(stack, amount);
    if (p.survival.creative || !sim.mobs) return;
    const f = smeltExperience(stack);
    let n = amount;
    if (f === 0) n = 0;
    else if (f < 1) {
      const raw = Math.fround(amount * f);
      n = Math.floor(raw);
      if (n < Math.ceil(raw) && sim.random() < raw - n) n++;
    }
    if (n > 0) sim.mobs.orbs.spawn(n, { x: p.position.x, y: p.position.y + 0.5, z: p.position.z + 0.5 });
  };
}

// EntityPlayer.fall, before the landing resets landedFall (player-environment.js finishPlayerMovement).
export function fallStat(p) { if (p.stats && p.grounded) addFallStat(p.stats, p.landedFall ?? 0, p.survival.creative); }
// After player p moved (NetHandlerPlayServer.processPlayer -> addMovementStat, EntityPlayer.onUpdate -> minutesPlayed and the
// biome and minecart achievements). `from` is where it stood before the move.
export function tickPlayerStats(sim, p, from) {
  const live = p.statsLive;
  if (!live) return;
  const at = p.position, vehicle = p.rider?.vehicle ?? null, world = sim.world;
  live.tick({ oldPosition: from, position: at, vehicle, eyeInWater: eyeInWater(world, at.x, playerEye(p).y, at.z), inWater: !!p.inWater,
    onLadder: !p.flying && countsVertical(world, at.x, at.y, at.z), grounded: !!p.grounded });
  const a = p.achievements;
  if (live.ticks % 20 === 0) a.visit(world.biomeAt?.(Math.floor(at.x), Math.floor(at.z))?.name, 0);
  if (vehicle && !vehicle.boat && !vehicle.horse) a.rideMinecart(at.x, at.y, at.z); else a.stopRiding();
}
// EntityLivingBase.renderBrokenItemStack on the server's side: the depleted stat and random.break for the players nearby.
export function brokenTool(sim, p) {
  const id = p.survival.broken;
  if (!id) return;
  p.statsLive?.broken(id);
  p.survival.broken = 0;
  sim.mobs?.sound({ sound: 'random.break', volume: 0.8, pitch: Math.fround(0.8 + Math.fround(sim.random() * 0.4)), position: { x: p.position.x, y: p.position.y, z: p.position.z } });
  sim.near(p, { type: 'crumbs', id, by: p.id }, true); // the 5 iconcrack pieces from its eye
}
// EntityPlayerMP.onDeath: deaths and killedBy; a player who killed another (EntityPlayer.addToPlayerScore) gets playerKills.
export function deathStats(p, killer = null) {
  p.statsLive?.death();
  if (killer?.stats && killer !== p) killer.stats.increment(STAT.playerKills);
}
// The pickups' achievements (EntityItem.onCollideWithPlayer): the picked item's, then Diamonds to you! for the player who threw a
// diamond (EntityItem.func_145800_j, the Q key's thrower name) when someone else in its world picks it up.
export function pickedUp(sim, p, item) {
  const stack = item?.stack, id = pickedAchievement(stack?.id);
  if (id) trigger(p, id);
  if (stack?.id !== ITEM.diamond || !item.thrower) return;
  const thrower = [...sim.players.values()].find(q => q.name === item.thrower); // World.getPlayerEntityByName
  if (thrower && thrower !== p) trigger(thrower, 'diamondsToYou');
}
// BlockSkull.func_149965_a: the Wither spawns, and every player whose box meets the Wither's grown by 50 gets The Beginning? (the
// dead too: they stay in World.playerEntities until they respawn).
export function spawnWither(sim, x, y, z, yaw) {
  const e = sim.mobs?.ew?.spawnWither(x, y, z, yaw);
  if (!e) return null;
  const hw = WITHER.width / 2 + 50, pw = PHYSICS.width / 2;
  for (const p of sim.players.values()) {
    const { x: px, y: py, z: pz } = p.position;
    if (px + pw > e.x - hw && px - pw < e.x + hw && py + PHYSICS.height > e.y - 50 && py < e.y + WITHER.height + 50 && pz + pw > e.z - hw && pz - pw < e.z + hw) trigger(p, 'spawnWither');
  }
  return e;
}
// S37PacketStatistics: every stat of player p (the tab's Statistics screen).
export const statsMessage = p => ({ type: 'stats', stats: p.stats?.save() ?? {} });
// What player p's tab mirrors of its achievements: the unlocked ids, sent when they change.
export const achievementList = p => (p.achievements ? [...p.achievements.unlocked] : []);
