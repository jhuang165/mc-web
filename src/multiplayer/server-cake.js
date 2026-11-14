// Batch 72 cakefog72: BlockCake on the dedicated server. onBlockActivated (right click) and onBlockClicked (a Survival punch, status 0) both call the same
// eat method (aju.b, bytecode-read): canEat(false), addStats(2, 0.1), metadata + 1, the cell cleared at 6. `cakeEat` (stems-cake.js) is the single-player rule.
// The food change reaches the player through the S06 vitals check; the block change through the world's dirty cells.
import { CAKE, cakeEat } from '../stems-cake.js';

// True when the cell holds a cake (the click is consumed whether or not a slice was eaten).
export function serverCakeEat(world, survival, x, y, z) {
  if (world.get(x, y, z) !== CAKE) return false;
  const eaten = cakeEat(survival, world, x, y, z);
  if (eaten.ate) world.set(x, y, z, eaten.next === null ? 0 : CAKE, true, eaten.next ?? 0);
  return true;
}
