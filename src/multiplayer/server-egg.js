// Batch 65 mpdragon2: BlockDragonEgg on the dedicated server (onBlockActivated and onBlockClicked both call func_150018_e = akp.m, bytecode-read b65).
//   * The server half moves the egg: up to 1000 random targets (nextInt(16) - nextInt(16), nextInt(8) - nextInt(8), nextInt(16) - nextInt(16)); the first cell of Material.air gets the egg
//     (setBlock flags 2, same metadata) and the old cell is cleared. dragon-egg.js teleportEgg is the same rule single player runs.
//   * Particles: NOT sent by the server. akp.m draws the 128 "portal" particles only when World.isRemote, from the CLICKING client's own world random (a different target than the server's),
//     and the other players see none. The client half (dragon-egg-live.js clientDragonEgg, main.js `eggClient`) already runs on a click, so nothing is sent.
//   * Clicks: right click without sneak-with-an-item (ItemInWorldManager.activateBlock), and a Survival punch (status 0 -> onBlockClicked); a Creative punch returns before onBlockClicked
//     and breaks the egg (mx.a(IIII)V: isCreative -> tryHarvestBlock, bytecode-read).
import { JavaRandom } from '../java-random.js';
import { DRAGON_EGG, teleportEgg } from '../dragon-egg.js';

const rand = new JavaRandom(Math.floor(Math.random() * 2 ** 48));

// `world` is the clicker's dimension world. True when the cell held an egg (it moved, or lost its place when the target was outside the world).
export function serverDragonEgg(world, x, y, z, random = rand) {
  const meta = world.getMeta?.(x, y, z) ?? 0;
  return teleportEgg(x, y, z, random, false, {
    isEgg: (i, j, k) => world.get(i, j, k) === DRAGON_EGG,
    isAir: (i, j, k) => world.get(i, j, k) === 0,
    place: (i, j, k) => { world.set(i, j, k, DRAGON_EGG, true, meta); },
    clear: (i, j, k) => { world.set(i, j, k, 0, true, 0); },
    particle() {},
  });
}
