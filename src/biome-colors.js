// Minecraft 1.7.10 per-position biome colours. Bytecode-read and probe-replayed
// (tools/probes/BiomeColorProbe.java -> public/research/biome-colors-reference.json, biome-colors.test.js):
//  - BiomeGenBase.getBiomeGrassColor (ahu.b(x,y,z)) and getBiomeFoliageColor (c): ColorizerGrass/ColorizerFoliage.getColor(
//    clamp(getFloatTemperature(x,y,z)), clamp(rainfall)): index (int)((1-t)*255) in x and (int)((1-t*rain)*255) in y of the
//    256x256 colormap. getFloatTemperature subtracts a noise-and-height term above y 64 (java-world.js javaTemperature).
//  - Overrides: BiomeGenSwamp (grass from noise ad = Perlin(Random(2345), 1) at x*0.0225, z*0.0225: < -0.1 -> 0x4C763C else
//    0x6A7039; foliage 0x6A7039), BiomeGenForest roofed (grass ((c & 0xFEFEFE) + 0x28340A) >> 1), BiomeGenMesa (grass 0x90814D,
//    foliage 0x9E814D) and BiomeGenMutated, which hands (x, y, y) - a vanilla slip - to its parent.
//  - Blocks: BlockGrass and BlockLeaves.colorMultiplier average the biome colour over x-1..x+1, z-1..z+1 (sum per channel, / 9,
//    & 255); BlockOldLeaf spruce/birch use fixed pine/birch constants; BlockVine (foliage), BlockReed, BlockTallGrass (not the
//    dead shrub) and BlockDoublePlant (grass and fern) use the single position; BlockLiquid water averages BiomeGenBase.waterColorMultiplier
//    (0xE0FFAE in swamps, else white); lava is white; the lily pad is 0x208030. Items use ColorizerGrass.getColor(0.5, 1.0)
//    (grass, tall grass, ferns), BlockLeaves.getRenderColor = ColorizerFoliage.getFoliageColorBasic (0x48B518), pine and birch.
import { NoiseGeneratorPerlin } from "./noise.js";
import { JavaRandom } from "./java-random.js";
import { BIOME_LIST } from "./java-biomes.js";

const f = Math.fround;
export const PINE = 0x619961, BIRCH = 0x80A755, FOLIAGE_BASIC = 0x48B518, LILY_PAD_COLOR = 0x208030, SWAMP_WATER = 0xE0FFAE;
const MESA_GRASS = 0x90814D, MESA_FOLIAGE = 0x9E814D, SWAMP_GRASS_LOW = 0x4C763C, SWAMP_GRASS_HIGH = 0x6A7039, SWAMP_FOLIAGE = 0x6A7039;
// BiomeGenMutated slot -> parent slot (ahu.n() as built by BiomeGenBase.<clinit>; BiomeColorProbe records them).
export const MUTATED_PARENT = Object.freeze({ 130: 2, 133: 5, 134: 6, 149: 21, 151: 23, 155: 27, 156: 28, 157: 29, 158: 30, 163: 35, 164: 36 });
const MESA = new Set([37, 38, 39, 165, 166, 167]), ROOFED = 29, SWAMP = 6;
let grassMap = null, foliageMap = null, swampNoise = null, tempNoise = null;
const swamp = () => (swampNoise ??= new NoiseGeneratorPerlin(new JavaRandom(2345n), 1));
const temperatureNoise = () => (tempNoise ??= new NoiseGeneratorPerlin(new JavaRandom(1234n), 1));
const toRgbInts = (pixels) => {
  if (pixels instanceof Int32Array) return pixels;
  const out = new Int32Array(65536);
  for (let i = 0; i < 65536; i++) out[i] = (pixels[i * 4] << 16) | (pixels[i * 4 + 1] << 8) | pixels[i * 4 + 2];
  return out;
};
// Installs the grass and foliage colormaps (256x256 RGBA bytes, or 65536 packed 0xRRGGBB ints).
export function setColormaps(grass, foliage) {
  grassMap = toRgbInts(grass); foliageMap = toRgbInts(foliage);
}
export const hasColormaps = () => grassMap !== null && foliageMap !== null;
// ColorizerGrass.getGrassColor / ColorizerFoliage.getFoliageColor (aha.a / agx.a(DD)I).
function colormapColor(map, temperature, rainfall) {
  const t = temperature, h = rainfall * t;
  return map[(((1 - h) * 255) | 0) << 8 | (((1 - t) * 255) | 0)] & 0xFFFFFF;
}
export const grassColormap = (temperature, rainfall) => colormapColor(grassMap, temperature, rainfall);
export const foliageColormap = (temperature, rainfall) => colormapColor(foliageMap, temperature, rainfall);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Item colours: Block.getRenderColor.
export const itemGrassColor = () => colormapColor(grassMap, 0.5, 1);
export const itemFoliageColor = () => colormapColor(foliageMap, 0.5, 1);
const slotOf = (b) => b.slot ?? b.id;
// BiomeGenBase.getFloatTemperature (ahu.a(III)F) with the height term above y 64.
export function floatTemperature(b, x, y, z) {
  if (y <= 64) return b.temperature;
  const n = f(f(temperatureNoise().value(x / 8, z / 8)) * 4);
  return f(b.temperature - f(f(f(f(n + f(y)) - 64) * f(0.05)) / 30));
}
// getBiomeGrassColor / getBiomeFoliageColor for one position.
export function biomeGrassColor(b, x, y, z) {
  const slot = slotOf(b);
  if (slot === SWAMP) return swamp().value(x * 0.0225, z * 0.0225) < -0.1 ? SWAMP_GRASS_LOW : SWAMP_GRASS_HIGH;
  if (MESA.has(slot)) return MESA_GRASS;
  const parent = MUTATED_PARENT[slot];
  if (parent !== undefined) return biomeGrassColor(BIOME_LIST[parent], x, y, y);
  const c = colormapColor(grassMap, clamp01(floatTemperature(b, x, y, z)), clamp01(b.rainfall));
  return slot === ROOFED ? (((c & 0xFEFEFE) + 0x28340A) >> 1) : c;
}
export function biomeFoliageColor(b, x, y, z) {
  const slot = slotOf(b);
  if (slot === SWAMP) return SWAMP_FOLIAGE;
  if (MESA.has(slot)) return MESA_FOLIAGE;
  const parent = MUTATED_PARENT[slot];
  if (parent !== undefined) return biomeFoliageColor(BIOME_LIST[parent], x, y, y);
  return colormapColor(foliageMap, clamp01(floatTemperature(b, x, y, z)), clamp01(b.rainfall));
}
// BiomeGenBase.waterColorMultiplier (ahu.aq): only BiomeGenSwamp sets it; BiomeGenMutated copies its parent's.
export function biomeWaterColor(b) {
  const slot = slotOf(b);
  return slot === SWAMP || MUTATED_PARENT[slot] === SWAMP ? SWAMP_WATER : 0xFFFFFF;
}
// The 3x3 average of the Block.colorMultiplier loops: integer channel sums, / 9, & 255.
function average(colors) {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 9; i++) { const c = colors[i]; r += (c & 0xFF0000) >> 16; g += (c & 0xFF00) >> 8; b += c & 0xFF; }
  return (((r / 9) | 0) & 255) << 16 | (((g / 9) | 0) & 255) << 8 | (((b / 9) | 0) & 255);
}
export const averageColors = average;
const SCRATCH = new Int32Array(9);
// A world's biome colours, with the biome per column cached (biomeAt takes native x, z). The column cache is dropped when it
// grows large, so an endless world does not keep every column it has ever meshed.
export class BiomeColorField {
  constructor(biomeAt) { this.biomeAt = biomeAt; this.columns = new Map(); }
  clear() { this.columns.clear(); }
  biome(x, z) {
    const key = (x + 2097152) * 4194304 + (z + 2097152);
    let b = this.columns.get(key);
    if (b === undefined) {
      if (this.columns.size > 300000) this.columns.clear();
      b = this.biomeAt(x, z);
      this.columns.set(key, b);
    }
    return b;
  }
  // Block.colorMultiplier averages: BlockGrass (grass), BlockLeaves (foliage), BlockLiquid water.
  grass(x, y, z) { return this.mean(x, y, z, biomeGrassColor); }
  foliage(x, y, z) { return this.mean(x, y, z, biomeFoliageColor); }
  water(x, z) {
    let i = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) SCRATCH[i++] = biomeWaterColor(this.biome(x + dx, z + dz));
    return average(SCRATCH);
  }
  mean(x, y, z, fn) {
    let i = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) SCRATCH[i++] = fn(this.biome(x + dx, z + dz), x + dx, y, z + dz);
    return average(SCRATCH);
  }
  // BlockVine, BlockReed, BlockTallGrass and BlockDoublePlant: the single position, no averaging.
  grassAt(x, y, z) { return biomeGrassColor(this.biome(x, z), x, y, z); }
  foliageAt(x, y, z) { return biomeFoliageColor(this.biome(x, z), x, y, z); }
}
export const rgbFloats = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
// The installed colormaps (packed 0xRRGGBB ints), for the mesh workers; null until setColormaps ran.
export const colormaps = () => (grassMap && foliageMap ? { grass: grassMap, foliage: foliageMap } : null);
