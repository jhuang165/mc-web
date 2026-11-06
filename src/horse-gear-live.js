// Horse gear inside EntityWorld (entities.js): leads and leash knots, name tags, the death drops of the horse inventory and
// the jump bar. Pure rules are in horse-gear.js (replayed against public/research/horse-gear-reference.json); this file wires
// them to the mob records. A mob record keeps `leash` ({holder: "player"} or {knot: {x, y, z}}), `customName`,
// `customNameVisible` and `persistent` (PersistenceRequired); a horse keeps its stacks in `horse.items`.
// Leash knots are not separate entities here: a knot exists for as long as a mob is tied to it (documented gap).
import { FENCE } from "./world.js";
import { NETHER_FENCE } from "./nether-blocks.js";
import * as G from "./horse-gear.js";

const isFence = (b) => b === FENCE || b === NETHER_FENCE;
const alive = (m, e) => e.health > 0 && m.entities.includes(e);

// EntityPlayerSP.isRidingHorse: the ridden entity is a saddled horse.
export function riddenHorse(rider) {
  const v = rider?.vehicle;
  return v?.horse && v.entity?.horse?.tame && v.entity.horse.saddled && v.entity.health > 0 ? v.entity : null;
}
// EntityPlayerSP.isRidingHorse (blk): the ridden entity is an EntityHorse, tame, saddled or not.
export function ridingHorse(rider) {
  const v = rider?.vehicle;
  return v?.horse && v.entity && (v.entity.type ?? "horse") === "horse" ? v.entity : null;
}
// GuiIngame.renderJumpBar replaces the experience bar whenever isRidingHorse: the filled width is (int)(power * 183)
// of the 182 pixel track.
export function jumpBar(rider) {
  const e = ridingHorse(rider);
  if (!e) return { visible: false, width: 0 };
  return { visible: true, width: Math.max(0, Math.min(183, Math.trunc(Math.fround(rider.jumpPower || 0) * 183))) };
}

// restore(): the leash, name and persistence of a saved record after a sanity pass.
export function gearFieldsFrom(e) {
  const k = e.leash?.knot, knot = k && [k.x, k.y, k.z].every(Number.isInteger) ? { x: k.x, y: k.y, z: k.z } : null;
  return {
    leash: e.leash?.holder === "player" ? { holder: "player" } : knot ? { knot } : undefined,
    customName: typeof e.customName === "string" && e.customName ? e.customName.slice(0, 64) : undefined,
    customNameVisible: e.customNameVisible === true ? true : undefined,
    persistent: e.persistent === true ? true : undefined,
  };
}

export function installHorseGear(EntityWorld) {
  const proto = EntityWorld.prototype;
  // Where a lead's other end is: the player's feet or the knot (block centre, EntityLeashKnot.setPosition(x + .5, y + .5, z + .5)).
  proto.leashHolder = function (e) {
    const l = e.leash;
    if (l?.holder === "player") { const p = this.ai?.player; return p && p.alive !== false ? { x: p.x, y: p.y, z: p.z, player: true } : null; }
    if (l?.knot) return isFence(this.world.get(l.knot.x, l.knot.y, l.knot.z)) ? { x: l.knot.x + 0.5, y: l.knot.y + 0.5, z: l.knot.z + 0.5, knot: l.knot } : null;
    return null;
  };
  // EntityLiving.clearLeashed(true, dropLead): the lead item drops where the mob stands.
  proto.unleash = function (e, drop = true) {
    if (!e.leash) return;
    delete e.leash;
    if (drop) this.events.push({ drop: G.LEAD_ITEM, count: 1, position: { x: e.x, y: e.y, z: e.z } });
  };
  // EntityLiving.updateLeashedState (sw.bL) and EntityCreature.func_142017_o (td.bL), once a tick.
  proto.leashTick = function (e) {
    if (!e.leash) return;
    const h = this.leashHolder(e);
    if (!h || e.health <= 0) { this.unleash(e, true); return; }
    const step = G.leashStep(h.x - e.x, h.y - e.y, h.z - e.z);
    if (step.pull) { e.vx = (e.vx || 0) + step.pull[0]; e.vy = (e.vy || 0) + step.pull[1]; e.vz = (e.vz || 0) + step.pull[2]; }
    if (step.unleash) this.unleash(e, true);
  };
  // EntityLiving.interactFirst (sw.c): the holder frees a leashed mob, a lead in hand ties a free one.
  proto.leashInteract = function (e, survival) {
    if (!alive(this, e)) return false;
    const creative = !!survival.creative;
    const out = G.leashUse({ leashed: !!e.leash, holderIsPlayer: e.leash?.holder === "player", heldLead: G.originalId(survival.held) === G.LEAD_ORIGINAL, creative, type: e.type });
    if (!out.used) return false;
    if (out.action === "free") this.unleash(e, out.dropLead);
    else { e.leash = { holder: "player" }; if (out.consume) survival.inventory.decr(survival.inventory.current, 1); }
    return true;
  };
  // ItemLead.onItemUse and BlockFence.onBlockActivated over a fence: the player's leashed mobs within 7 blocks move to its knot;
  // with no mob to move, a click on a fence that holds a knot breaks the knot (EntityLeashKnot.interact). Returns whether it acted.
  proto.leashFence = function ([x, y, z], survival) {
    if (!isFence(this.world.get(x, y, z))) return false;
    const player = this.ai?.player, lead = G.originalId(survival.held) === G.LEAD_ORIGINAL;
    if (!player) return false;
    const mobs = G.knotAttach(this.entities.filter((m) => m.health > 0), player);
    if (mobs.length) { for (const m of mobs) m.leash = { knot: { x, y, z } }; return true; }
    const tied = this.entities.filter((m) => m.leash?.knot && m.leash.knot.x === x && m.leash.knot.y === y && m.leash.knot.z === z);
    if (tied.length && !lead) {
      const out = G.knotClick({ attached: 0, creative: !!survival.creative });
      if (out.freeAll) for (const m of tied) this.unleash(m, false);
      else for (const m of tied) this.unleash(m, true);
      return out.kill;
    }
    return lead;
  };
  // Every distinct fence a mob is tied to (the renderer draws a knot on each).
  proto.leashKnots = function () {
    const seen = new Map();
    for (const e of this.entities) if (e.leash?.knot) seen.set(G.knotKey(e.leash.knot.x, e.leash.knot.y, e.leash.knot.z), e.leash.knot);
    return [...seen.values()];
  };
  // ItemNameTag.itemInteractionForEntity: the tag's display name becomes the mob's CustomName and the mob stops despawning.
  proto.nameTagUse = function (e, survival) {
    if (!alive(this, e) || G.originalId(survival.held) !== G.NAME_TAG_ORIGINAL) return false;
    const out = G.nameTagUse({ stackName: survival.held.displayName, isMob: true, isPlayer: false });
    if (!out.used) return false;
    if (out.name) e.customName = out.name.slice(0, 64);
    else delete e.customName;
    if (out.persistent) e.persistent = true;
    survival.inventory.decr(survival.inventory.current, out.consume); // ItemNameTag uses the tag up in Creative too
    return true;
  };
  // EntityHorse.cK on death plus the lead (EntityLiving.setDead -> clearLeashed): everything the horse carried drops.
  proto.gearDeath = function (e) {
    if (e.type === "horse" && e.horse) {
      const h = { ...e.horse };
      G.ensureItems(h);
      for (const s of G.gearDrops(h)) this.events.push({ drop: s.id, count: s.count, ...(s.damage ? { damage: s.damage } : {}), position: { x: e.x, y: e.y, z: e.z } });
      e.horse.items = null;
      e.horse.saddled = false;
      e.horse.armor = 0;
      e.horse.chested = false;
    }
    if (e.leash) this.unleash(e, true);
  };
  // wi.a(yz) "gui": the screen's horse record, with the stacks the flags stand for.
  proto.horseGear = function (e) {
    if (!e.horse) return null;
    G.ensureItems(e.horse);
    return e.horse;
  };
}
