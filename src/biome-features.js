// 1.7.10 generators that biome decorate overrides add on top of BiomeDecorator:
// WorldGenDoublePlant (arm), WorldGenDesertWells (arl), WorldGenMelon (asc), WorldGenVines (asr),
// WorldGenIceSpike (arw), WorldGenIcePath (arv) and WorldGenBlockBlob (arf), with the
// BlockDoublePlant/BlockVine placement rules they call. World adapter as gen-world.js
// (getBlock, isAirBlock, setBlock with flags, isReplaceable, hasNoSky). Original numeric IDs.
// Replayed natively in biome-overrides.test.js.
import { materialOf } from "./gen-world.js";

export const AIR = 0, STONE = 1, GRASS = 2, DIRT = 3, FLOWING_WATER = 8, SAND = 12, SANDSTONE = 24, STONE_SLAB = 44,
  MOSSY_COBBLESTONE = 48, FARMLAND = 60, ICE = 79, SNOW = 80, MONSTER_EGG = 97, MELON = 103, VINE = 106,
  EMERALD_ORE = 129, PACKED_ICE = 174, DOUBLE_PLANT = 175;

const f = Math.fround;
const spread = (random, bound) => random.nextInt(bound) - random.nextInt(bound);
// Block.canPlaceBlockAt: the block there has a replaceable material.
const replaceableAt = (world, x, y, z) => world.isReplaceable(world.getBlock(x, y, z));
// BlockBush.canPlaceBlockOn.
const bushSoil = (id) => id === GRASS || id === DIRT || id === FARMLAND;

// BlockDoublePlant.canPlaceBlockAt: BlockBush's rule and air above.
export function canPlaceDoublePlant(world, x, y, z) {
  return replaceableAt(world, x, y, z) && bushSoil(world.getBlock(x, y - 1, z)) && world.isAirBlock(x, y + 1, z);
}
// BlockDoublePlant.canBlockStay: the top half needs the bottom half below; the bottom needs the
// top above and bush soil.
export function doublePlantCanStay(world, x, y, z) {
  if (world.getBlockMetadata(x, y, z) & 8) return world.getBlock(x, y - 1, z) === DOUBLE_PLANT;
  return world.getBlock(x, y + 1, z) === DOUBLE_PLANT && bushSoil(world.getBlock(x, y - 1, z));
}

// WorldGenDoublePlant: one shared instance whose type (metadata 0-5) is set before each use.
export class WorldGenDoublePlant {
  constructor() { this.type = 0; }
  setType(type) { this.type = type; }
  generate(world, random, x, y, z) {
    let placed = false;
    for (let i = 0; i < 64; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (!world.isAirBlock(px, py, pz) || (world.hasNoSky && py >= 254) || !canPlaceDoublePlant(world, px, py, pz)) continue;
      // BlockDoublePlant.func_149889_c: the bottom half, then the top (metadata 8).
      world.setBlock(px, py, pz, DOUBLE_PLANT, this.type, 2);
      world.setBlock(px, py + 1, pz, DOUBLE_PLANT, 8, 2);
      placed = true;
    }
    return placed;
  }
}

export class WorldGenMelon {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 64; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (replaceableAt(world, px, py, pz) && world.getBlock(px, py - 1, pz) === GRASS) world.setBlock(px, py, pz, MELON, 0, 2);
    }
    return true;
  }
}

// BlockVine.canPlaceBlockOnSide for sides 2-5 and the metadata bit
// 1 << Direction.facingToDirection[Facing.oppositeSide[side]].
const VINE_SIDES = [[2, 0, 1, 1], [3, 0, -1, 4], [4, 1, 0, 8], [5, -1, 0, 2]];
// WorldGenVines. Jungle decoration calls it at y = 128, where the loop never runs.
export class WorldGenVines {
  generate(world, random, x, y, z) {
    const x0 = x, z0 = z;
    for (; y < 128; y++) {
      if (world.isAirBlock(x, y, z)) {
        for (const [, dx, dz, meta] of VINE_SIDES)
          if (world.vineSupport(world.getBlock(x + dx, y, z + dz))) { world.setBlock(x, y, z, VINE, meta, 2); break; }
      } else {
        x = x0 + spread(random, 4);
        z = z0 + spread(random, 4);
      }
    }
    return true;
  }
}

export class WorldGenDesertWells {
  generate(world, random, x, y, z) {
    while (world.isAirBlock(x, y, z) && y > 2) y--;
    if (world.getBlock(x, y, z) !== SAND) return false;
    for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++)
      if (world.isAirBlock(x + i, y - 1, z + k) && world.isAirBlock(x + i, y - 2, z + k)) return false;
    for (let j = -1; j <= 0; j++) for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) world.setBlock(x + i, y + j, z + k, SANDSTONE, 0, 2);
    world.setBlock(x, y, z, FLOWING_WATER, 0, 2);
    world.setBlock(x - 1, y, z, FLOWING_WATER, 0, 2);
    world.setBlock(x + 1, y, z, FLOWING_WATER, 0, 2);
    world.setBlock(x, y, z - 1, FLOWING_WATER, 0, 2);
    world.setBlock(x, y, z + 1, FLOWING_WATER, 0, 2);
    for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++)
      if (i === -2 || i === 2 || k === -2 || k === 2) world.setBlock(x + i, y + 1, z + k, SANDSTONE, 0, 2);
    world.setBlock(x + 2, y + 1, z, STONE_SLAB, 1, 2);
    world.setBlock(x - 2, y + 1, z, STONE_SLAB, 1, 2);
    world.setBlock(x, y + 1, z + 2, STONE_SLAB, 1, 2);
    world.setBlock(x, y + 1, z - 2, STONE_SLAB, 1, 2);
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++)
      if (i === 0 && k === 0) world.setBlock(x, y + 4, z, SANDSTONE, 0, 2);
      else world.setBlock(x + i, y + 4, z + k, STONE_SLAB, 1, 2);
    for (let j = 1; j <= 3; j++) {
      world.setBlock(x - 1, y + j, z - 1, SANDSTONE, 0, 2);
      world.setBlock(x - 1, y + j, z + 1, SANDSTONE, 0, 2);
      world.setBlock(x + 1, y + j, z - 1, SANDSTONE, 0, 2);
      world.setBlock(x + 1, y + j, z + 1, SANDSTONE, 0, 2);
    }
    return true;
  }
}

const iceTarget = (id) => id === DIRT || id === SNOW || id === ICE;

export class WorldGenIcePath {
  constructor(radius) { this.radius = radius; }
  generate(world, random, x, y, z) {
    while (world.isAirBlock(x, y, z) && y > 2) y--;
    if (world.getBlock(x, y, z) !== SNOW) return false;
    const r = random.nextInt(this.radius - 2) + 2, h = 1;
    for (let i = x - r; i <= x + r; i++) for (let k = z - r; k <= z + r; k++) {
      const dx = i - x, dz = k - z;
      if (dx * dx + dz * dz > r * r) continue;
      for (let j = y - h; j <= y + h; j++) if (iceTarget(world.getBlock(i, j, k))) world.setBlock(i, j, k, PACKED_ICE, 0, 2);
    }
    return true;
  }
}

export class WorldGenIceSpike {
  generate(world, random, x, y, z) {
    while (world.isAirBlock(x, y, z) && y > 2) y--;
    if (world.getBlock(x, y, z) !== SNOW) return false;
    y += random.nextInt(4);
    const height = random.nextInt(4) + 7, width = Math.trunc(height / 4) + random.nextInt(2);
    if (width > 1 && random.nextInt(60) === 0) y += 10 + random.nextInt(30);
    const fill = (id) => materialOf(id) === "a" || iceTarget(id);
    for (let j = 0; j < height; j++) {
      const r = f(f(1 - f(f(j) / f(height))) * f(width)), n = Math.ceil(r);
      for (let i = -n; i <= n; i++) {
        const fi = f(f(Math.abs(i)) - f(0.25));
        for (let k = -n; k <= n; k++) {
          const fk = f(f(Math.abs(k)) - f(0.25));
          if (((i !== 0 || k !== 0) && f(f(fi * fi) + f(fk * fk)) > f(r * r)) ||
            ((i === -n || i === n || k === -n || k === n) && random.nextFloat() > f(0.75))) continue;
          if (fill(world.getBlock(x + i, y + j, z + k))) world.setBlock(x + i, y + j, z + k, PACKED_ICE, 0, 2);
          if (j !== 0 && n > 1 && fill(world.getBlock(x + i, y - j, z + k))) world.setBlock(x + i, y - j, z + k, PACKED_ICE, 0, 2);
        }
      }
    }
    const base = Math.min(Math.max(width - 1, 0), 1);
    for (let i = -base; i <= base; i++) for (let k = -base; k <= base; k++) {
      let j = y - 1, run = 50;
      if (Math.abs(i) === 1 && Math.abs(k) === 1) run = random.nextInt(5);
      for (let id; j > 50 && (fill((id = world.getBlock(x + i, j, z + k))) || id === PACKED_ICE); ) {
        world.setBlock(x + i, j, z + k, PACKED_ICE, 0, 2);
        j--;
        if (--run > 0) continue;
        j -= random.nextInt(5) + 1;
        run = random.nextInt(5);
      }
    }
    return true;
  }
}

// WorldGenBlockBlob: sink through air and non-grass/dirt/stone, then three overlapping
// ellipsoids written with flag 4.
export class WorldGenBlockBlob {
  constructor(block, radius) { this.block = block; this.radius = radius; }
  generate(world, random, x, y, z) {
    for (let id; y > 3 && (world.isAirBlock(x, y - 1, z) || ((id = world.getBlock(x, y - 1, z)) !== GRASS && id !== DIRT && id !== STONE)); ) y--;
    if (y <= 3) return false;
    const r = this.radius;
    for (let n = 0; r >= 0 && n < 3; n++) {
      const rx = r + random.nextInt(2), ry = r + random.nextInt(2), rz = r + random.nextInt(2);
      const limit = f(f(f(rx + ry + rz) * f(0.333)) + f(0.5));
      for (let i = x - rx; i <= x + rx; i++) for (let k = z - rz; k <= z + rz; k++) for (let j = y - ry; j <= y + ry; j++) {
        const dx = f(i - x), dz = f(k - z), dy = f(j - y);
        if (f(f(f(dx * dx) + f(dz * dz)) + f(dy * dy)) > f(limit * limit)) continue;
        world.setBlock(i, j, k, this.block, 0, 4);
      }
      x += -(r + 1) + random.nextInt(2 + r * 2);
      z += -(r + 1) + random.nextInt(2 + r * 2);
      y += 0 - random.nextInt(2);
    }
    return true;
  }
}
