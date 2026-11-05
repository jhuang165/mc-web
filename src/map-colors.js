// MapColor (awv) and Block.getMapColor / Material.isLiquid / Block.getLightOpacity by original block id (1.7.10).
// Data: map-colors-data.js, generated from public/research/maps-clock-reference.json (mapColor and blockColor records).
import { MAP_COLOR_RGB, MAP_BLOCKS } from "./map-colors-data.js";

export const COLOR_AIR = 0, COLOR_WATER = 12, COLOR_DIRT = 10, COLOR_STONE = 11;
export const SHADE_MULTIPLIER = [180, 220, 255, 135]; // MapColor.func_151643_b(shade)

// Block.getMapColor(meta) as a MapColor index; unknown ids read as air (no colour).
export function blockMapColor(id, meta) {
  const row = MAP_BLOCKS[id];
  if (!row) return COLOR_AIR;
  return typeof row[0] === "number" ? row[0] : row[0][meta & 15];
}
export const blockIsLiquid = (id) => MAP_BLOCKS[id]?.[1] === 1; // Block.getMaterial().isLiquid()
export const blockLightOpacity = (id) => MAP_BLOCKS[id]?.[2] ?? 0; // Block.getLightOpacity(); the heightmap's rule
// ARGB of a stored map byte (colorIndex * 4 + shade) as MapColor.func_151643_b computes it.
export function mapByteRgb(value) {
  const index = (value & 255) >> 2, shade = value & 3, base = MAP_COLOR_RGB[index] ?? 0;
  if (index === 0) return [0, 0, 0, 0]; // transparent: the map background shows through
  const m = SHADE_MULTIPLIER[shade];
  return [((base >> 16) & 255) * m / 255 | 0, ((base >> 8) & 255) * m / 255 | 0, (base & 255) * m / 255 | 0, 255];
}
export { MAP_COLOR_RGB };
