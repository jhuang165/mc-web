// Minecraft Java 1.7.10 EntitySilverfish (yk), BlockSilverfish (amb, the monster egg) and ModelSilverfish (bia).
// A leaf module: the legacy (non-AI-task) action state is ported with injected hooks, so entities.js
// supplies the live world and tests/silverfish.test.js replays public/research/silverfish-reference.json.
const f = Math.fround;
export const STONE = 3, COBBLESTONE = 12, STONE_BRICKS = 101, MONSTER_EGG = 68;
export const SILVERFISH = Object.freeze({ health: 8, width: f(0.3), height: f(0.7), speed: 0.6000000238418579, damage: 1, followRange: 16 });
export const isSilverfish = (type) => type === "silverfish";
// EntitySilverfish: say/hit/kill; step never plays (canTriggerWalking is false).
export const SILVERFISH_SOUNDS = Object.freeze({ say: "mob.silverfish.say", hurt: "mob.silverfish.hit", death: "mob.silverfish.kill", step: "mob.silverfish.step" });
// Facing.offsetsXForSide / YForSide / ZForSide: down, up, north, south, west, east.
export const FACING = Object.freeze([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]);

// BlockSilverfish.func_150196_a: stone, cobblestone and stone bricks can hold a silverfish.
export const canHide = (id) => id === STONE || id === COBBLESTONE || id === STONE_BRICKS;
// BlockSilverfish.func_150195_a(block, meta): the monster-egg metadata that imitates the block.
export function eggMetaFor(id, meta) {
  if (meta === 0) return id === COBBLESTONE ? 1 : id === STONE_BRICKS ? 2 : 0;
  return id === STONE_BRICKS ? (meta === 1 ? 3 : meta === 2 ? 4 : meta === 3 ? 5 : 0) : 0;
}
// BlockSilverfish.func_150197_b(meta): the block a monster egg is made of (anything over 5 is stone).
export function blockForEggMeta(meta) {
  switch (meta) {
    case 1: return { id: COBBLESTONE, meta: 0 };
    case 2: return { id: STONE_BRICKS, meta: 0 };
    case 3: return { id: STONE_BRICKS, meta: 1 };
    case 4: return { id: STONE_BRICKS, meta: 2 };
    case 5: return { id: STONE_BRICKS, meta: 3 };
    default: return { id: STONE, meta: 0 };
  }
}
// BlockSilverfish.createStackedBlock (the silk-touch drop): the same block as a stack of one.
export const silkStack = (meta) => blockForEggMeta(meta);
// Block.onBlockDestroyedByPlayer / dropBlockAsItemWithChance (both spawn a silverfish at the cell's
// centre, yaw 0, when not remote). tryHarvestBlock runs removeBlock (which fires the first) and, outside
// Creative, harvestBlock: without Silk Touch dropBlockAsItemWithChance fires the second; with Silk
// Touch the stacked block drops instead and nothing else spawns. quantityDropped is 0.
export function eggBreak({ creative = false, silkTouch = false, meta = 0 } = {}) {
  const spawns = 1 + (creative || silkTouch ? 0 : 1);
  return { spawns, item: !creative && silkTouch ? silkStack(meta) : null };
}
export const eggSpawn = (x, y, z) => ({ x: x + 0.5, y, z: z + 0.5, yaw: 0 });

// EntitySilverfish.attackEntityFrom (yk.a(ro, F)): an EntityDamageSource or DamageSource.magic arms the 20 tick summon
// cooldown when it is not already running. Returns the new cooldown.
export const hurtSummon = (cooldown, source) => (cooldown <= 0 && (source?.entity || source?.type === "magic") ? 20 : cooldown);
// EntitySilverfish.attackEntity (yk.a(sa, F)): attackTime 0, closer than 1.2f and overlapping in Y.
export function attackReady(e, targetMinY, targetMaxY, distance) {
  return e.attackTime <= 0 && f(distance) < f(1.2) && targetMaxY > e.y && targetMinY < e.y + SILVERFISH.height;
}
// World.getClosestVulnerablePlayerToEntity (ahb.b(sa, D) -> b(DDDD)) without sneak/invisible scaling:
// players with disableDamage or not alive are skipped; the nearest inside the range wins.
export function closestVulnerablePlayer(e, players, range = 8) {
  let best = null, bestSq = -1;
  for (const p of players) {
    if (p.creative || p.disableDamage || p.alive === false) continue;
    const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, d = dx * dx + dy * dy + dz * dz;
    if (d < range * range && (bestSq === -1 || d < bestSq)) { best = p; bestSq = d; }
  }
  return best;
}
// EntitySilverfish.getBlockPathWeight: stone below is 10, otherwise EntityMob's 0.5 - light brightness.
export const pathWeight = (belowId, brightness) => (belowId === STONE ? 10 : f(f(0.5) - f(brightness)));
// EntitySilverfish.getCanSpawnHere: EntityMob's (not Peaceful; isValidLightLevel is overridden to true, so
// no light rolls and no draws), EntityLiving's box checks, pathWeight >= 0, and no player within 5.
// env: difficulty, entityCollision(box), blockCollision(box), liquid(box), belowId(x, y, z), brightness(x, y, z),
// playerWithin(x, y, z, range).
export function silverfishCanSpawnHere(mob, env, boxOf) {
  if (env.difficulty === 0) return false;
  const box = boxOf(mob);
  if (env.entityCollision(box) || env.blockCollision(box) || env.liquid(box)) return false;
  const x = Math.floor(mob.x), y = Math.floor(mob.y), z = Math.floor(mob.z);
  if (pathWeight(env.belowId(x, y - 1, z), env.brightness(x, y, z)) < 0) return false;
  return !env.playerWithin(mob.x, mob.y, mob.z, 5);
}

// MathHelper.wrapAngleTo180_float and EntityLiving.updateRotation (sw.b(FFF)F).
const wrap = (a) => {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
};
const turn = (cur, want, max) => {
  let d = wrap(f(want - cur));
  if (d > max) d = max;
  if (d < -max) d = -max;
  return f(cur + d);
};
const DEG = 3.1415927410125732;
const floor = Math.floor;
// EntityLiving.faceEntity (sw.a(sa, F, F)): yaw step `yawStep`, pitch step `pitchStep`. Eye height is the
// living target's posY + eye; env.eyeHeight(e) gives it (EntityLivingBase: height * 0.85F, players 1.62F).
export function faceEntity(e, target, yawStep, pitchStep, env) {
  const dx = target.x - e.x, dz = target.z - e.z;
  const mine = e.y + env.eyeHeight(e);
  const dy = target.living === false ? (env.boxMidY(target) - mine) : target.y + env.eyeHeight(target) - mine;
  const d3 = f(Math.sqrt(dx * dx + dz * dz));
  const yaw = f(f((Math.atan2(dz, dx) * 180) / DEG) - 90), pitch = f(-((Math.atan2(dy, d3) * 180) / DEG));
  e.rotationPitch = turn(e.rotationPitch, pitch, pitchStep);
  e.rotationYaw = turn(e.rotationYaw, yaw, yawStep);
}
const distanceTo = (a, b) => {
  const x = f(a.x - b.x), y = f(a.y - b.y), z = f(a.z - b.z);
  return f(Math.sqrt(f(f(f(x * x) + f(y * y)) + f(z * z))));
};
const distSq = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z);

// A fresh state for the legacy AI fields. e is mutated in place by the functions below.
export function legacyFields() {
  return { target: null, path: null, entityAge: 0, summonCooldown: 0, attackTime: 0, lookTarget: null, chaseTicks: 0, randomYaw: 0, moveForward: 0, moveStrafing: 0, jumping: false, rotationYaw: 0, rotationPitch: 0 };
}

// EntityLiving.despawnEntity (sw.w): not persistent; the nearest player decides.
function despawnEntity(e, env) {
  if (e.persistent) { e.entityAge = 0; return; }
  const p = env.closestPlayer(e, -1);
  if (!p) return;
  const d = distSq(p, e);
  if (d > 16384) env.setDead(e);
  if (e.entityAge > 600 && env.rand.nextInt(800) === 0 && d > 1024) env.setDead(e);
  else if (d < 1024) e.entityAge = 0;
}
// EntityLiving.updateEntityActionState (sw.bq), after EntityLivingBase's ++entityAge.
function livingActionState(e, env) {
  const r = env.rand;
  e.entityAge++;
  e.moveStrafing = 0;
  e.moveForward = 0;
  despawnEntity(e, env);
  const range = 8;
  if (r.nextFloat() < f(0.02)) {
    const p = env.closestPlayer(e, range);
    if (p) {
      e.lookTarget = p;
      e.chaseTicks = 10 + r.nextInt(20);
    } else e.randomYaw = f(f(r.nextFloat() - f(0.5)) * 20);
  }
  if (e.lookTarget) {
    faceEntity(e, e.lookTarget, 10, 40, env);
    if (e.chaseTicks-- <= 0 || /* post-decrement (sw.bq: g-- <= 0) */ !env.isAlive(e.lookTarget) || distSq(e.lookTarget, e) > f(range * range)) e.lookTarget = null;
  } else {
    if (r.nextFloat() < f(0.05)) e.randomYaw = f(f(r.nextFloat() - f(0.5)) * 20);
    e.rotationYaw = f(e.rotationYaw + e.randomYaw);
    e.rotationPitch = 0;
  }
  const water = !!e.inWater, lava = !!e.inLava;
  if (water || lava) e.jumping = r.nextFloat() < f(0.8);
}
// EntityCreature.updateWanderPath (td.bQ): the best of ten random nearby cells by getBlockPathWeight.
function wanderPath(e, env) {
  const r = env.rand;
  let found = false, bx = -1, by = -1, bz = -1, best = f(-99999);
  for (let i = 0; i < 10; i++) {
    const x = floor(e.x + r.nextInt(13) - 6), y = floor(e.y + r.nextInt(7) - 3), z = floor(e.z + r.nextInt(13) - 6);
    const w = env.pathWeight(e, x, y, z);
    if (w > best) { best = w; bx = x; by = y; bz = z; found = true; }
  }
  if (found) e.path = env.pathToBlock(e, bx, by, bz, 10);
}
// EntityCreature.updateEntityActionState (td.bq) for a mob that is never "movement ceased" and never flees.
export function creatureActionState(e, env) {
  const r = env.rand;
  if (!e.target) {
    e.target = env.findPlayerToAttack(e);
    if (e.target) e.path = env.pathToEntity(e, e.target, 16);
  } else if (env.isAlive(e.target)) {
    const d = distanceTo(e.target, e);
    if (env.canSee(e, e.target)) env.attackEntity(e, e.target, d);
  } else e.target = null;
  if (e.target && env.isCreative(e.target)) e.target = null;
  if (e.target && (!e.path || r.nextInt(20) === 0)) e.path = env.pathToEntity(e, e.target, 16);
  else if (((!e.path && r.nextInt(180) === 0) || r.nextInt(120) === 0) && e.entityAge < 100) wanderPath(e, env);
  const i = floor(e.y + 0.5), water = !!e.inWater, lava = !!e.inLava;
  e.rotationPitch = 0;
  if (!e.path || r.nextInt(100) === 0) {
    livingActionState(e, env);
    e.path = null;
    return;
  }
  let vec = e.path.getPosition(e);
  const reach = f(f(e.width * 2));
  while (vec && (vec.x - e.x) * (vec.x - e.x) + (vec.z - e.z) * (vec.z - e.z) < reach * reach) {
    e.path.incrementPathIndex();
    if (e.path.isFinished()) { vec = null; e.path = null; } else vec = e.path.getPosition(e);
  }
  e.jumping = false;
  if (vec) {
    const dx = vec.x - e.x, dz = vec.z - e.z, dy = vec.y - i;
    const want = f(f((Math.atan2(dz, dx) * 180) / DEG) - 90);
    let step = wrap(f(want - e.rotationYaw));
    e.moveForward = f(e.speed ?? SILVERFISH.speed); // td.be: the movementSpeed attribute (a giant passes its own)
    if (step > 30) step = 30;
    if (step < -30) step = -30;
    e.rotationYaw = f(e.rotationYaw + step);
    if (dy > 0) e.jumping = true;
  }
  if (e.target) faceEntity(e, e.target, 30, 30, env);
  if (e.collidedH && !e.path) e.jumping = true;
  if (r.nextFloat() < f(0.8) && (water || lava)) e.jumping = true;
}
// EntityLiving.spawnExplosionParticle (sw.s): twenty "explode" puffs, each drawing three nextGaussian and
// three nextFloat from Entity.rand (the server's spawnParticle itself does nothing, the draws still happen).
function explosionDraws(r) {
  for (let i = 0; i < 20; i++) {
    r.nextGaussian(); r.nextGaussian(); r.nextGaussian();
    r.nextFloat(); r.nextFloat(); r.nextFloat();
  }
}
// The monster-egg wake scan of EntitySilverfish.updateEntityActionState: when the summon cooldown reaches 0,
// the cells around the fish (dy 0,1,-1..+-5; dx and dz 0,1,-1..+-10, in that nesting) are searched in order. Each
// monster egg is broken without drops (mobGriefing) or turned back into its block, releases a silverfish, and a
// nextBoolean stops the scan.
function wake(e, env) {
  const r = env.rand, i = floor(e.x), j = floor(e.y), k = floor(e.z);
  const next = (v) => (v <= 0 ? 1 - v : 0 - v);
  let done = false;
  for (let dy = 0; !done && dy <= 5 && dy >= -5; dy = next(dy))
    for (let dx = 0; !done && dx <= 10 && dx >= -10; dx = next(dx))
      for (let dz = 0; !done && dz <= 10 && dz >= -10; dz = next(dz)) {
        const x = i + dx, y = j + dy, z = k + dz;
        if (env.getBlock(x, y, z) !== MONSTER_EGG) continue;
        if (env.mobGriefing) env.breakBlock(x, y, z);
        else {
          const b = blockForEggMeta(env.getMeta(x, y, z));
          env.setBlock(x, y, z, b.id, b.meta);
        }
        env.releaseEgg(x, y, z);
        if (r.nextBoolean()) done = true;
      }
}
// EntitySilverfish.updateEntityActionState (yk.bq).
export function silverfishActionState(e, env) {
  creatureActionState(e, env);
  if (env.remote) return;
  if (e.summonCooldown > 0) {
    e.summonCooldown--;
    if (e.summonCooldown === 0) wake(e, env);
  }
  if (!e.target && !e.path) {
    const x = floor(e.x), y = floor(e.y + 0.5), z = floor(e.z), side = env.rand.nextInt(6);
    const nx = x + FACING[side][0], ny = y + FACING[side][1], nz = z + FACING[side][2];
    const id = env.getBlock(nx, ny, nz);
    if (canHide(id)) {
      env.setBlock(nx, ny, nz, MONSTER_EGG, eggMetaFor(id, env.getMeta(nx, ny, nz)));
      explosionDraws(env.rand);
      env.explosionParticle(e);
      env.setDead(e);
    } else wanderPath(e, env);
  } else if (e.target && !e.path) e.target = null;
}

// ModelSilverfish: seven body segments and three layer boxes, texture 64x32. `point` is the rest rotation point
// (x 0, y, z) and `box` the cube [x0, y0, z0, x1, y1, z1] in 1/16 block units; layers copy a segment's
// rotation: layer 0 segment 2, layer 1 segment 4, layer 2 segment 1.
export const SILVERFISH_MODEL = Object.freeze({
  texture: [64, 32],
  segments: [
    { y: 22, z: -3.5, box: [-1.5, 0, -1, 1.5, 2, 1], uv: [0, 0] },
    { y: 21, z: -1.5, box: [-2, 0, -1, 2, 3, 1], uv: [0, 4] },
    { y: 20, z: 1, box: [-3, 0, -1.5, 3, 4, 1.5], uv: [0, 9] },
    { y: 21, z: 4, box: [-1.5, 0, -1.5, 1.5, 3, 1.5], uv: [0, 16] },
    { y: 22, z: 7, box: [-1, 0, -1.5, 1, 2, 1.5], uv: [0, 22] },
    { y: 23, z: 9.5, box: [-1, 0, -1, 1, 1, 1], uv: [11, 0] },
    { y: 23, z: 11.5, box: [-0.5, 0, -1, 0.5, 1, 1], uv: [13, 4] },
  ],
  layers: [
    { y: 16, z: 1, box: [-5, 0, -1.5, 5, 8, 1.5], uv: [20, 0], copy: 2 },
    { y: 20, z: 7, box: [-3, 0, -1.5, 3, 4, 1.5], uv: [20, 11], copy: 4 },
    { y: 19, z: -1.5, box: [-3, 0, -1.5, 3, 5, 0.5], uv: [20, 18], copy: 1 },
  ],
});
// ModelSilverfish.setRotationAngles: every segment sways with the entity age.
export function silverfishPose(age) {
  const parts = SILVERFISH_MODEL.segments.map((s, i) => {
    const a = f(f(f(age * f(0.9)) + f(f(i * f(0.15)) * f(Math.PI)))), spread = 1 + Math.abs(i - 2);
    return {
      x: f(f(f(Math.sin(a) * f(Math.PI)) * f(0.2)) * Math.abs(i - 2)),
      yaw: f(f(f(Math.cos(a) * f(Math.PI)) * f(0.05)) * spread),
    };
  });
  return { segments: parts, layers: SILVERFISH_MODEL.layers.map((l) => parts[l.copy]) };
}
