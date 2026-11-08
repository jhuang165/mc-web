// Minecraft Java 1.7.10 EntityWolf (wv) and EntityTameable (tg): the data and the pure rules. The AI tasks are
// wolf-ai.js, the model animation wolf-renderer.js, and entities.js hooks these in (wolfTick, wolfInteract, ...).
// Every rule here is checked against public/research/wolf-reference.json, which tools/probes/WolfProbe.java records
// from the unchanged original classes. See public/research/wolves.md for the obfuscated names and the limits.
import { ownerPresent } from "./owner-links.js";
import { mhSin } from "./lighting.js";
import { maxHealthOf } from "./mob-riding.js";
const f = Math.fround;
export const WOLF_WIDTH = f(0.6), WOLF_HEIGHT = f(0.8);
// applyEntityAttributes: movementSpeed 0.3 (a float), maxHealth 8 wild and 20 tamed (EntityWolf.func_70903_f).
export const WOLF_SPEED = f(0.3), WILD_MAX_HEALTH = 8, TAMED_MAX_HEALTH = 20;
// EntityWolf.getEyeHeight: height * 0.8 (a float).
export const WOLF_EYE_HEIGHT = f(WOLF_HEIGHT * f(0.8));
// The datawatcher collar byte starts at BlockColored.func_150032_b(1): 15 - 1 = 14 (red).
export const DEFAULT_COLLAR = 14;
// EntityWolf.getMaxSpawnedInChunk: groups of up to 8.
export const WOLF_MAX_GROUP = 8;
// The project's item ids (survival.js) for the original's bone (352), dye (351, ItemDye) and the meats that
// ItemFood.isWolfsFavoriteMeat accepts, with ItemFood.func_150905_g healing: raw/cooked pork 3/8, raw/cooked beef 3/8,
// raw/cooked chicken 2/6 and rotten flesh 4. Fish, bread and the rest are not favourites.
export const BONE = 311, DYE = 351;
export const WOLF_MEAT = new Map([[202, 3], [203, 8], [204, 3], [205, 8], [318, 2], [319, 6], [206, 4]]);
// Only the wolf's own sounds: the hurt and death sounds are fixed, the living sound is wolfSay below.
export const WOLF_SOUNDS = { hurt: "mob.wolf.hurt", death: "mob.wolf.death", step: "mob.wolf.step", shake: "mob.wolf.shake", volume: f(0.4), stepVolume: f(0.15) };
export const wolfFields = () => ({
  // The owner of a tamed wolf. 1.7.10 stores the owner's UUID (OwnerUUID); the single player here is the only owner,
  // so any non-empty string means "the player" (java-mobs.js maps a Java UUID or name to it).
  owner: "",
  // datawatcher 16 bit 1 (isSitting): changed only by the Sit task. `sitWish` is EntityAISit.isSitting: the click toggle.
  sitting: false, sitWish: false,
  angry: false, collar: DEFAULT_COLLAR, begging: false,
  // bq/br: head tilt and its previous value; bu/bv: the shake timer and its previous value; bs/bt: wet and shaking.
  headTilt: 0, prevHeadTilt: 0, shakeTime: 0, prevShakeTime: 0, wet: false, shaking: false,
  // datawatcher 18: the health the clients see, rewritten by every AI update (a fresh wolf shows 1.0).
  dwHealth: 1,
});
export const isTamed = (e) => !!e.owner;
// getMaxHealth: the base setTamed sets (20 tamed, 8 wild: a wild wolf keeps an imported base) with its saved modifiers (mob-riding.js maxHealthOf).
export const maxHealth = (e) => maxHealthOf({ ...e, type: "wolf" }, isTamed(e) ? TAMED_MAX_HEALTH : WILD_MAX_HEALTH);
// What a save, an imported Java mob or /summon may contain, sanitised.
export function wolfFieldsFrom(e, fresh) {
  const owner = typeof e.owner === "string" ? e.owner.trim() : "";
  const tamed = owner !== "";
  return {
    owner, sitting: tamed && e.sitting === true, sitWish: tamed && (e.sitWish ?? e.sitting) === true,
    angry: e.angry === true, collar: Number.isInteger(e.collar) && e.collar >= 0 && e.collar < 16 ? e.collar : DEFAULT_COLLAR,
    // Shaking, begging and the tilts are not saved in 1.7.10.
    begging: false, headTilt: 0, prevHeadTilt: 0, shakeTime: 0, prevShakeTime: 0, wet: false, shaking: false,
    dwHealth: fresh.dwHealth,
  };
}
// EntityWolf.getTailRotation (ch): angry 1.5393804; tamed (0.55 - (20 - health) * 0.02) * PI from the datawatcher
// health; wild 0.62831855 (0.2 * PI).
export function tailAngle(e) {
  if (e.angry) return f(1.5393804);
  if (isTamed(e)) return f(f(f(0.55) - f(f(20 - e.dwHealth) * f(0.02))) * f(Math.PI));
  return f(f(0.2) * f(Math.PI));
}
// EntityWolf.getInterestedAngle (q): (bq lerp) * 0.15 * PI, the head tilt of a begging wolf.
export function interestedAngle(e, partial) {
  return f(f(f(e.prevHeadTilt + f(f(e.headTilt - e.prevHeadTilt) * f(partial))) * f(0.15)) * f(Math.PI));
}
// EntityWolf.getShakeAngle (g): the wet shake of the body parts; `offset` staggers mane, body and tail.
export function shakeAngle(e, partial, offset) {
  let t = f(f(f(e.prevShakeTime + f(f(e.shakeTime - e.prevShakeTime) * f(partial))) + f(offset)) / f(1.8));
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return f(f(f(f(mhSin(f(t * f(Math.PI)))) * f(mhSin(f(f(t * f(Math.PI)) * 11)))) * f(0.15)) * f(Math.PI));
}
// EntityWolf.getShadingWhileWet (p): 0.75 + (bu lerp) / 2 * 0.25.
export function wetShade(e, partial) {
  return f(f(0.75) + f(f(f(e.prevShakeTime + f(f(e.shakeTime - e.prevShakeTime) * f(partial))) / 2) * f(0.25)));
}
// EntityWolf.getLivingSound (t): an angry wolf growls; else one roll in three pants (a tamed wolf below 10 health in
// the datawatcher whines); otherwise it barks. Draws nextInt(3) first.
export function wolfSay(e, rand) {
  if (e.angry) return "mob.wolf.growl";
  if (rand.nextInt(3) === 0) return isTamed(e) && e.dwHealth < 10 ? "mob.wolf.whine" : "mob.wolf.panting";
  return "mob.wolf.bark";
}
// EntityWolf.attackEntityFrom (a(ro, F)): the sit wish is cleared, and damage from something that is neither a
// player nor an arrow (a mob) is halved: (amount + 1) / 2.
export function hurtAmount(amount, source) {
  if (source?.attacker && !source.player && !source.arrow) return f(f(amount + 1) / 2);
  return amount;
}
// EntityWolf.attackEntityAsMob (n): 4 damage for a tamed wolf, 2 for a wild one.
export const attackStrength = (e) => (isTamed(e) ? 4 : 2);
// EntityWolf.func_70922_bv / shouldAttackEntity (a(sv, sv)): never creepers or ghasts (the ghast does not exist yet),
// never a tamed wolf of the same owner, never a tamed horse (no horses). A player target is allowed when the owner may
// attack it (no teams here; the probe's `ownerAsTarget` is true); the owner is kept out by isSuitableTarget (vu.a),
// which refuses the owner and anything with the owner's own owner.
export function shouldAttackEntity(wolf, target) {
  if (target.type === "creeper") return false;
  // wolf.getOwner() != owner: two ownerless (foreign-owned) wolves compare equal as null (probed attributes3 `foreign`).
  if (target.type === "wolf" && isTamed(target) && (ownerPresent(target) ? ownerPresent(wolf) && target.owner === wolf.owner : !ownerPresent(wolf))) return false;
  return true;
}
// EntityWolf.canMateWith (a(wf)): another tamed wolf, neither sitting, both in love.
export function canMateWith(a, b) {
  if (a === b || !isTamed(a) || b.type !== "wolf" || !isTamed(b) || b.sitting) return false;
  return a.love > 0 && b.love > 0;
}
// EntityWolf.createChild (b(rx)): a puppy; the parent's owner makes it tamed (tg.func_152115_b), which sets only the
// attribute, so it starts with the wild 8 health and a default collar.
export function puppyFields(parent) {
  return parent.owner && parent.owner.trim() !== "" ? { owner: parent.owner } : {};
}
// The effect of a right click, as EntityWolf.interact (a(yz)) decides it. `item` is the held stack ({id, damage}) or
// null, `isOwner` whether the clicker owns the wolf, `creative` whether the stack is kept, `rand` Entity.rand.
// It mutates the wolf and returns { handled, consume, heal, status, love }:
//   handled  whether interact returned true; consume: items to take from the stack; status: the world event byte
//   (7 hearts after taming, 6 smoke after a failed bone); love: the super interact puts the wolf in love (a breeding
//   item: a favourite meat) which the caller does with its usual rules.
export function interact(e, item, isOwner, creative, rand) {
  const out = { handled: false, consume: 0, heal: 0, status: 0, love: false, tamed: false };
  if (isTamed(e)) {
    if (item) {
      const heal = WOLF_MEAT.get(item.id);
      if (heal !== undefined && e.dwHealth < 20) {
        if (!creative) out.consume = 1;
        e.health = Math.min(maxHealth(e), f(e.health + heal));
        out.handled = true;
        out.heal = heal;
        return out;
      }
      if (item.id === DYE) {
        // BlockColored.func_150032_b: the collar is 15 - the dye's damage (the fleece colour of that dye).
        const colour = 15 - (item.damage & 15);
        if (colour !== e.collar) {
          e.collar = colour;
          if (!creative) out.consume = 1;
          out.handled = true;
          return out;
        }
      }
    }
    // isOwner and not a breeding item: the sit wish toggles (the AI starts or ends the sitting), the path and target go.
    if (isOwner && !(item && WOLF_MEAT.has(item.id))) {
      e.sitWish = !e.sitting;
      e.jumping = false;
      out.sitToggle = true;
    }
  } else if (item && item.id === BONE && !e.angry) {
    if (!creative) out.consume = 1;
    if (rand.nextInt(3) === 0) {
      e.owner = e.owner || "player";
      e.sitWish = true;
      // setTamed(true) resets the maxHealth base to 20, then setHealth(20) clamps to the modified maximum (probed attributes2 `tame`: 10 under a -50% modifier).
      if (e.attributeBases?.["generic.maxHealth"] !== undefined) { const { "generic.maxHealth": _, ...rest } = e.attributeBases; e.attributeBases = Object.keys(rest).length ? rest : undefined; }
      e.health = Math.min(TAMED_MAX_HEALTH, maxHealth(e));
      out.status = 7;
      out.tamed = true;
    } else out.status = 6;
    out.handled = true;
    return out;
  }
  // EntityAnimal.interact: a breeding item (a favourite meat) puts the wolf in love, a baby only ages.
  if (item && WOLF_MEAT.has(item.id)) {
    out.love = true;
    out.handled = true;
  }
  return out;
}
// The per-tick state of EntityWolf.onUpdate (h) and onLivingUpdate (e): the begging tilt, the wet shake and the
// datawatcher health. `inWater` and `onGround` come from the world, `hasPath` from the navigator. Returns the number
// of splash particles to spawn this tick and whether to play the shake sound.
export function updateWolf(e, { inWater, onGround, hasPath, rand }) {
  const out = { splashes: 0, shakeSound: false, splashHeight: 0 };
  e.dwHealth = e.health;
  // onLivingUpdate: a wet wolf standing still on the ground (no path) begins to shake.
  if (e.wet && !e.shaking && !hasPath && onGround) {
    e.shaking = true;
    e.shakeTime = 0;
    e.prevShakeTime = 0;
  }
  e.prevHeadTilt = e.headTilt;
  e.headTilt = f(e.headTilt + f(f((e.begging ? 1 : 0) - e.headTilt) * f(0.4)));
  if (e.begging) e.idle = 0; // `g = 10`: the idle counter is held back while it begs
  if (inWater) {
    e.wet = true;
    e.shaking = false;
    e.shakeTime = 0;
    e.prevShakeTime = 0;
  } else if ((e.wet || e.shaking) && e.shaking) {
    if (e.shakeTime === 0) out.shakeSound = true;
    e.prevShakeTime = e.shakeTime;
    e.shakeTime = f(e.shakeTime + f(0.05));
    if (e.prevShakeTime >= 2) {
      e.wet = false;
      e.shaking = false;
      e.prevShakeTime = 0;
      e.shakeTime = 0;
    }
    if (e.shakeTime > f(0.4)) {
      out.splashes = Math.max(0, Math.trunc(f(mhSin(f(f(e.shakeTime - f(0.4)) * f(Math.PI))) * 7)));
      out.splashHeight = 0.8;
    }
  }
  return out;
}
