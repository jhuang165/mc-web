// CombatTracker (rn) and CombatEntry (rm) of Minecraft Java 1.7.10 for the player, and the death message CombatTracker.func_151521_b
// builds from them. The rules were executed on the unchanged classes by tools/probes/CombatTrackerProbe.java
// (public/research/combat-tracker-reference.json, replayed by src/combat-tracker.test.js); public/research/combat.md has the notes.
//
//   func_94547_a (EntityLivingBase.damageEntity calls it AFTER setting the new health): func_94549_h first, then the entry (damage taken after
//     armour and absorption, health before, ticksExisted, fall description, Entity.fallDistance). A hit that deals 0 adds none. A living
//     source entity on a living victim opens the "in combat" window (300 ticks instead of 100).
//   func_94549_h: when an entry was added and the victim is dead or the last entry is older than the window, the list empties. Because
//     func_94547_a runs it while the victim already has no health, a FATAL hit empties the earlier entries: a death message only ever
//     sees its own killing entry, so the death.fell assist/killer/finish texts (which need an earlier entry) can only appear for a
//     non-fatal state. The same method also runs every 20 ticks (EntityLivingBase.onUpdate), which changes nothing observable.
//   func_94548_b / the fall description: ladder or vines when the cell at the feet is one, else water when in water, else generic.
//   func_94550_c: the player that dealt the most damage if it dealt at least a third of the living maximum, else the living entity that
//     dealt the most (the first wins a tie). EntityLivingBase.func_94060_bK is that, else the attacking player (set for 100 ticks by a
//     player hit), else the revenge target (the last living source entity, cleared when dead or 100 ticks after the hit).
//   i(): the entry whose fall distance is the largest among fall/outOfWorld entries (outOfWorld counts as unbounded), taken as the entry
//     BEFORE it when there is one; it is used only when that distance exceeds 5.
import { entityDisplayName } from "./entity-names.js";
import { translate } from "./lang.js";

export const COMBAT_WINDOW = 100, IN_COMBAT_WINDOW = 300, REVENGE_TICKS = 100;
const f = Math.fround;

/** DamageSource type ("death.attack.<type>") of a Survival.damage reason when no entity is involved. */
const PLAIN = {
  burning: "onFire", lava: "lava", fire: "inFire", lightning: "inFire", "a fall": "fall", drowning: "drown", starvation: "starve",
  suffocation: "inWall", void: "outOfWorld", anvil: "anvil", fallingBlock: "fallingBlock", "a cactus": "cactus", poison: "magic", wither: "wither", magic: "magic",
  "an accident": "generic",
};
const PROJECTILE_REASONS = new Set(["an arrow", "an explosion", "fireball", "magic"]);
const articleless = (reason) => String(reason).replace(/^(an?|the) /i, "").trim().replace(/ /g, "_").toLowerCase();

/** The entity of a DamageSource: a name (Entity.func_145748_c_), whether it is a living entity (EntityLivingBase) and a player, and the
 *  named item it holds (EntityLivingBase.func_70694_bm, only a renamed stack counts). `held` is read when the message is built. */
function entity(raw, { self = false, projectile = null } = {}) {
  if (self) return { self: true, living: true, tracked: true, player: true, rawPlayer: (ctx) => ctx.rawName ?? ctx.name, name: (ctx) => ctx.name, held: (ctx) => ctx.selfItem ?? null };
  if (projectile) return { living: false, tracked: projectile === FIREBALL, player: false, name: () => translate(...projectile), held: () => null };
  const named = raw?.equipment?.[0]?.displayName ?? raw?.heldItem?.displayName ?? raw?.held?.displayName;
  // EntityPlayer.func_145748_c_ applies the scoreboard team (team-names.js); Entity.func_145748_c_ of any other entity is the plain name.
  return { raw, living: true, tracked: true, player: !!raw?.isPlayer, rawPlayer: () => (raw?.isPlayer ? raw.customName ?? raw.name ?? "Player" : null), name: () => (raw?.isPlayer && typeof raw.formattedName === "string" ? raw.formattedName : entityDisplayName(raw)), held: () => (typeof named === "string" && named ? named : null) };
}
const ARROW = ["entity.Arrow.name", "arrow"], FIREBALL = ["entity.SmallFireball.name", "Small Fireball"];
// EntityPotion has no "entity.ThrownPotion.name" key in en_US, so an ownerless thrown or indirectMagic source prints the raw key (probed).
const POTION = ["entity.ThrownPotion.name", "entity.ThrownPotion.name"];

/** DamageSource of a Survival.damage call. Returns { type, kind, entity }:
 *  kind "plain" (ro), "entity" (rp: EntityDamageSource, text takes the entity as %2$s, and the ".item" key when it holds a renamed item)
 *  or "indirect" (rq). `via.self` means the player's own projectile. */
export function damageSource(reason, source, from, via) {
  const own = via?.self ? entity(null, { self: true }) : null;
  if (source === "fireball" || reason === "fireball") {
    // DamageSource.causeFireballDamage: an owner gives "fireball"; without one the source is the onFire type with the fireball itself.
    const e = own ?? (from?.type ? entity(from) : null);
    return e ? { type: "fireball", kind: "indirect", entity: e } : { type: "onFire", kind: "indirect", entity: entity(null, { projectile: FIREBALL }) };
  }
  if (source === "explosion" || reason === "an explosion") {
    // DamageSource.setExplosion: with a living exploder it is "explosion.player" (an EntityDamageSource), else the plain "explosion".
    const e = own ?? (from?.type ? entity(from) : null);
    return e ? { type: "explosion.player", kind: "entity", entity: e } : { type: "explosion", kind: "plain", entity: null };
  }
  if (reason === "an arrow") {
    const e = own ?? (from?.type ? entity(from) : entity(null, { projectile: ARROW }));
    return { type: "arrow", kind: "indirect", entity: e };
  }
  // DamageSource.causeThornsDamage(wearer): an EntityDamageSource "thorns" whose entity is the wearer that was hit (the victim is the attacker).
  // Its text has no ".item" key, so a renamed held item adds nothing (probed).
  if (source === "thorns") return { type: "thorns", kind: "entity", entity: own ?? entity(from) };
  // causeThrownDamage / causeIndirectMagicDamage with an ownerless projectile name the potion's raw lang key (probed).
  if (source === "thrown") return { type: "thrown", kind: "indirect", entity: own ?? (from?.type ? entity(from) : entity(null, { projectile: POTION })) };
  if (source === "indirectMagic") return { type: "indirectMagic", kind: "indirect", entity: own ?? (from?.type ? entity(from) : entity(null, { projectile: POTION })) };
  if (reason === "magic" && (own || from?.type)) return { type: "indirectMagic", kind: "indirect", entity: own ?? entity(from) };
  if (source === "mob" || source === "player" || (from?.type && !PLAIN[reason] && !PROJECTILE_REASONS.has(reason)) || (own && !PLAIN[reason]))
    return { type: own || source === "player" || (source !== "mob" && from?.isPlayer) ? "player" : "mob", kind: "entity", entity: own ?? entity(from ?? { type: articleless(reason) }) };
  return { type: PLAIN[reason] ?? "generic", kind: "plain", entity: null };
}

/** The fall description for a position: ladder (65) or vines (72) in the cell at the feet, else water when `inWater`, else null
 *  (CombatTracker.func_94545_a over the cell at floor(x), floor(minY), floor(z)). */
export function sampleFallSite(world, x, y, z, inWater = false) {
  const cell = world?.get?.(Math.floor(x), Math.floor(y), Math.floor(z));
  return cell === 65 ? "ladder" : cell === 72 ? "vines" : inWater ? "water" : null;
}

/** Entity.fallDistance / the block under the feet: the CombatTracker.func_94545_a fall description of the cell at floor(x), floor(minY), floor(z). */
export function fallDescription({ block, inWater, ladder, vine }) {
  if (block === ladder) return "ladder";
  if (block === vine) return "vines";
  return inWater ? "water" : null;
}
/** The cell test above in one call: ladder or vines when standing in one, else water. Mirrors EntityLivingBase.isOnLadder first. */
export function siteDescription(onLadderBlock, inWater, { ladder, vine }) {
  if (onLadderBlock === ladder || onLadderBlock === vine) return fallDescription({ block: onLadderBlock, inWater, ladder, vine });
  return inWater ? "water" : null;
}

export class CombatTracker {
  constructor() { this.clear(); this.revenge = null; }
  clear() { this.entries = []; this.lastDamage = 0; this.inCombat = false; this.takingDamage = false; }
  /** CombatTracker.func_94549_h. `alive` is EntityLivingBase.isEntityAlive. */
  reset(ticks, alive) {
    const window = this.inCombat ? IN_COMBAT_WINDOW : COMBAT_WINDOW;
    if (this.takingDamage && (!alive || ticks - this.lastDamage > window)) this.clear();
  }
  /** CombatTracker.func_94547_a. `site` is the fall description now, `fall` Entity.fallDistance, `alive` the victim after this hit. */
  record(src, healthBefore, damage, ticks, { alive, site = null, fall = 0 } = {}) {
    this.reset(ticks, alive);
    this.entries.push({ src, tick: ticks, healthBefore, damage: f(damage), site, fall });
    this.lastDamage = ticks;
    this.takingDamage = true;
    if (src.entity?.living && !this.inCombat && alive) this.inCombat = true;
    // EntityLivingBase.attackEntityFrom: a living source entity becomes the revenge target (also while the hit only tops up).
  }
  /** EntityLivingBase.setRevengeTarget / the part of attackEntityFrom that runs for every accepted hit. */
  noteAttacker(src, ticks) { if (src.entity?.living) this.revenge = { entity: src.entity, tick: ticks }; }
  /** The revenge expiry of EntityLivingBase.onEntityUpdate: 100 ticks after the hit, or when the attacker died. */
  tick(ticks, attackerAlive = () => true) {
    if (this.revenge && (!attackerAlive(this.revenge.entity) || ticks - this.revenge.tick > REVENGE_TICKS)) this.revenge = null;
    if (ticks % 20 === 0) this.reset(ticks, true);
  }
  /** CombatTracker.func_94550_c. */
  killer() {
    let living = null, player = null, bestLiving = 0, bestPlayer = 0;
    for (const e of this.entries) {
      const who = e.src.entity;
      if (who?.player && (!player || e.damage > bestPlayer)) { bestPlayer = e.damage; player = who; }
      if (who?.living && (!living || e.damage > bestLiving)) { bestLiving = e.damage; living = who; }
    }
    return player && bestPlayer >= f(bestLiving / 3) ? player : living;
  }
  /** EntityLivingBase.func_94060_bK: the tracker's fighter, else the revenge target. */
  fighter() { return this.killer() ?? this.revenge?.entity ?? null; }
  /** CombatTracker.i: the entry that explains a long fall, or null. */
  fallEntry() {
    let best = null, bestFall = 0;
    this.entries.forEach((e, i) => {
      const type = e.src.type, far = type === "outOfWorld" ? Infinity : e.fall;
      if ((type === "fall" || type === "outOfWorld") && far > 0 && (!best || far > bestFall)) { best = i > 0 ? this.entries[i - 1] : e; bestFall = far; }
    });
    return bestFall > 5 && best ? best : null;
  }

  /** CombatTracker.func_151521_b as { key, args } (args are the texts the arguments print). `ctx`: { name, selfItem }. */
  message(ctx) {
    const out = this.#message(ctx);
    // `players`: per argument, the raw player name when the argument is EntityPlayer.func_145748_c_ (victim, a player attacker), else null.
    out.players = out.args.map((_, i) => (i === 0 ? ctx.rawName ?? ctx.name : out.who?.[i - 1] ?? null));
    delete out.who;
    return out;
  }
  #message(ctx) {
    const victim = ctx.name;
    if (!this.entries.length) return { key: "death.attack.generic", args: [victim] };
    const near = this.fallEntry(), last = this.entries[this.entries.length - 1], lastName = last.src.entity?.tracked ? last.src.entity.name(ctx) : null; // getEntity: the shooter, not the projectile
    if (near && last.src.type === "fall") {
      const name = near.src.entity?.tracked ? near.src.entity.name(ctx) : null;
      if (near.src.type === "fall" || near.src.type === "outOfWorld") return { key: "death.fell.accident." + (near.site ?? "generic"), args: [victim] };
      const itemOf = (who) => { const item = who?.living ? who.held(ctx) : null; return item ? `[${item}]` : null; };
      const rawOf = (e) => (e?.tracked && e.player ? e.rawPlayer(ctx) : null);
      if (name !== null && (lastName === null || name !== lastName)) {
        const item = itemOf(near.src.entity), who = [rawOf(near.src.entity)];
        return item ? { key: "death.fell.assist.item", args: [victim, name, item], who } : { key: "death.fell.assist", args: [victim, name], who };
      }
      if (lastName !== null) {
        const item = itemOf(last.src.entity), who = [rawOf(last.src.entity)];
        return item ? { key: "death.fell.finish.item", args: [victim, lastName, item], who } : { key: "death.fell.finish", args: [victim, lastName], who };
      }
      return { key: "death.fell.killer", args: [victim] };
    }
    return attackMessage(last.src, victim, ctx, this.fighter());
  }
}

/** DamageSource.func_151519_b: "death.attack.<type>" (EntityDamageSource families add the entity, a renamed held item adds ".item"), and for a
 *  plain source the ".player" key naming the fighting entity when that key exists. */
export function attackMessage(src, victim, ctx, fighter, hasKey = hasLangKey) {
  const base = "death.attack." + src.type;
  if (src.kind === "plain") {
    const who = fighter?.name(ctx);
    return who != null && hasKey(base + ".player") ? { key: base + ".player", args: [victim, who], who: [fighter.player ? fighter.rawPlayer(ctx) : null] } : { key: base, args: [victim] };
  }
  const who = src.entity.name(ctx), held = src.entity.living ? src.entity.held(ctx) : null;
  // EntityDamageSource (type mob/player/thorns...) and the indirect family both look the ".item" key up only when the held stack has a custom name.
  const raw = src.entity.player ? src.entity.rawPlayer(ctx) : null;
  if (held && hasKey(base + ".item")) return { key: base + ".item", args: [victim, who, `[${held}]`], who: [raw] };
  return { key: base, args: [victim, who], who: [raw] };
}

/** StatCollector.canTranslate over the en_US keys the port carries (lang-en-us.js). */
let known = null;
export function setKnownKeys(keys) { known = new Set(keys); }
function hasLangKey(key) { return known ? known.has(key) : false; }
