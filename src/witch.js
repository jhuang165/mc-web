// EntityWitch (yp, Minecraft Java 1.7.10): the pure rules. Ported from the unchanged classes and replayed in witch.test.js against
// public/research/witch-reference.json (tools/probes/WitchProbe.java, tools/verify-witch.mjs); public/research/witch.md lists what is
// native-verified and what is approximated. entities.js, ai.js, combat.js and witch-potions.js call into this module; the splash potion
// flight itself is projectiles.js (witch-potions.js).
import { mhSin, mhCos } from "./lighting.js";
import { getPotionEffects } from "./potions.js";
const f = Math.fround;
export const WITCH = Object.freeze({
  // EntityWitch.applyEntityAttributes: maxHealth 26 (EntityMob's 20 is replaced), movementSpeed 0.25; EntityMob adds attackDamage 2 (never used:
  // the witch has no melee task) and followRange 16.
  health: 26, width: f(0.6), height: f(1.8), movement: 0.25, followRange: 16, attackDamage: 2, talkInterval: 80, experience: 5,
  // EntityLiving.getEyeHeight (height * 0.85) and the potion attack's constants.
  eyeHeight: f(f(1.8) * f(0.85)),
});
// The sound names are the original's; 1.7.10's asset index has no mob.witch.* events, so they play nothing (public/research/witch.md).
export const WITCH_SOUNDS = Object.freeze({ idle: "mob.witch.idle", hurt: "mob.witch.hurt", death: "mob.witch.death" });
// Item ids of this build: glass bottle (original 374) and potion (original 373) are new here; the others are the existing ids of
// stick, sugar, spider eye, gunpowder, redstone dust and glowstone dust (this build's own numbers).
export const ITEM_GLASS_BOTTLE = 384, ITEM_POTION = 385;
const STICK = 300, SUGAR = 329, SPIDER_EYE = 326, GUNPOWDER = 330, REDSTONE = 360, GLOWSTONE_DUST = 383;
// EntityWitch.witchDrops (yp.br): glowstone dust, sugar, redstone dust, spider eye, glass bottle, gunpowder, stick, stick.
export const WITCH_DROP_TABLE = Object.freeze([GLOWSTONE_DUST, SUGAR, REDSTONE, SPIDER_EYE, ITEM_GLASS_BOTTLE, GUNPOWDER, STICK, STICK]);

// Drinking speed penalty: attribute modifier "Drinking speed penalty" (5CD17E52-...), -0.25, operation 0, not saved.
export const DRINK_PENALTY = Object.freeze([-0.25, 0]);
export const DRINK_TICKS = 32; // ItemPotion.getMaxItemUseDuration

// The eight potions the witch uses, as ItemPotion.getEffects reports them (splash durations are PotionHelper's 0.75 scaling, rounded).
// Entries are [effect id, amplifier, duration in ticks]. Other values come from potions.js (potionEffects below).
export const POTIONS = Object.freeze({
  8237: [[13, 0, 3600]], // water breathing (drunk)
  16307: [[12, 0, 3600]], // fire resistance (drunk)
  16341: [[6, 0, 1]], // instant health (drunk)
  16274: [[1, 0, 3600]], // swiftness (drunk)
  32732: [[7, 0, 1]], // splash instant damage
  32698: [[2, 0, 1351]], // splash slowness
  32660: [[19, 0, 676]], // splash poison
  32696: [[18, 0, 1351]], // splash weakness
});
export const POTION_THROWN_DEFAULT = 32732;
// Any other potion value (a player's thrown splash potion) reads PotionHelper through potions.js, which gives the same rows for the eight.
export const potionEffects = (damage) => POTIONS[damage] ?? (getPotionEffects(damage) ?? []).map((e) => [e.id, e.amplifier, e.duration]);
export const isSplashPotion = (damage) => (damage & 16384) !== 0;
export const SPLASH_EFFECT = { SLOWNESS: 2, WEAKNESS: 18, POISON: 19, HARM: 7, HEAL: 6 };

// EntityWitch.onLivingUpdate on the server, drinking half (yp.e): the countdown ends the drink, which hands the held potion's effects
// (and the speed penalty goes away); with no drink running each of five chained rolls on Entity.rand may start one. The final
// nextFloat() < 7.5E-4 is the client particle event (world.setEntityState 15); it is drawn all the same. `ctx`:
// { rand, inWater, burning, health, maxHealth, target, targetDistSq, hasEffect(id) }. Mutates `w` ({ drinking, timer, held }) and
// returns { finished, started } where finished is the held stack that was drunk.
export function witchDrink(w, ctx) {
  const out = { finished: null, started: null };
  const rand = ctx.rand;
  if (w.drinking) {
    if (--w.timer <= 0) {
      w.drinking = false;
      const held = w.held;
      w.held = null;
      if (held && held.id === ITEM_POTION) out.finished = held;
    }
  } else {
    let pick = -1;
    if (rand.nextFloat() < f(0.15) && ctx.inWater && !ctx.hasEffect(13)) pick = 8237;
    else if (rand.nextFloat() < f(0.15) && ctx.burning && !ctx.hasEffect(12)) pick = 16307;
    else if (rand.nextFloat() < f(0.05) && ctx.health < ctx.maxHealth) pick = 16341;
    else if (rand.nextFloat() < f(0.25) && ctx.target && !ctx.hasEffect(1) && ctx.targetDistSq > 121) pick = 16274;
    else if (rand.nextFloat() < f(0.25) && ctx.target && !ctx.hasEffect(1) && ctx.targetDistSq > 121) pick = 16274;
    if (pick > -1) {
      w.held = { id: ITEM_POTION, damage: pick, count: 1 };
      w.drinking = true;
      w.timer = DRINK_TICKS;
      out.started = pick;
    }
  }
  rand.nextFloat(); // the 7.5E-4 particle roll
  return out;
}

// EntityWitch.attackEntityWithRangedAttack (yp.a(sv, float)): nothing while drinking. The potion value: slowness against a target at
// distance >= 8 with no slowness, else poison against a healthy target (>= 8) without it, else weakness within 3 and 25 %, else damage.
// The aim is (dx, dy + dist * 0.2F, dz) with velocity 0.75 and inaccuracy 8.0; the spawn point comes from throwSpawn. `target`:
// { x, y, z, eyeHeight, motionX, motionZ, health, hasEffect(id) }; `witch`: { x, y, z }. Returns null when drinking.
export function chooseThrownPotion(rand, witch, target, drinking) {
  if (drinking) return null;
  const dx = target.x + target.motionX - witch.x, dy = target.y + f(target.eyeHeight) - 1.100000023841858 - witch.y, dz = target.z + target.motionZ - witch.z,
    dist = f(Math.sqrt(dx * dx + dz * dz));
  let damage = POTION_THROWN_DEFAULT;
  if (dist >= 8 && !target.hasEffect(SPLASH_EFFECT.SLOWNESS)) damage = 32698;
  else if (f(target.health) >= 8 && !target.hasEffect(SPLASH_EFFECT.POISON)) damage = 32660;
  else if (dist <= 3 && !target.hasEffect(SPLASH_EFFECT.WEAKNESS) && rand.nextFloat() < f(0.25)) damage = 32696;
  return { damage, dx, dy: dy + f(dist * f(0.2)), dz, dist, velocity: f(0.75), inaccuracy: f(8) };
}

// EntityThrowable(world, thrower): the eye position moved 0.16 sideways along the yaw and 0.1 down. `yawDegrees` is rotationYaw
// (Minecraft's own convention), `eye` the thrower's eye height.
export function throwSpawn(witch, yawDegrees, eye) {
  const k = f(f(f(yawDegrees) / 180) * f(Math.PI)), c = mhCos(k), s = mhSin(k);
  return { x: witch.x - f(c * f(0.16)), y: witch.y + f(eye) - 0.10000000149011612, z: witch.z - f(s * f(0.16)) };
}

// EntityPotion.onImpact (zo.a): every living entity in the potion's box grown by (4, 2, 4) and within sqrt(16) (position to position)
// takes the effects, scaled by 1 - sqrt(dist^2) / 4 (1 for the entity struck). Instant effects (harm 7, heal 6) hit at once: damage
// (int)(factor * (6 << amp) + 0.5) on a living target, healing (int)(factor * (4 << amp) + 0.5), the other way round for the undead.
// Timed effects last (int)(factor * duration + 0.5) ticks and are skipped at 20 or less. `impact`: { x, y, z }; `targets`:
// [{ x, y, z, width, height, undead, ref, direct }]. Returns [{ ref, hurt, heal, effects: [{ id, amplifier, duration }] }] in target order.
export function splashImpact(damage, impact, targets, thrower = null) {
  const effects = potionEffects(damage), out = [];
  if (!effects.length) return out;
  const hw = f(f(0.25) / 2), box = [impact.x - hw - 4, impact.y - 2, impact.z - hw - 4, impact.x + hw + 4, impact.y + f(0.25) + 2, impact.z + hw + 4];
  for (const t of targets) {
    const w2 = f(f(t.width) / 2), b = [t.x - w2, t.y, t.z - w2, t.x + w2, t.y + f(t.height), t.z + w2];
    if (!(b[3] > box[0] && b[0] < box[3] && b[4] > box[1] && b[1] < box[4] && b[5] > box[2] && b[2] < box[5])) continue;
    const d2 = (t.x - impact.x) ** 2 + (t.y - impact.y) ** 2 + (t.z - impact.z) ** 2;
    if (!(d2 < 16)) continue;
    let factor = 1 - Math.sqrt(d2) / 4;
    if (t.direct) factor = 1;
    const r = { ref: t.ref, hurt: 0, heal: 0, effects: [], thrower };
    for (const [id, amplifier, duration] of effects) {
      if (id === SPLASH_EFFECT.HARM || id === SPLASH_EFFECT.HEAL) {
        const harms = id === SPLASH_EFFECT.HARM ? !t.undead : !!t.undead;
        if (harms) r.hurt += Math.trunc(factor * (6 << amplifier) + 0.5);
        else r.heal += Math.trunc(factor * (4 << amplifier) + 0.5);
      } else {
        const ticks = Math.trunc(factor * duration + 0.5);
        // EntityLivingBase.isPotionApplicable: the undead take neither regeneration (10) nor poison (19).
        if (ticks > 20 && !(t.undead && (id === 10 || id === 19))) r.effects.push({ id, amplifier, duration: ticks });
      }
    }
    out.push(r);
  }
  return out;
}

// EntityWitch.func_70672_c / applyPotionDamageCalculations (yp.c(ro, float)): damage caused by the witch itself is ignored and magic
// damage is cut to 15 % (the double product narrowed to a float). `base` is the unchanged EntityLivingBase result.
export function witchDamage(amount, { isMagic, byWitch }, base = amount) {
  let a = f(base);
  if (byWitch) a = 0;
  if (isMagic) a = f(a * 0.15);
  return a;
}

// EntityWitch.dropFewItems (yp.b(boolean, int)): 1 to 3 draws, each a stack of nextInt(3) (+ nextInt(looting + 1) with looting) of one
// of the eight table items, dropped as single items. Entry: [id, damage].
export function witchDrops(rand, looting = 0) {
  const out = [], n = rand.nextInt(3) + 1;
  for (let i = 0; i < n; i++) {
    let k = rand.nextInt(3);
    const id = WITCH_DROP_TABLE[rand.nextInt(WITCH_DROP_TABLE.length)];
    if (looting > 0) k += rand.nextInt(looting + 1);
    for (let j = 0; j < k; j++) out.push([id, 0]);
  }
  return out;
}
// EntityLiving.dropEquipment for the held potion (drop chance 0.085F): only after a player hit, nextFloat() - looting * 0.01F.
export const WITCH_EQUIPMENT_CHANCE = f(0.085);
export function witchEquipmentDrop(rand, held, playerHit, looting = 0) {
  if (!held || !playerHit) return null;
  return f(rand.nextFloat() - f(looting * f(0.01))) < WITCH_EQUIPMENT_CHANCE ? { id: held.id, damage: held.damage, count: held.count ?? 1 } : null;
}
// EntityLiving.getExperiencePoints with a held item whose drop chance is at most 1: 5 plus 1 + nextInt(3) for it.
export const witchExperience = (rand, held) => 5 + (held ? 1 + rand.nextInt(3) : 0);

// ModelWitch.setRotationAngles (bim.a): the nose (and the mole on it) swings with the entity id; a held item pulls it forward.
// Returns [rotateX, rotateY, rotateZ, pointX, pointY, pointZ] of the nose. `ticks` is ticksExisted (entity age).
export function noseAngles(entityId, ticks, held) {
  const k = f(f(0.01) * f(entityId % 10)), t = f(ticks);
  const rx = f(f(f(mhSin(f(t * k)) * f(4.5)) * f(Math.PI)) / 180), rz = f(f(f(mhCos(f(t * k)) * f(2.5)) * f(Math.PI)) / 180);
  return held ? [f(-0.9), 0, rz, 0, f(0.1875), f(-0.09375)] : [rx, 0, rz, 0, 0, 0];
}
// ModelWitch boxes (texture 64 x 128) for the renderer: [name, parent, point, boxes] with boxes as [x, y, z, w, h, d, u, v, grow]; angles in radians.
export const WITCH_MODEL = Object.freeze({
  texture: [64, 128],
  head: { point: [0, 0, 0], boxes: [[-4, -10, -4, 8, 10, 8, 0, 0, 0]] },
  nose: { point: [0, 0, 0], boxes: [[-1, -1, -6, 2, 4, 2, 24, 0, 0]] },
  mole: { point: [0, -2, 0], boxes: [[0, 3, -6.75, 1, 1, 1, 0, 0, -0.25]] },
  hat: [
    { point: [-5, -10.03125, -5], angle: [0, 0, 0], boxes: [[0, 0, 0, 10, 2, 10, 0, 64, 0]] },
    { point: [1.75, -4, 2], angle: [f(-0.05235988), 0, f(0.02617994)], boxes: [[0, 0, 0, 7, 4, 7, 0, 76, 0]] },
    { point: [1.75, -4, 2], angle: [f(-0.10471976), 0, f(0.05235988)], boxes: [[0, 0, 0, 4, 4, 4, 0, 87, 0]] },
    { point: [1.75, -2, 2], angle: [f(-0.20943952), 0, f(0.10471976)], boxes: [[0, 0, 0, 1, 2, 1, 0, 95, 0.25]] },
  ],
  body: { point: [0, 0, 0], boxes: [[-4, 0, -3, 8, 12, 6, 16, 20, 0], [-4, 0, -3, 8, 18, 6, 0, 38, 0.5]] },
  arms: { point: [0, 3, -1], boxes: [[-8, -2, -2, 4, 8, 4, 44, 22, 0], [4, -2, -2, 4, 8, 4, 44, 22, 0], [-4, 2, -2, 8, 4, 4, 40, 38, 0]], angle: f(-0.75) },
  legs: [{ point: [-2, 12, 0], mirror: false }, { point: [2, 12, 0], mirror: true }],
  leg: [-2, 0, -2, 4, 12, 4, 0, 22, 0],
});
