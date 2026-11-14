// Batch 65 mpstats3: the kill credit of EntityLivingBase.onDeath, ported from the 1.7.10 bytecode (rn = CombatTracker, rm = CombatEntry, sv.aX = func_94060_bK) and
// replayed against the executed records in public/research/combat-best-reference.json (tools/probes/CombatBestProbe.java).
//
// EntityLivingBase.damageEntity ends in CombatTracker.func_94547_a(source, healthBefore, amount) (amount after armour, potions and absorption; nothing when it is 0):
//   * g() first: when entries exist and the victim is dead, or ticksExisted - lastEntryTick > (inCombat ? 300 : 100), the list is cleared and inCombat reset.
//     A killing hit therefore empties the list before its own entry goes in (the victim is already dead): only that hit counts.
//   * the entry stores the source's entity (DamageSource.getEntity: the shooter of an arrow, the thrower of a snowball or fishing hook), the amount and the tick; inCombat turns on
//     when that entity is an EntityLivingBase and the victim is alive.
// func_94550_c (rn.c) then walks the entries in order and keeps, per entry, the entity with the largest SINGLE amount (a strictly greater amount replaces, so the first of equals wins):
// the best EntityPlayer, and the best EntityLivingBase (players are living too). It returns the player when playerAmount >= livingAmount / 3 (float), else the living one, else null.
// sv.aX (func_94060_bK) is that, else attackingPlayer (field aR, the last player to hit, valid while recentlyHit > 0), else the revenge target (field i, any living attacker of the
// last 100 ticks, and only while it lives: b67 bytecode-read sv.C (the victim's per-tick update) clears `i` through setRevengeTarget(null) when the target is not alive (sv.Z, isEntityAlive)
// or ticksExisted - revengeTimer > 100; sv.aX itself returns the field unchecked, and attackingPlayer (aR) is returned unchecked too, cleared only when recentlyHit runs out). onDeath calls aX() first: addToPlayerScore on it (mobKills / playerKills, only a player has one), then Entity.onKillEntity on source.getEntity() (kill-by-type stat).
const f = Math.fround;

export class CombatTrackerPort {
  constructor() { this.entries = []; this.last = 0; this.inCombat = false; this.has = false; this.lethal = false; }
  // CombatTracker.func_94549_h (rn.g)
  expire(now, alive) {
    const window = this.inCombat ? 300 : 100;
    if (this.has && (!alive || now - this.last > window)) { this.has = false; this.inCombat = false; this.entries.length = 0; }
  }
  // CombatTracker.func_94547_a (rn.a(ro, F, F)); `by` is { player: record|null, living: bool } of the source's entity, or null.
  add(by, damage, now, alive) {
    this.expire(now, alive);
    this.entries.push({ by, damage: f(damage) });
    this.last = now; this.has = true;
    if (!alive) this.lethal = true;
    if (by?.living && !this.inCombat && alive) this.inCombat = true;
  }
  // CombatTracker.func_94550_c (rn.c): { player, living } where `living` is the returned entry's attacker; null when none.
  best() {
    let player = null, living = null, playerDamage = 0, livingDamage = 0;
    for (const { by, damage } of this.entries) {
      if (by?.isPlayer && (!player || damage > playerDamage)) { playerDamage = damage; player = by; }
      if (by?.living && (!living || damage > livingDamage)) { livingDamage = damage; living = by; }
    }
    if (player && !(playerDamage < f(livingDamage / 3))) return player;
    return living;
  }
}

// One victim's CombatTracker plus the two fallbacks of sv.aX. `by` is { isPlayer, living, p } (the source's entity) or null.
export class KillCredit {
  constructor() { this.tracker = new CombatTrackerPort(); this.aR = null; this.revenge = null; this.revengeAt = 0; }
  // The effects of one counted hit (damageEntity; `damage` is 0 when nothing was dealt, which the tracker ignores) and of EntityLivingBase.attackEntityFrom's attacker bookkeeping.
  hit(by, damage, now, alive) {
    if (damage) this.tracker.add(by, damage, now, alive);
    if (by?.living) { this.revenge = by; this.revengeAt = now; } // func_70604_c
    if (by?.isPlayer) this.aR = by; else if (by?.tamedWolf) this.aR = null; // attackingPlayer (a tamed wolf's hit sets recentlyHit but not the player)
  }
  // sv.aX(): the entry that gets the score, or null. `recentlyHit` is the victim's counter (> 0 while attackingPlayer stands). `revengeAlive(by)` is the revenge target's
  // isEntityAlive: a dead one has been dropped by the victim's tick (checked here, at the moment of the kill; an attacker that died after the victim's last tick is counted dead).
  killer(now, recentlyHit, alive, revengeAlive = () => true) {
    if (!this.tracker.lethal && !alive) this.tracker.expire(now, false); // a death that skipped damageEntity: the lethal entry would have emptied the list
    const best = this.tracker.best();
    if (best) return best;
    if (recentlyHit > 0 && this.aR) return this.aR;
    if (this.revenge && now - this.revengeAt <= 100 && revengeAlive(this.revenge)) return this.revenge;
    return null;
  }
}
