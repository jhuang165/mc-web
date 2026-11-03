// Block particles from the 1.7.10 JAR: EntityFX (bkm), EntityDiggingFX (bld),
// EntityBlockDustFX (blc), EffectRenderer (bkn) addEffect / updateEffects /
// addBlockDestroyEffects / addBlockHitEffects, RenderGlobal (bma)
// doSpawnParticle's "blockcrack_" and "blockdust_" and playAuxSFX(2006) (landing
// dust), and Entity.onEntityUpdate's sprint particle (sa.C). Rules and the probe
// records they replay are in public/research/particles.md and
// particle-reference.json. Pure logic; the particles live in an
// EffectRenderer (effect-renderer.js) layer 1 and particle-renderer.js draws them.
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
import { EffectRenderer, PARTICLE_LIMIT, entityFX } from "./effect-renderer.js";
import { acceptsParticle } from "./particle-settings.js";
import { collisionBoxList, FIRE, LAVA, WATER, WEB } from "./world.js";
import { blockTile, TILES } from "./block-textures.js";
import { rayBounds } from "./projectiles.js";
import { touchesWeb } from "./webs.js";

const f = Math.fround;
export { PARTICLE_LIMIT };
const SIZE = f(0.2), F06 = f(0.6), F02 = f(0.2);
// The constants the bytecode widens from float (0.1F, 0.2F, 0.98F, 0.7F).
const D01 = 0.10000000149011612, D02 = 0.20000000298023224, DRAG = 0.9800000190734863, GROUND = 0.699999988079071;

// This build's block ids against 1.7.10's, with the metadata the original block
// would carry (wheat stages are separate ids here; furnaces 61/62 by `lit`).
const VANILLA = { 1: 2, 2: 3, 3: 1, 4: 17, 5: 18, 6: 12, 7: 5, 8: 45, 9: 20, 10: 9, 11: 7, 12: 4, 13: 58, 15: 16, 16: 15, 17: 56, 18: 14, 19: 35, 20: 50, 21: 47, 22: 49, 23: 80, 24: 82, 25: 13, 26: 42, 27: 41, 28: 57, 29: 60, 30: 60, 39: 31, 40: 172, 41: 54, 42: 11, 43: 37, 44: 38, 45: 51, 46: 78, 47: 79, 48: 6, 49: 141, 50: 142, 51: 30, 52: 65 };
export function vanillaBlock(id, meta = 0, lit = false) {
  if (id >= 31 && id <= 38) return [59, id - 31];
  if (id === 14) return [lit ? 62 : 61, meta];
  if (id === 30) return [60, 7];
  if (id === 39) return [31, 1];
  return [VANILLA[id] ?? 0, meta];
}

// Block.getIcon(0, meta), the face EntityDiggingFX takes: the bottom face of
// blockTile. The chest has no block icon of its own; BlockChest registers
// planks_oak. Air, liquids and fire make no block particles here (-1).
const PLANKS = TILES.indexOf("planks_oak");
export function particleTile(id, meta = 0, lit = false) {
  if (!id || id === WATER || id === LAVA || id === FIRE) return -1;
  if (id === 41) return PLANKS;
  return blockTile(id, 3, lit, meta);
}

// Block.colorMultiplier / getRenderColor for this build's blocks. Only grass
// (skipped by EntityDiggingFX), leaves (foliage colour / 0x48B518) and tall
// grass (grass colour) are tinted in 1.7.10, and the atlas already bakes the
// biome colour into leaves_oak and tallgrass, so the multiplier left to apply is
// white for every block. The fixed 0x48B518 of a blockcrack/blockdust on leaves
// is therefore drawn with the biome foliage colour instead (particles.md).
export const particleColor = () => 0xffffff;

// java.util.Random-like source of floats for one particle's Entity.rand, which
// the EntityFX constructor draws four times (jitter x, y, scale, lifetime).
export const freshRandom = () => ({ nextFloat: () => Math.floor(Math.random() * 16777216) / 16777216 });

// MathHelper.randomFloatClamp (qh.a(Random, F, F)).
const randomFloat = (rand, min, max) => (min >= max ? min : f(f(rand.nextFloat() * f(max - min)) + min));

// World.getCollidingBoundingBoxes(entity, mask): x and z from floor(min) to
// floor(max + 1) exclusive, y from floor(minY) - 1; each block's collision box
// if it strictly intersects the mask. BlockFarmland's collision box is a full
// cube in 1.7.10 (only its render/selection bounds are 15/16).
function collisionBoxes(world, x0, y0, z0, x1, y1, z1) {
  const out = [];
  for (let bx = Math.floor(x0); bx < Math.floor(x1 + 1); bx++)
    for (let bz = Math.floor(z0); bz < Math.floor(z1 + 1); bz++)
      for (let by = Math.floor(y0) - 1; by < Math.floor(y1 + 1); by++) {
        if (!world.solid(bx, by, bz)) continue;
        for (const [a, b, c, d, e, g] of collisionBoxList(world, bx, by, bz))
          if (bx + d > x0 && bx + a < x1 && by + e > y0 && by + b < y1 && bz + g > z0 && bz + c < z1) out.push([bx + a, by + b, bz + c, bx + d, by + e, bz + g]);
      }
  return out;
}

// Entity.moveEntity for an EntityFX (no step height, no sneaking, ySize 0):
// the web slow-down from last move, the y, x then z sweeps against the block
// boxes (AxisAlignedBB.calculate*Offset), posX/posZ from the box centre and posY
// from its bottom + yOffset, onGround, motion zeroed on blocked axes, then
// doBlockCollisions (BlockWeb.onEntityCollidedWithBlock sets isInWeb).
export function moveParticleEntity(world, p, dx, dy, dz) {
  // noClip: the box is offset and the position follows; nothing else runs.
  if (p.noClip) {
    const b = p.box;
    b[0] += dx;
    b[1] += dy;
    b[2] += dz;
    b[3] += dx;
    b[4] += dy;
    b[5] += dz;
    p.x = (b[0] + b[3]) / 2;
    p.y = b[1] + p.yOffset;
    p.z = (b[2] + b[5]) / 2;
    return;
  }
  if (p.inWeb) {
    p.inWeb = false;
    dx *= 0.25;
    dy *= 0.05000000074505806;
    dz *= 0.25;
    p.mx = p.my = p.mz = 0;
  }
  const b = p.box, ox = dx, oy = dy, oz = dz,
    list = collisionBoxes(world, dx < 0 ? b[0] + dx : b[0], dy < 0 ? b[1] + dy : b[1], dz < 0 ? b[2] + dz : b[2], dx > 0 ? b[3] + dx : b[3], dy > 0 ? b[4] + dy : b[4], dz > 0 ? b[5] + dz : b[5]);
  for (const o of list)
    if (b[3] > o[0] && b[0] < o[3] && b[5] > o[2] && b[2] < o[5]) {
      if (dy > 0 && b[4] <= o[1] && o[1] - b[4] < dy) dy = o[1] - b[4];
      if (dy < 0 && b[1] >= o[4] && o[4] - b[1] > dy) dy = o[4] - b[1];
    }
  b[1] += dy;
  b[4] += dy;
  for (const o of list)
    if (b[4] > o[1] && b[1] < o[4] && b[5] > o[2] && b[2] < o[5]) {
      if (dx > 0 && b[3] <= o[0] && o[0] - b[3] < dx) dx = o[0] - b[3];
      if (dx < 0 && b[0] >= o[3] && o[3] - b[0] > dx) dx = o[3] - b[0];
    }
  b[0] += dx;
  b[3] += dx;
  for (const o of list)
    if (b[4] > o[1] && b[1] < o[4] && b[3] > o[0] && b[0] < o[3]) {
      if (dz > 0 && b[5] <= o[2] && o[2] - b[5] < dz) dz = o[2] - b[5];
      if (dz < 0 && b[2] >= o[5] && o[5] - b[2] > dz) dz = o[5] - b[2];
    }
  b[2] += dz;
  b[5] += dz;
  p.x = (b[0] + b[3]) / 2;
  p.y = b[1] + p.yOffset;
  p.z = (b[2] + b[5]) / 2;
  p.onGround = oy !== dy && oy < 0;
  if (ox !== dx) p.mx = 0;
  if (oy !== dy) p.my = 0;
  if (oz !== dz) p.mz = 0;
  if (touchesWeb(world, b)) p.inWeb = true;
}

export class ParticleSystem {
  // `random` stands for Math.random (the EntityFX motion kick), `entityRandom`
  // returns each new particle's Entity.rand, and `rand` is EffectRenderer.rand
  // (hit positions); `worldRandom` is the client World.rand (landing dust).
  // `effects` is the shared EffectRenderer; a private one by default.
  constructor({ random = Math.random, entityRandom = freshRandom, rand = { nextDouble: Math.random }, worldRandom = new JavaRandom(Math.floor(Math.random() * 2 ** 48)), limit = PARTICLE_LIMIT, effects = new EffectRenderer({ limit }) } = {}) {
    this.random = random;
    this.entityRandom = entityRandom;
    this.rand = rand;
    this.worldRandom = worldRandom;
    this.effects = effects;
    // GameSettings.particleSetting: 0 all, 1 decreased, 2 minimal.
    this.setting = 0;
  }
  // This system's particles in the terrain layer (the huge-explosion emitter shares it).
  get list() {
    return this.effects.layers[1].filter((p) => p.owner === this);
  }
  clear() {
    this.effects.clear();
  }
  // EffectRenderer.addEffect (terrain layer).
  add(p) {
    return this.effects.add(p);
  }
  // new EntityDiggingFX(world, x, y, z, vx, vy, vz, block, meta): the EntityFX
  // constructor (box, Entity.rand jitter/scale/lifetime), the 7-argument
  // EntityFX motion (Math.random), then the block icon, blockParticleGravity
  // (1.0 for every block here), colour 0.6 and half the scale.
  digging(x, y, z, vx, vy, vz, id, meta = 0, lit = false) {
    const p = entityFX(x, y, z, vx, vy, vz, this.entityRandom(), this.random);
    return Object.assign(p, {
      scale: f(p.scale / 2), gravity: 1,
      r: F06, g: F06, b: F06,
      tile: particleTile(id, meta, lit), id, meta,
      layer: 1, owner: this,
    });
  }
  // EntityDiggingFX.applyColourMultiplier / applyRenderColor: multiply by the
  // block colour unless the block is grass.
  tint(p, id, color = particleColor(id)) {
    if (id === 1) return p;
    p.r = f(p.r * f(((color >> 16) & 255) / 255));
    p.g = f(p.g * f(((color >> 8) & 255) / 255));
    p.b = f(p.b * f((color & 255) / 255));
    return p;
  }
  // EntityFX.multiplyVelocity.
  multiplyVelocity(p, k) {
    p.mx *= k;
    p.my = (p.my - D01) * k + D01;
    p.mz *= k;
    return p;
  }
  // EntityFX.multipleParticleScaleBy: Entity.setSize keeps the box's min corner,
  // so the particle's centre moves on its first update.
  scaleBy(p, k) {
    const size = f(SIZE * k), b = p.box;
    p.width = p.height = size;
    b[3] = b[0] + size;
    b[4] = b[1] + size;
    b[5] = b[2] + size;
    p.scale = f(p.scale * k);
    return p;
  }
  // EffectRenderer.addBlockDestroyEffects(x, y, z, block, meta): a 4 x 4 x 4
  // grid of EntityDiggingFX at the cell centres, each moving away from the
  // block's centre, with the block's colour multiplier. `id` and `meta` are the
  // block that was there (it is air by now).
  destroyBlock(world, x, y, z, id, meta = 0, lit = false) {
    if (particleTile(id, meta, lit) < 0) return 0;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) {
          const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
          this.add(this.tint(this.digging(px, py, pz, px - x - 0.5, py - y - 0.5, pz - z - 0.5, id, meta, lit), id));
        }
    return 64;
  }
  // EffectRenderer.addBlockHitEffects(x, y, z, side): one EntityDiggingFX at a
  // random point of the block's bounds pushed 0.1 out of the hit face
  // (0 -y, 1 +y, 2 -z, 3 +z, 4 -x, 5 +x), motion x 0.2 and scale x 0.6.
  hitBlock(world, x, y, z, side, lit = false) {
    const id = world.get(x, y, z), meta = world.getMeta?.(x, y, z) ?? 0;
    if (particleTile(id, meta, lit) < 0) return null;
    const [x0, y0, z0, x1, y1, z1] = rayBounds(world, x, y, z, id), r = this.rand;
    let px = x + r.nextDouble() * (x1 - x0 - D02) + D01 + x0,
      py = y + r.nextDouble() * (y1 - y0 - D02) + D01 + y0,
      pz = z + r.nextDouble() * (z1 - z0 - D02) + D01 + z0;
    if (side === 0) py = y + y0 - D01;
    if (side === 1) py = y + y1 + D01;
    if (side === 2) pz = z + z0 - D01;
    if (side === 3) pz = z + z1 + D01;
    if (side === 4) px = x + x0 - D01;
    if (side === 5) px = x + x1 + D01;
    const p = this.tint(this.digging(px, py, pz, 0, 0, 0, id, meta, lit), id);
    return this.add(this.scaleBy(this.multiplyVelocity(p, D02), F06));
  }
  // RenderGlobal.doSpawnParticle for "blockcrack_id_meta" (EntityDiggingFX) and
  // "blockdust_id_meta" (EntityBlockDustFX, which then sets its motion to the
  // given velocity exactly). Nothing is made, and Math.random is not drawn, when
  // the view entity's position (the eye) is more than 16 blocks away or the
  // particle setting is minimal.
  spawn(kind, id, meta, x, y, z, vx, vy, vz, viewer, worldRandom = this.worldRandom) {
    if (!acceptsParticle(kind, this.setting, worldRandom, x, y, z, viewer) || particleTile(id, meta) < 0) return null;
    const p = this.tint(this.digging(x, y, z, vx, vy, vz, id, meta), id);
    if (kind === "blockdust") {
      p.mx = vx;
      p.my = vy;
      p.mz = vz;
    }
    return this.add(p);
  }
  // RenderGlobal.playAuxSFX(2006, x, y, z, data): the landing dust. `data` is
  // ceil(fallDistance - 3) from EntityLivingBase.updateFallState, (x, y, z) the
  // block under the feet. 150 x min(0.2 + data / 15, 2.5) blockdust particles
  // from the top centre of the block, fanned out by World.rand.
  landingDust(world, x, y, z, data, viewer, rand = this.worldRandom) {
    const id = world.get(x, y, z);
    if (!id) return 0;
    const meta = world.getMeta?.(x, y, z) ?? 0;
    let d = Math.min(f(F02 + f(data / 15)), 10);
    if (d > 2.5) d = 2.5;
    const count = Math.trunc(150 * d), vy = D02 + d / 100, sx = f(x + 0.5), sy = f(y + 1), sz = f(z + 0.5);
    for (let i = 0; i < count; i++) {
      const a = randomFloat(rand, 0, f(6.2831855)), s = randomFloat(rand, 0.75, 1);
      const vx = f(mhCos(a) * F02) * s * s * (d + 0.2), vz = f(mhSin(a) * F02) * s * s * (d + 0.2);
      this.spawn("blockdust", id, meta, sx, sy, sz, vx, vy, vz, viewer);
    }
    return count;
  }
  // Entity.onEntityUpdate: a sprinting entity that was not in water last tick
  // throws one blockcrack of the block 0.2 below its feet per tick, at a random
  // point across its width, flying back against its motion.
  running(world, e, rand, viewer) {
    if (!e.sprinting || e.inWater) return null;
    const yOffset = e.yOffset ?? f(1.62), ySize = e.ySize ?? 0, posY = e.y + yOffset - ySize,
      bx = Math.floor(e.x), by = Math.floor(posY - D02 - yOffset), bz = Math.floor(e.z),
      id = world.get(bx, by, bz);
    if (!id) return null;
    const meta = world.getMeta?.(bx, by, bz) ?? 0, width = e.width ?? f(0.6);
    const x = e.x + (rand.nextFloat() - 0.5) * width, y = e.y + 0.1, z = e.z + (rand.nextFloat() - 0.5) * width;
    return this.spawn("blockcrack", id, meta, x, y, z, -e.mx * 4, 1.5, -e.mz * 4, viewer);
  }
  // EntityFX.onUpdate (bkm.h). A particle still moves on the tick it dies.
  step(world, p) {
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    if (p.age++ >= p.max) p.dead = true;
    p.my -= 0.04 * p.gravity;
    moveParticleEntity(world, p, p.mx, p.my, p.mz);
    p.mx *= DRAG;
    p.my *= DRAG;
    p.mz *= DRAG;
    if (p.onGround) {
      p.mx *= GROUND;
      p.mz *= GROUND;
    }
  }
  // EffectRenderer.updateEffects for the whole pool (main.js ticks the shared one).
  tick(world) {
    this.effects.tick(world);
  }
}

// The sprint particle for one entity: `entity` is { x, y (bottom of the box),
// z, mx, mz (blocks per tick), sprinting, inWater (last tick's), width?,
// yOffset?, ySize? }, `rand` its Entity.rand and `viewer` the view entity's
// eye. Call once per tick before the entity moves (Entity.onUpdate runs
// onEntityUpdate before onLivingUpdate's movement).
export const spawnRunningParticles = (system, world, entity, rand, viewer) => system.running(world, entity, rand, viewer);

// ActiveRenderInfo.updateRenderInfo: the billboard basis from the player's
// rotation (degrees, Java convention); `mirror` is the front third-person view.
export function particleBasis(yawDeg, pitchDeg, mirror = false) {
  const k = mirror ? -1 : 1, yaw = f(f(f(yawDeg) * f(Math.PI)) / 180), pitch = f(f(f(pitchDeg) * f(Math.PI)) / 180),
    x = f(mhCos(yaw) * k), z = f(mhSin(yaw) * k);
  return { x, z, yz: f(f(-z * mhSin(pitch)) * k), xy: f(f(x * mhSin(pitch)) * k), xz: mhCos(pitch) };
}

// EntityFX.renderParticle's corners (bkm.a(bmh, F, FFFFF) and every override): the
// position interpolated in double and cast to float (less `origin`, the interpPos the
// original subtracts; the renderers draw in world space), then float sums of the camera
// basis times the half-size `s`, as the Tessellator stores them. `uv` gives the corners'
// texture coordinates in draw order.
export function billboard(p, partial, { x: rx, z: rz, yz, xy, xz }, s, uv, [ox, oy, oz] = [0, 0, 0]) {
  const x = f(p.px + (p.x - p.px) * partial - ox), y = f(p.py + (p.y - p.py) * partial - oy), z = f(p.pz + (p.z - p.pz) * partial - oz),
    a = f(rx * s), b = f(yz * s), c = f(xz * s), d = f(rz * s), e = f(xy * s);
  return [
    [f(f(x - a) - b), f(y - c), f(f(z - d) - e), ...uv[0]],
    [f(f(x - a) + b), f(y + c), f(f(z - d) + e), ...uv[1]],
    [f(f(x + a) + b), f(y + c), f(f(z + d) + e), ...uv[2]],
    [f(f(x + a) - b), f(y - c), f(f(z + d) - e), ...uv[3]],
  ];
}

// EntityFX.renderParticle's sheet cell (u1, v1 first) for a sprite {u0, u1, v0, v1, size}.
export const spriteQuad = (p, partial, basis, { u0, u1, v0, v1, size }, origin) =>
  billboard(p, partial, basis, size, [[u1, v1], [u1, v0], [u0, v0], [u0, v1]], origin);

// EntityDiggingFX / EntityBreakingFX.renderParticle: half-size 0.1 x scale and a 4-pixel
// window of the 16-pixel icon at the jitter offset (IIcon.getInterpolatedU/V, u0 first).
// `u`/`v` are the icon's [min, max]; v grows downwards as in the atlas image.
export function particleQuad(p, partial, basis, [u0, u1] = [0, 1], [v0, v1] = [0, 1], origin) {
  const iu = (d) => f(u0 + f(f(u1 - u0) * f(d / 16))), iv = (d) => f(v0 + f(f(v1 - v0) * f(d / 16))),
    ua = iu(f(f(p.jx / 4) * 16)), ub = iu(f(f(f(p.jx + 1) / 4) * 16)), va = iv(f(f(p.jy / 4) * 16)), vb = iv(f(f(f(p.jy + 1) / 4) * 16));
  return billboard(p, partial, basis, f(f(0.1) * p.scale), [[ua, vb], [ua, va], [ub, va], [ub, vb]], origin);
}

// Entity.getBrightnessForRender: the light at floor(posY - yOffset + height x 0.66).
export const particleLightCell = (p) => [Math.floor(p.x), Math.floor(p.y - p.yOffset + (p.box[4] - p.box[1]) * 0.66), Math.floor(p.z)];

// Tessellator.setColorOpaque_F / setColorRGBA_F per channel, as a 0..1 shade.
export const quantize = (c) => colorByte(c) / 255;
// One channel of Tessellator.setColorRGBA_F: (int)(c * 255), clamped to 0..255.
export const colorByte = (c) => Math.min(255, Math.max(0, Math.trunc(f(c * 255))));
