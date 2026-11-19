// Batch 83 corpse83: the parts of a dying mob's own update (deathTime 1..20) that test no health, on top of what entities.js `dying` already runs.
// Bytecode-read (javap -c -p, 1.7.10 jar) and replayed against public/research/corpse-living-reference.json (tools/probes/CorpseLivingProbe.java):
//  - Entity.onEntityUpdate (sa.C): the sprint particle's two nextFloat, handleWaterMovement (sa.N: the flow push, fallDistance 0, inWater, the splash and the fire put out);
//    EntityLivingBase.onEntityUpdate (sv.C) sets the air to 300 when the mob is not alive (EntityWaterMob's wu.C too, with no ws.M() call).
//  - sv.C after onDeathUpdate: the revenge target lapses (sv.i cleared when it is dead or aa - bm > 100) and updatePotionEffects (sv.aO) counts the effects down
//    with their swirl draws; the effects' own hits are refused by attackEntityFrom at health <= 0, heal tests the health (mob-effects.js gates them).
//  - EntitySquid: sv.e's blocked movement still calls moveEntityWithHeading, which ws.e(FF) makes moveEntity(motion) (no gravity, friction or limb swing), then the
//    push (sv.bo), then ws.e's tail (one ws.M(), the tentacles, the coast on the frozen swim vector in water or the 0.08 fall out of it) and the body turn.
//  - EntityEnderman.onLivingUpdate (ya.e) runs whole except its isEntityAlive-gated block (the stare / chase test and its else: screaming and the chase counter stay).
//  - EntityWither.onLivingUpdate (xc.e): the 0.6 damping, the chase on head 0's target and the yaw before EntityMob's; the side heads after.
//  - EntityWolf.onLivingUpdate / onUpdate (wv.e, wv.h): the wet shake, the head tilt and the shake's sound and splashes; watcher 18 (the health the tail shows) is written
//    by updateAITasks (wv.bp), which a corpse skips, so it keeps the last live value.
//  - EntitySnowman.onLivingUpdate (wr.e): the melt and drown hits are refused, the snow trail is still laid.
// Already run before batch 83: EntityIronGolem's counters and walking dust (push -> golemTailTick). Not observable: EntityMob's entityAge += 2 in the light (yg.e).
import { moveEntity, entityRandom, inWater } from "./entities.js";
import { squidStateOf, squidLivingUpdate, squidWet, legacyBodyTurn } from "./squid-bat.js";
import { tickMobEffects } from "./mob-effects.js";
import { maxHealthOf } from "./mob-riding.js";
import { revengeOf } from "./revenge-target.js";
import { endermanTick } from "./enderman-live.js";
import { witherUpdate, witherPost } from "./wither-boss-mobs.js";

// sa.C / sv.C up to the fire and air, for a corpse (the caller runs it where the live path runs the water and the fire).
export function corpseEntityUpdate(m, e, t) {
  if (e.sprinting && !e.inWater && m.world.get(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z)) !== 0) { const r = entityRandom(e); r.nextFloat(); r.nextFloat(); }
  const wasInWater = e.inWater;
  if ((e.inWater = inWater(m.world, e, t.width, t.height))) e.fallDistance = 0;
  if (e.inWater && wasInWater === false) m.splash(e, t);
  m.burn(e, t);
  e.air = 300; // sv.C: `isEntityAlive() && isInsideOfMaterial(water)` fails, so setAir(300)
}

// sv.C after onDeathUpdate and recentlyHit: the revenge lapse (the live path's test) and updatePotionEffects.
export function corpseEffects(m, e, t, baseHealth) {
  if (e.revenge && (e.age + 1 - e.revenge > 100 || (revengeOf(e) !== "player" && !(revengeOf(e)?.health > 0 && m.entities.includes(revengeOf(e)))))) e.revenge = 0;
  tickMobEffects(e, t, () => maxHealthOf(e, baseHealth), entityRandom(e), m.fx, (x, n, name) => m.attackEntityFrom(x, n, { name }));
}

// The per-type part of onLivingUpdate before EntityLivingBase's movement.
export function corpseLivingHead(m, e, t) {
  if (e.type === "enderman") endermanTick(m, e, entityRandom(e)); // enderman-live.js passes the dead flag: the alive-gated block is skipped
  else if (e.type === "wither") witherUpdate(m, e, t);
}

// The per-type part after the movement and the push.
export function corpseLivingTail(m, e, t) {
  if (e.type === "wolf") { const dw = e.dwHealth; m.wolfUpdate(e, t); e.dwHealth = dw; }
  else if (e.type === "snow_golem") m.snowGolemUpdate(e, e.inWater || !!m.wet?.(e, t.height));
  else if (e.type === "wither") witherPost(m, e, t);
}

// A squid corpse's movement and ws.e tail (in place of the generic walk, push, body turn and limb swing).
export function squidCorpse(m, e, t) {
  const rand = entityRandom(e), s = squidStateOf(e, rand);
  if (Math.abs(e.vx) < 0.005) e.vx = 0;
  if (Math.abs(e.vy) < 0.005) e.vy = 0;
  if (Math.abs(e.vz) < 0.005) e.vz = 0;
  e.moveForward = 0;
  const hooks = { living: true, hurt: (source, points) => m.hazard(e, points, source), wet: false, fizz() {} };
  const landed = moveEntity(m.world, e, t.width, t.height, e.vx, e.vy, e.vz, undefined, hooks);
  if (landed > 0) {
    m.onLand?.(e, landed);
    m.fall(e, landed);
  }
  m.push(e, t);
  const r = squidWet(m.world, e);
  e.vx += r.push[0];
  e.vy += r.push[1];
  e.vz += r.push[2];
  squidLivingUpdate(s, e, { rand, wet: r.wet });
  legacyBodyTurn(e, e.x - e.px, e.z - e.pz);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}
