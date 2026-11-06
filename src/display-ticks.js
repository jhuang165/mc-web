import { portalDisplayTick } from "./nether-portal.js";
// WorldClient.doVoidFogParticles (bjf.C), Java 1.7.10: each client tick 1000 cells within
// 15 blocks of the viewer (x + rand.nextInt(16) - rand.nextInt(16) on each axis, from the
// client World.rand) get Block.randomDisplayTick with one fresh, unseeded Random. An air cell
// below y 8 instead rolls the void-fog "depthsuspend" (nextInt(8) > y) from World.rand.
// The display ticks here are the original ones of this build's blocks: BlockTorch (aoc),
// the lit BlockFurnace (ale), BlockFire (alb), BlockLeaves (alt) and BlockLiquid (alw).
// Particles go through World.spawnParticle (fx.spawn, RenderGlobal's filter), sounds
// through `sound(name, x, y, z, volume, pitch)`. Evidence: public/research/particles.md.
import { JavaRandom } from "./lighting.js";
import { WATER, LAVA, FIRE, SNOW_LAYER, normalCube } from "./world.js";
import { canCatchFire } from "./fire.js";
import { blocksMovement } from "./plants.js";
import { isStair, stairSolidTop } from "./stairs.js";
import { wireDisplay, redstoneTorchDisplay, oreSparkle, repeaterDisplay, enchantTableDisplay } from "./redstone-particles.js";

const f = Math.fround;
const TORCH = 20, FURNACE = 14, LEAVES = 5;
// This build's ids: lit redstone torch, wire, lit ore, repeater, enchanting table, bookshelf.
const RS_TORCH = 120, RS_WIRE = 107, RS_ORE_LIT = 65, REPEATER = 112, ENCHANT_TABLE = 86, BOOKSHELF = 21;

// World.doesBlockHaveSolidTopSurface: an opaque full cube, or a full snow layer (meta 7).
export function solidTopSurface(world, x, y, z) {
  const b = world.get(x, y, z);
  if (isStair(b)) return stairSolidTop(world.getMeta(x, y, z));
  if (b === 165) return (world.getMeta(x, y, z) & 8) !== 0; // a top wood slab (shaped-blocks.js)
  if (b === 103) return (world.getMeta(x, y, z) & 8) !== 0; // a top stone slab (stone-utility.js STONE_SLAB)
  if (b === 104) return true; // the end portal frame counts as a solid top (fence-rail-reference.json)
  return normalCube(b) || (b === SNOW_LAYER && (world.getMeta(x, y, z) & 7) === 7);
}

// `rand` is the client World.rand, shared with RenderGlobal's filter; `lit(x, y, z)` says
// whether a furnace is burning; `canStrike(x, y, z)` is World.canLightningStrikeAt for the leaves.
export function displayTicks(world, cx, cy, cz, { rand, fx, repeaterLit = () => false, sound = () => {}, lit = () => false, canStrike = () => false, voidFog = true, random = new JavaRandom(Math.floor(Math.random() * 2 ** 48)) }) {
  for (let i = 0; i < 1000; i++) {
    const x = cx + rand.nextInt(16) - rand.nextInt(16), y = cy + rand.nextInt(16) - rand.nextInt(16), z = cz + rand.nextInt(16) - rand.nextInt(16);
    const b = world.get(x, y, z);
    if (b === 0) {
      // WorldProvider.getWorldHasVoidParticles: the default surface world.
      if (rand.nextInt(8) <= y || !voidFog) continue;
      fx.spawn("depthsuspend", f(x + rand.nextFloat()), f(y + rand.nextFloat()), f(z + rand.nextFloat()));
      continue;
    }
    randomDisplayTick(world, x, y, z, b, random, { fx, sound, lit, canStrike, repeaterLit, worldRand: rand });
  }
}

export function randomDisplayTick(world, x, y, z, b, random, { fx, sound = () => {}, lit = () => false, canStrike = () => false, repeaterLit = () => false, worldRand = random }) {
  if (b === TORCH) torch(world, x, y, z, fx);
  else if (b === FURNACE) {
    if (lit(x, y, z)) furnace(x, y, z, random, fx);
  } else if (b === FIRE) fire(world, x, y, z, random, fx, sound);
  else if (b === LEAVES) {
    // BlockLeaves.randomDisplayTick: a drip under rain-exposed leaves with nothing solid below.
    if (canStrike(x, y + 1, z) && !solidTopSurface(world, x, y - 1, z) && random.nextInt(15) === 1)
      fx.spawn("dripWater", f(x + random.nextFloat()), y - 0.05, f(z + random.nextFloat()));
  } else if (b === 164) portalDisplayTick(world, x, y, z, random, fx, sound); // Nether portal
  else if (b === WATER || b === LAVA) liquid(world, x, y, z, b, random, fx, sound);
  else if (b === RS_TORCH) redstoneTorchDisplay(world, x, y, z, random, fx);
  else if (b === RS_WIRE) wireDisplay(world, x, y, z, random, fx);
  else if (b === RS_ORE_LIT) oreSparkle(world, x, y, z, worldRand, fx);
  else if (b === REPEATER) {
    if (repeaterLit(x, y, z)) repeaterDisplay(world, x, y, z, random, fx);
  } else if (b === ENCHANT_TABLE) enchantTableDisplay(world, x, y, z, random, fx, (i, j, k) => world.get(i, j, k) === BOOKSHELF, (i, j, k) => world.get(i, j, k) === 0);
}

// BlockTorch.randomDisplayTick: smoke then flame 0.7 up, pushed 0.27 off a wall (meta 1-4)
// and 0.22 higher.
function torch(world, x, y, z, fx) {
  const meta = world.getMeta(x, y, z), d = f(x + f(0.5)), d2 = f(y + f(0.7)), d3 = f(z + f(0.5)), d4 = f(0.22), d5 = f(0.27);
  const [px, py, pz] = meta === 1 ? [d - d5, d2 + d4, d3] : meta === 2 ? [d + d5, d2 + d4, d3] : meta === 3 ? [d, d2 + d4, d3 - d5] : meta === 4 ? [d, d2 + d4, d3 + d5] : [d, d2, d3];
  fx.spawn("smoke", px, py, pz);
  fx.spawn("flame", px, py, pz);
}

// BlockFurnace.randomDisplayTick (lit only): smoke and flame 0.52 out from the front, at a
// random height in the lower 6/16 and +-0.3 along the face. This build's furnace front faces
// +z, which is metadata 3.
function furnace(x, y, z, random, fx) {
  const fx0 = f(x + f(0.5)), f2 = f(f(y + 0) + f(f(random.nextFloat() * 6) / 16)), f3 = f(z + f(0.5)), f4 = f(0.52), f5 = f(f(random.nextFloat() * f(0.6)) - f(0.3));
  const px = f(fx0 + f5), pz = f(f3 + f4);
  fx.spawn("smoke", px, f2, pz);
  fx.spawn("flame", px, f2, pz);
}

// BlockFire.randomDisplayTick: the crackle one time in 24, then three largesmoke over a solid
// or burnable floor, else two by each burnable side and the burnable block above.
function fire(world, x, y, z, random, fx, sound) {
  if (random.nextInt(24) === 0) sound("fire.fire", f(x + f(0.5)), f(y + f(0.5)), f(z + f(0.5)), f(1 + random.nextFloat()), f(f(random.nextFloat() * f(0.7)) + f(0.3)));
  const nf = () => random.nextFloat(), smoke = (a, b, c) => fx.spawn("largesmoke", a, b, c);
  if (solidTopSurface(world, x, y - 1, z) || canCatchFire(world, x, y - 1, z)) {
    for (let i = 0; i < 3; i++) {
      const a = f(x + nf()), b = f(f(y + f(nf() * f(0.5))) + f(0.5)), c = f(z + nf());
      smoke(a, b, c);
    }
    return;
  }
  const two = (pos) => {
    for (let i = 0; i < 2; i++) smoke(...pos());
  };
  if (canCatchFire(world, x - 1, y, z)) two(() => [f(x + f(nf() * f(0.1))), f(y + nf()), f(z + nf())]);
  if (canCatchFire(world, x + 1, y, z)) two(() => [f(x + 1 - f(nf() * f(0.1))), f(y + nf()), f(z + nf())]);
  if (canCatchFire(world, x, y, z - 1)) two(() => [f(x + nf()), f(y + nf()), f(z + f(nf() * f(0.1)))]);
  if (canCatchFire(world, x, y, z + 1)) two(() => [f(x + nf()), f(y + nf()), f(z + 1 - f(nf() * f(0.1)))]);
  if (canCatchFire(world, x, y + 1, z)) two(() => [f(x + nf()), f(y + 1 - f(nf() * f(0.1))), f(z + nf())]);
}

// BlockLiquid.randomDisplayTick: water suspends particles in still or falling cells and
// gurgles in flowing ones; lava under air pops "lava" particles and plays its ambience; both
// drip from a ceiling that rests on a solid top over open space.
function liquid(world, x, y, z, b, random, fx, sound) {
  const water = b === WATER;
  if (water) {
    if (random.nextInt(10) === 0) {
      const meta = world.getMeta(x, y, z);
      if (meta <= 0 || meta >= 8) fx.spawn("suspended", f(x + random.nextFloat()), f(y + random.nextFloat()), f(z + random.nextFloat()));
    }
    if (random.nextInt(64) === 0) {
      const meta = world.getMeta(x, y, z);
      if (meta > 0 && meta < 8) sound("liquid.water", f(x + f(0.5)), f(y + f(0.5)), f(z + f(0.5)), f(f(random.nextFloat() * f(0.25)) + f(0.75)), f(f(random.nextFloat() * 1) + f(0.5)));
    }
  } else if (world.get(x, y + 1, z) === 0) {
    if (random.nextInt(100) === 0) {
      const d = f(x + random.nextFloat()), d6 = y + 1, d7 = f(z + random.nextFloat());
      fx.spawn("lava", d, d6, d7);
      sound("liquid.lavapop", d, d6, d7, f(f(0.2) + f(random.nextFloat() * f(0.2))), f(f(0.9) + f(random.nextFloat() * f(0.15))));
    }
    if (random.nextInt(200) === 0) sound("liquid.lava", x, y, z, f(f(0.2) + f(random.nextFloat() * f(0.2))), f(f(0.9) + f(random.nextFloat() * f(0.15))));
  }
  if (random.nextInt(10) === 0 && solidTopSurface(world, x, y - 1, z) && !blocksMovement(world.get(x, y - 2, z)))
    fx.spawn(water ? "dripWater" : "dripLava", f(x + random.nextFloat()), y - 1.05, f(z + random.nextFloat()));
}
