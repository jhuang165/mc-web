// EntityDragon (xa), EntityDragonPart (wy) rules of 1.7.10 as pure functions, ported from the original bytecode.
// Evidence: public/research/dragon-reference.json (tools/probes/DragonProbe.java drives the unchanged classes).
// All float fields and float temporaries are rounded with Math.fround where the original uses float.
//
// The dragon `e` is any object with x, y, z, vx, vy, vz, yaw (degrees), health, hurtTime, ticksExisted. Its
// dragon-only state is `e.dragon` (createDragonState). `host` supplies the world:
//   host.rand                      java.util.Random like (nextFloat, nextInt, nextGaussian)
//   host.players                   array of { x, z, minY } (World.playerEntities)
//   host.crystals(box)             alive or dead EntityEnderCrystal objects { x, y, z, dead } whose box meets `box`
//   host.living(box)               entities (excluding the dragon) whose box meets `box`: { living, push(x, y, z), hurt(damage) }
//   host.blockKind(x, y, z)        0 air, 1 obsidian / end stone / bedrock, 2 anything else
//   host.removeBlock(x, y, z)      World.setBlockToAir, returns whether it changed
//   host.griefing                  gamerule mobGriefing
//   host.particle(name, x, y, z)   largeexplode / hugeexplosion
//   host.orb(amount), host.worldEvent(id, x, y, z), host.portal(x, z)   death effects
//   (yaw is e.rotationYaw, Java degrees)
//   host.hurt(e, amount, source)   livingHurt for the dragon (base attackEntityFrom: hurt window)
import { mhSin, mhCos } from "./lighting.js";

const f = Math.fround;
const PI_F = f(Math.PI);
export const DRAGON_MAX_HEALTH = 200;
export const DRAGON_WIDTH = 16, DRAGON_HEIGHT = 8;
export const DRAGON_CRYSTAL_RANGE = 32;
export const DRAGON_XP_TOTAL = 12000;
export const DRAGON_SOUNDS = Object.freeze({ growl: "mob.enderdragon.growl", hit: "mob.enderdragon.hit", wings: "mob.enderdragon.wings", volume: 5, deathEvent: 1018 });
export const PART_NAMES = ["head", "body", "tail1", "tail2", "tail3", "wing1", "wing2"];
// Part sizes the dragon writes into the parts every tick (width, height).
export const PART_SIZES = Object.freeze([[3, 3], [5, 3], [2, 2], [2, 2], [2, 2], [4, 2], [4, 3]]);
const HEAD = 0;

// MathHelper.wrapAngleTo180_float / _double.
export function wrapFloat(a) {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
}
export function wrapDouble(a) {
  a %= 360;
  if (a >= 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
const sqrtF = (v) => f(Math.sqrt(v));
const rad = (yaw) => f(f(yaw * PI_F) / 180);
const clampD = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Vec3.normalize: float sqrt of the squared length, zero below 1e-4.
function normalize(x, y, z) {
  const d = sqrtF(x * x + y * y + z * z);
  return d < 1e-4 ? [0, 0, 0] : [x / d, y / d, z / d];
}

export function partBox(x, y, z, width, height) {
  const h = f(width / 2);
  return [x - h, y, z - h, x + h, y + height, z + h];
}

export function createDragonState(e) {
  const s = {
    tx: 0, ty: 100, tz: 0, target: null,
    ring: new Float64Array(64 * 3), ri: -1,
    prevAnim: 0, anim: 0, force: false, slowed: false, deathTicks: 0, ryv: 0, healer: null,
    bb: null, parts: PART_SIZES.map(([w, h]) => ({ width: w, height: h, box: partBox(0, 0, 0, w, h) })),
  };
  e.dragon = s;
  setPosition(e, e.x, e.y, e.z);
  return s;
}

// Entity.setPosition: the box is rebuilt from the position (width 16 / height 8 as floats).
export function setPosition(e, x, y, z) {
  e.x = x; e.y = y; e.z = z;
  e.dragon.bb = [x - 8, y, z - 8, x + 8, y + DRAGON_HEIGHT, z + 8];
}

// Entity.moveEntity with noClip: only the box moves; the position is read back from it.
export function moveNoClip(e, dx, dy, dz) {
  const b = e.dragon.bb;
  b[0] += dx; b[3] += dx; b[1] += dy; b[4] += dy; b[2] += dz; b[5] += dz;
  e.x = (b[0] + b[3]) / 2;
  e.y = b[1];
  e.z = (b[2] + b[5]) / 2;
}

// EntityDragon.getMovementOffsets (xa.b(int, float)): ring buffer sample n ticks back, [yaw, y, unused].
export function movementOffsets(e, n, p) {
  const s = e.dragon;
  if (e.health <= 0) p = 0;
  p = f(1 - p);
  const i = (s.ri - n) & 63, j = (s.ri - n - 1) & 63, r = s.ring;
  return [
    r[i * 3] + wrapDouble(r[j * 3] - r[i * 3]) * p,
    r[i * 3 + 1] + (r[j * 3 + 1] - r[i * 3 + 1]) * p,
    r[i * 3 + 2] + (r[j * 3 + 2] - r[i * 3 + 2]) * p,
  ];
}

// EntityDragon.setNewTarget (bQ).
export function setNewTarget(e, host) {
  const s = e.dragon, rand = host.rand;
  s.force = false;
  if (rand.nextInt(2) === 0 && host.players.length > 0) {
    s.target = host.players[rand.nextInt(host.players.length)];
    return;
  }
  let far = false;
  do {
    s.tx = 0;
    s.ty = f(70 + f(rand.nextFloat() * 50));
    s.tz = 0;
    s.tx += f(f(rand.nextFloat() * 120) - 60);
    s.tz += f(f(rand.nextFloat() * 120) - 60);
    const dx = e.x - s.tx, dy = e.y - s.ty, dz = e.z - s.tz;
    far = dx * dx + dy * dy + dz * dz > 100;
  } while (!far);
  s.target = null;
}

// EntityLivingBase.attackEntityFrom's hurt window as the dragon's base call needs it. Returns whether it hurt.
// A fresh hit (not inside the window) advances the entity Random by four draws (the probe shows
// 4 next() calls for an explosion and 6 for a player: the hit sound pitch, and the knockback
// nextDouble when the source has an entity); `host.onHurtSound` receives the call.
export function livingHurt(e, amount, source, host) {
  if (e.health <= 0) return false;
  let dealt = amount;
  if ((e.hurtResist || 0) > 10) {
    if (amount <= (e.lastDamage || 0)) return false;
    dealt = amount - e.lastDamage;
    e.lastDamage = amount;
  } else {
    e.lastDamage = amount;
    e.hurtResist = 20;
    e.hurtTime = 10;
    if (host?.rand) {
      for (let i = 0; i < 4; i++) host.rand.nextFloat();
      if (source?.player) host.rand.nextDouble();
    }
    host?.onHurtSound?.(e);
  }
  e.health -= dealt;
  return true;
}

// EntityDragon.attackEntityFromPart (xa.a(wy, ro, float)). `source` = { player, explosion }. Always true;
// only a player or an explosion actually hurts, the other parts take dmg / 4 + 1.
export function attackFromPart(e, partIndex, source, dmg, host) {
  const s = e.dragon, rand = host.rand;
  if (partIndex !== HEAD) dmg = f(f(dmg / 4) + 1);
  const a = rad(e.rotationYaw), sn = mhSin(a), cs = mhCos(a);
  s.tx = e.x + f(sn * 5) + f(f(rand.nextFloat() - 0.5) * 2);
  s.ty = e.y + f(rand.nextFloat() * 3) + 1;
  s.tz = e.z - f(cs * 5) + f(f(rand.nextFloat() - 0.5) * 2);
  s.target = null;
  if (source && (source.player || source.explosion)) (host.hurt ?? livingHurt)(e, dmg, source, host);
  return true;
}

// EntityDragon.updateDragonEnderCrystal (bP).
export function crystalUpdate(e, host) {
  const s = e.dragon;
  if (s.healer) {
    if (s.healer.dead) {
      attackFromPart(e, HEAD, { explosion: true }, 10, host);
      s.healer = null;
    } else if (e.ticksExisted % 10 === 0 && e.health < DRAGON_MAX_HEALTH) e.health += 1;
  }
  if (host.rand.nextInt(10) === 0) {
    const b = s.bb, r = DRAGON_CRYSTAL_RANGE;
    let best = null, bestD = Number.MAX_VALUE;
    for (const c of host.crystals([b[0] - r, b[1] - r, b[2] - r, b[3] + r, b[4] + r, b[5] + r])) {
      const dx = e.x - c.x, dy = e.y - c.y, dz = e.z - c.z, d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = c; }
    }
    s.healer = best;
  }
}

// EntityDragon.destroyBlocksInAABB (xa.a(azt)). Returns whether a protected block (or mobGriefing off) stopped it.
export function destroyBlocks(e, box, host) {
  let blocked = false, removed = false;
  const x0 = Math.floor(box[0]), y0 = Math.floor(box[1]), z0 = Math.floor(box[2]);
  const x1 = Math.floor(box[3]), y1 = Math.floor(box[4]), z1 = Math.floor(box[5]);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const kind = host.blockKind(x, y, z);
    if (kind === 0) continue;
    if (kind === 2 && host.griefing) removed = host.removeBlock(x, y, z) || removed;
    else blocked = true;
  }
  if (removed) {
    const r = host.rand;
    const px = box[0] + (box[3] - box[0]) * r.nextFloat();
    const py = box[1] + (box[4] - box[1]) * r.nextFloat();
    const pz = box[2] + (box[5] - box[2]) * r.nextFloat();
    host.particle("largeexplode", px, py, pz);
  }
  return blocked;
}

// collideWithEntities (xa.a(List)): the wing sweep pushes every living entity away from the body's centre.
function collideWithEntities(e, box, host) {
  const s = e.dragon, body = s.parts[1].box;
  const cx = (body[0] + body[3]) / 2, cz = (body[2] + body[5]) / 2;
  for (const v of host.living(box)) {
    if (!v.living) continue;
    const dx = v.x - cx, dz = v.z - cz, d = dx * dx + dz * dz;
    v.push(dx / d * 4, f(0.2), dz / d * 4);
  }
}
const expand = (b, x, y, z) => [b[0] - x, b[1] - y, b[2] - z, b[3] + x, b[4] + y, b[5] + z];

function placePart(s, i, x, y, z) {
  const p = s.parts[i];
  p.box = partBox(x, y, z, p.width, p.height);
  p.x = x; p.y = y; p.z = z;
}

// EntityDragon.moveFlying(strafe, forward, friction) with the float MathHelper sin table.
function moveFlying(e, strafe, forward, friction) {
  let g = f(f(strafe * strafe) + f(forward * forward));
  if (g >= f(1e-4)) {
    g = sqrtF(g);
    if (g < 1) g = 1;
    g = f(friction / g);
    strafe = f(strafe * g);
    forward = f(forward * g);
    const a = rad(e.rotationYaw), sn = mhSin(a), cs = mhCos(a);
    e.vx += f(f(strafe * cs) - f(forward * sn));
    e.vz += f(f(forward * cs) + f(strafe * sn));
  }
}

// EntityDragon.onLivingUpdate (xa.e) for a living dragon on the server. A dead dragon only puffs a
// largeexplode at a random spot (deathTicks come from deathTick).
export function dragonTick(e, host) {
  const s = e.dragon, rand = host.rand;
  s.prevAnim = s.anim;
  if (e.health <= 0) {
    const a = f(f(rand.nextFloat() - 0.5) * 8), b = f(f(rand.nextFloat() - 0.5) * 4), c = f(f(rand.nextFloat() - 0.5) * 8);
    host.particle("largeexplode", e.x + a, e.y + 2 + b, e.z + c);
    return;
  }
  crystalUpdate(e, host);
  let g = f(f(0.2) / f(f(sqrtF(e.vx * e.vx + e.vz * e.vz) * 10) + 1));
  g = f(g * f(Math.pow(2, e.vy)));
  s.anim = f(s.anim + (s.slowed ? f(g * 0.5) : g));
  e.rotationYaw = wrapFloat(e.rotationYaw);
  const ring = s.ring;
  if (s.ri < 0) for (let i = 0; i < 64; i++) { ring[i * 3] = e.rotationYaw; ring[i * 3 + 1] = e.y; }
  if (++s.ri === 64) s.ri = 0;
  ring[s.ri * 3] = e.rotationYaw;
  ring[s.ri * 3 + 1] = e.y;
  ring[s.ri * 3 + 2] = 0;

  let d0 = s.tx - e.x, d1 = s.ty - e.y, d2 = s.tz - e.z;
  const d3 = d0 * d0 + d1 * d1 + d2 * d2;
  if (s.target) {
    s.tx = s.target.x;
    s.tz = s.target.z;
    const dx = s.target.x - e.x, dz = s.target.z - e.z, dist = Math.sqrt(dx * dx + dz * dz);
    let d7 = 0.4000000059604645 + dist / 80 - 1;
    if (d7 > 10) d7 = 10;
    s.ty = s.target.minY + d7;
  } else {
    s.tx += rand.nextGaussian() * 2;
    s.tz += rand.nextGaussian() * 2;
  }
  if (s.force || d3 < 100 || d3 > 22500 || e.collided) setNewTarget(e, host);
  d1 /= sqrtF(d0 * d0 + d2 * d2);
  const cap = f(0.6);
  d1 = clampD(d1, -cap, cap);
  e.vy += d1 * 0.10000000149011612;
  e.rotationYaw = wrapFloat(e.rotationYaw);
  const d8 = 180 - Math.atan2(d0, d2) * 180 / 3.1415927410125732;
  const d9 = clampD(wrapDouble(d8 - e.rotationYaw), -50, 50);
  const toTarget = normalize(s.tx - e.x, s.ty - e.y, s.tz - e.z);
  const ya = rad(e.rotationYaw);
  const facing = normalize(mhSin(ya), e.vy, -mhCos(ya));
  let f5 = f(f(facing[0] * toTarget[0] + facing[1] * toTarget[1] + facing[2] * toTarget[2] + 0.5) / f(1.5));
  if (f5 < 0) f5 = 0;
  s.ryv = f(s.ryv * f(0.8));
  const hs = Math.sqrt(e.vx * e.vx + e.vz * e.vz);
  const f6 = f(f(sqrtF(e.vx * e.vx + e.vz * e.vz) * 1) + 1);
  let d10 = hs + 1;
  if (d10 > 40) d10 = 40;
  s.ryv = f(s.ryv + d9 * (0.699999988079071 / d10 / f6));
  e.rotationYaw = f(e.rotationYaw + f(s.ryv * f(0.1)));
  const f7 = f(2 / (d10 + 1));
  moveFlying(e, 0, -1, f(f(0.06) * f(f(f5 * f7) + f(1 - f7))));
  if (s.slowed) moveNoClip(e, e.vx * 0.800000011920929, e.vy * 0.800000011920929, e.vz * 0.800000011920929);
  else moveNoClip(e, e.vx, e.vy, e.vz);
  const m = normalize(e.vx, e.vy, e.vz);
  // the facing vector is the one from before the yaw turn (bytecode local 16)
  let f9 = f(f(m[0] * facing[0] + m[1] * facing[1] + m[2] * facing[2] + 1) / 2);
  f9 = f(f(0.8) + f(f(0.15) * f9));
  e.vx *= f9;
  e.vz *= f9;
  e.vy *= 0.9100000262260437;

  updateParts(e, host);
}

// The part placement half of onLivingUpdate: sizes, wing sweep, head attack, head/tail placement, block breaking.
export function updateParts(e, host) {
  const s = e.dragon;
  const r5 = movementOffsets(e, 5, 1), r10 = movementOffsets(e, 10, 1);
  const f10 = f(f(f(f(r5[1] - r10[1]) * 10) / 180) * PI_F);
  const cp = mhCos(f10), sp = f(-mhSin(f10));
  const yr = rad(e.rotationYaw), sy = mhSin(yr), cy = mhCos(yr);
  placePart(s, 1, e.x + f(sy * 0.5), e.y, e.z - f(cy * 0.5));
  placePart(s, 5, e.x + f(cy * 4.5), e.y + 2, e.z + f(sy * 4.5));
  placePart(s, 6, e.x - f(cy * 4.5), e.y + 2, e.z - f(sy * 4.5));
  if (e.hurtTime === 0 && host.living) {
    for (const w of [5, 6]) {
      const b = expand(s.parts[w].box, 4, 2, 4);
      collideWithEntities(e, [b[0], b[1] - 2, b[2], b[3], b[4] - 2, b[5]], host);
    }
    for (const v of host.living(expand(s.parts[HEAD].box, 1, 1, 1))) if (v.living) v.hurt(10);
  }
  const r0 = movementOffsets(e, 0, 1);
  const hy = f(rad(e.rotationYaw) - f(s.ryv * f(0.01))), hs = mhSin(hy), hc = mhCos(hy);
  placePart(s, 0, e.x + f(f(hs * 5.5) * cp), e.y + (r0[1] - r5[1]) * 1 + f(sp * 5.5), e.z - f(f(hc * 5.5) * cp));
  for (let j = 0; j < 3; j++) {
    const t = movementOffsets(e, 12 + j * 2, 1);
    const ang = f(yr + f(f(f(wrapDouble(t[0] - r5[0])) * PI_F) / 180));
    const sa = mhSin(ang), ca = mhCos(ang), a = f(1.5), b = f((j + 1) * 2);
    placePart(s, 2 + j, e.x - f(f(f(sy * a) + f(sa * b)) * cp), e.y + (t[1] - r5[1]) * 1 - f(f(b + a) * sp) + 1.5, e.z + f(f(f(cy * a) + f(ca * b)) * cp));
  }
  const h = destroyBlocks(e, s.parts[HEAD].box, host);
  const bd = destroyBlocks(e, s.parts[1].box, host);
  s.slowed = h || bd;
}

// EntityDragon.onDeathUpdate (xa.aF). Returns true when the dragon is done (setDead).
export function deathTick(e, host) {
  const s = e.dragon, rand = host.rand;
  s.deathTicks++;
  if (s.deathTicks >= 180 && s.deathTicks <= 200) {
    const a = f(f(rand.nextFloat() - 0.5) * 8), b = f(f(rand.nextFloat() - 0.5) * 4), c = f(f(rand.nextFloat() - 0.5) * 8);
    host.particle("hugeexplosion", e.x + a, e.y + 2 + b, e.z + c);
  }
  if (s.deathTicks > 150 && s.deathTicks % 5 === 0) orbs(1000, host);
  if (s.deathTicks === 1) host.worldEvent(DRAGON_SOUNDS.deathEvent, Math.trunc(e.x), Math.trunc(e.y), Math.trunc(e.z));
  moveNoClip(e, 0, 0.10000000149011612, 0);
  e.rotationYaw = f(e.rotationYaw + 20);
  if (s.deathTicks === 200) {
    orbs(2000, host);
    host.portal(Math.floor(e.x), Math.floor(e.z));
    return true;
  }
  return false;
}
const XP_SPLITS = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
function orbs(total, host) {
  while (total > 0) {
    const v = XP_SPLITS.find((n) => total >= n) ?? 1;
    total -= v;
    host.orb(v);
  }
}

// Boss bar data (BossStatus.setBossStatus(dragon, true) in RenderDragon: name plus health fraction).
// dragon-renderer.js feeds boss-bar.js with it from animateDragon.
export function dragonBossStatus(e) {
  return { name: "Ender Dragon", fraction: Math.max(0, Math.min(1, e.health / DRAGON_MAX_HEALTH)) };
}
