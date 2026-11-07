// Snow and ice, ported from the 1.7.10 JAR (public/research/snow.md; replayed against
// public/research/snow-reference.json by snow.test.js): World.canBlockFreeze (ahb.d) and
// canSnowAt (ahb.e), BlockSnow (ann) placement, melting and neighbour rules, BlockIce (alp)
// melting, and the freeze/snow pass at the end of ChunkProviderGenerate.populate (aqz.a).
// `generationVersion` 6 switches the population pass on. Every function takes the World and
// reads the saved block light through `light(x, y, z)` (default: world.blockLight, the scene's
// LightVolume, or the lava light worked out at generation). weather.js drives the per-chunk
// WorldServer tick that uses these rules while it rains.
import { SIZE, HEIGHT, WATER, LAVA, SNOW_LAYER, ICE, opaqueCube } from "./world.js";
import { lightOpacity } from "./lighting.js";
import { precipitationHeight, stopsPrecipitation } from "./weather.js";
import { biomeTemperatureAt } from "./biomes.js";

const f = Math.fround;
const FREEZE_LIMIT = f(0.15); // BiomeGenBase.getFloatTemperature above this never freezes or snows
export const ICE_LIGHT_OPACITY = 3;

// The lava-only block light a freshly generated world has (World.getSavedLightValue for
// EnumSkyBlock.Block): a flood fill from every lava cell, 15 at the source and one less per
// step, stopped by cells with light opacity 255 (a step through partial opacity costs it).
export function generationLight(world) {
  const H = world.height ?? HEIGHT, XS = SIZE * H, light = new Uint8Array(SIZE * SIZE * H), blocks = world.snapshot().data, queue = [];
  for (let i = 0; i < blocks.length; i++) if (blocks[i] === LAVA) { light[i] = 15; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], v = light[i];
    if (v <= 1) continue;
    const y = i % H, t = (i - y) / H, z = t % SIZE, x = (t - z) / SIZE;
    const spread = (j) => {
      const cost = Math.max(1, lightOpacity(blocks[j]));
      if (cost < 15 && v - cost > light[j]) { light[j] = v - cost; queue.push(j); }
    };
    if (y + 1 < H) spread(i + 1);
    if (y > 0) spread(i - 1);
    if (z + 1 < SIZE) spread(i + H);
    if (z > 0) spread(i - H);
    if (x + 1 < SIZE) spread(i + XS);
    if (x > 0) spread(i - XS);
  }
  return (x, y, z) => (x < 0 || z < 0 || x >= SIZE || z >= SIZE || y < 0 || y >= H ? 0 : light[(x * SIZE + z) * H + y]);
}
export const lightOf = (world) => world.blockLight || (world.generationLight ||= generationLight(world));

// World.canBlockFreeze (ahb.d): cold enough, dark enough (block light below 10) and a water
// source block; with noWaterAdj (World.isBlockFreezableNaturally, ahb.s) it also needs at
// least one horizontal neighbour that is not water. isBlockFreezable (ahb.r) is noWaterAdj false.
export function canBlockFreeze(world, x, y, z, noWaterAdj, light = lightOf(world)) {
  if ((world.temperatureAt?.(x,y,z) ?? biomeTemperatureAt(world.biome, x, y, z)) > FREEZE_LIMIT) return false;
  if (y < 0 || y >= 256 || light(x, y, z) >= 10) return false;
  if (world.get(x, y, z) !== WATER || world.getMeta(x, y, z) !== 0) return false;
  if (!noWaterAdj) return true;
  return !(world.get(x - 1, y, z) === WATER && world.get(x + 1, y, z) === WATER && world.get(x, y, z - 1) === WATER && world.get(x, y, z + 1) === WATER);
}

// BlockSnow.canPlaceBlockAt (ann.c): not on ice, yes on leaves and on a full snow layer, else
// on an opaque cube (a block whose material blocks movement).
export function snowCanStay(world, x, y, z) {
  const below = world.get(x, y - 1, z);
  if (below === ICE) return false;
  if (below === 5) return true; // Material.leaves
  if (below === SNOW_LAYER && (world.getMeta(x, y - 1, z) & 7) === 7) return true;
  return below !== 0 && opaqueCube(below);
}
// World.func_147478_e (ahb.e) = canSnowAt: with its boolean set (the populate pass and the
// weather tick pass true) the cell must also be dark, empty (Material.air) and take a snow layer.
export function canSnowAt(world, x, y, z, checkLight, light = lightOf(world)) {
  if ((world.temperatureAt?.(x,y,z) ?? biomeTemperatureAt(world.biome, x, y, z)) > FREEZE_LIMIT) return false;
  if (!checkLight) return true;
  if (y < 0 || y >= 256 || light(x, y, z) >= 10) return false;
  return world.get(x, y, z) === 0 && snowCanStay(world, x, y, z);
}

// ChunkProviderGenerate.populate, last pass: in every column, freeze the water under the
// precipitation height and put a flat snow layer on top. (Vanilla visits each 16 x 16 area
// offset by 8; this world's columns are all visited.)
export function populateColumn(world, x, z, light = lightOf(world)) {
  const y = precipitationHeight(world, x, z);
  if (canBlockFreeze(world, x, y - 1, z, false, light)) world.set(x, y - 1, z, ICE, false);
  if (canSnowAt(world, x, y, z, true, light)) world.set(x, y, z, SNOW_LAYER, false, 0);
}
export function populateSnow(world) {
  if (biomeTemperatureAt(world.biome) > FREEZE_LIMIT) return;
  const light = lightOf(world);
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) populateColumn(world, x, z, light);
  world.generationLight = null;
}

// BlockSnow.updateTick and BlockIce.updateTick: what a random tick turns the block into, or
// null. Snow melts above block light 11; ice above 11 - lightOpacity (8) and leaves still
// water (the original sets Blocks.water, a source).
export const SNOW_BLOCK = 23;
export function meltResult(block, blockLight) {
  if (block === SNOW_LAYER && blockLight > 11) return { block: 0, meta: 0 };
  if (block === ICE && blockLight > 11 - ICE_LIGHT_OPACITY) return { block: WATER, meta: 0 };
  // BlockSnowBlock.updateTick: above block light 11 it drops 4 snowballs (item 312) and goes (block-sweep-reference.json tick column).
  if (block === SNOW_BLOCK && blockLight > 11) return { block: 0, meta: 0, drops: [{ id: 312, count: 4 }] };
  return null;
}
// BlockSnow.onNeighborBlockChange: a layer that can no longer stand is removed (it drops nothing).
export const snowFalls = (world, x, y, z) => world.get(x, y, z) === SNOW_LAYER && !snowCanStay(world, x, y, z);
// BlockSnow.harvestBlock with a shovel (ItemSpade.func_150897_b): metadata + 1 snowballs.
export const snowballsFor = (meta) => (meta & 7) + 1;
// BlockIce.harvestBlock without Silk Touch: water replaces it when the block below blocks
// movement or is a liquid (the same blocks that stop precipitation); it drops nothing.
export const iceLeavesWater = (below) => stopsPrecipitation(below);
// ItemSnow.onItemUse (aec.a), clicking a snow layer with a snow layer: one more layer while the
// stack is at most 6 (metadata & 7 <= 6), keeping the other metadata bits. Returns the new
// metadata or null when it does not apply (the click then places a block as usual).
export const stackedSnowMeta = (meta) => ((meta & 7) <= 6 ? (meta & 7) + 1 | (meta & -8) : null);
