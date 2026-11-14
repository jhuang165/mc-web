// Per-player statistics of the dedicated world (batch 63 mpstats): StatisticsFile (pg) of the server, EntityPlayerMP.addStat and S37 (gd, "statistics").
//
// Every server player owns a `Stats` (src/stats.js, the table and file shape single player uses) in `p.stats`, saved in the player record as `stats` (a flat { statId: int } object,
// like the achievements in `achievements`). The awards reuse the single-player observers in stats-live.js (`StatsLive` per player: movement, play time, jump, damage taken, deaths)
// and hook the server's own events for the rest (mob kills, damage dealt, breeding, crafting, mining, tool use and wear, drops).
//
// Entry points (all take the server player record `p`; `sim.stats` is this object):
//   add(p, id, n = 1)       StatisticsFile.func_150871_b / EntityPlayerMP.addStat for any known stat id (STAT.* of stats.js): the hook other tracks call, e.g. stats.add(p, STAT.playerKills).
//   tick(p, moved)          once per server tick after the player moved and ServerSurvival ran (simulation.tick): play time, movement, landing.
//   mounted(p, mount)       the mounted distance (vehicles tick); `mount` is p.mount.
//   death(p)                EntityPlayerMP.onDeath: deaths and the killed-by stat of the last mob attacker.
//   crafted(p, stack, n)    SlotCrafting / SlotFurnace.onCrafting.   harvested(p, info) Block.harvestBlock + ItemStack.onBlockDestroyed.   broken(p, id) item ran out.
//   used(p, id)             ItemStack.tryPlaceItemIntoWorld returned true for a placed block or applied item.
//   watchMobs(mobs)         ServerMobs: kills credited to `sim.achievements.attacker`, damage dealt, tool hits, animalsBred (the breeder is the attacker of the call), mob hits for killedBy.
//   watchItems(items)       EntityPlayer.dropPlayerItem (the player is found by the position object the drop was given).
//   request(p)              C16 action 1 (REQUEST_STATS): the S37 message `{ type: 'stats', stats: { id: value }, full }` for this player, or null.
// Bytecode-read (javap on the 1.7.10 jar): pg.b(player, stat, n) adds to the value and puts the stat into the dirty set (pg.e); pg.d() puts every known stat into it; pg.c() returns a copy
// of the dirty set, clears it and clears the announce flag (pg.g); pg.a(mw) sends S37 with `value` of every stat in c() only when the announce flag is set or more than 300 ticks passed
// since the last send (pg.f starts at -300), else S37 with an empty map. C16 action 1 calls pg.a(mw). So a second request within 15 seconds answers with nothing.
import { Stats, STAT, entityName } from '../stats.js';
import { StatsLive, addFallStat, addMountedMovementStat, toolUses, originalItem, damageTenths } from '../stats-live.js';
import { eyeInWater } from '../fluids.js';
import { countsVertical } from '../ladders.js';
import { PHYSICS } from '../world.js';

export const STATS_INTERVAL = 300; // pg.a(mw): ticks between two S37 that carry stats
const mountKind = m => (m?.mob ? 'pig' : m?.boat ? 'boat' : 'minecart');

export class ServerStats {
  constructor(sim) { this.sim = sim; }
  get ticks() { return this.sim.ticks | 0; }

  // A player record joins (addPlayer): the saved stats load, and pg.d() marks all of them dirty for the first S37.
  join(p, saved) {
    const stats = p.stats = new Stats(saved?.stats), net = p.statsNet = { dirty: new Set(stats.values.keys()), last: -STATS_INTERVAL };
    stats.onIncrement = id => net.dirty.add(id);
    p.statsLive = new StatsLive(stats);
    p.statsLive.bind(p.survival); // EntityPlayer.jump and attackEntityFrom: the jump and damage taken stats
    return stats;
  }
  leave(p) { this.add(p, STAT.leaveGame); } // ServerConfigurationManager.playerLoggedOut
  savedFields(p) { const s = p.stats?.save(); return s && Object.keys(s).length ? { stats: s } : {}; }

  add(p, id, n = 1) { p?.stats?.increment(id, n); return !!p?.stats; }

  // The values of one S37: `full` is the first send after the join (the client replaces its copy), later ones are the changed stats only.
  request(p) {
    if (!p?.stats) return null;
    const net = p.statsNet, now = this.ticks, send = now - net.last > STATS_INTERVAL;
    const full = !net.sentOnce;
    const stats = {};
    if (send) { net.last = now; net.sentOnce = true; for (const id of net.dirty) stats[id] = p.stats.get(id); net.dirty.clear(); }
    return { type: 'stats', stats, full: full && send };
  }

  tick(p, moved) {
    if (!p.stats || p.dead) return;
    if (p.mount) { p.stats.increment(STAT.playOneMinute); return; } // the vehicle tick adds the mounted distance (`mounted`)
    const at = p.position, world = p.world ?? this.sim.world;
    if (p.grounded) addFallStat(p.stats, p.landedFall || 0, p.survival.creative); // EntityPlayer.fall
    p.statsLive.tick({
      oldPosition: moved?.oldPosition ?? p.previous, position: at, eyeInWater: eyeInWater(world, at.x, at.y + PHYSICS.eye, at.z), inWater: !!moved?.inWater,
      onLadder: !p.flying && countsVertical(world, at.x, at.y, at.z), grounded: !!p.grounded,
    });
  }
  mounted(p, mount) {
    const at = p.position, prev = p.previous;
    if (!p.stats || !mount) return;
    addMountedMovementStat(p.stats, { dx: at.x - prev.x, dy: at.y - prev.y, dz: at.z - prev.z, kind: mountKind(mount) });
  }
  death(p) { p.statsLive?.death(); }

  crafted(p, stack, n) { p?.statsLive?.crafted(stack, n); }
  harvested(p, info) { p?.statsLive?.harvested(info); }
  broken(p, id) { if (id) p?.statsLive?.broken(id); }
  used(p, id) { if (id && p?.stats) p.stats.use(originalItem(id)); }

  watchItems(items) {
    const drop = items.dropPlayer, self = this;
    items.dropPlayer = function (stack, position, ...rest) {
      for (const q of self.sim.players.values()) if (q.position === position) { q.statsLive?.drop(); break; }
      return drop.call(this, stack, position, ...rest);
    };
  }

  watchMobs(mobs) {
    const sim = this.sim, attacker = () => sim.achievements?.attacker ?? null;
    const death = mobs.onDeath, attack = mobs.attack, baby = mobs.spawnBaby, hit = mobs.hitPlayer;
    // b64: EntityLivingBase.onDeath credits func_94060_bK(), the CombatTracker's best attacker (rn.c, bytecode-read): the player who did the most damage, whatever killed the mob
    // (fire, a fall). The tracker forgets after 100 quiet ticks; recentlyHit (100, set by a player's hit) is its stand-in here. `combat` keeps each player's damage on the mob.
    const combat = new WeakMap(), damageEntity = mobs.damageEntity;
    if (typeof damageEntity === 'function') mobs.damageEntity = function (e, amount, name, source, ...rest) {
      const p = source?.player ? attacker() : null, before = e.health, result = damageEntity.call(this, e, amount, name, source, ...rest);
      if (p?.stats) {
        let row = combat.get(e);
        if (!row || !(e.recentlyHit > 0)) combat.set(e, row = new Map());
        row.set(p, (row.get(p) ?? 0) + Math.max(0, before - e.health));
      }
      return result;
    };
    const credited = (e, source) => {
      const row = combat.get(e); combat.delete(e);
      let best = null, most = -1;
      if (row && e.recentlyHit > 0) for (const [q, d] of row) if (d > most && sim.players.get(q.id) === q) { best = q; most = d; } // a strictly greater total replaces: the first of equals wins
      return best ?? (source.player ? attacker() : null);
    };
    mobs.onDeath = function (e, source = {}) {
      const result = death.call(this, e, source), p = credited(e, source);
      if (p?.stats) { p.stats.increment(STAT.mobKills); p.stats.kill(e.type); }
      return result;
    };
    mobs.attack = function (e, tool, ...rest) {
      const landed = attack.call(this, e, tool, ...rest), p = attacker();
      if (landed && p?.stats) {
        p.stats.increment(STAT.damageDealt, damageTenths(this.lastAttackDamage)); // b64: round(f * 10) of the pre-armour damage, as the PvP path (bytecode-read yz.f)
        if (toolUses(tool)) p.stats.use(originalItem(tool)); // ItemStack.hitEntity
      }
      return landed;
    };
    mobs.spawnBaby = function (a, b) {
      const born = baby.call(this, a, b), p = attacker();
      if (born && p?.stats) p.stats.increment(STAT.animalsBred); // EntityAnimal.func_146082_f's breeder (set by ServerMobs.spawnBaby)
      return born;
    };
    if (typeof hit === 'function') {
      mobs.hitPlayer = function (e, survival) {
        const result = hit.call(this, e, survival);
        if (result) for (const v of sim.mobs?.views?.values?.() ?? []) if (v.survival === survival) { v.player?.statsLive?.hurtBy(e.type); break; }
        return result;
      };
    }
  }
}
export { entityName };
