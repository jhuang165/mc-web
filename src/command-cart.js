// EntityMinecartCommandBlock (xn) with its CommandBlockLogic (xo extends agp): the cart's command runs from an
// activator rail (cart-variants.js activatorPass, at most once per 4 ticks while the rail is powered) with the cart as
// the sender (xo.f_ = ChunkCoordinates(floor x, floor(y + 0.5), floor z)). Evidence: public/research/polish.md.
import { createCommandRunner } from './commands.js';
import { commandBlockSender } from './command-block.js';

export const cartCommandPosition = (cart) => ({ x: Math.floor(cart.x), y: Math.floor(cart.posY + 0.5), z: Math.floor(cart.z) });

// CommandBlockLogic.func_145755_a(world): successCount = the command's result (0 when empty).
export function runCommandCart(cart, { host, changed = () => {} }) {
  const tile = cart.command;
  if (!tile) return 0;
  const sender = commandBlockSender(host, tile, cartCommandPosition(cart));
  // Watcher 24 only follows addChatMessage output (agp.a(fj) -> e()), the GUI's setCommand + e() and readEntityFromNBT (cart-variants.js), never a run itself: a fresh cart reads "" whether or not it ran (executed).
  tile.outputChanged = () => { tile.watch24 = tile.lastOutput; };
  try { tile.successCount = tile.command ? (createCommandRunner(sender).run(tile.command) ? 1 : 0) : 0; } finally { delete tile.outputChanged; }
  changed();
  return tile.successCount;
}
