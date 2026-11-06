// Block.randomDisplayTick of the emitters of "reddust" and "enchantmenttable", Java 1.7.10: BlockRedstoneWire (ana),
// the lit BlockRedstoneTorch (anc), the lit BlockRedstoneOre sparkle (amz, which draws from World.rand rather than
// the tick's Random), the powered BlockRedstoneRepeater (anf) and BlockEnchantmentTable (aks). Each takes the block
// cell with this build's ids resolved by the caller (display-ticks.js). Evidence: extra-particle-reference.json.
import { opaqueCube } from "./world.js";

const f = Math.fround;
const D22 = f(0.22), D27 = f(0.27);
const DELAY = [-0.0625, 0.0625, 0.1875, 0.3125];

// BlockRedstoneWire: a level above 0 spreads reddust over the cell, red from 0.4 and brighter with the level.
export function wireDisplay(world, x, y, z, random, fx) {
  const meta = world.getMeta(x, y, z);
  if (meta <= 0) return;
  const px = x + 0.5 + (random.nextFloat() - 0.5) * 0.2, py = f(y + f(0.0625)), pz = z + 0.5 + (random.nextFloat() - 0.5) * 0.2;
  const level = f(meta / 15), red = f(f(level * f(0.6)) + f(0.4));
  let green = f(f(f(level * level) * f(0.7)) - f(0.5)), blue = f(f(f(level * level) * f(0.6)) - f(0.7));
  if (green < 0) green = 0;
  if (blue < 0) blue = 0;
  fx.spawn("reddust", px, py, pz, red, green, blue);
}

// BlockRedstoneTorch (lit): one reddust 0.7 up, jittered +-0.1, 0.27 off a wall and 0.22 higher (meta 1-4).
export function redstoneTorchDisplay(world, x, y, z, random, fx) {
  const meta = world.getMeta(x, y, z);
  const d = f(f(x + f(0.5))) + f(random.nextFloat() - f(0.5)) * 0.2, d2 = f(f(y + f(0.7))) + f(random.nextFloat() - f(0.5)) * 0.2, d3 = f(f(z + f(0.5))) + f(random.nextFloat() - f(0.5)) * 0.2;
  if (meta === 1) fx.spawn("reddust", d - D27, d2 + D22, d3, 0, 0, 0);
  else if (meta === 2) fx.spawn("reddust", d + D27, d2 + D22, d3, 0, 0, 0);
  else if (meta === 3) fx.spawn("reddust", d, d2 + D22, d3 - D27, 0, 0, 0);
  else if (meta === 4) fx.spawn("reddust", d, d2 + D22, d3 + D27, 0, 0, 0);
  else fx.spawn("reddust", d, d2, d3, 0, 0, 0);
}

// BlockRedstoneOre.func_150185_e (sparkle), run by the lit ore's display tick and by touching an ore: six points,
// one per face, pushed 0.0625 out of the face when the neighbour is not opaque; only points outside the cell
// spawn. The lower test reads `y < 0` (not the cell's y), as the original does. `rand` is World.rand.
export function oreSparkle(world, x, y, z, rand, fx) {
  const d = 0.0625;
  const open = (a, b, c) => !opaqueCube(world.get(a, b, c));
  for (let i = 0; i < 6; i++) {
    let px = f(x + rand.nextFloat()), py = f(y + rand.nextFloat()), pz = f(z + rand.nextFloat());
    if (i === 0 && open(x, y + 1, z)) py = y + 1 + d;
    if (i === 1 && open(x, y - 1, z)) py = y + 0 - d;
    if (i === 2 && open(x, y, z + 1)) pz = z + 1 + d;
    if (i === 3 && open(x, y, z - 1)) pz = z + 0 - d;
    if (i === 4 && open(x + 1, y, z)) px = x + 1 + d;
    if (i === 5 && open(x - 1, y, z)) px = x + 0 - d;
    if (px < x || px > x + 1 || py < 0 || py > y + 1 || pz < z || pz > z + 1) fx.spawn("reddust", px, py, pz, 0, 0, 0);
  }
}

// BlockRedstoneRepeater (powered): one reddust on a torch, half the time at the fixed torch and otherwise sliding
// along the delay slot (-0.0625, 0.0625, 0.1875 or 0.3125).
export function repeaterDisplay(world, x, y, z, random, fx) {
  const meta = world.getMeta(x, y, z), dir = meta & 3;
  const px = f(f(x + f(0.5))) + f(random.nextFloat() - f(0.5)) * 0.2, py = f(f(y + f(0.4))) + f(random.nextFloat() - f(0.5)) * 0.2, pz = f(f(z + f(0.5))) + f(random.nextFloat() - f(0.5)) * 0.2;
  let dx = 0, dz = 0;
  if (random.nextInt(2) === 0) {
    if (dir === 0) dz = -0.3125;
    else if (dir === 1) dx = 0.3125;
    else if (dir === 2) dz = 0.3125;
    else dx = -0.3125;
  } else {
    const slot = DELAY[(meta & 12) >> 2];
    if (dir === 0) dz = slot;
    else if (dir === 1) dx = -slot;
    else if (dir === 2) dz = -slot;
    else dx = slot;
  }
  fx.spawn("reddust", px + dx, py, pz + dz, 0, 0, 0);
}

// BlockEnchantmentTable: on one tick in 16 for each cell of the 5x5 ring (the two cells beside the table's row
// skipped), a bookshelf in the table's layer or the one above with an open cell halfway to the table sends a glyph
// from above the table toward it. `isShelf(x, y, z)` and `isAir(x, y, z)` read this build's cells.
export function enchantTableDisplay(world, x, y, z, random, fx, isShelf, isAir) {
  for (let i = x - 2; i <= x + 2; i++)
    for (let k = z - 2; k <= z + 2; k++) {
      if (i > x - 2 && i < x + 2 && k === z - 1) k = z + 2;
      if (random.nextInt(16) !== 0) continue;
      for (let j = y; j <= y + 1; j++) {
        if (!isShelf(i, j, k)) continue;
        if (!isAir(Math.trunc((i - x) / 2) + x, j, Math.trunc((k - z) / 2) + z)) break;
        fx.spawn("enchantmenttable", x + 0.5, y + 2.0, z + 0.5,
          f(f(i - x) + random.nextFloat()) - 0.5, f(f(f(j - y) - random.nextFloat()) - 1), f(f(k - z) + random.nextFloat()) - 0.5);
      }
    }
}
