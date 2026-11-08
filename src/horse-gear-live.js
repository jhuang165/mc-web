// Horse gear inside EntityWorld (entities.js): leads and leash knots, name tags, the death drops of the horse inventory and
// the jump bar. Pure rules are in horse-gear.js (replayed against public/research/horse-gear-reference.json); this file wires
// them to the mob records. A mob record keeps `leash` ({holder: "player"} or {knot: {x, y, z}}), `customName`,
// `customNameVisible` and `persistent` (PersistenceRequired); a horse keeps its stacks in `horse.items`.
// Leash knots are runtime entities (`world.knotList`: {x, y, z, age, dead}) as EntityLeashKnot is: a knot outlives its mobs, dies up to
// 100 ticks after its fence goes, is never saved itself (su.d refuses) and is rebuilt from the Leash X/Y/Z of the mobs tied to it.
// Path-following (td.bL) runs every tick of a leashed mob; see public/research/leash.md.
import { FENCE } from "./world.js";
import { NETHER_FENCE } from "./nether-blocks.js";
import { Task } from "./ai.js";
import { villageTasks } from "./village-ai.js";
import { setHomeArea } from "./home-area.js";
import { ownerPresent } from "./owner-links.js";
import * as G from "./horse-gear.js";

const isFence = (b) => b === FENCE || b === NETHER_FENCE;
// td.bL's runtime state per mob, not saved: { task } is the EntityAIMoveTowardsRestriction it added (td.bt is "task is in the list").
// A leashed mob with no entry yet is one that was just loaded: its first tick restores the holder (sw.bP).
const leashStates = new WeakMap();
let restrictionClass = null;
const KNOT_HALF_HEIGHT = 9 / 32; // ss: a 9 pixel box either side of the centre
const knotsOf = (w) => (w.knotList ??= []);
// A knot's entity position: the block centre, or the command position of a /summon LeashKnot (whose tile stays 0, 0, 0).
const knotCentre = (k) => (k.summoned ? { x: k.px, y: k.py, z: k.pz } : { x: k.x + 0.5, y: k.y + 0.5, z: k.z + 0.5 });
let knotSeq = 0;
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
    // The home area td.bL set around a holder is not saved by EntityCreature; it is set again on the first leashed tick.
    ...(e.leashHome ? { homeRadius: -1, leashHome: undefined } : {}),
    leash: e.leash?.lost ? { lost: true, ...(typeof e.leash.raw === "string" ? { raw: e.leash.raw } : {}) } : e.leash?.holder === "player" ? { holder: "player" } : e.leash?.holder === "mob" && typeof e.leash.holderUuid === "string" ? { holder: "mob", holderUuid: e.leash.holderUuid } : knot ? { knot } : undefined,
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
    // Another mob holds (EntityLiving.func_110162_b with a living holder): found by UUID among this world's mobs; a dead or missing one holds nothing.
    if (l?.holder === "mob") { const m = this.leashHolderMob(l); return m ? { x: m.x, y: m.y, z: m.z, mob: m } : null; }
    // A knot holds while its entity lives, whatever the fence block is (the fence is only checked every 101st knot tick).
    if (l?.knot) { const k = this.knotAt(l.knot.x, l.knot.y, l.knot.z); return k ? { ...knotCentre(k), knot: k } : null; }
    return null;
  };
  proto.leashHolderMob = function (l) {
    const m = this.entities.find((x) => x.uuid === l.holderUuid);
    return m && m.health > 0 ? m : null;
  };
  // The leash is set (EntityLiving.setLeashedToEntity): the mob is known to the leash tick from now on.
  proto.setLeash = function (e, leash) {
    e.leash = leash;
    if (!leashStates.has(e)) leashStates.set(e, { task: null });
  };
  // ---- EntityLeashKnot (su) as runtime entities ----
  // su.b(world, x, y, z): the knot at a block, if any.
  proto.knotAt = function (x, y, z) { return knotsOf(this).find((k) => !k.dead && k.x === x && k.y === y && k.z === z) ?? null; };
  // su.a(world, x, y, z): a knot is made without looking at the block (the fence check comes with its first 100 ticks).
  proto.knotCreate = function (x, y, z) { const k = { x, y, z, age: 0, dead: false }; knotsOf(this).push(k); return k; };
  // /summon LeashKnot (EntityList.createEntityFromNBT: su(world), whose readEntityFromNBT is empty, so TileX/Y/Z stay 0, 0, 0; then
  // CommandSummon.setLocationAndAngles). It looks for a fence at tile 0, 0, 0 on its 101st update, so it normally dies there.
  proto.knotSummon = function (px, py, pz) { const k = { x: 0, y: 0, z: 0, age: 0, dead: false, summoned: true, px, py, pz, id: ++knotSeq }; knotsOf(this).push(k); return k; };
  // Entity.setDead on a knot: nothing drops (su.b(Entity) is empty) and the mobs it held lose the lead on their next tick.
  proto.knotKill = function (k) {
    k.dead = true;
    const list = knotsOf(this), i = list.indexOf(k);
    if (i >= 0) list.splice(i, 1);
  };
  // A /summon LeashKnot has no fence to click: its 0.5 x 0.5 box (probed, summon-reference.json: 10.25 to 10.75 around the command position, the
  // entity's own Entity.setPosition box) is what the view ray meets. The picker result carries a stable stand-in `{ id: "mob-<n>", knotRef, health: 1 }`
  // so the captured player action (player-actions.js) can name it; leashInteract and attack route it to the knot (EntityLeashKnot.interactFirst /
  // attackEntityFrom). Placed knots keep their fence-click path.
  const KNOT_ID_BASE = 900000000;
  proto.knotEntity = function (id) {
    const n = /^mob-(\d+)$/.exec(id ?? "")?.[1];
    const k = n && knotsOf(this).find((c) => c.summoned && !c.dead && KNOT_ID_BASE + c.id === Number(n));
    return k ? (k.stand ??= { id: `mob-${KNOT_ID_BASE + k.id}`, type: "leash_knot", knotRef: k, health: 1, x: k.px, y: k.py, z: k.pz }) : null;
  };
  const pick = proto.pick;
  proto.pick = function (origin, dir, reach, wall = reach) {
    let best = pick.call(this, origin, dir, reach, wall);
    for (const k of knotsOf(this)) {
      if (!k.summoned || k.dead) continue;
      const box = [[origin.x, dir.x, k.px - 0.25, k.px + 0.25], [origin.y, dir.y, k.py, k.py + 0.5], [origin.z, dir.z, k.pz - 0.25, k.pz + 0.25]];
      let near = 0, far = Math.min(reach, wall);
      for (const [o, d, min, max] of box) {
        if (Math.abs(d) < 1e-8) { if (o < min || o > max) { far = -1; break; } continue; }
        const a = (min - o) / d, b = (max - o) / d;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
      if (far >= near && near <= Math.min(reach, wall) && (!best || near < best.distance)) best = { entity: this.knotEntity(`mob-${KNOT_ID_BASE + k.id}`), distance: near };
    }
    return best;
  };
  const attack = proto.attack;
  proto.attack = function (e, ...rest) {
    if (e?.knotRef) { this.knotAttack(e.knotRef); return false; } // any hit kills a knot, with no knockback or damage events
    return attack.call(this, e, ...rest);
  };
  // EntityHanging.onUpdate for every knot, once a tick.
  proto.knotTick = function () {
    const list = this.knotList;
    if (!list?.length) return;
    for (const k of list.slice()) {
      const out = G.knotAge(k.age, isFence(this.world.get(k.x, k.y, k.z)));
      k.age = out.age;
      if (out.kill) this.knotKill(k);
    }
  };
  // EntityHanging.attackEntityFrom: any hit kills a knot without a drop. (Left click is not routed to knots in the browser.)
  proto.knotAttack = function (k) { if (k.dead) return false; this.knotKill(k); return true; };
  // The mobs the player holds whose bounding box meets the 7-block box around `centre` (ahb.getEntitiesWithinAABB).
  proto.leashedNear = function (centre) {
    const cands = this.entities.filter((m) => m.health > 0 && m.leash?.holder === "player").map((m) => {
      const [w, h] = this.size(m);
      return { x: m.x, y: m.y, z: m.z, halfWidth: w / 2, height: h, leash: m.leash, rec: m };
    });
    return G.knotAttach(cands, centre).map((c) => c.rec);
  };
  // EntityLeashKnot.interactFirst (su.c): with a lead in hand the player's mobs join this knot; with none to attach it dies, and in
  // Creative the mobs it held are freed without a drop. Always consumes the click.
  proto.knotInteract = function (k, survival) {
    const lead = G.originalId(survival.held) === G.LEAD_ORIGINAL, tie = { x: k.x, y: k.y, z: k.z };
    let attached = 0;
    if (lead) for (const m of this.leashedNear(knotCentre(k))) { this.setLeash(m, { knot: { ...tie } }); attached++; }
    const out = G.knotClick({ attached, creative: !!survival.creative });
    if (out.kill) {
      this.knotKill(k);
      if (out.freeAll) for (const m of this.entities) if (m.leash?.knot && m.leash.knot.x === k.x && m.leash.knot.y === k.y && m.leash.knot.z === k.z && this.leashNearKnot(m, k)) this.unleash(m, false);
    }
    return true;
  };
  proto.leashNearKnot = function (m, k) {
    const [w, h] = this.size(m);
    return G.knotAttach([{ x: m.x, y: m.y, z: m.z, halfWidth: w / 2, height: h, leash: { holder: "player" } }], knotCentre(k)).length > 0;
  };
  // EntityLiving.clearLeashed(true, dropLead): the lead item drops where the mob stands. The knot stays; the home area goes with it.
  proto.unleash = function (e, drop = true) {
    if (!e.leash) return;
    delete e.leash;
    this.leashRelease(e);
    if (drop) this.events.push({ drop: G.LEAD_ITEM, count: 1, position: { x: e.x, y: e.y, z: e.z } });
  };
  // EntityLiving.func_110160_i (sw.bP), the first updateLeashedState after a load: a knot is found or made at the saved X/Y/Z (even
  // with no fence, which then dies in up to 100 ticks); a player holder must be within 10 blocks of the mob (the UUID is the one player's).
  proto.leashRestore = function (e) {
    const l = e.leash;
    if (l.lost) { this.unleash(e, true); return; } // an imported Leashed mob whose Leash tag names no holder: the lead item drops
    if (l.knot) { if (!this.knotAt(l.knot.x, l.knot.y, l.knot.z)) this.knotCreate(l.knot.x, l.knot.y, l.knot.z); return; }
    // sw.bP: any living entity of the UUID in the 10-block box (the first in the list; a dead one is found and then dropped by the next tick).
    const p = l.holder === "mob" ? (() => { const m = this.entities.find((x) => x.uuid === l.holderUuid); const [mw, mh] = m ? this.size(m) : []; return m && { x: m.x, y: m.y, z: m.z, width: mw, height: mh }; })() : this.ai?.player;
    if (!p) { this.unleash(e, true); return; }
    const [w, h] = this.size(e), pw = p.width ?? 0.6, ph = p.height ?? 1.8;
    const near = Math.abs(p.x - e.x) <= 10 + (w + pw) / 2 && Math.abs(p.z - e.z) <= 10 + (w + pw) / 2 && p.y + ph >= e.y - 10 && p.y <= e.y + h + 10;
    if (!near) this.unleash(e, true);
  };
  // td.bL's task: EntityAIMoveTowardsRestriction (ut) at priority 2, speed 1, built from the village task factory.
  const addRestriction = (world, e, st) => {
    restrictionClass ??= villageTasks({ Task, TargetBase: class extends Task {} }).MoveTowardsRestriction;
    const b = world.ai.brain(e);
    st.task = new restrictionClass(b, G.LEASH_PATH_SPEED);
    b.tasks.add(G.LEASH_TASK_PRIORITY, st.task);
    b.navigator.setAvoidsWater(false);
  };
  // td.bL's else branch: the task leaves the list (uj.a(ui): a running one is reset first), avoid-water is back on, the home is detached.
  proto.leashRelease = function (e) {
    const st = leashStates.get(e);
    if (!st?.task) return;
    const b = this.ai.brain(e), tasks = b.tasks, i = tasks.entries.findIndex((x) => x.action === st.task);
    if (i >= 0) {
      const entry = tasks.entries[i], r = tasks.running.indexOf(entry);
      if (r >= 0) { entry.action.resetTask(); tasks.running.splice(r, 1); }
      tasks.entries.splice(i, 1);
    }
    st.task = null;
    b.navigator.setAvoidsWater(true);
    e.homeRadius = -1;
    delete e.leashHome;
  };
  // EntityLiving.updateLeashedState (sw.bL) then EntityCreature.func_142017_o (td.bL), once a tick (probe leash-reference.json `path`).
  proto.leashTick = function (e) {
    let st = leashStates.get(e);
    if (e.leash && !st) { leashStates.set(e, (st = { task: null })); this.leashRestore(e); }
    if (e.leash) {
      const h = this.leashHolder(e);
      // sw.bL: only a missing or dead holder frees the mob. A corpse in its 20-tick death animation keeps the lead (td.bL still runs) and the lead
      // is lost without a drop when the corpse is removed (setDead does not clear it; leads3-reference.json leadDeath).
      if (!h) this.unleash(e, true);
    }
    if (!e.leash) { this.leashRelease(e); return; }
    const h = this.leashHolder(e);
    setHomeArea(e, Math.trunc(h.x), Math.trunc(h.y), Math.trunc(h.z), G.LEASH_HOME_RADIUS);
    e.leashHome = true;
    const sitting = (e.type === "wolf" || e.type === "ocelot") && e.sitting === true;
    const step = G.leashStep(h.x - e.x, h.y - e.y, h.z - e.z, { sitting });
    if (step.task && e.health > 0) { // a corpse's AI tasks never run
      st ??= leashStates.get(e);
      if (!st.task) addRestriction(this, e, st);
      if (step.path) this.ai.brain(e).navigator.tryMoveToEntityLiving(h.player ? this.ai.player : h.mob ? h.mob : { x: h.x, y: h.y - KNOT_HALF_HEIGHT, z: h.z }, G.LEASH_PATH_SPEED);
      if (step.pull) { e.vx = (e.vx || 0) + step.pull[0]; e.vy = (e.vy || 0) + step.pull[1]; e.vz = (e.vz || 0) + step.pull[2]; }
    }
    if (step.unleash) this.unleash(e, true);
  };
  // EntityLiving.interactFirst (sw.c): the holder frees a leashed mob, a lead in hand ties a free one.
  proto.leashInteract = function (e, survival) {
    if (e?.knotRef) return !e.knotRef.dead && this.knotInteract(e.knotRef, survival); // a summoned knot picked by view ray
    if (!alive(this, e)) return false;
    const creative = !!survival.creative;
    // sw.c: a tamed wolf or ocelot is leashed only by its owner (EntityTameable.isOwner, leads2-reference.json leadUse).
    const ownerBlocked = (e.type === "wolf" || e.type === "ocelot") && !!e.owner && !ownerPresent(e);
    const out = G.leashUse({ ownerBlocked, leashed: !!e.leash, holderIsPlayer: e.leash?.holder === "player", heldLead: G.originalId(survival.held) === G.LEAD_ORIGINAL, creative, type: e.type });
    if (!out.used) return false;
    if (out.action === "free") this.unleash(e, out.dropLead);
    else { this.setLeash(e, { holder: "player" }); if (out.consume && !creative) survival.inventory.decr(survival.inventory.current, 1); }
    return true;
  };
  // A click on a fence block. A knot there is clicked first (EntityLeashKnot.interactFirst, su.c: the knot's 9 pixel box is wider than
  // the post, so the ray meets it before the block; the browser does not ray-test the knot box, so any click on that fence while a
  // lead or nothing is held goes to the knot). Otherwise ItemLead.func_150909_a (BlockFence.onBlockActivated, ItemLead.onItemUse): the
  // player's leashed mobs whose boxes meet the 7-block box around the fence block move to the existing knot, or to a new one made
  // only when a mob is found. Returns whether it acted (a lead in hand always consumes the click, as ItemLead.onItemUse does).
  proto.leashFence = function ([x, y, z], survival) {
    if (!isFence(this.world.get(x, y, z)) || !this.ai?.player) return false;
    const lead = G.originalId(survival.held) === G.LEAD_ORIGINAL, knot = this.knotAt(x, y, z);
    if (knot && (lead || !survival.held)) return this.knotInteract(knot, survival);
    const mobs = this.leashedNear({ x, y, z });
    if (mobs.length) {
      this.knotAt(x, y, z) ?? this.knotCreate(x, y, z);
      for (const m of mobs) this.setLeash(m, { knot: { x, y, z } });
      return true;
    }
    return lead;
  };
  // Every live knot entity (the renderer draws the knot model on each, tied mobs or not).
  proto.leashKnots = function () { return knotsOf(this).filter((k) => !k.dead).map((k) => ({ x: k.x, y: k.y, z: k.z, ...(k.summoned ? { px: k.px, py: k.py, pz: k.pz, id: k.id } : {}) })); };
  // ItemNameTag.itemInteractionForEntity: the tag's display name becomes the mob's CustomName and the mob stops despawning.
  proto.nameTagUse = function (e, survival) {
    if (!alive(this, e) || G.originalId(survival.held) !== G.NAME_TAG_ORIGINAL) return false;
    const out = G.nameTagUse({ stackName: survival.held.displayName, isMob: true, isPlayer: false });
    if (!out.used) return false;
    if (out.name) e.customName = out.name.slice(0, 64);
    else delete e.customName;
    if (out.persistent) e.persistent = true;
    // EntityPlayer.interactWith hands Creative a copy of the stack, so the tag is only used up outside Creative (neg-stacks2-reference.json interact).
    if (!survival.creative) survival.inventory.decr(survival.inventory.current, out.consume);
    return true;
  };
  // EntityHorse.cK on death: everything the horse carried drops.
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
    // The lead is not cleared here: EntityLivingBase.onDeath and setDead never call clearLeashed (leads3-reference.json leadDeath).
  };
  // wi.a(yz) "gui": the screen's horse record, with the stacks the flags stand for.
  proto.horseGear = function (e) {
    if (!e.horse) return null;
    G.ensureItems(e.horse);
    return e.horse;
  };
}
