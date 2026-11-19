// b84 drops84: the support-loss rules single player runs from main.js watchFlowers / carpetNeighbourChange, for the dedicated server's worlds (Overworld, Nether, End).
// Before this the server had none of them: a sign, ladder, flower, stem, cake, crop or carpet whose support was removed stayed floating (the client predicted the pop,
// client-prediction.js, and the server's tick then resent the cell). Each rule is the block's onNeighborBlockChange (bytecode-read in the earlier batches that ported them):
//   sign (signShouldPop), stem / cake (popDrops: seeds or nothing), flower (flowerCanStay), crop and farmland (farmNeighbourChange), ladder (ladderSupported),
//   snow layer (snowFalls: no drop) and carpet (carpetNeighbourChange). The block is removed with world.set, which notifies its own neighbours in turn, as in single player.
// `drop(stacks, x, y, z)` is the dimension's block drop (ServerItems.stacksDrop, native spread); the dimension's own signs / skull tiles go through `dropTiles` on the cell change.
import { LADDER, SNOW_LAYER, YELLOW_FLOWER, RED_FLOWER, isFlower } from '../world.js';
import { isSign, signShouldPop, signDrops } from '../signs.js';
import { isStemCake, popDrops } from '../stems-cake.js';
import { flowerCanStay } from '../flowers.js';
import { plantDropDamage } from '../plant-damage.js';
import { farmNeighbourChange } from '../farming.js';
import { ladderSupported } from '../ladders.js';
import { snowFalls } from '../snow.js';
import { carpetNeighbourChange } from '../colored-blocks.js';

const SIX = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };

export function watchSupportLoss(world, drop, farming = null) {
  const next = world.onChange;
  world.onChange = (x, y, z, old, now) => {
    next?.(x, y, z, old, now);
    for (const [dx, dy, dz] of SIX) {
      const fx = x + dx, fy = y + dy, fz = z + dz, b = world.get(fx, fy, fz);
      if (isSign(b) && signShouldPop(world, fx, fy, fz)) { world.set(fx, fy, fz, 0); drop(signDrops(), fx, fy, fz); continue; }
      if (isStemCake(b)) { const pop = popDrops(world, fx, fy, fz); if (pop) { world.set(fx, fy, fz, 0); drop(pop, fx, fy, fz); } continue; }
      if (!isFlower(b) || flowerCanStay(world, FLOWERS, fx, fy, fz)) continue;
      const meta = world.getMeta(fx, fy, fz), pd = plantDropDamage(b, meta);
      world.set(fx, fy, fz, 0);
      drop([{ id: b, count: 1, damage: pd?.damage ?? 0, rawDamage: pd?.tags?.rawDamage }], fx, fy, fz);
    }
    for (const c of farmNeighbourChange(world, x, y, z)) { if (c.drops.length) drop(c.drops, c.x, c.y, c.z); farming?.observe(c.x, c.y, c.z); }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = x + dx, lz = z + dz;
      if (world.get(lx, y, lz) !== LADDER || ladderSupported(world, lx, y, lz)) continue;
      world.set(lx, y, lz, 0);
      drop([{ id: LADDER, count: 1 }], lx, y, lz);
    }
    for (const [dx, dy, dz] of SIX) {
      const fx = x + dx, fy = y + dy, fz = z + dz;
      if (world.get(fx, fy, fz) === SNOW_LAYER && snowFalls(world, fx, fy, fz)) world.set(fx, fy, fz, 0); // no drop
    }
    for (const dy of [1, 0]) { const d = carpetNeighbourChange(world, x, y + dy, z); if (d) drop([d], x, y + dy, z); }
  };
  return world;
}
