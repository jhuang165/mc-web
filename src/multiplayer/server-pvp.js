// Batch 63 mppvp: player-versus-player on the dedicated server.
// - `pvp` is the server property (server.properties `pvp`, default true; MinecraftServer.isPVPEnabled `ab`). Here it is `--pvp true|false` / MC_WEB_PVP, `sim.pvp`.
//   EntityPlayerMP.attackEntityFrom (mw.a, bytecode-read) refuses a hit whose source is an EntityDamageSource (melee, arrows, splash potions and thorns reach it through the indirect
//   subclass) whose attacker or arrow shooter is a player when `canAttackPlayer` (mw.a(yz)) is false: PvP off, or (scoreboard teams, not on this server yet) a team without friendly fire.
//   `sim.damagePlayer` calls `allows(from)`; every hit with a player `from` goes through it.
// - C02 attack on a player (`attackPlayer`): NetHandlerPlayServer.processUseEntity (reach below), then EntityPlayer.attackTargetEntityWithCurrentItem (yz.r, bytecode-read and executed by
//   tools/probes/PvpAttackProbe.java, public/research/pvp-reference.json): the attackDamage attribute (1 + the held weapon's modifier, Weakness/Strength through Effects.attackDamage), x 1.5 on a
//   critical hit (falling, not on the ground / a ladder / in water, not blind, not riding), plus Sharpness (Smite and Bane add nothing against a player), the DamageSource causePlayerDamage
//   (not difficulty scaled: EntityDamageSource.isDifficultyScaled excludes players), knockBack (0.4) on a fresh hit, then on a landed hit the Knockback + sprint push and the attacker's
//   motion * 0.6 with sprinting off, Thorns of the victim, the weapon's durability (only on a landed hit), 0.3 exhaustion; Fire Aspect burns 4 s per level on a landed hit.
import { heldAttackDamage } from '../entities.js';
import { weaponEnchantments } from '../enchantment-effects.js';
import { criticalDamage, isCritical } from '../player-movement.js';
import { queueVelocity } from '../player-knockback.js';
import { rayTraceBlocks } from '../buckets.js';
import { ITEMS } from '../survival.js';
import { mhSin, mhCos } from '../lighting.js';
import { STAT } from '../stats.js';

const f = Math.fround, EYE = 1.62, TOOLS = ['sword', 'axe', 'pickaxe', 'shovel'];

export class ServerPvp {
  constructor(sim) { this.sim = sim; }
  /** MinecraftServer.isPVPEnabled. */
  get enabled() { return this.sim.pvp !== false; }
  /** EntityPlayerMP.canAttackPlayer for a DamageSource entity `from` (a plain object: `isPlayer`); other attackers are never refused. */
  allows(from) { return !from?.isPlayer || this.enabled; }
  /** The DamageSource entity of a player attacker as the combat tracker and the knockback read it. */
  fromOf(p) { return { x: p.position.x, y: p.position.y, z: p.position.z, type: 'player', isPlayer: true, name: p.name, playerId: p.id, held: p.survival.held ?? undefined }; }
  /**
   * NetHandlerPlayServer.processUseEntity: the target must exist and not be the sender; the squared distance (feet to feet, Entity.getDistanceSqToEntity) must be below 36, below 9 when the
   * attacker's eyes cannot see the target's eyes (Entity.canEntityBeSeen: World.rayTraceBlocks eye to eye). A dead player or one in another dimension is not an entity of this world.
   */
  inReach(p, v) {
    if (!v || v === p || v.dead || v.survival.health <= 0 || (v.dimension | 0) !== (p.dimension | 0)) return false;
    const dx = v.position.x - p.position.x, dy = v.position.y - p.position.y, dz = v.position.z - p.position.z;
    const seen = !rayTraceBlocks(p.world, [p.position.x, p.position.y + EYE, p.position.z], [v.position.x, v.position.y + EYE, v.position.z], false, false);
    return dx * dx + dy * dy + dz * dz < (seen ? 36 : 9);
  }
  /** C02 attack by player `p` on the player with wire id `targetId`. True when the hit landed (health damage dealt). */
  attack(p, targetId) {
    const v = this.sim.players.get(targetId), sim = this.sim;
    if (!p || p.dead || p.survival.health <= 0 || !this.inReach(p, v)) return false;
    const s = p.survival, vs = v.survival, tool = s.held?.id ?? 0, item = ITEMS[tool], owned = s.creative || s.count(tool) > 0, held = owned && s.held?.id === tool ? s.held : null;
    const weapon = weaponEnchantments(held, 'player'); // Smite / Bane of Arthropods only add against undead / arthropods
    let damage = heldAttackDamage(tool, s);
    if (!(damage > 0 || weapon.damage > 0)) return false; // `if (f > 0 || f1 > 0)`: Weakness II on an empty hand does nothing at all
    let push = weapon.knockback + (p.motion?.sprinting ? 1 : 0);
    const critical = isCritical({ fallDistance: p.fallDistance ?? 0, onGround: !!p.grounded, inWater: !!p.inWater, blind: !!s.effects?.has?.(15), riding: !!p.mount });
    if (critical && damage > 0) damage = criticalDamage(damage);
    damage = f(damage + weapon.damage);
    const ignite = weapon.fireAspect > 0 && !(vs.fire > 0);
    if (ignite) vs.setFire(1); // undone below when the hit does not land
    const from = this.fromOf(p), health = vs.health;
    const landed = sim.damagePlayer(v, damage, { name: 'player', from, call: () => vs.damage(damage, 'a player', true, 'player', from) }) !== false;
    if (landed) {
      if (push > 0 && Number.isFinite(p.yaw)) {
        const rad = f(f(f(180 - p.yaw * (180 / Math.PI)) * f(Math.PI)) / 180); // Java yaw = 180 - the view yaw in degrees
        queueVelocity(vs, f(f(-mhSin(rad) * push) * 0.5), 0.1, f(f(mhCos(rad) * push) * 0.5)); // after the hit's own knockBack, as the queue keeps the order
        p.velocity.x *= 0.6; p.velocity.z *= 0.6;
        if (p.motion) p.motion.sprinting = false;
      }
      vs.thorns?.({ // EnchantmentHelper.func_151384_a(victim, attacker): the victim's Thorns hurt the attacker
        hurt: n => sim.damagePlayer(p, n, { name: 'thorns', from: this.fromOf(v), call: () => s.damage(n, 'thorns', true, 'thorns', this.fromOf(v)) }),
        sound: () => sim.soundsOut?.push({ name: 'damage.thorns', x: p.position.x, y: p.position.y, z: p.position.z, volume: 0.5, pitch: 1, dim: p.dimension | 0 }),
      });
      (sim.events ??= []).push({ type: 'pvpHit', id: p.id, victim: v.id, damage: Math.round(f(damage * 10)), dealt: f(health - vs.health) }); // the damageDealt statistic (mpstats)
      sim.stats?.add(p, STAT.damageDealt, Math.round(f(damage * 10))); // b63 lead: EntityPlayer.attackTargetEntityWithCurrentItem addStat(damageDealtStat, round(f * 10)) for a living target
      if (owned && TOOLS.includes(item?.kind)) s.wear(tool, item.kind === 'sword' ? 1 : 2); // ItemStack.hitEntity
      s.exhaust(0.3);
    }
    if (weapon.fireAspect > 0 && landed) vs.setFire(weapon.fireAspect * 4);
    else if (ignite) vs.fire = 0; // Entity.extinguish
    return landed;
  }
}

/** Ray against the 0.6 x 1.8 box of each other player's copy (the client's aim for C02): the nearest { id, distance } within `reach`, or null. */
export function pickPlayer(entries, origin, dir, reach) {
  let best = null;
  for (const [id, e] of entries) {
    const p = e.state ?? e.last;
    if (!p || p.dead) continue;
    const lo = [p.x - 0.3, p.y - (p.ySize ?? 0), p.z - 0.3], hi = [p.x + 0.3, p.y - (p.ySize ?? 0) + 1.8, p.z + 0.3], o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    let near = 0, far = reach;
    for (let i = 0; i < 3 && near <= far; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) near = Infinity; continue; }
      let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
    }
    if (near <= far && (!best || near < best.distance)) best = { id, distance: near };
  }
  return best;
}
