// Minecraft Java 1.7.10 EntityEnderman (ya): the data and the pure rules. The live adapter is enderman-live.js and the
// model/render is enderman-renderer.js; entities.js and ai.js hook these in. Every rule below is checked against
// public/research/enderman-reference.json, which tools/probes/EndermanProbe.java records from the unchanged original
// classes (EntityEnderman ya over EntityMob yg / EntityLivingBase sv / Entity sa). See public/research/enderman.md for
// the obfuscated names and the limits.
//
// The rules work on a plain record `e` (feet position x, y, z; health; carried/carriedData as ORIGINAL block ids;
// screaming; aggressive; stareCount (bt); chaseTimer (bs)) and an environment `w` the caller supplies:
//   blockExists/blocksMovement/blockId/blockMeta/isNormalCube(x, y, z), collides(box), liquidIn(box), setBlock(x, y, z, id, meta),
//   canSeeSky/brightness(x, y, z), isDaytime(), rainingAt(x, y, z), lineBlocked(a, b), mobGriefing(),
//   sound(name, x, y, z, volume, pitch), particle(name, x, y, z, vx, vy, vz).
// Positions of players and targets are the server entity's posY: an EntityPlayerMP has yOffset 0, so posY is the feet and its
// getEyeHeight is 1.62 (batch 33, eye-height-reference.json).
import { mhSin, mhCos } from "./lighting.js";
const f = Math.fround;

export const ENDERMAN_WIDTH = f(0.6), ENDERMAN_HEIGHT = f(2.9), ENDERMAN_STEP_HEIGHT = 1;
// applyEntityAttributes: maxHealth 40, movementSpeed 0.30000001192092896, attackDamage 7. EntityMob's constructor sets
// experienceValue 5.
export const ENDERMAN_HEALTH = 40, ENDERMAN_SPEED = 0.30000001192092896, ENDERMAN_ATTACK = 7, ENDERMAN_XP = 5;
// e(): "Attacking speed boost" (UUID 020E0DFB-87AE-4653-9556-831010E291A0, +6.199999809265137, operation 0) is added while
// the enderman has an attack target (bm) and removed when it loses it.
export const SPEED_BOOST = 6.199999809265137;
// EntityEnderman.getEyeHeight is Entity's: height * 0.85 (a float).
export const ENDERMAN_EYE_HEIGHT = f(ENDERMAN_HEIGHT * f(0.85));
// EntityPlayerMP.getEyeHeight (mw.g, bytecode-read and replayed in eye-height-reference.json): 1.62 above the posY, which on the server
// is the feet. (EntityPlayer.getEyeHeight, yz.g, is the client's 0.12 over a posY that already is the eye.)
export const PLAYER_EYE_OFFSET = f(1.62);
// The static boolean[256] br of ya: grass, dirt, sand, gravel, dandelion, rose, both mushrooms, TNT, cactus, clay, pumpkin,
// melon and mycelium (probe: facts.carriable).
export const CARRIABLE = new Set([2, 3, 12, 13, 37, 38, 39, 40, 46, 81, 82, 86, 103, 110]);
export const PUMPKIN = 86;
// The original items: dropped ender pearl (the project's id for item 368) and its drop rule b(boolean, int).
export const ENDER_PEARL_ITEM = 378;
export const SOUNDS = { stare: "mob.endermen.stare", portal: "mob.endermen.portal", idle: "mob.endermen.idle", scream: "mob.endermen.scream", hit: "mob.endermen.hit", death: "mob.endermen.death" };

export const endermanFields = () => ({
  carried: 0, carriedData: 0, screaming: false, aggressive: false, stareCount: 0, chaseTimer: 0, speedBoost: false,
});
// What a save, an imported Java mob or /summon may contain, sanitised. ya.b(NBTTagCompound) writes `carried` and
// `carriedData` (shorts); the datawatcher keeps them as bytes. screaming/aggressive are not saved in 1.7.10.
export function endermanFieldsFrom(e) {
  const id = Number.isInteger(e?.carried) && e.carried > 0 && e.carried < 256 ? e.carried : 0;
  const data = id && Number.isInteger(e?.carriedData) && e.carriedData >= 0 && e.carriedData < 16 ? e.carriedData : 0;
  return { ...endermanFields(), carried: id, carriedData: data };
}
// aD()/e(): getAttributeValue(movementSpeed) is the legacy moveForward (td.bq).
export const moveSpeed = (e) => (e.speedBoost ? f(ENDERMAN_SPEED + SPEED_BOOST) : f(ENDERMAN_SPEED));

const box = (e) => {
  const h = f(ENDERMAN_WIDTH / 2);
  return { minX: e.x - h, minY: e.y, minZ: e.z - h, maxX: e.x + h, maxY: e.y + ENDERMAN_HEIGHT, maxZ: e.z + h };
};
const floor = Math.floor;

// EntityLivingBase.getLook(1.0) from the yaw/pitch fields, using MathHelper's sine table, then Vec3.normalize.
export function lookVector(yaw, pitch) {
  const k = f(0.017453292);
  const a = f(f(-yaw * k) - f(Math.PI));
  const f1 = mhCos(a), f2 = mhSin(a), p = f(-pitch * k), f3 = -mhCos(p), f4 = mhSin(p);
  return normalize({ x: f(f2 * f3), y: f4, z: f(f1 * f3) });
}
function normalize(v) {
  // Vec3.normalize / lengthVector go through MathHelper.sqrt_double, which returns a float.
  const d = f(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z));
  return d < 1e-4 ? { x: 0, y: 0, z: 0 } : { x: v.x / d, y: v.y / d, z: v.z / d };
}

// ya.f(yz) shouldAttackPlayer. `p` = { x, y (posY: the feet), z, yaw, pitch, helmet (original block id of the head slot or 0) }.
// A carved pumpkin on the head (the item of Blocks.pumpkin, id 86 as a block) makes the player harmless; the jack-o-lantern
// (91) does not. Then the look vector against the direction to the enderman's middle, the threshold 1 - 0.025 / distance, and
// EntityLivingBase.canEntityBeSeen (a block ray from the player's feet + 1.62 to the enderman's eye).
export function staresAt(e, p, w) {
  if (p.helmet === PUMPKIN) return false;
  const look = lookVector(p.yaw, p.pitch);
  const v = { x: e.x - p.x, y: e.y + f(ENDERMAN_HEIGHT / 2) - (p.y + PLAYER_EYE_OFFSET), z: e.z - p.z };
  const d0 = f(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)), n = normalize(v);
  if (!(look.x * n.x + look.y * n.y + look.z * n.z > 1 - 0.025 / d0)) return false;
  return !w.lineBlocked({ x: p.x, y: p.y + PLAYER_EYE_OFFSET, z: p.z }, { x: e.x, y: e.y + ENDERMAN_EYE_HEIGHT, z: e.z });
}

// ya.bR (findPlayerToAttack) for the closest vulnerable player within 64 blocks: a staring player makes the enderman
// aggressive, plays the stare sound on the first staring tick, and on the sixth makes it scream and returns the player.
export function findPlayerToAttack(e, p, w) {
  if (!p) return null;
  if (staresAt(e, p, w)) {
    e.aggressive = true;
    if (e.stareCount === 0) w.sound(SOUNDS.stare, p.x, p.y, p.z, 1, 1);
    if (e.stareCount++ === 5) {
      e.stareCount = 0;
      e.screaming = true;
      return p;
    }
  } else e.stareCount = 0;
  return null;
}

// ya.k(DDD) teleportTo. Falls to the ground (a block that blocks movement below, scanning down while y > 0), accepted when
// the body box collides with nothing and holds no liquid, then 128 "portal" particles along the path and the portal sound
// at the old and new positions. Returns false (position restored) otherwise.
export function teleportTo(e, x, y, z, w, rng) {
  const ox = e.x, oy = e.y, oz = e.z;
  e.x = x; e.y = y; e.z = z;
  let ok = false;
  const bx = floor(e.x), bz = floor(e.z);
  let by = floor(e.y);
  if (w.blockExists(bx, by, bz)) {
    let ground = false;
    while (!ground && by > 0) {
      if (w.blocksMovement(bx, by - 1, bz)) ground = true;
      else { e.y -= 1; by--; }
    }
    if (ground) ok = !w.collides(box(e)) && !w.liquidIn(box(e));
  }
  if (!ok) { e.x = ox; e.y = oy; e.z = oz; return false; }
  for (let i = 0; i < 128; i++) {
    const d = i / 127, vx = f(f(rng.nextFloat() - 0.5) * f(0.2)), vy = f(f(rng.nextFloat() - 0.5) * f(0.2)), vz = f(f(rng.nextFloat() - 0.5) * f(0.2));
    const px = ox + (e.x - ox) * d + (rng.nextDouble() - 0.5) * ENDERMAN_WIDTH * 2;
    const py = oy + (e.y - oy) * d + rng.nextDouble() * ENDERMAN_HEIGHT;
    const pz = oz + (e.z - oz) * d + (rng.nextDouble() - 0.5) * ENDERMAN_WIDTH * 2;
    w.particle("portal", px, py, pz, vx, vy, vz);
  }
  w.sound(SOUNDS.portal, ox, oy, oz, 1, 1);
  w.sound(SOUNDS.portal, e.x, e.y, e.z, 1, 1);
  return true;
}
// ya.bZ teleportRandomly: a point within 32 blocks horizontally and +-32 vertically.
export function teleportRandomly(e, w, rng) {
  const x = e.x + (rng.nextDouble() - 0.5) * 64, y = e.y + (rng.nextInt(64) - 32), z = e.z + (rng.nextDouble() - 0.5) * 64;
  return teleportTo(e, x, y, z, w, rng);
}
// ya.c(sa) teleportToEntity: 16 blocks back along the line from the target's eye to the enderman, scattered by +-4 / +-8.
// `t` = { x, y (posY), z, eye (the target's getEyeHeight) }.
export function teleportToEntity(e, t, w, rng) {
  const v = normalize({ x: e.x - t.x, y: e.y + f(ENDERMAN_HEIGHT / 2) - t.y + t.eye, z: e.z - t.z });
  const x = e.x + (rng.nextDouble() - 0.5) * 8 - v.x * 16, y = e.y + (rng.nextInt(16) - 8) - v.y * 16, z = e.z + (rng.nextDouble() - 0.5) * 8 - v.z * 16;
  return teleportTo(e, x, y, z, w, rng);
}

// ya.a(ro, F) attackEntityFrom. `src` = { direct: attacker is a melee EntityDamageSource, player: that attacker is a player,
// projectile: an EntityDamageSourceIndirect (arrow, snowball, pearl, fireball) }. A projectile never hurts: the enderman
// tries teleportRandomly up to 64 times and returns whether one worked. Everything else screams, a player melee hit makes it
// aggressive, and the normal damage (yg.a) follows: `proceed` is true then (and the caller makes the attacker the target).
export function attackEntityFrom(e, src, w, rng) {
  e.screaming = true;
  if (src.direct && src.player) e.aggressive = true;
  if (src.projectile) {
    e.aggressive = false;
    for (let i = 0; i < 64; i++) if (teleportRandomly(e, w, rng)) return { result: true, proceed: false };
    return { result: false, proceed: false };
  }
  return { result: true, proceed: true };
}
// EntityLiving.getSoundPitch: (nextFloat - nextFloat) * 0.2 + 1 (the hurt/living sound pitch).
export const soundPitch = (rng) => f(f(f(rng.nextFloat() - rng.nextFloat()) * f(0.2)) + 1);

// ya.u / b(boolean, int): 0 to 1 + looting ender pearls (nextInt(2 + looting)). The carried block is NOT dropped on death.
export const pearlCount = (rng, looting = 0) => rng.nextInt(2 + Math.max(0, looting));

// ya.t: scream while screaming, else idle. s/aT, aU: hit and death.
export const livingSound = (e) => (e.screaming ? SOUNDS.scream : SOUNDS.idle);

// The carry rules inside ya.e(): with the mobGriefing rule on and not remote. Empty-handed: 1/20 per tick to look at
// one random cell (x within 2, y 0..3 above the feet, z within 2) and take it when it is carriable. Carrying: 1/2000 per
// tick to put the block into a random cell (within 1, 0..2 above) that is air with a normal cube below.
export function carryStep(e, w, rng) {
  if (e.carried === 0) {
    if (rng.nextInt(20) !== 0) return;
    const x = floor(e.x - 2 + rng.nextDouble() * 4), y = floor(e.y + rng.nextDouble() * 3), z = floor(e.z - 2 + rng.nextDouble() * 4);
    const id = w.blockId(x, y, z);
    if (id > 0 && CARRIABLE.has(id)) {
      e.carried = id;
      e.carriedData = w.blockMeta(x, y, z);
      w.setBlock(x, y, z, 0, 0);
    }
  } else if (rng.nextInt(2000) === 0) {
    const x = floor(e.x - 1 + rng.nextDouble() * 2), y = floor(e.y + rng.nextDouble() * 2), z = floor(e.z - 1 + rng.nextDouble() * 2);
    if (w.blockId(x, y, z) === 0 && w.blockId(x, y - 1, z) !== 0 && w.isNormalCube(x, y - 1, z)) {
      w.setBlock(x, y, z, e.carried, e.carriedData);
      e.carried = 0;
      e.carriedData = 0;
    }
  }
}

// ya.e(), everything before the EntityMob/EntityLivingBase update, in the original's order and with its Random draws.
// ctx = { rng, target (null or { x, y, z, eye, player: p | null, id }), dropTarget(), wet (L: in water or rain), burning (al),
//         hurt(source) (the 1 point of drown damage), distanceSq(target), face(target) (isJumping = false and faceEntity 100/100) }.
// `p` (when the target is a player) is the staring record staresAt takes. The mob's own particle effect (two "portal"
// particles a tick) is drawn here because it consumes Entity.rand.
export function tick(e, w, ctx) {
  const { rng } = ctx;
  const wet = ctx.wet;
  if (wet) ctx.hurt({ name: "drown" });
  const had = e.prevTarget ?? null, target = ctx.target;
  if (had !== (target?.id ?? null)) {
    e.speedBoost = !!target;
    e.prevTarget = target?.id ?? null;
  }
  if (w.mobGriefing()) carryStep(e, w, rng);
  for (let i = 0; i < 2; i++) {
    const px = e.x + (rng.nextDouble() - 0.5) * ENDERMAN_WIDTH, py = e.y + rng.nextDouble() * ENDERMAN_HEIGHT - 0.25, pz = e.z + (rng.nextDouble() - 0.5) * ENDERMAN_WIDTH;
    w.particle("portal", px, py, pz, (rng.nextDouble() - 0.5) * 2, -rng.nextDouble(), (rng.nextDouble() - 0.5) * 2);
  }
  let tgt = target;
  const lose = () => { ctx.dropTarget(); tgt = null; e.screaming = false; e.aggressive = false; teleportRandomly(e, w, rng); };
  if (w.isDaytime()) {
    const b = w.brightness(floor(e.x), floor(e.y + ENDERMAN_HEIGHT * 0.66), floor(e.z));
    if (b > f(0.5) && w.canSeeSky(floor(e.x), floor(e.y), floor(e.z)) && f(rng.nextFloat() * f(30)) < f(f(b - f(0.4)) * 2)) lose();
  }
  if (ctx.wet || ctx.burning) lose();
  if (e.screaming && !e.aggressive && rng.nextInt(100) === 0) e.screaming = false;
  ctx.face?.(tgt); // bc = false, then faceEntity(bm, 100, 100) when the (possibly just dropped) target is set
  if (tgt) {
    if (tgt.player && staresAt(e, tgt.player, w)) {
      if (ctx.distanceSq(tgt) < 16) teleportRandomly(e, w, rng); // ya.e(): sa.f(sa) is getDistanceSqToEntity, `< 16.0D` = 4 blocks (bytecode-read)
      e.chaseTimer = 0;
    } else if (ctx.distanceSq(tgt) > 256 && // bs++ >= 30 (post-increment, bytecode-read at offset 817)
      e.chaseTimer++ >= 30 && teleportToEntity(e, tgt, w, rng)) e.chaseTimer = 0;
  } else {
    e.screaming = false;
    e.chaseTimer = 0;
  }
}
