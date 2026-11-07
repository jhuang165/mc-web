// Light-dependent plant rules of 1.7.10 (batch 19), replayed against public/research/block-sweep3-reference.json.
//  BlockBush.canBlockStay (flowers, tall grass, saplings, crops, stems): only the block below, no light (flowers.js, farming.js).
//  BlockMushroom.canBlockStay (amc.j): y in [0, 256) and (mycelium below, or podzol, or (World.getFullBlockLightValue < 13 and an opaque cube
//  below)). getFullBlockLightValue is ahb.j: max(sky, block) with skylightSubtracted 0, so day and night do not matter for it.
//  BlockMushroom.updateTick (amc.a): one random tick in 25 spreads (func below).
//  BlockCrops/BlockSapling/BlockStem growth read World.getBlockLightValue (ahb.k): max(sky - skylightSubtracted, block) at y + 1.
import { normalCube } from "./world.js";
import { lightOpacity } from "./lighting.js";

export const BROWN_MUSHROOM = 75, RED_MUSHROOM = 76, MYCELIUM = 57, DIRT = 2, PODZOL_META = 2;
export const isMushroom = (id) => id === BROWN_MUSHROOM || id === RED_MUSHROOM;

// World.getFullBlockLightValue. The game hooks the scene's light volume in as `world.fullLight`; without it (tests, generation) the sky
// column is walked through the block light opacities and `world.blockLight` supplies block light.
export function fullLight(world, x, y, z) {
  if (typeof world.fullLight === "function") return world.fullLight(x, y, z);
  let sky = 15;
  for (let yy = y + 1; yy < (world.height ?? 256) && sky > 0; yy++) sky -= lightOpacity(world.get(x, yy, z));
  return Math.max(Math.max(sky, 0), world.blockLight?.(x, y, z) ?? 0);
}

// BlockMushroom.canBlockStay.
export function mushroomCanStay(world, x, y, z, light = (a, b, c) => fullLight(world, a, b, c)) {
  if (y < 0 || y >= (world.height ?? 256)) return false;
  const below = world.get(x, y - 1, z);
  if (below === MYCELIUM || (below === DIRT && world.getMeta(x, y - 1, z) === PODZOL_META)) return true;
  return light(x, y, z) < 13 && normalCube(below);
}

// BlockMushroom.updateTick: with nextInt(25) === 0, give up when five of the same mushroom stand within +-4 x/z and +-1 y (the count includes
// the ticked block), then draw an offset (nextInt(3) - 1, nextInt(2) - nextInt(2), nextInt(3) - 1) and walk it up to four times to the
// last air cell that can hold a mushroom, and place the same block (metadata 0) at the final offset when it can. `rand` is a java.util.Random.
// Returns the placed cell [x, y, z] or null.
export function mushroomSpread(world, x, y, z, rand, light) {
  const id = world.get(x, y, z);
  if (rand.nextInt(25) !== 0) return null;
  let count = 5;
  for (let xx = x - 4; xx <= x + 4; xx++) for (let zz = z - 4; zz <= z + 4; zz++) for (let yy = y - 1; yy <= y + 1; yy++) if (world.get(xx, yy, zz) === id && --count <= 0) return null;
  const air = (a, b, c) => world.inside(a, b, c) && world.get(a, b, c) === 0;
  const draw = () => [rand.nextInt(3) - 1, rand.nextInt(2) - rand.nextInt(2), rand.nextInt(3) - 1];
  let [dx, dy, dz] = draw(), tx = x + dx, ty = y + dy, tz = z + dz;
  for (let i = 0; i < 4; i++) {
    if (air(tx, ty, tz) && mushroomCanStay(world, tx, ty, tz, light)) { x = tx; y = ty; z = tz; }
    [dx, dy, dz] = draw();
    tx = x + dx; ty = y + dy; tz = z + dz;
  }
  if (air(tx, ty, tz) && mushroomCanStay(world, tx, ty, tz, light)) return [tx, ty, tz];
  return null;
}
